-- DIAGNOSTICO OPCIONAL. Solo lectura; no activa planes ni modifica datos.
-- Ejecutar en el SQL Editor del mismo proyecto Supabase usado por MRMAA.
begin transaction read only;
select r.id as restaurante_id, r.name as restaurante,
       r.plan_code as plan, r.subscription_status as estado,
       r.billing_cycle as periodicidad,
       r.billing_current_period_end as pagado_hasta,
       r.lemon_subscription_id as suscripcion_lemon,
       a.provider as proveedor, a.mode as modo,
       a.external_subscription_id as suscripcion_proveedor,
       (select count(*) from public.v2_lemon_checkouts c
         where c.restaurant_id = r.id) as enlaces_generados,
       (select count(*) from public.v2_lemon_checkouts c
         where c.restaurant_id = r.id and c.subscription_id is not null) as enlaces_vinculados,
       (select count(*) from public.v2_billing_events e
         where e.restaurant_id = r.id) as eventos_aplicados
from public.v2_restaurants r
left join public.v2_payment_accounts a on a.restaurant_id = r.id
order by r.name;
commit;
