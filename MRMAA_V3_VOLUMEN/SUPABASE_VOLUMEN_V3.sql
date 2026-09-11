-- Ejecutar DESPUÉS de SUPABASE_SAAS_50000_RESTAURANTES.sql.
-- Cambios aditivos: no borra datos del negocio ni cambia sus permisos.
begin;
set local lock_timeout = '5s';

-- No recorrer todos los restaurantes para decidir cuál procesar.
insert into public.v2_tenant_usage(restaurant_id,measured_at)
select id,'1970-01-01'::timestamptz from public.v2_restaurants
on conflict(restaurant_id) do nothing;

create or replace function public.v2_register_tenant_location()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.v2_tenant_locations(restaurant_id) values(new.id) on conflict do nothing;
  insert into public.v2_tenant_usage(restaurant_id,measured_at)
  values(new.id,'1970-01-01'::timestamptz) on conflict do nothing;
  return new;
end $$;

-- Serializa solo este mantenimiento. El límite impide recuentos masivos
-- accidentales; el índice measured_at permite escoger el siguiente en orden.
create or replace function public.v2_refresh_usage_batch(p_limit integer default 1)
returns integer language plpgsql security definer set search_path=public as $$
declare rid uuid; processed integer := 0;
begin
  if not pg_try_advisory_xact_lock(814237,1) then return 0; end if;
  for rid in select restaurant_id from public.v2_tenant_usage
    where measured_at < now()-interval '24 hours'
    order by measured_at,restaurant_id
    limit least(greatest(coalesce(p_limit,1),1),5)
  loop
    perform public.v2_rebuild_tenant_usage(rid);
    processed := processed+1;
  end loop;
  return processed;
end $$;

-- Conserva las mismas retenciones; limita cada DELETE a 1,000 filas.
-- SKIP LOCKED evita esperar por filas que otro proceso está utilizando.
create or replace function public.v2_platform_maintenance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare rate_rows bigint; key_rows bigint; job_rows bigint; metric_rows bigint;
begin
  delete from public.v2_rate_limits where ctid in (
    select ctid from public.v2_rate_limits where expires_at<now()
    order by expires_at limit 1000 for update skip locked);
  get diagnostics rate_rows=row_count;
  delete from public.v2_idempotency_keys where ctid in (
    select ctid from public.v2_idempotency_keys
    where created_at<now()-interval '7 days' and status in ('completed','failed')
    order by created_at limit 1000 for update skip locked);
  get diagnostics key_rows=row_count;
  delete from public.v2_jobs where ctid in (
    select ctid from public.v2_jobs
    where created_at<now()-interval '30 days' and status in ('completed','failed','cancelled')
    order by created_at limit 1000 for update skip locked);
  get diagnostics job_rows=row_count;
  delete from public.v2_platform_metrics_hourly where ctid in (
    select ctid from public.v2_platform_metrics_hourly where hour<now()-interval '400 days'
    order by hour limit 1000 for update skip locked);
  get diagnostics metric_rows=row_count;
  return jsonb_build_object('rate_limits',rate_rows,'idempotency',key_rows,
    'jobs',job_rows,'metrics',metric_rows,'batch_limit',1000,
    'more_possible',greatest(rate_rows,key_rows,job_rows,metric_rows)=1000);
end $$;
revoke all on function public.v2_refresh_usage_batch(integer),public.v2_platform_maintenance()
from public,anon,authenticated;
grant execute on function public.v2_refresh_usage_batch(integer),public.v2_platform_maintenance() to service_role;
commit;
notify pgrst,'reload schema';
