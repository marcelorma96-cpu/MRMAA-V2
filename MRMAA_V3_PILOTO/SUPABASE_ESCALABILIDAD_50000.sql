-- MRMAA: consultas e índices para 50,000+ registros.
-- Ejecutar una sola vez en Supabase SQL Editor después de los scripts V2.

create extension if not exists pg_trgm with schema extensions;

create index if not exists v2_clients_search_name_idx
  on public.v2_clients using gin (name extensions.gin_trgm_ops)
  where deleted_at is null;
create index if not exists v2_clients_search_phone_idx
  on public.v2_clients using gin (phone extensions.gin_trgm_ops)
  where deleted_at is null;
create index if not exists v2_clients_search_email_idx
  on public.v2_clients using gin (email extensions.gin_trgm_ops)
  where deleted_at is null;
create index if not exists v2_clients_identity_name_idx
  on public.v2_clients(restaurant_id,lower(name)) where deleted_at is null;
create index if not exists v2_clients_identity_email_idx
  on public.v2_clients(restaurant_id,lower(email)) where deleted_at is null and email is not null;
create index if not exists v2_clients_identity_phone_idx
  on public.v2_clients(restaurant_id,(regexp_replace(coalesce(phone,''),'\D','','g')))
  where deleted_at is null and phone is not null;
create index if not exists v2_quotes_restaurant_date_idx
  on public.v2_quotes(restaurant_id,event_date desc,event_time)
  where deleted_at is null;
create index if not exists v2_quotes_restaurant_status_idx
  on public.v2_quotes(restaurant_id,status,quote_number desc)
  where deleted_at is null;
create index if not exists v2_quotes_search_client_idx
  on public.v2_quotes using gin (client_name extensions.gin_trgm_ops)
  where deleted_at is null;
create index if not exists v2_reservations_restaurant_status_idx
  on public.v2_reservations(restaurant_id,status,event_date,event_time)
  where deleted_at is null;
create index if not exists v2_reservations_search_client_idx
  on public.v2_reservations using gin (client_name extensions.gin_trgm_ops)
  where deleted_at is null;
create index if not exists v2_quote_items_quote_position_idx
  on public.v2_quote_items(quote_id,position);

-- STORAGE_BEGIN: Los logos nuevos se guardan como archivos, no como Base64 dentro de cada fila.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mrmaa-branding','mrmaa-branding',true,8388608,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists mrmaa_branding_admin_insert on storage.objects;
drop policy if exists mrmaa_branding_admin_update on storage.objects;
drop policy if exists mrmaa_branding_admin_delete on storage.objects;
create policy mrmaa_branding_admin_insert on storage.objects for insert to authenticated
  with check(bucket_id='mrmaa-branding' and public.v2_current_admin((storage.foldername(name))[1]::uuid));
create policy mrmaa_branding_admin_update on storage.objects for update to authenticated
  using(bucket_id='mrmaa-branding' and public.v2_current_admin((storage.foldername(name))[1]::uuid))
  with check(bucket_id='mrmaa-branding' and public.v2_current_admin((storage.foldername(name))[1]::uuid));
create policy mrmaa_branding_admin_delete on storage.objects for delete to authenticated
  using(bucket_id='mrmaa-branding' and public.v2_current_admin((storage.foldername(name))[1]::uuid));
-- STORAGE_END

create or replace function public.v2_find_duplicate_client(
  p_restaurant_id uuid, p_name text, p_phone text default '', p_email text default '', p_exclude_id uuid default null
)
returns table(id uuid, name text, match_reason text)
language sql stable security invoker set search_path = public
as $$
  select c.id,c.name,
    case
      when nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),'') is not null
       and regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(coalesce(p_phone,''),'\D','','g') then 'teléfono'
      when nullif(lower(trim(coalesce(p_email,''))),'') is not null
       and lower(trim(coalesce(c.email,'')))=lower(trim(p_email)) then 'correo electrónico'
      else 'nombre'
    end
  from public.v2_clients c
  where c.restaurant_id=p_restaurant_id and c.deleted_at is null
    and (p_exclude_id is null or c.id<>p_exclude_id)
    and (
      (nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),'') is not null and regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(coalesce(p_phone,''),'\D','','g'))
      or (nullif(lower(trim(coalesce(p_email,''))),'') is not null and lower(trim(coalesce(c.email,'')))=lower(trim(p_email)))
      or (nullif(trim(coalesce(p_phone,'')),'') is null and nullif(trim(coalesce(p_email,'')),'') is null and lower(trim(c.name))=lower(trim(p_name)))
    )
    and public.v2_can_read(p_restaurant_id)
  order by case when regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(coalesce(p_phone,''),'\D','','g') then 0 else 1 end
  limit 1;
$$;

revoke all on function public.v2_find_duplicate_client(uuid,text,text,text,uuid) from public;
grant execute on function public.v2_find_duplicate_client(uuid,text,text,text,uuid) to authenticated;

create or replace function public.v2_find_or_create_client(
  p_restaurant_id uuid, p_name text, p_phone text default '', p_email text default ''
)
returns uuid
language plpgsql security invoker set search_path = public
as $$
declare client_uuid uuid;
begin
  if not public.v2_can_operate(p_restaurant_id) then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then
    raise exception 'El nombre del cliente es obligatorio.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text || ':' || lower(trim(p_name)) || ':' || regexp_replace(coalesce(p_phone,''),'\D','','g') || ':' || lower(trim(coalesce(p_email,'')))));
  select d.id into client_uuid
  from public.v2_find_duplicate_client(p_restaurant_id,p_name,p_phone,p_email,null) d limit 1;
  if client_uuid is null then
    insert into public.v2_clients(restaurant_id,name,phone,email,notes)
    values(p_restaurant_id,trim(p_name),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_email,'')),''),null)
    returning id into client_uuid;
  end if;
  return client_uuid;
end;
$$;

revoke all on function public.v2_find_or_create_client(uuid,text,text,text) from public;
grant execute on function public.v2_find_or_create_client(uuid,text,text,text) to authenticated;

create or replace function public.v2_reservation_summary(
  p_restaurant_id uuid,
  p_mode text default 'all',
  p_date date default current_date,
  p_from date default null,
  p_to date default null,
  p_search text default ''
)
returns table(reservations bigint, people numeric, deposits numeric)
language sql stable security invoker set search_path = public
as $$
  select count(*)::bigint,
         coalesce(sum(r.guests),0)::numeric,
         coalesce(sum(r.deposit),0)::numeric
  from public.v2_reservations r
  where r.restaurant_id = p_restaurant_id
    and r.deleted_at is null
    and case
      when p_mode in ('today','single') then r.event_date = p_date
      when p_mode = 'range' then r.event_date between p_from and p_to
      else true
    end
    and (coalesce(trim(p_search),'') = '' or concat_ws(' ',r.client_name,r.phone,r.area,r.menu,r.notes,r.status) ilike '%' || trim(p_search) || '%')
    and public.v2_can_read(p_restaurant_id);
$$;

revoke all on function public.v2_reservation_summary(uuid,text,date,date,date,text) from public;
grant execute on function public.v2_reservation_summary(uuid,text,date,date,date,text) to authenticated;

create or replace function public.v2_report_rows(
  p_restaurant_id uuid,
  p_kind text,
  p_from date,
  p_to date,
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table(row_data jsonb, total_count bigint)
language plpgsql stable security invoker set search_path = public
as $$
begin
  if not public.v2_current_admin(p_restaurant_id) then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;

  if p_kind = 'frequent' then
    return query
    with raw as (
      select jsonb_build_object(
        'Cliente',c.name,'Telefono',coalesce(c.phone,''),
        'Reservaciones',count(r.id),'Invitados',coalesce(sum(r.guests),0),
        'Ultima',coalesce(to_char(max(r.event_date),'DD/MM/YYYY'),'—')
      ) data, count(r.id) sort_value
      from public.v2_clients c
      join public.v2_reservations r on r.restaurant_id=c.restaurant_id
        and (r.client_id=c.id or (r.client_id is null and lower(r.client_name)=lower(c.name)))
        and r.deleted_at is null and r.event_date between p_from and p_to
      where c.restaurant_id=p_restaurant_id and c.deleted_at is null
      group by c.id,c.name,c.phone
    ), filtered as (select * from raw where trim(p_search)='' or data::text ilike '%'||trim(p_search)||'%')
    select data,count(*) over() from filtered order by sort_value desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
  elsif p_kind in ('reserved','pending','approved','deposits') then
    return query
    with raw as (
      select case
        when p_kind='reserved' then jsonb_build_object('Fecha',to_char(r.event_date,'DD/MM/YYYY'),'Hora',left(coalesce(r.event_time::text,''),5),'Cliente',r.client_name,'Telefono',coalesce(r.phone,''),'Area',coalesce(r.area,''),'Invitados',r.guests,'Estado',r.status)
        when p_kind='deposits' then jsonb_build_object('Fecha',to_char(r.event_date,'DD/MM/YYYY'),'Cliente',r.client_name,'Origen','Reservación','Anticipo',r.deposit,'Metodo',coalesce(r.payment_method,'Sin especificar'))
      end data, r.event_date sort_date
      from public.v2_reservations r
      where r.restaurant_id=p_restaurant_id and r.deleted_at is null and r.event_date between p_from and p_to
        and (p_kind='reserved' or (p_kind='deposits' and coalesce(r.deposit,0)>0))
      union all
      select case
        when p_kind='pending' then jsonb_build_object('Numero','#'||q.quote_number,'Fecha',to_char(q.event_date,'DD/MM/YYYY'),'Cliente',q.client_name,'Telefono',coalesce(q.client_phone,''),'Total',q.total,'Estado',q.status)
        when p_kind='approved' then jsonb_build_object('Numero','#'||q.quote_number,'Fecha',to_char(q.event_date,'DD/MM/YYYY'),'Cliente',q.client_name,'Venta',q.total,'Anticipo',q.deposit,'Saldo',q.balance)
        when p_kind='deposits' then jsonb_build_object('Fecha',to_char(q.event_date,'DD/MM/YYYY'),'Cliente',q.client_name,'Origen','Cotización #'||q.quote_number,'Anticipo',q.deposit,'Metodo',coalesce(q.payment_method,'Sin especificar'))
      end data, q.event_date sort_date
      from public.v2_quotes q
      where q.restaurant_id=p_restaurant_id and q.deleted_at is null and q.event_date between p_from and p_to
        and ((p_kind='pending' and q.status not in ('convertida','aprobada'))
          or (p_kind='approved' and q.status in ('convertida','aprobada'))
          or (p_kind='deposits' and coalesce(q.deposit,0)>0 and not exists(select 1 from public.v2_reservations r where r.quote_id=q.id and r.deleted_at is null)))
    ), filtered as (select * from raw where data is not null and (trim(p_search)='' or data::text ilike '%'||trim(p_search)||'%'))
    select data,count(*) over() from filtered order by sort_date desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
  elsif p_kind = 'employees' then
    return query
    with raw as (
      select jsonb_build_object(
        'Empleado',e.name,'Codigo',coalesce(e.employee_code,''),'Area',coalesce(max(a.name),'Sin área'),
        'Dias',count(*) filter (where s.shift_id is not null and lower(coalesce(s.notes,'')) not like '%descanso%' and lower(coalesce(s.notes,'')) not like '%permiso%'),
        'HorasNetas',round(coalesce(sum(case when s.shift_id is not null then greatest(0,
          extract(epoch from ((case when sh.end_time>=sh.start_time then sh.end_time-sh.start_time else sh.end_time-sh.start_time+interval '24 hours' end)))/3600 - coalesce(sh.break_minutes,0)/60.0) else 0 end),0)::numeric,2),
        'HorasComida',round(coalesce(sum(case when s.shift_id is not null then coalesce(sh.break_minutes,0)/60.0 else 0 end),0)::numeric,2),
        'Descansos',count(*) filter (where lower(coalesce(s.notes,'')) like '%descanso%' or lower(coalesce(s.notes,'')) like '%día libre%' or lower(coalesce(s.notes,'')) like '%dia libre%'),
        'Permisos',count(*) filter (where lower(coalesce(s.notes,'')) like '%permiso%')
      ) data,e.name sort_name
      from public.v2_employees e
      left join public.v2_schedules s on s.employee_id=e.id and s.work_date between p_from and p_to
      left join public.v2_shifts sh on sh.id=s.shift_id
      left join public.v2_areas a on a.id=coalesce(s.area_id,e.area_id)
      where e.restaurant_id=p_restaurant_id
      group by e.id,e.name,e.employee_code
    ), filtered as (select * from raw where trim(p_search)='' or data::text ilike '%'||trim(p_search)||'%')
    select data,count(*) over() from filtered order by sort_name offset greatest(p_offset,0) limit least(greatest(p_limit,1),1000);
  else
    raise exception 'Tipo de reporte no válido.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.v2_report_rows(uuid,text,date,date,text,integer,integer) from public;
grant execute on function public.v2_report_rows(uuid,text,date,date,text,integer,integer) to authenticated;

create or replace function public.v2_import_reservations(p_restaurant_id uuid, p_rows jsonb)
returns table(created integer, updated integer, unchanged integer)
language plpgsql security invoker set search_path = public
as $$
declare
  item jsonb;
  client_uuid uuid;
  reservation_uuid uuid;
  old_row public.v2_reservations%rowtype;
  new_phone text;
  new_time time;
begin
  if not public.v2_can_operate(p_restaurant_id) then
    raise exception 'Acceso denegado.' using errcode = '42501';
  end if;
  created := 0; updated := 0; unchanged := 0;
  for item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    new_phone := nullif(trim(coalesce(item->>'phone','')),'');
    new_time := nullif(item->>'event_time','')::time;
    select c.id into client_uuid from public.v2_clients c
      where c.restaurant_id=p_restaurant_id and c.deleted_at is null
        and ((new_phone is not null and regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(new_phone,'\D','','g'))
          or lower(c.name)=lower(trim(item->>'client_name')))
      order by case when new_phone is not null and regexp_replace(coalesce(c.phone,''),'\D','','g')=regexp_replace(new_phone,'\D','','g') then 0 else 1 end
      limit 1;
    if client_uuid is null then
      insert into public.v2_clients(restaurant_id,name,phone,email,notes)
      values(p_restaurant_id,trim(item->>'client_name'),new_phone,null,'Creado desde importación de reservaciones')
      returning id into client_uuid;
    end if;

    select r.* into old_row from public.v2_reservations r
      where r.restaurant_id=p_restaurant_id and r.deleted_at is null
        and lower(r.client_name)=lower(trim(item->>'client_name'))
        and r.event_date=(item->>'event_date')::date
        and coalesce(r.event_time,'00:00'::time)=coalesce(new_time,'00:00'::time)
      order by r.created_at limit 1;
    reservation_uuid := old_row.id;
    if reservation_uuid is null then
      insert into public.v2_reservations(restaurant_id,client_id,client_name,phone,event_date,event_time,area,guests,menu,deposit,payment_method,status,notes,subtotal,discount_pct,tip_pct,total,balance)
      values(p_restaurant_id,client_uuid,trim(item->>'client_name'),coalesce(new_phone,''),(item->>'event_date')::date,new_time,
        coalesce(item->>'area',''),nullif(item->>'guests','')::integer,coalesce(item->>'menu',''),nullif(item->>'deposit','')::numeric,
        coalesce(item->>'payment_method',''),coalesce(item->>'status',''),coalesce(item->>'notes',''),0,0,0,0,0);
      created := created + 1;
    elsif row(old_row.client_id,old_row.phone,old_row.area,old_row.guests,old_row.menu,old_row.deposit,old_row.payment_method,old_row.status,old_row.notes)
      is not distinct from row(client_uuid,coalesce(new_phone,''),coalesce(item->>'area',''),nullif(item->>'guests','')::integer,coalesce(item->>'menu',''),nullif(item->>'deposit','')::numeric,coalesce(item->>'payment_method',''),coalesce(item->>'status',''),coalesce(item->>'notes','')) then
      unchanged := unchanged + 1;
    else
      update public.v2_reservations set client_id=client_uuid,phone=coalesce(new_phone,''),area=coalesce(item->>'area',''),
        guests=nullif(item->>'guests','')::integer,menu=coalesce(item->>'menu',''),deposit=nullif(item->>'deposit','')::numeric,
        payment_method=coalesce(item->>'payment_method',''),status=coalesce(item->>'status',''),notes=coalesce(item->>'notes','')
      where id=reservation_uuid;
      updated := updated + 1;
    end if;
    client_uuid := null; reservation_uuid := null; old_row := null;
  end loop;
  return next;
end;
$$;

revoke all on function public.v2_import_reservations(uuid,jsonb) from public;
grant execute on function public.v2_import_reservations(uuid,jsonb) to authenticated;

analyze public.v2_clients;
analyze public.v2_quotes;
analyze public.v2_quote_items;
analyze public.v2_reservations;
analyze public.v2_schedules;

notify pgrst, 'reload schema';
