-- UnoMesa: búsqueda de auditoría para administradores activos de una sucursal.
-- Instala una función de consulta. No altera reservas, clientes ni el historial.
begin;
create or replace function public.v2_security_history(p_restaurant uuid,p_search text default '',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare
 term text := lower(btrim(coalesce(p_search,'')));
 output jsonb;
 fields text[] := array['label','client_name','name','quote_number','event_date','event_time','status','guests','area','deposit','total','deleted_at'];
begin
 if auth.uid() is null or not exists(select 1 from public.v2_members m where m.restaurant_id=p_restaurant and m.user_id=auth.uid() and m.status='activo' and m.role in ('administrador','admin'))
    or not coalesce(public.v2_can_read(p_restaurant),false)
 then raise exception 'Acceso restringido al historial.' using errcode='42501'; end if;
 if length(term)>150 or p_page is null or p_page<1 then raise exception 'Búsqueda o página inválida.' using errcode='22023'; end if;
 with history as not materialized (
   select a.*, coalesce(nullif(a.new_data->>'id',''),nullif(a.old_data->>'id',''),to_jsonb(a)->>'record_id') as entity_key
   from public.v2_audit_log a where a.restaurant_id=p_restaurant
 ), related as (
   select distinct h.table_name,h.entity_key from history h
   where term<>'' and h.entity_key is not null and (h.entity_key=term or exists(
     select 1 from (values (h.old_data->>'client_name'),(h.new_data->>'client_name'),(h.old_data->>'name'),(h.new_data->>'name'),
       (h.old_data->>'label'),(h.new_data->>'label'),(h.old_data->>'quote_number'),(h.new_data->>'quote_number')) n(v)
     where strpos(lower(n.v),term)>0))
   union
   select 'v2_reservations',r.id::text from public.v2_reservations r where term<>'' and r.restaurant_id=p_restaurant and strpos(lower(r.client_name),term)>0
 ), matches as materialized (
   select h.id,h.changed_at from history h where term='' or
     (h.table_name,h.entity_key) in (select table_name,entity_key from related) or
     exists(select 1 from (values (h.actor_name::text),(h.actor_role::text),(replace(h.action::text,'_',' ')),(h.action::text),
       (h.old_data->>'event_date'),(h.new_data->>'event_date')) x(v) where strpos(lower(x.v),term)>0)
 ), totals as (select count(*) as total from matches),
 bounds as (select total,least(p_page::bigint,greatest(1,(total+9)/10)) as page from totals),
 picked as (
   select m.id from matches m order by m.changed_at desc,m.id desc limit 10 offset (select (page-1)*10 from bounds)
 ), details as (
   select h.id,h.table_name,h.entity_key as entity_id,h.action,h.changed_by,h.actor_name,h.actor_role,h.changed_at,
    (select jsonb_object_agg(x.key,x.value) from jsonb_each(coalesce(nullif(h.old_data::jsonb,'null'::jsonb),'{}'::jsonb)) x where x.key=any(fields)) as old_data,
    (select jsonb_object_agg(x.key,x.value) from jsonb_each(coalesce(nullif(h.new_data::jsonb,'null'::jsonb),'{}'::jsonb)) x where x.key=any(fields)) as new_data,
    case when h.table_name='v2_reservations' then case when r.id is null then 'not_visible' when r.deleted_at is not null then 'trash' else 'present' end end as current_location,
    r.client_name as current_name,r.event_date as current_date_of_event,r.event_time as current_time_of_event,r.status as current_status
   from picked p join history h on h.id=p.id
   left join public.v2_reservations r on r.restaurant_id=p_restaurant and h.table_name='v2_reservations' and
    r.id=case when h.entity_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then h.entity_key::uuid end
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(d) order by d.changed_at desc,d.id desc) from details d),'[]'::jsonb),
   'total',b.total,'page',b.page,'has_more',b.page*10<b.total) into output from bounds b;
 return output;
end;
$$;
revoke all on function public.v2_security_history(uuid,text,integer) from public,anon;
grant execute on function public.v2_security_history(uuid,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
