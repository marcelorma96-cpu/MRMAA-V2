-- MRMAA: infraestructura SaaS aditiva para 50,000+ restaurantes.
-- Requiere SUPABASE_ESCALABILIDAD_50000.sql. Es repetible y no elimina datos.

begin;

-- Catálogo de ubicación: hoy todo vive en primary; permite migrar restaurantes
-- individualmente a otros proyectos/regiones sin cambiar sus identificadores.
create table if not exists public.v2_tenant_locations (
  restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
  cluster_key text not null default 'primary',
  region text not null default 'auto',
  migration_status text not null default 'ready' check (migration_status in ('ready','copying','verifying','cutover','failed')),
  updated_at timestamptz not null default now()
);
insert into public.v2_tenant_locations(restaurant_id)
select id from public.v2_restaurants on conflict(restaurant_id) do nothing;

create or replace function public.v2_register_tenant_location()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.v2_tenant_locations(restaurant_id) values(new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists v2_register_tenant_location on public.v2_restaurants;
create trigger v2_register_tenant_location after insert on public.v2_restaurants
for each row execute function public.v2_register_tenant_location();

-- Límites configurables. NULL significa sin límite. No se activan restricciones
-- comerciales automáticamente, por lo que las funciones actuales no cambian.
create table if not exists public.v2_plan_limits (
  plan_code text primary key,
  max_members bigint,
  max_clients bigint,
  max_quotes bigint,
  max_reservations bigint,
  max_storage_bytes bigint,
  updated_at timestamptz not null default now()
);
insert into public.v2_plan_limits(plan_code) values('basic'),('intermediate'),('advanced')
on conflict(plan_code) do nothing;

create table if not exists public.v2_tenant_usage (
  restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
  members bigint not null default 0 check(members>=0),
  clients bigint not null default 0 check(clients>=0),
  quotes bigint not null default 0 check(quotes>=0),
  reservations bigint not null default 0 check(reservations>=0),
  storage_bytes bigint not null default 0 check(storage_bytes>=0),
  measured_at timestamptz not null default now()
);
create index if not exists v2_tenant_usage_measured_idx on public.v2_tenant_usage(measured_at,restaurant_id);

create or replace function public.v2_rebuild_tenant_usage(target_restaurant uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.v2_tenant_usage(restaurant_id,members,clients,quotes,reservations,measured_at)
  select r.id,
    (select count(*) from public.v2_members m where m.restaurant_id=r.id and m.status in ('activo','invitado')),
    (select count(*) from public.v2_clients c where c.restaurant_id=r.id and c.deleted_at is null),
    (select count(*) from public.v2_quotes q where q.restaurant_id=r.id and q.deleted_at is null),
    (select count(*) from public.v2_reservations x where x.restaurant_id=r.id and x.deleted_at is null),now()
  from public.v2_restaurants r where target_restaurant is null or r.id=target_restaurant
  on conflict(restaurant_id) do update set members=excluded.members,clients=excluded.clients,
    quotes=excluded.quotes,reservations=excluded.reservations,measured_at=excluded.measured_at;
end $$;
select public.v2_rebuild_tenant_usage(null);

create or replace function public.v2_refresh_usage_batch(p_limit integer default 500)
returns integer language plpgsql security definer set search_path=public as $$
declare rid uuid; processed integer := 0;
begin
  for rid in
    select r.id from public.v2_restaurants r left join public.v2_tenant_usage u on u.restaurant_id=r.id
    order by u.measured_at nulls first,r.id limit least(greatest(p_limit,1),1000)
  loop
    perform public.v2_rebuild_tenant_usage(rid);
    processed := processed+1;
  end loop;
  return processed;
end $$;

-- El uso se recalcula por trabajo programado, no mediante triggers por fila.
-- Así una importación de 50,000 registros no genera 50,000 actualizaciones del contador.
do $$ declare t text; begin
  foreach t in array array['v2_members','v2_clients','v2_quotes','v2_reservations'] loop
    execute format('drop trigger if exists %I on public.%I','v2_usage_'||t,t);
  end loop;
end $$;

-- Idempotencia para webhooks, cobros y acciones reintentables.
create table if not exists public.v2_idempotency_keys (
  scope text not null,
  idempotency_key text not null,
  restaurant_id uuid references public.v2_restaurants(id) on delete cascade,
  request_hash text,
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  response_code integer,
  response_body jsonb,
  locked_until timestamptz not null default (now()+interval '5 minutes'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(scope,idempotency_key)
);
create index if not exists v2_idempotency_expiry_idx on public.v2_idempotency_keys(locked_until) where status='processing';

create or replace function public.v2_claim_idempotency(p_scope text,p_key text,p_restaurant_id uuid default null,p_hash text default null)
returns table(claimed boolean,status text,response_code integer,response_body jsonb)
language plpgsql security definer set search_path=public as $$
declare existing public.v2_idempotency_keys%rowtype; did_claim boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext(left(p_scope,80)||':'||left(p_key,200)));
  select * into existing from public.v2_idempotency_keys x
    where x.scope=left(p_scope,80) and x.idempotency_key=left(p_key,200) for update;
  if existing.scope is null then
    insert into public.v2_idempotency_keys(scope,idempotency_key,restaurant_id,request_hash)
    values(left(p_scope,80),left(p_key,200),p_restaurant_id,p_hash);
    did_claim := true;
  elsif existing.status='failed' or existing.locked_until<now() then
    update public.v2_idempotency_keys set status='processing',request_hash=p_hash,response_code=null,
      response_body=null,completed_at=null,locked_until=now()+interval '5 minutes'
    where scope=left(p_scope,80) and idempotency_key=left(p_key,200);
    did_claim := true;
  end if;
  return query select did_claim,
    x.status,x.response_code,x.response_body from public.v2_idempotency_keys x
    where x.scope=left(p_scope,80) and x.idempotency_key=left(p_key,200);
end $$;

create or replace function public.v2_complete_idempotency(p_scope text,p_key text,p_code integer,p_body jsonb,p_failed boolean default false)
returns void language sql security definer set search_path=public as $$
  update public.v2_idempotency_keys set status=case when p_failed then 'failed' else 'completed' end,
    response_code=p_code,response_body=p_body,completed_at=now(),locked_until=now()
  where scope=left(p_scope,80) and idempotency_key=left(p_key,200);
$$;

-- Cola durable. Los workers reclaman trabajos con SKIP LOCKED; los procesos
-- pesados dejan de competir con las solicitudes normales de la aplicación.
create table if not exists public.v2_jobs (
  id bigint generated always as identity primary key,
  restaurant_id uuid references public.v2_restaurants(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
  priority smallint not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists v2_jobs_claim_idx on public.v2_jobs(priority,available_at,id) where status='queued';
create index if not exists v2_jobs_tenant_idx on public.v2_jobs(restaurant_id,created_at desc);

create or replace function public.v2_enqueue_job(p_restaurant_id uuid,p_type text,p_payload jsonb,p_priority smallint default 100)
returns bigint language plpgsql security definer set search_path=public as $$
declare result bigint; begin
  insert into public.v2_jobs(restaurant_id,job_type,payload,priority)
  values(p_restaurant_id,left(p_type,80),coalesce(p_payload,'{}'::jsonb),p_priority) returning id into result;
  return result;
end $$;

create or replace function public.v2_claim_jobs(p_worker text,p_limit integer default 10)
returns setof public.v2_jobs language plpgsql security definer set search_path=public as $$
begin
  return query
  update public.v2_jobs j set status='running',locked_at=now(),locked_by=left(p_worker,120),attempts=attempts+1
  where j.id in (select id from public.v2_jobs where status='queued' and available_at<=now()
    order by priority,available_at,id for update skip locked limit least(greatest(p_limit,1),100))
  returning j.*;
end $$;

create or replace function public.v2_finish_job(p_id bigint,p_error text default null)
returns void language sql security definer set search_path=public as $$
  update public.v2_jobs set
    status=case when p_error is null then 'completed' when attempts>=max_attempts then 'failed' else 'queued' end,
    last_error=left(p_error,2000),locked_at=null,locked_by=null,
    available_at=case when p_error is null then available_at else now()+make_interval(secs=>least(3600,30*power(2,greatest(attempts-1,0))::integer)) end,
    completed_at=case when p_error is null then now() when attempts>=max_attempts then now() else null end
  where id=p_id;
$$;

-- Rate limit compartido por todas las instancias de Vercel.
create table if not exists public.v2_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  expires_at timestamptz not null,
  primary key(bucket,subject_hash,window_start)
);
create index if not exists v2_rate_limits_expiry_idx on public.v2_rate_limits(expires_at);
create or replace function public.v2_take_rate_limit(p_bucket text,p_subject_hash text,p_limit integer,p_window_seconds integer default 60)
returns boolean language plpgsql security definer set search_path=public as $$
declare start_at timestamptz; current_hits integer;
begin
  start_at := to_timestamp(floor(extract(epoch from now())/greatest(p_window_seconds,1))*greatest(p_window_seconds,1));
  insert into public.v2_rate_limits(bucket,subject_hash,window_start,hits,expires_at)
  values(left(p_bucket,80),left(p_subject_hash,128),start_at,1,start_at+make_interval(secs=>greatest(p_window_seconds,1)*2))
  on conflict(bucket,subject_hash,window_start) do update set hits=v2_rate_limits.hits+1
  returning hits into current_hits;
  return current_hits<=greatest(p_limit,1);
end $$;

-- Telemetría agregada sin guardar cuerpos, contraseñas ni información del cliente.
create table if not exists public.v2_platform_metrics_hourly (
  hour timestamptz not null,
  metric text not null,
  dimension text not null default '',
  count bigint not null default 0,
  total_ms bigint not null default 0,
  errors bigint not null default 0,
  primary key(hour,metric,dimension)
);
create or replace function public.v2_record_metric(p_metric text,p_dimension text default '',p_duration_ms integer default 0,p_error boolean default false)
returns void language sql security definer set search_path=public as $$
  insert into public.v2_platform_metrics_hourly(hour,metric,dimension,count,total_ms,errors)
  values(date_trunc('hour',now()),left(p_metric,80),left(coalesce(p_dimension,''),80),1,greatest(p_duration_ms,0),case when p_error then 1 else 0 end)
  on conflict(hour,metric,dimension) do update set count=v2_platform_metrics_hourly.count+1,
    total_ms=v2_platform_metrics_hourly.total_ms+excluded.total_ms,errors=v2_platform_metrics_hourly.errors+excluded.errors;
$$;

create or replace function public.v2_platform_maintenance()
returns jsonb language plpgsql security definer set search_path=public as $$
declare rate_rows bigint; key_rows bigint; job_rows bigint; metric_rows bigint;
begin
  delete from public.v2_rate_limits where expires_at<now(); get diagnostics rate_rows=row_count;
  delete from public.v2_idempotency_keys where created_at<now()-interval '7 days' and status in ('completed','failed'); get diagnostics key_rows=row_count;
  delete from public.v2_jobs where created_at<now()-interval '30 days' and status in ('completed','failed','cancelled'); get diagnostics job_rows=row_count;
  delete from public.v2_platform_metrics_hourly where hour<now()-interval '400 days'; get diagnostics metric_rows=row_count;
  return jsonb_build_object('rate_limits',rate_rows,'idempotency',key_rows,'jobs',job_rows,'metrics',metric_rows);
end $$;

-- Índices para millones de filas y barridos de mantenimiento.
create index if not exists v2_members_user_active_idx on public.v2_members(user_id,restaurant_id) where status='activo';
create index if not exists v2_clients_tenant_created_idx on public.v2_clients(restaurant_id,created_at desc,id);
create index if not exists v2_quotes_tenant_updated_idx on public.v2_quotes(restaurant_id,updated_at desc,id) where deleted_at is null;
create index if not exists v2_reservations_tenant_created_idx on public.v2_reservations(restaurant_id,created_at desc,id) where deleted_at is null;
create index if not exists v2_schedules_tenant_employee_date_idx on public.v2_schedules(restaurant_id,employee_id,work_date);
create index if not exists v2_audit_time_brin_idx on public.v2_audit_log using brin(changed_at);
create index if not exists v2_audit_tenant_table_time_idx on public.v2_audit_log(restaurant_id,table_name,changed_at desc);

-- Estas tablas son internas. Solo backend/SQL administrativo puede usarlas.
do $$ declare t text; begin
  foreach t in array array['v2_tenant_locations','v2_plan_limits','v2_tenant_usage','v2_idempotency_keys','v2_jobs','v2_rate_limits','v2_platform_metrics_hourly'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
  end loop;
end $$;
revoke all on function public.v2_rebuild_tenant_usage(uuid),public.v2_refresh_usage_batch(integer),public.v2_claim_idempotency(text,text,uuid,text),
  public.v2_complete_idempotency(text,text,integer,jsonb,boolean),public.v2_enqueue_job(uuid,text,jsonb,smallint),
  public.v2_claim_jobs(text,integer),public.v2_finish_job(bigint,text),public.v2_take_rate_limit(text,text,integer,integer),
  public.v2_record_metric(text,text,integer,boolean),public.v2_platform_maintenance() from public,anon,authenticated;
grant execute on function public.v2_rebuild_tenant_usage(uuid),public.v2_refresh_usage_batch(integer),public.v2_claim_idempotency(text,text,uuid,text),
  public.v2_complete_idempotency(text,text,integer,jsonb,boolean),public.v2_enqueue_job(uuid,text,jsonb,smallint),
  public.v2_claim_jobs(text,integer),public.v2_finish_job(bigint,text),public.v2_take_rate_limit(text,text,integer,integer),
  public.v2_record_metric(text,text,integer,boolean),public.v2_platform_maintenance() to service_role;

commit;
notify pgrst,'reload schema';
