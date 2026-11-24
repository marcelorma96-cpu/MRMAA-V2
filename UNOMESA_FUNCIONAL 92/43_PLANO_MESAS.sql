-- EXCLUSIVO: Proyecto nuevo prueba. No ejecutar en UnoMesa funcional.
-- Promover solamente tras la confirmacion expresa de Marcelo.
-- UnoMesa · Plano de mesas opcional · 30 septiembre 2026.
-- Ejecutar completo UNA VEZ para activar el guardado del plano.
-- Solo crea objetos nuevos v2_floor_*. No cambia tablas, funciones, políticas,
-- clientes, cotizaciones, reservaciones ni configuración existentes.
-- Sin este archivo, la aplicación conserva el listado y permite probar una demo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if to_regprocedure('public.v2_can_read(uuid)') is null
    or to_regprocedure('public.v2_effective_membership(uuid)') is null
    or to_regprocedure('public.v2_account_billing(uuid)') is null
    or to_regprocedure('public.v2_session_alive()') is null then
    raise exception 'Faltan funciones de acceso de la instalación actual. No se aplicó el plano.';
  end if;
end $$;

create table if not exists public.v2_floor_plans (
  restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
  revision integer not null default 0,
  layout jsonb not null default '{"areas":[],"tables":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.v2_floor_seatings (
  reservation_id uuid primary key references public.v2_reservations(id) on delete cascade,
  restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
  table_ids text[] not null default '{}',
  whole_area_id text,
  duration_minutes integer not null check(duration_minutes between 15 and 1440),
  service_status text not null default 'reserved' check(service_status in ('reserved','seated','finished')),
  source_date date not null,
  source_time time not null,
  source_guests integer not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create index if not exists v2_floor_seatings_restaurant on public.v2_floor_seatings(restaurant_id);
alter table public.v2_floor_plans enable row level security;
alter table public.v2_floor_seatings enable row level security;
-- No direct access: only the checked RPCs below may read or write these tables.
revoke all on public.v2_floor_plans, public.v2_floor_seatings from public, anon, authenticated;

create or replace function public.v2_floor_authorize(p_restaurant_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare m jsonb; b jsonb; r text;
begin
  if auth.uid() is null or not coalesce(public.v2_session_alive(),false)
    or not coalesce(public.v2_can_read(p_restaurant_id),false) then
    raise exception 'FLOOR_ACCESS';
  end if;
  m := to_jsonb(public.v2_effective_membership(p_restaurant_id));
  r := lower(m->>'role');
  if m->>'status' is distinct from 'activo' then raise exception 'FLOOR_ACCESS'; end if;
  if p_action = 'read' and r in ('administrador','admin','gerente','operacion','lectura','soporte_editor','soporte_lectura') then return; end if;
  if p_action not in ('operate','layout') or r is null then raise exception 'FLOOR_ACCESS'; end if;
  if p_action = 'operate' and r not in ('administrador','admin','gerente','operacion','soporte_editor') then raise exception 'FLOOR_ACCESS'; end if;
  if p_action = 'layout' and r not in ('administrador','admin','gerente','soporte_editor') then raise exception 'FLOOR_ACCESS'; end if;
  b := to_jsonb(public.v2_account_billing(p_restaurant_id));
  if not coalesce((b->>'can_write')::boolean,false) then raise exception 'FLOOR_ACCESS'; end if;
end $$;
revoke all on function public.v2_floor_authorize(uuid,text) from public, anon, authenticated;

create or replace function public.v2_floor_read(p_restaurant_id uuid, p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; n integer;
begin
  perform public.v2_floor_authorize(p_restaurant_id,'read');
  if p_date is null or p_date < date '2000-01-01' or p_date > date '2100-12-31' then raise exception 'FLOOR_DATE'; end if;
  select count(*) into n from public.v2_reservations r
    where r.restaurant_id=p_restaurant_id and r.deleted_at is null and r.event_date between p_date-1 and p_date+1;
  if n > 2000 then raise exception 'FLOOR_LIMIT'; end if;
  select jsonb_build_object(
    'revision', coalesce((select p.revision from public.v2_floor_plans p where p.restaurant_id=p_restaurant_id),0),
    'layout', coalesce((select p.layout from public.v2_floor_plans p where p.restaurant_id=p_restaurant_id),'{"areas":[],"tables":[]}'::jsonb),
    'reservations', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'client_name',r.client_name,'phone',r.phone,
      'event_date',r.event_date,'event_time',r.event_time,'guests',coalesce(r.guests,0),'area',r.area,'status',r.status)
      order by r.event_date,r.event_time,r.id) from public.v2_reservations r
      where r.restaurant_id=p_restaurant_id and r.deleted_at is null and r.event_date between p_date-1 and p_date+1),'[]'::jsonb),
    'seatings', coalesce((select jsonb_agg(to_jsonb(s)) from public.v2_floor_seatings s join public.v2_reservations r on r.id=s.reservation_id
      where s.restaurant_id=p_restaurant_id and r.restaurant_id=p_restaurant_id and r.deleted_at is null
        and r.event_date between p_date-1 and p_date+1),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.v2_floor_save_layout(p_restaurant_id uuid,p_revision integer,p_layout jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_area jsonb; v_table jsonb; rev integer;
begin
  perform public.v2_floor_authorize(p_restaurant_id,'layout');
  if p_layout is null or jsonb_typeof(p_layout) <> 'object' or jsonb_typeof(p_layout->'areas') is distinct from 'array'
    or jsonb_typeof(p_layout->'tables') is distinct from 'array' or octet_length(p_layout::text)>200000 then raise exception 'FLOOR_LAYOUT'; end if;
  if jsonb_array_length(p_layout->'areas')>20 or jsonb_array_length(p_layout->'tables')>200 then raise exception 'FLOOR_LAYOUT'; end if;
  for v_area in select value from jsonb_array_elements(p_layout->'areas') loop
    if coalesce(v_area->>'id','') !~ '^[a-zA-Z0-9_-]{1,64}$' or length(trim(coalesce(v_area->>'name',''))) not between 1 and 60 then raise exception 'FLOOR_LAYOUT'; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_layout->'areas')) <> jsonb_array_length(p_layout->'areas')
    or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p_layout->'areas')) <> jsonb_array_length(p_layout->'areas') then raise exception 'FLOOR_LAYOUT'; end if;
  for v_table in select value from jsonb_array_elements(p_layout->'tables') loop
    if coalesce(v_table->>'id','') !~ '^[a-zA-Z0-9_-]{1,64}$' or length(trim(coalesce(v_table->>'name',''))) not between 1 and 30
      or not exists(select 1 from jsonb_array_elements(p_layout->'areas') ar where ar->>'id'=v_table->>'areaId')
      or coalesce(v_table->>'shape','') not in ('round','square','rectangle')
      or coalesce(v_table->>'seats','') !~ '^[0-9]{1,3}$' or (v_table->>'seats')::int not between 1 and 100
      or coalesce(v_table->>'x','') !~ '^[0-9]+(\.[0-9]+)?$' or (v_table->>'x')::numeric not between 8 and 92
      or coalesce(v_table->>'y','') !~ '^[0-9]+(\.[0-9]+)?$' or (v_table->>'y')::numeric not between 10 and 90
      or coalesce(v_table->>'rotation','') not in ('0','90') then raise exception 'FLOOR_LAYOUT'; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_layout->'tables')) <> jsonb_array_length(p_layout->'tables')
    or exists(select 1 from jsonb_array_elements(p_layout->'tables') t group by t->>'areaId',lower(trim(t->>'name')) having count(*)>1) then raise exception 'FLOOR_LAYOUT'; end if;
  -- One row lock serializes layout and seating writes from all computers.
  insert into public.v2_floor_plans(restaurant_id) values(p_restaurant_id) on conflict do nothing;
  select revision into rev from public.v2_floor_plans where restaurant_id=p_restaurant_id for update;
  if p_revision is distinct from rev then raise exception 'FLOOR_STALE'; end if;
  -- Preserve every saved assignment, including history. Unassign before removing a table.
  if exists(select 1 from public.v2_floor_seatings s cross join lateral unnest(s.table_ids) assigned(id)
    where s.restaurant_id=p_restaurant_id and not exists(select 1 from jsonb_array_elements(p_layout->'tables') t where t->>'id'=assigned.id))
    or exists(select 1 from public.v2_floor_seatings s where s.restaurant_id=p_restaurant_id and s.whole_area_id is not null
      and not exists(select 1 from jsonb_array_elements(p_layout->'areas') a where a->>'id'=s.whole_area_id)) then raise exception 'FLOOR_IN_USE'; end if;
  -- Moving a table to another area can change exclusive-room availability; require unassignment first.
  if exists(select 1 from public.v2_floor_plans p cross join lateral jsonb_array_elements(p.layout->'tables') oldt
    join jsonb_array_elements(p_layout->'tables') newt on newt->>'id'=oldt->>'id'
    where p.restaurant_id=p_restaurant_id and oldt->>'areaId'<>newt->>'areaId'
      and exists(select 1 from public.v2_floor_seatings s where s.restaurant_id=p_restaurant_id
        and (oldt->>'id'=any(s.table_ids) or s.whole_area_id in (oldt->>'areaId',newt->>'areaId')))) then raise exception 'FLOOR_IN_USE'; end if;
  update public.v2_floor_plans set layout=p_layout, revision=rev+1,updated_at=now() where restaurant_id=p_restaurant_id;
  return rev+1;
end $$;

create or replace function public.v2_floor_assign(p_restaurant_id uuid,p_reservation_id uuid,p_revision integer,
  p_plan_revision integer,p_table_ids text[],p_whole_area_id text,p_duration integer,p_status text,
  p_source_date date,p_source_time time,p_source_guests integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare lay jsonb; planrev integer; oldrev integer; r public.v2_reservations%rowtype; ids text[];
  start_at timestamp; end_at timestamp; capacity integer; n integer;
begin
  perform public.v2_floor_authorize(p_restaurant_id,'operate');
  select layout,revision into lay,planrev from public.v2_floor_plans where restaurant_id=p_restaurant_id for update;
  if not found or p_plan_revision is distinct from planrev then raise exception 'FLOOR_STALE'; end if;
  select * into r from public.v2_reservations where id=p_reservation_id and restaurant_id=p_restaurant_id for share;
  if not found then raise exception 'FLOOR_RESERVATION'; end if;
  select revision into oldrev from public.v2_floor_seatings where reservation_id=p_reservation_id;
  if p_revision is distinct from coalesce(oldrev,0) then raise exception 'FLOOR_STALE'; end if;
  -- Empty selection removes only this seating; reservation and customer are untouched.
  if coalesce(cardinality(p_table_ids),0)=0 and p_whole_area_id is null then
    delete from public.v2_floor_seatings where reservation_id=p_reservation_id and restaurant_id=p_restaurant_id;
    return 0;
  end if;
  if r.deleted_at is not null or lower(trim(coalesce(r.status,''))) in ('cancelada','cancelado','cancelled','canceled')
    or r.event_date is null or r.event_time is null then raise exception 'FLOOR_RESERVATION'; end if;
  if r.event_date is distinct from p_source_date or r.event_time is distinct from p_source_time or coalesce(r.guests,0) is distinct from coalesce(p_source_guests,0) then raise exception 'FLOOR_STALE'; end if;
  if p_duration is null or p_duration not between 15 and 1440 or p_status is null or p_status not in ('reserved','seated','finished') then raise exception 'FLOOR_ASSIGNMENT'; end if;
  if p_whole_area_id is not null then
    if not exists(select 1 from jsonb_array_elements(lay->'areas') a where a->>'id'=p_whole_area_id) then raise exception 'FLOOR_ASSIGNMENT'; end if;
    select array_agg(t->>'id') into ids from jsonb_array_elements(lay->'tables') t where t->>'areaId'=p_whole_area_id;
  else
    select array_agg(distinct val) into ids from unnest(p_table_ids) val;
  end if;
  if coalesce(cardinality(ids),0)=0 or cardinality(ids)>200 then raise exception 'FLOOR_ASSIGNMENT'; end if;
  select count(*),sum((t->>'seats')::int) into n,capacity from jsonb_array_elements(lay->'tables') t where t->>'id'=any(ids);
  if n<>cardinality(ids) then raise exception 'FLOOR_ASSIGNMENT'; end if;
  if capacity < coalesce(r.guests,0) then raise exception 'FLOOR_CAPACITY'; end if;
  start_at := r.event_date + r.event_time; end_at := start_at + make_interval(mins=>p_duration);
  if p_status <> 'finished' and exists (
    select 1 from public.v2_floor_seatings s join public.v2_reservations other on other.id=s.reservation_id
    where s.restaurant_id=p_restaurant_id and other.restaurant_id=p_restaurant_id and s.reservation_id<>p_reservation_id
      and other.deleted_at is null and lower(trim(coalesce(other.status,''))) not in ('cancelada','cancelado','cancelled','canceled')
      and s.service_status<>'finished'
      and other.event_date+coalesce(other.event_time,s.source_time) < end_at
      and other.event_date+coalesce(other.event_time,s.source_time)+make_interval(mins=>s.duration_minutes)>start_at
      and (s.table_ids && ids or (s.whole_area_id is not null and exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=s.whole_area_id and t->>'id'=any(ids)))
        or (p_whole_area_id is not null and exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=p_whole_area_id and t->>'id'=any(s.table_ids))))
  ) then raise exception 'FLOOR_CONFLICT'; end if;
  insert into public.v2_floor_seatings(reservation_id,restaurant_id,table_ids,whole_area_id,duration_minutes,service_status,source_date,source_time,source_guests,revision)
  values(p_reservation_id,p_restaurant_id,ids,p_whole_area_id,p_duration,p_status,r.event_date,r.event_time,coalesce(r.guests,0),coalesce(oldrev,0)+1)
  on conflict(reservation_id) do update set table_ids=excluded.table_ids,whole_area_id=excluded.whole_area_id,
    duration_minutes=excluded.duration_minutes,service_status=excluded.service_status,source_date=excluded.source_date,
    source_time=excluded.source_time,source_guests=excluded.source_guests,revision=excluded.revision,updated_at=now();
  return coalesce(oldrev,0)+1;
end $$;
revoke all on function public.v2_floor_read(uuid,date),public.v2_floor_save_layout(uuid,integer,jsonb),
 public.v2_floor_assign(uuid,uuid,integer,integer,text[],text,integer,text,date,time,integer) from public,anon;
grant execute on function public.v2_floor_read(uuid,date),public.v2_floor_save_layout(uuid,integer,jsonb),
 public.v2_floor_assign(uuid,uuid,integer,integer,text[],text,integer,text,date,time,integer) to authenticated;
notify pgrst,'reload schema';
commit;
