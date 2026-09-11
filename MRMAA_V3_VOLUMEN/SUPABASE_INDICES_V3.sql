-- Ejecutar CADA sentencia por separado, sin BEGIN/COMMIT.
-- CONCURRENTLY mantiene disponibles las escrituras mientras se construye.
-- Si una sentencia falla, comprobar pg_index.indisvalid antes de reintentar:
-- IF NOT EXISTS no repara un índice inválido de un intento interrumpido.
create index concurrently if not exists v3_clients_tenant_name
on public.v2_clients(restaurant_id,name,id) where deleted_at is null;

create index concurrently if not exists v3_quotes_tenant_number
on public.v2_quotes(restaurant_id,quote_number desc,id) where deleted_at is null;

create index concurrently if not exists v3_reservations_tenant_date_time
on public.v2_reservations(restaurant_id,event_date,event_time,id) where deleted_at is null;

create index concurrently if not exists v3_keys_retention
on public.v2_idempotency_keys(created_at) where status in ('completed','failed');

create index concurrently if not exists v3_jobs_retention
on public.v2_jobs(created_at) where status in ('completed','failed','cancelled');
