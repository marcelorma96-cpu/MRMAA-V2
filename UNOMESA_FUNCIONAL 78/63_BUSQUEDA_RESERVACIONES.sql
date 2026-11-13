-- UnoMesa: resumen coherente con la búsqueda ampliada de reservaciones.
-- Ejecutar completo antes de desplegar el código actualizado.
-- Reejecutable. Solo agrega/reemplaza una función de lectura y sus permisos.
-- No cambia ni elimina reservaciones, cotizaciones, anticipos ni otros datos.
begin;
set local lock_timeout='10s';
do $$ begin
 if to_regprocedure('public.v2_reservation_summary(uuid,text,date,date,date,text)') is null then
  raise exception 'Falta el resumen de reservaciones existente. No se aplicó este cambio.';
 end if;
end $$;

create or replace function public.v2_reservation_search_summary(
 p_restaurant_id uuid,
 p_mode text default 'all',
 p_date date default current_date,
 p_from date default null,
 p_to date default null,
 p_search jsonb default '{}'::jsonb
)
returns table(reservations bigint,people numeric,deposits numeric)
language plpgsql stable security invoker set search_path=public
as $$
begin
 if jsonb_typeof(p_search) is distinct from 'object' or coalesce(p_search->>'field','all') not in
  ('all','client_name','phone','deposit','payment_method','total','balance','guests','area','event_date','event_time','status','notes','menu') then
  raise exception 'Filtro de búsqueda inválido.' using errcode='22023';
 end if;
 return query
 with input as (
  select left(trim(coalesce(p_search->>'text','')),150) as term,
   coalesce(p_search->>'field','all') as field,
   (p_search->>'amount')::numeric as amount,(p_search->>'date')::date as search_date,
   (p_search->>'time')::time as search_time,p_search->>'deposit_mode' as deposit_mode
 ), s as (
  select input.*,'%'||replace(replace(replace(term,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%' as pattern from input
 )
 select count(*)::bigint,
  coalesce(sum(r.guests) filter(where lower(trim(coalesce(r.status,''))) not in ('cancelada','cancelado','cancelled','canceled')),0)::numeric,
  coalesce(sum(r.deposit),0)::numeric
 from public.v2_reservations r cross join s
 where r.restaurant_id=p_restaurant_id and r.deleted_at is null and public.v2_can_read(p_restaurant_id)
  and case when p_mode in ('today','single') then r.event_date=p_date
   when p_mode='range' then r.event_date between p_from and p_to else true end
  and (s.term='' or
   exists(select 1 from (values
    ('client_name',r.client_name),('phone',r.phone),('area',r.area),('menu',r.menu),
    ('notes',r.notes),('status',r.status),('payment_method',r.payment_method)
   ) as content(field,value) where (s.field='all' or s.field=content.field) and content.value ilike s.pattern)
   or (s.amount is not null and (
    (s.field in ('all','deposit') and coalesce(r.deposit,0)=s.amount)
    or (s.field in ('all','total') and coalesce(r.total,0)=s.amount)
    or (s.field in ('all','balance') and coalesce(r.balance,0)=s.amount)
    or (s.field in ('all','guests') and s.amount=trunc(s.amount) and s.amount<=2147483647 and r.guests=s.amount)
   ))
   or (s.field in ('all','deposit') and ((s.deposit_mode='with' and r.deposit>0) or (s.deposit_mode='without' and coalesce(r.deposit,0)=0)))
   or (s.field in ('all','event_date') and r.event_date=s.search_date)
   or (s.field in ('all','event_time') and r.event_time=s.search_time)
  );
end;
$$;
revoke all on function public.v2_reservation_search_summary(uuid,text,date,date,date,jsonb) from public,anon;
grant execute on function public.v2_reservation_search_summary(uuid,text,date,date,date,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
select 'Búsqueda ampliada: resumen preparado sin modificar datos.' as resultado;
