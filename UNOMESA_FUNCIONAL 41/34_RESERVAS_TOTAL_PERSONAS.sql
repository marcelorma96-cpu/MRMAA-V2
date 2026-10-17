-- MRMAA: excluir reservas canceladas del total de personas.
-- Ejecutar completo antes de desplegar el ZIP actualizado.
-- Solo reemplaza el cálculo del resumen. No modifica filas, invitados guardados,
-- estados, anticipos, cuentas, sesiones ni la exención del piloto.
-- El conteo de reservaciones y la suma de anticipos conservan su comportamiento.
-- Reejecutable; no requiere repetir las migraciones anteriores.

begin;
set local lock_timeout='10s';
do $$ begin
 if to_regprocedure('public.v2_reservation_summary(uuid,text,date,date,date,text)') is null then
  raise exception 'Falta la función de resumen de reservaciones. No se aplicó el cambio.';
 end if;
end $$;
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
         coalesce(sum(r.guests) filter (where lower(trim(coalesce(r.status,''))) not in ('cancelada','cancelado','cancelled','canceled')),0)::numeric,
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

notify pgrst,'reload schema';
commit;
select 'Resumen actualizado: las reservas canceladas no suman personas.' as resultado;
