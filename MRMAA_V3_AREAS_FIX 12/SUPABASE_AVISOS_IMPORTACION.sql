-- Ejecutar completo una sola vez. Es repetible y no elimina información.
begin;

create or replace function public.v2_reservation_area_similar(left_value text, right_value text)
returns boolean language sql immutable set search_path=public as $$
  with keys as (
    select trim(regexp_replace(public.v2_area_key(left_value),'[^a-z0-9]+',' ','g')) as a,
      trim(regexp_replace(public.v2_area_key(right_value),'[^a-z0-9]+',' ','g')) as b
  )
  select a<>'' and b<>'' and (
    a=b
    or (least(length(a),length(b))>=3 and (
      string_to_array(a,' ') <@ string_to_array(b,' ')
      or string_to_array(b,' ') <@ string_to_array(a,' ')
    ))
  ) from keys
$$;

create or replace function public.v2_nearby_reservations(
 p_restaurant uuid,p_area uuid,p_date date,p_time time,p_exclude uuid default null)
returns table(id uuid,event_time time,guests integer)
language sql stable security invoker set search_path=public as $$
 select r.id,r.event_time,r.guests::integer from public.v2_reservations r
 join public.v2_reservation_areas a on a.id=p_area and a.restaurant_id=p_restaurant
 where r.restaurant_id=p_restaurant and r.event_date=p_date and r.deleted_at is null
 and (p_exclude is null or r.id<>p_exclude)
 and (r.area_id=p_area or public.v2_reservation_area_similar(r.area,a.name))
 and coalesce(lower(r.status),'') not in ('cancelada','cancelado','cancelled','canceled')
 and r.event_time is not null
 and abs(extract(epoch from (r.event_time-p_time)))<=10800
 order by r.event_time,r.id limit 11
$$;
revoke all on function public.v2_nearby_reservations(uuid,uuid,date,time,uuid) from public,anon;
grant execute on function public.v2_nearby_reservations(uuid,uuid,date,time,uuid) to authenticated;

create or replace function public.v2_import_reservation_warnings(p_restaurant_id uuid, p_rows jsonb)
returns table(client_name text,event_date date,event_time time,area text,nearby_client text,nearby_time time)
language plpgsql stable security invoker set search_path=public as $$
begin
  if not public.v2_can_operate(p_restaurant_id) then
    raise exception 'Acceso denegado.' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb)) <> 'array' then
    raise exception 'Formato de importación inválido.';
  end if;
  if jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) > 5000 then
    raise exception 'La importación admite un máximo de 5,000 filas por archivo.';
  end if;
  return query
  with parsed as (
    select ordinality::bigint as row_number,
      trim(value->>'client_name') as imported_client,
      (value->>'event_date')::date as imported_date,
      nullif(value->>'event_time','')::time as imported_time,
      trim(coalesce(value->>'area','')) as imported_area,
      lower(trim(coalesce(value->>'status',''))) as imported_status
    from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) with ordinality
  ), imported as materialized (
    -- The importer identifies an update by client, date and time.
    -- Keep the final version of repeated input rows for the warning check.
    select distinct on (lower(imported_client),imported_date,coalesce(imported_time,'00:00'::time)) *
    from parsed order by lower(imported_client),imported_date,coalesce(imported_time,'00:00'::time),row_number desc
  )
    select i.imported_client,i.imported_date,i.imported_time,i.imported_area,
      conflict.conflict_client,conflict.conflict_time
    from imported i
    cross join lateral (
      select * from (
        (select r.client_name as conflict_client,r.event_time as conflict_time
         from public.v2_reservations r
         where r.restaurant_id=p_restaurant_id and r.deleted_at is null
           and r.event_date=i.imported_date
           and coalesce(lower(r.status),'') not in ('cancelada','cancelado','cancelled','canceled')
           and abs(extract(epoch from (r.event_time-i.imported_time)))<=10800
           and public.v2_reservation_area_similar(r.area,i.imported_area)
           and not exists (select 1 from imported replacement
             where lower(replacement.imported_client)=lower(r.client_name)
             and replacement.imported_date=r.event_date
             and coalesce(replacement.imported_time,'00:00'::time)=coalesce(r.event_time,'00:00'::time))
         limit 1)
        union all
        (select previous.imported_client,previous.imported_time from imported previous
         where previous.row_number<i.row_number and previous.imported_date=i.imported_date
           and previous.imported_status not in ('cancelada','cancelado','cancelled','canceled')
           and abs(extract(epoch from (previous.imported_time-i.imported_time)))<=10800
           and public.v2_reservation_area_similar(previous.imported_area,i.imported_area)
         limit 1)
      ) candidates limit 1
    ) conflict
    where i.imported_time is not null and i.imported_area<>''
      and i.imported_status not in ('cancelada','cancelado','cancelled','canceled')
  order by i.row_number
  limit 100;
end
$$;
revoke all on function public.v2_import_reservation_warnings(uuid,jsonb) from public,anon;
grant execute on function public.v2_import_reservation_warnings(uuid,jsonb) to authenticated;

commit;
notify pgrst,'reload schema';
