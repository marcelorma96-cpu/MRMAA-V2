-- UnoMesa · Seleccionar varias áreas completas en un mismo evento.
-- Aplicar completo DESPUÉS de 60_VINCULAR_RESERVAS_COTIZACIONES.sql.
-- Conserva las filas existentes, importes, clientes, permisos y configuración.
-- Añade columnas opcionales; no borra ni recrea tablas. Es repetible.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regprocedure('public.v2_event_quote_to_reservation(uuid,uuid,uuid)') is null
 or to_regprocedure('public.v2_floor_assign_extra_seats(uuid,uuid,integer,integer,text[],text,integer,text,date,time,integer,boolean)') is null then
 raise exception 'Aplique primero los SQL anteriores, incluido 60. No se aplicaron cambios.';end if;
end $$;
alter table public.v2_reservations add column if not exists area_ids uuid[] not null default '{}';
alter table public.v2_quotes add column if not exists area_ids uuid[] not null default '{}';
alter table public.v2_reservations add column if not exists area_duration_minutes integer;
alter table public.v2_quotes add column if not exists area_duration_minutes integer;
alter table public.v2_floor_seatings add column if not exists whole_area_ids text[] not null default '{}';

-- Canonical names and tenant-checked IDs. Legacy callers may omit the new field.
create or replace function public.v2_event_area_payload(p_restaurant uuid,p_payload jsonb,p_previous jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[]; names text; n integer;
begin
 if not (p_payload?'area_ids') then
  if coalesce(jsonb_array_length(nullif(p_previous->'area_ids','null'::jsonb)),0)>1
   and (not (p_payload?'area_id') or p_payload->'area_id' is not distinct from p_previous->'area_id')
   and (not (p_payload?'area') or p_payload->'area' is not distinct from p_previous->'area') then
   p_payload:=p_payload||jsonb_build_object('area_ids',p_previous->'area_ids');
  else
   return p_payload||jsonb_build_object('area_ids',case when coalesce(case when p_payload?'area_id' then p_payload->>'area_id' else p_previous->>'area_id' end,'')<>'' then jsonb_build_array(case when p_payload?'area_id' then p_payload->>'area_id' else p_previous->>'area_id' end) else '[]'::jsonb end);
  end if;
 end if;
 if jsonb_typeof(p_payload->'area_ids') is distinct from 'array' or jsonb_array_length(p_payload->'area_ids')>20 then raise exception 'EVENT_AREAS';end if;
 select coalesce(array_agg(id order by pos),'{}') into ids from (select value::uuid id,min(ord) pos from jsonb_array_elements_text(p_payload->'area_ids') with ordinality x(value,ord) group by value::uuid) x;
 select count(*),string_agg(a.name,' + ' order by x.pos) into n,names from unnest(ids) with ordinality x(id,pos) join public.v2_reservation_areas a on a.id=x.id and a.restaurant_id=p_restaurant;
 if n<>cardinality(ids) then raise exception 'EVENT_AREAS';end if;
 return p_payload||jsonb_build_object('area_ids',to_jsonb(ids),'area_id',ids[1],'area',coalesce(names,''));
end $$;

create or replace function public.v2_event_floor_rooms(p_restaurant uuid,p_ids uuid[])
returns text[] language plpgsql stable security definer set search_path='' as $$
declare lay jsonb; rooms text[]:='{}'; aid uuid; aname text; matches text[];
begin
 select layout into lay from public.v2_floor_plans where restaurant_id=p_restaurant;
 foreach aid in array coalesce(p_ids,'{}') loop
  select name into aname from public.v2_reservation_areas where restaurant_id=p_restaurant and id=aid;
  if not found then raise exception 'EVENT_AREAS';end if;
  select array_agg(a->>'id') into matches from jsonb_array_elements(coalesce(lay->'areas','[]')) a
   where a->>'eventAreaId'=aid::text or (nullif(a->>'eventAreaId','') is null and
    translate(lower(regexp_replace(trim(a->>'name'),'\s+',' ','g')),'áéíóúüñ','aeiouun')=translate(lower(regexp_replace(trim(aname),'\s+',' ','g')),'áéíóúüñ','aeiouun'));
  if cardinality(matches)>1 then raise exception 'FLOOR_AREA';end if;
  rooms:=array_append(rooms,coalesce(matches[1],'catalog-'||aid::text));
 end loop;
 return rooms;
end $$;


create or replace function public.v2_floor_selection(p_restaurant uuid,p_selection jsonb,p_guests integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lay jsonb; rev integer; ids text[]; cap integer; n integer; room text; rooms text[]; event_ids uuid[];
begin
 select layout,revision into lay,rev from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 if not found or rev is distinct from (p_selection->>'plan_revision')::integer then raise exception 'FLOOR_STALE';end if;
 if jsonb_typeof(p_selection->'table_ids') is distinct from 'array' or jsonb_array_length(p_selection->'table_ids')>200
   or coalesce((p_selection->>'duration_minutes')::integer,0) not between 15 and 1440 then raise exception 'FLOOR_ASSIGNMENT';end if;
 if jsonb_typeof(p_selection->'event_area_ids')='array' and jsonb_array_length(p_selection->'event_area_ids')>1 then
  if jsonb_array_length(p_selection->'event_area_ids')>20 then raise exception 'EVENT_AREAS';end if;
  select array_agg(distinct value::uuid) into event_ids from jsonb_array_elements_text(p_selection->'event_area_ids');
  rooms:=public.v2_event_floor_rooms(p_restaurant,event_ids);
  select coalesce(array_agg(t->>'id'),'{}'),coalesce(sum((t->>'seats')::integer),0) into ids,cap from jsonb_array_elements(lay->'tables') t where t->>'areaId'=any(rooms);
  if cardinality(ids)>0 and cap<coalesce(p_guests,0) and p_selection->'allow_extra_seats' is distinct from 'true'::jsonb then raise exception 'FLOOR_CAPACITY';end if;
  return p_selection||jsonb_build_object('table_ids',to_jsonb(ids),'whole_area_id',null,'whole_area_ids',to_jsonb(rooms));
 end if;
 p_selection:=p_selection||jsonb_build_object('whole_area_ids','[]'::jsonb);
 room:=nullif(p_selection->>'whole_area_id','');
 if room is not null then
  if not exists(select 1 from jsonb_array_elements(lay->'areas') a where a->>'id'=room) then raise exception 'FLOOR_ASSIGNMENT';end if;
  select array_agg(t->>'id') into ids from jsonb_array_elements(lay->'tables') t where t->>'areaId'=room;
  if coalesce(cardinality(ids),0)=0 then raise exception 'FLOOR_ASSIGNMENT';end if;
 else select array_agg(distinct value) into ids from jsonb_array_elements_text(p_selection->'table_ids');end if;
 if coalesce(cardinality(ids),0)=0 then return p_selection||jsonb_build_object('table_ids','[]'::jsonb,'whole_area_id',null);end if;
 select count(*),sum((t->>'seats')::integer) into n,cap from jsonb_array_elements(lay->'tables') t where t->>'id'=any(ids);
 if n<>cardinality(ids) then raise exception 'FLOOR_ASSIGNMENT';end if;
 if cap<coalesce(p_guests,0) and p_selection->'allow_extra_seats' is distinct from 'true'::jsonb then raise exception 'FLOOR_CAPACITY';end if;
 return p_selection||jsonb_build_object('table_ids',to_jsonb(ids),'whole_area_id',room);
end $$;


-- Authoritative conflict check also covers rooms without configured tables.
create or replace function public.v2_floor_check_event_areas(p_restaurant uuid,p_reservation uuid,p_ids text[],p_rooms text[],p_duration integer,p_status text,p_allow boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.v2_reservations%rowtype; other record; lay jsonb; other_rooms text[]; whole_rooms text[]; hit boolean; duration integer;
begin
 if p_allow is true or p_status='finished' then return;end if;
 select * into r from public.v2_reservations where restaurant_id=p_restaurant and id=p_reservation;
 if r.event_time is null or lower(trim(coalesce(r.status,''))) in ('cancelada','cancelado','cancelled','canceled') then return;end if;
 select layout into lay from public.v2_floor_plans where restaurant_id=p_restaurant;
 for other in select o.*,s.table_ids,s.whole_area_id,s.whole_area_ids,s.service_status,s.duration_minutes,s.reservation_id seat_id
  from public.v2_reservations o left join public.v2_floor_seatings s on s.reservation_id=o.id and s.restaurant_id=p_restaurant
  where o.restaurant_id=p_restaurant and o.id<>r.id and o.deleted_at is null and o.event_time is not null
   and o.event_date between r.event_date-1 and r.event_date+1
   and lower(trim(coalesce(o.status,''))) not in ('cancelada','cancelado','cancelled','canceled') and coalesce(s.service_status,'reserved')<>'finished'
 loop
  duration:=coalesce(other.duration_minutes,other.area_duration_minutes,(lay->>'defaultDurationMinutes')::integer,180);
  if other.event_date+other.event_time>=r.event_date+r.event_time+make_interval(mins=>p_duration)
   or other.event_date+other.event_time+make_interval(mins=>duration)<=r.event_date+r.event_time then continue;end if;
  whole_rooms:=coalesce(other.whole_area_ids,'{}')||case when other.whole_area_id is null then '{}'::text[] else array[other.whole_area_id] end;
  if cardinality(other.area_ids)>1 then whole_rooms:=public.v2_event_floor_rooms(p_restaurant,other.area_ids);
  elsif other.seat_id is null then
   if cardinality(other.area_ids)>0 then whole_rooms:=public.v2_event_floor_rooms(p_restaurant,other.area_ids);
   elsif other.area_id is not null then whole_rooms:=public.v2_event_floor_rooms(p_restaurant,array[other.area_id]);
   else select coalesce(array_agg(a->>'id'),'{}') into whole_rooms from jsonb_array_elements(lay->'areas') a where lower(trim(a->>'name'))=lower(trim(other.area));end if;
  end if;
  select coalesce(array_agg(t->>'areaId'),'{}') into other_rooms from jsonb_array_elements(lay->'tables') t where t->>'id'=any(coalesce(other.table_ids,'{}'));
  hit:=coalesce(other.table_ids,'{}')&&p_ids or whole_rooms&&p_rooms or other_rooms&&p_rooms
    or exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'id'=any(p_ids) and t->>'areaId'=any(whole_rooms));
  if hit then raise exception 'FLOOR_CONFLICT';end if;
 end loop;
end $$;


create or replace function public.v2_floor_apply(p_restaurant uuid,p_reservation uuid,p_floor jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.v2_reservations%rowtype; value jsonb; s public.v2_floor_seatings%rowtype; rev integer; rooms text[]; ids text[]; oldrev integer;
begin
 select * into r from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant;
 if not found then raise exception 'FLOOR_RESERVATION';end if;
 if p_floor is null then
  select * into s from public.v2_floor_seatings where reservation_id=p_reservation and restaurant_id=p_restaurant;
  if not found then
   if cardinality(r.area_ids)<2 then return;end if;
   s.duration_minutes:=coalesce(r.area_duration_minutes,180);s.service_status:='reserved';s.revision:=0;s.table_ids:='{}';
  end if;
  select revision into rev from public.v2_floor_plans where restaurant_id=p_restaurant;
  value:=to_jsonb(s)||jsonb_build_object('plan_revision',rev);
 else value:=p_floor;end if;
 if cardinality(r.area_ids)>1 then value:=value||jsonb_build_object('event_area_ids',to_jsonb(r.area_ids),'table_ids',coalesce(value->'table_ids','[]'::jsonb));
 else value:=value||jsonb_build_object('event_area_ids','[]'::jsonb,'whole_area_ids','[]'::jsonb);end if;
 if cardinality(r.area_ids)>1 then
  value:=public.v2_floor_selection(p_restaurant,value,r.guests);
  select revision into oldrev from public.v2_floor_seatings where reservation_id=r.id and restaurant_id=p_restaurant;
  if coalesce((value->>'revision')::integer,0)<>coalesce(oldrev,0) then raise exception 'FLOOR_STALE';end if;
  if coalesce(value->>'service_status','reserved') not in ('reserved','seated','finished') then raise exception 'FLOOR_ASSIGNMENT';end if;
  if r.event_time is null then
   delete from public.v2_floor_seatings where reservation_id=r.id and restaurant_id=p_restaurant;return;
  end if;
  rooms:=array(select jsonb_array_elements_text(value->'whole_area_ids'));ids:=array(select jsonb_array_elements_text(value->'table_ids'));
  perform public.v2_floor_check_event_areas(p_restaurant,r.id,ids,rooms,(value->>'duration_minutes')::integer,coalesce(value->>'service_status','reserved'),value->'allow_conflict'='true'::jsonb);
  insert into public.v2_floor_seatings(reservation_id,restaurant_id,table_ids,whole_area_id,whole_area_ids,duration_minutes,service_status,source_date,source_time,source_guests,revision)
  values(r.id,p_restaurant,ids,null,rooms,(value->>'duration_minutes')::integer,coalesce(value->>'service_status','reserved'),r.event_date,r.event_time,r.guests,coalesce(oldrev,0)+1)
  on conflict(reservation_id) do update set table_ids=excluded.table_ids,whole_area_id=null,whole_area_ids=excluded.whole_area_ids,duration_minutes=excluded.duration_minutes,service_status=excluded.service_status,source_date=excluded.source_date,source_time=excluded.source_time,source_guests=excluded.source_guests,revision=excluded.revision,updated_at=now();
  return;
 end if;
 -- Cancellation frees occupancy without discarding its saved seating history.
 if lower(trim(coalesce(r.status,''))) in ('cancelada','cancelado','cancelled','canceled') then
  if p_floor is not null and exists(select 1 from public.v2_floor_seatings where reservation_id=r.id and restaurant_id=p_restaurant and cardinality(whole_area_ids)>0) then
   select revision into oldrev from public.v2_floor_seatings where reservation_id=r.id and restaurant_id=p_restaurant;
   if coalesce((value->>'revision')::integer,0)<>oldrev then raise exception 'FLOOR_STALE';end if;
   delete from public.v2_floor_seatings where reservation_id=r.id and restaurant_id=p_restaurant;
  end if;
  return;
 end if;
 value:=public.v2_floor_selection(p_restaurant,value,r.guests);
 ids:=array(select jsonb_array_elements_text(value->'table_ids'));
 rooms:=case when nullif(value->>'whole_area_id','') is not null then array[value->>'whole_area_id'] when cardinality(ids)=0 and r.area_id is not null then public.v2_event_floor_rooms(p_restaurant,array[r.area_id]) else '{}'::text[] end;
 perform public.v2_floor_check_event_areas(p_restaurant,r.id,ids,rooms,(value->>'duration_minutes')::integer,coalesce(value->>'service_status','reserved'),value->'allow_conflict'='true'::jsonb);
 if value->'allow_extra_seats'='true'::jsonb then
 perform public.v2_floor_assign_extra_seats(p_restaurant,r.id,coalesce((value->>'revision')::integer,0),(value->>'plan_revision')::integer,
   array(select jsonb_array_elements_text(value->'table_ids')),nullif(value->>'whole_area_id',''),(value->>'duration_minutes')::integer,
   coalesce(value->>'service_status','reserved'),r.event_date,r.event_time,coalesce(r.guests,0),value->'allow_conflict'='true'::jsonb);
 elsif value->'allow_conflict'='true'::jsonb then
 perform public.v2_floor_assign_confirmed(p_restaurant,r.id,coalesce((value->>'revision')::integer,0),(value->>'plan_revision')::integer,
   array(select jsonb_array_elements_text(value->'table_ids')),nullif(value->>'whole_area_id',''),(value->>'duration_minutes')::integer,
   coalesce(value->>'service_status','reserved'),r.event_date,r.event_time,coalesce(r.guests,0));
 else
 perform public.v2_floor_assign(p_restaurant,r.id,coalesce((value->>'revision')::integer,0),(value->>'plan_revision')::integer,
   array(select jsonb_array_elements_text(value->'table_ids')),nullif(value->>'whole_area_id',''),(value->>'duration_minutes')::integer,
   coalesce(value->>'service_status','reserved'),r.event_date,r.event_time,coalesce(r.guests,0));
 end if;
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
  if cardinality(r.area_ids)>1 then raise exception 'MULTI_AREA_FORM';end if;
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
      and (s.table_ids && ids or (s.whole_area_ids && array(select t->>'areaId' from jsonb_array_elements(lay->'tables') t where t->>'id'=any(ids))) or (s.whole_area_id is not null and exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=s.whole_area_id and t->>'id'=any(ids)))
        or (p_whole_area_id is not null and exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=p_whole_area_id and t->>'id'=any(s.table_ids))))
  ) then raise exception 'FLOOR_CONFLICT'; end if;
  perform public.v2_floor_check_event_areas(p_restaurant_id,p_reservation_id,ids,case when p_whole_area_id is null then '{}'::text[] else array[p_whole_area_id] end,p_duration,p_status,false);
  insert into public.v2_floor_seatings(reservation_id,restaurant_id,table_ids,whole_area_id,duration_minutes,service_status,source_date,source_time,source_guests,revision)
  values(p_reservation_id,p_restaurant_id,ids,p_whole_area_id,p_duration,p_status,r.event_date,r.event_time,coalesce(r.guests,0),coalesce(oldrev,0)+1)
  on conflict(reservation_id) do update set table_ids=excluded.table_ids,whole_area_id=excluded.whole_area_id,
    whole_area_ids='{}',duration_minutes=excluded.duration_minutes,service_status=excluded.service_status,source_date=excluded.source_date,
    source_time=excluded.source_time,source_guests=excluded.source_guests,revision=excluded.revision,updated_at=now();
  return coalesce(oldrev,0)+1;
end $$;

create or replace function public.v2_floor_assign_confirmed(p_restaurant_id uuid,p_reservation_id uuid,p_revision integer,
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
  if cardinality(r.area_ids)>1 then raise exception 'MULTI_AREA_FORM';end if;
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
  -- The caller explicitly confirmed the overlap. Other validations above still apply.

  perform public.v2_floor_check_event_areas(p_restaurant_id,p_reservation_id,ids,case when p_whole_area_id is null then '{}'::text[] else array[p_whole_area_id] end,p_duration,p_status,true);
  insert into public.v2_floor_seatings(reservation_id,restaurant_id,table_ids,whole_area_id,duration_minutes,service_status,source_date,source_time,source_guests,revision)
  values(p_reservation_id,p_restaurant_id,ids,p_whole_area_id,p_duration,p_status,r.event_date,r.event_time,coalesce(r.guests,0),coalesce(oldrev,0)+1)
  on conflict(reservation_id) do update set table_ids=excluded.table_ids,whole_area_id=excluded.whole_area_id,
    whole_area_ids='{}',duration_minutes=excluded.duration_minutes,service_status=excluded.service_status,source_date=excluded.source_date,
    source_time=excluded.source_time,source_guests=excluded.source_guests,revision=excluded.revision,updated_at=now();
  return coalesce(oldrev,0)+1;
end $$;

create or replace function public.v2_floor_assign_extra_seats(p_restaurant_id uuid,p_reservation_id uuid,p_revision integer,
  p_plan_revision integer,p_table_ids text[],p_whole_area_id text,p_duration integer,p_status text,
  p_source_date date,p_source_time time,p_source_guests integer,p_allow_conflict boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare lay jsonb; planrev integer; oldrev integer; r public.v2_reservations%rowtype; ids text[];
  start_at timestamp; end_at timestamp; capacity integer; n integer;
begin
  perform public.v2_floor_authorize(p_restaurant_id,'operate');
  select layout,revision into lay,planrev from public.v2_floor_plans where restaurant_id=p_restaurant_id for update;
  if not found or p_plan_revision is distinct from planrev then raise exception 'FLOOR_STALE'; end if;
  select * into r from public.v2_reservations where id=p_reservation_id and restaurant_id=p_restaurant_id for share;
  if not found then raise exception 'FLOOR_RESERVATION'; end if;
  if cardinality(r.area_ids)>1 then raise exception 'MULTI_AREA_FORM';end if;
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
  -- Explicit added-seat confirmation; preserve the table capacity in the layout.
  start_at := r.event_date + r.event_time; end_at := start_at + make_interval(mins=>p_duration);
  if p_allow_conflict is not true and p_status <> 'finished' and exists (
    select 1 from public.v2_floor_seatings s join public.v2_reservations other on other.id=s.reservation_id
    where s.restaurant_id=p_restaurant_id and other.restaurant_id=p_restaurant_id and s.reservation_id<>p_reservation_id
      and other.deleted_at is null and lower(trim(coalesce(other.status,''))) not in ('cancelada','cancelado','cancelled','canceled')
      and s.service_status<>'finished'
      and other.event_date+coalesce(other.event_time,s.source_time) < end_at
      and other.event_date+coalesce(other.event_time,s.source_time)+make_interval(mins=>s.duration_minutes)>start_at
      and (s.table_ids && ids or (s.whole_area_ids && array(select t->>'areaId' from jsonb_array_elements(lay->'tables') t where t->>'id'=any(ids))) or (s.whole_area_id is not null and exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=s.whole_area_id and t->>'id'=any(ids)))
        or (p_whole_area_id is not null and exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=p_whole_area_id and t->>'id'=any(s.table_ids))))
  ) then raise exception 'FLOOR_CONFLICT'; end if;
  perform public.v2_floor_check_event_areas(p_restaurant_id,p_reservation_id,ids,case when p_whole_area_id is null then '{}'::text[] else array[p_whole_area_id] end,p_duration,p_status,p_allow_conflict);
  insert into public.v2_floor_seatings(reservation_id,restaurant_id,table_ids,whole_area_id,duration_minutes,service_status,source_date,source_time,source_guests,revision)
  values(p_reservation_id,p_restaurant_id,ids,p_whole_area_id,p_duration,p_status,r.event_date,r.event_time,coalesce(r.guests,0),coalesce(oldrev,0)+1)
  on conflict(reservation_id) do update set table_ids=excluded.table_ids,whole_area_id=excluded.whole_area_id,
    whole_area_ids='{}',duration_minutes=excluded.duration_minutes,service_status=excluded.service_status,source_date=excluded.source_date,
    source_time=excluded.source_time,source_guests=excluded.source_guests,revision=excluded.revision,updated_at=now();
  return coalesce(oldrev,0)+1;
end $$;

create or replace function public.v2_floor_save_reservation(p_restaurant uuid,p_id uuid,p_new boolean,p_payload jsonb,p_floor jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.v2_reservations%rowtype; v public.v2_reservations%rowtype;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 if p_id is null or p_new is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'FLOOR_RESERVATION';end if;
 select * into r from public.v2_reservations where id=p_id and restaurant_id=p_restaurant for update;
 if p_new and found then raise exception 'FLOOR_ALREADY_SAVED';end if;
 if not p_new and (r.id is null or r.deleted_at is not null) then raise exception 'FLOOR_RESERVATION';end if;
 if not p_new and p_floor->'source' is not null and p_floor->'source'<>'null'::jsonb and
  p_floor->'source' is distinct from jsonb_build_object('event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'quote_id',r.quote_id) then raise exception 'FLOOR_STALE';end if;
 p_payload:=public.v2_event_area_payload(p_restaurant,p_payload,to_jsonb(r));
 v:=jsonb_populate_record(r,p_payload);
 v.area_duration_minutes:=coalesce((p_floor->>'duration_minutes')::integer,v.area_duration_minutes,180);
 if length(trim(coalesce(v.client_name,'')))=0 or v.event_date is null or coalesce(v.guests,0)<1 then raise exception 'FLOOR_RESERVATION';end if;
 if v.client_id is not null and not exists(select 1 from public.v2_clients where id=v.client_id and restaurant_id=p_restaurant and deleted_at is null) then raise exception 'FLOOR_RESERVATION';end if;
 if v.area_id is not null and not exists(select 1 from public.v2_reservation_areas where id=v.area_id and restaurant_id=p_restaurant) then raise exception 'FLOOR_RESERVATION';end if;
 if p_new then
  insert into public.v2_reservations(id,restaurant_id,client_id,client_name,phone,event_date,event_time,area,area_id,area_ids,area_duration_minutes,guests,menu,deposit,payment_method,notes,status,subtotal,discount_pct,tip_pct,total,balance)
  values(p_id,p_restaurant,v.client_id,v.client_name,v.phone,v.event_date,v.event_time,v.area,v.area_id,v.area_ids,v.area_duration_minutes,v.guests,v.menu,coalesce(v.deposit,0),v.payment_method,v.notes,v.status,0,0,0,0,0);
 else
  -- Keep existing commercial amounts; the reservation form does not edit them.
  update public.v2_reservations set client_id=v.client_id,client_name=v.client_name,phone=v.phone,event_date=v.event_date,event_time=v.event_time,
    area=v.area,area_id=v.area_id,area_ids=v.area_ids,area_duration_minutes=v.area_duration_minutes,guests=v.guests,menu=v.menu,deposit=v.deposit,payment_method=v.payment_method,notes=v.notes,status=v.status
    where id=p_id and restaurant_id=p_restaurant;
 end if;
 perform public.v2_floor_apply(p_restaurant,p_id,p_floor);
 select * into r from public.v2_reservations where id=p_id and restaurant_id=p_restaurant;
 return to_jsonb(r);
end $$;

create or replace function public.v2_floor_save_quote(p_restaurant uuid,p_quote_id uuid,p_request_id uuid,p_payload jsonb,p_items jsonb,p_reservation uuid,p_floor jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb; qid uuid; rid uuid; previous integer; selected jsonb; existing_link uuid; q public.v2_quotes%rowtype; old_area text; old_area_id uuid; applied_floor jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 select id into rid from public.v2_reservations where restaurant_id=p_restaurant and deleted_at is null
  and ((p_reservation is not null and id=p_reservation) or (p_quote_id is not null and quote_id=p_quote_id)) limit 1 for update;
 if rid is not null and p_floor->'source' is not null and p_floor->'source'<>'null'::jsonb and
  p_floor->'source' is distinct from (select jsonb_build_object('event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'quote_id',r.quote_id) from public.v2_reservations r where r.id=rid) then raise exception 'FLOOR_STALE';end if;
 if rid is not null then select quote_id,area,area_id into existing_link,old_area,old_area_id from public.v2_reservations where id=rid;end if;
 select * into q from public.v2_quotes where id=p_quote_id and restaurant_id=p_restaurant;
 p_payload:=public.v2_event_area_payload(p_restaurant,p_payload,to_jsonb(q));
 -- These installed functions retain quote numbering, items, request deduplication and link rules.
 if p_reservation is null then
  select to_jsonb(f) into saved from public.v2_save_quote_once(p_restaurant=>p_restaurant,p_quote_id=>p_quote_id,p_request_id=>p_request_id,p_payload=>p_payload,p_items=>p_items) f;
 else
  select to_jsonb(f) into saved from public.v2_save_reservation_quote(p_restaurant=>p_restaurant,p_quote_id=>p_quote_id,p_request_id=>p_request_id,p_payload=>p_payload,p_items=>p_items,p_reservation=>p_reservation) f;
 end if;
 if jsonb_typeof(saved)='array' then saved:=saved->0;end if;
 qid:=(saved->>'id')::uuid;
 select * into q from public.v2_quotes where id=qid and restaurant_id=p_restaurant and deleted_at is null;
 if not found then raise exception 'FLOOR_QUOTE';end if;
 -- A repeated new-quote request already saved its floor data in the same transaction.
 if p_quote_id is null and (existing_link=qid or exists(select 1 from public.v2_floor_quote_plans where quote_id=qid and restaurant_id=p_restaurant)) then return saved;end if;
 update public.v2_quotes set area_ids=array(select jsonb_array_elements_text(p_payload->'area_ids')::uuid),
 area=p_payload->>'area',area_id=nullif(p_payload->>'area_id','')::uuid,
 area_duration_minutes=coalesce((p_floor->>'duration_minutes')::integer,area_duration_minutes,180) where id=qid and restaurant_id=p_restaurant;
 select * into q from public.v2_quotes where id=qid and restaurant_id=p_restaurant;
 select id into rid from public.v2_reservations where quote_id=qid and restaurant_id=p_restaurant and deleted_at is null limit 1;
 if rid is not null then
  perform public.v2_event_quote_to_reservation(p_restaurant,rid,qid);
  applied_floor:=p_floor;
  if p_floor is null and (old_area is distinct from q.area or old_area_id is distinct from q.area_id) then
   -- A caller without a floor draft must not leave tables in the previous area.
   applied_floor:=(public.v2_floor_form(p_restaurant,rid,null)->'selection')||jsonb_build_object('table_ids','[]'::jsonb,'whole_area_id',null,'duration_minutes',180);
  end if;
  perform public.v2_floor_apply(p_restaurant,rid,applied_floor);
 elsif p_floor is not null then
  select revision into previous from public.v2_floor_quote_plans where quote_id=qid and restaurant_id=p_restaurant;
  if coalesce(previous,0) is distinct from coalesce((p_floor->>'revision')::integer,0) then raise exception 'FLOOR_STALE';end if;
  selected:=public.v2_floor_selection(p_restaurant,p_floor||jsonb_build_object('event_area_ids',to_jsonb(q.area_ids)),q.guests);
  insert into public.v2_floor_quote_plans(quote_id,restaurant_id,selection,revision) values(qid,p_restaurant,selected,coalesce(previous,0)+1)
   on conflict(quote_id) do update set selection=excluded.selection,revision=excluded.revision,updated_at=now();
 end if;
 return saved;
end $$;

create or replace function public.v2_event_quote_to_reservation(p_restaurant uuid,p_reservation uuid,p_quote uuid)
returns void language plpgsql security definer set search_path='' as $$
declare q public.v2_quotes%rowtype; cid uuid; menu_text text;
begin
 select * into q from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant and deleted_at is null;
 if not found then raise exception 'EVENT_LINK_QUOTE';end if;
 if not exists(select 1 from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant and quote_id=p_quote and deleted_at is null) then raise exception 'EVENT_LINK_RESERVATION';end if;
 cid:=q.client_id;
 if cid is null then
  cid:=public.v2_find_or_create_client(p_restaurant_id=>p_restaurant,p_name=>q.client_name,p_phone=>q.client_phone,p_email=>q.client_email);
 elsif not exists(select 1 from public.v2_clients where id=cid and restaurant_id=p_restaurant and deleted_at is null) then raise exception 'EVENT_LINK_CLIENT';end if;
 if q.area_id is not null and not exists(select 1 from public.v2_reservation_areas where id=q.area_id and restaurant_id=p_restaurant) then raise exception 'EVENT_LINK_AREA';end if;
 select string_agg(i.name||case when i.quantity<>1 then ' × '||i.quantity::text else '' end,', ' order by i.position) into menu_text from public.v2_quote_items i where quote_id=p_quote;
 update public.v2_reservations set client_id=cid,client_name=q.client_name,phone=q.client_phone,
  event_date=q.event_date,event_time=q.event_time,area=q.area,area_id=q.area_id,area_ids=q.area_ids,area_duration_minutes=q.area_duration_minutes,guests=q.guests,
  menu=coalesce(menu_text,''),subtotal=q.subtotal,discount_pct=q.discount_pct,tip_pct=q.tip_pct,
  total=q.total,deposit=q.deposit,payment_method=q.payment_method,balance=q.balance,notes=q.internal_notes
  where id=p_reservation and restaurant_id=p_restaurant and quote_id=p_quote and deleted_at is null;
end $$;

create or replace function public.v2_floor_convert_quote(p_restaurant uuid,p_quote uuid,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.v2_quotes%rowtype; r public.v2_reservations%rowtype; cid uuid; menu_text text;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 select * into q from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant and deleted_at is null for update;
 if not found then raise exception 'FLOOR_QUOTE';end if;
 select * into r from public.v2_reservations where quote_id=p_quote and restaurant_id=p_restaurant and deleted_at is null limit 1;
 if found then raise exception 'FLOOR_ALREADY_SAVED';end if;
 if p_expected is null or (p_expected->>'event_date')::date is distinct from q.event_date
  or nullif(p_expected->>'event_time','')::time is distinct from q.event_time
  or (p_expected->>'guests')::integer is distinct from q.guests then raise exception 'FLOOR_STALE';end if;
 cid:=q.client_id;
 if cid is null then cid:=public.v2_find_or_create_client(p_restaurant_id=>p_restaurant,p_name=>q.client_name,p_phone=>q.client_phone,p_email=>q.client_email);end if;
 select string_agg(i.name||case when i.quantity<>1 then ' × '||i.quantity::text else '' end,', ' order by i.position) into menu_text from public.v2_quote_items i where quote_id=p_quote;
 insert into public.v2_reservations(restaurant_id,quote_id,client_id,client_name,phone,event_date,event_time,area,area_id,area_ids,area_duration_minutes,guests,menu,subtotal,discount_pct,tip_pct,total,deposit,payment_method,balance,notes,status)
 values(p_restaurant,p_quote,cid,q.client_name,q.client_phone,q.event_date,q.event_time,q.area,q.area_id,q.area_ids,q.area_duration_minutes,q.guests,coalesce(menu_text,''),q.subtotal,q.discount_pct,q.tip_pct,q.total,q.deposit,q.payment_method,q.balance,q.internal_notes,'confirmada') returning * into r;
 perform public.v2_floor_transfer_exceptions(p_restaurant,r.id,p_quote,p_expected->'allow_conflict'='true'::jsonb,p_expected->'allow_extra_seats'='true'::jsonb);
 return to_jsonb(r);
end $$;

create or replace function public.v2_floor_transfer_exceptions(p_restaurant uuid,p_reservation uuid,p_quote uuid,p_confirmed boolean,p_extra boolean)
returns void language plpgsql security definer set search_path='' as $$
declare draft jsonb; rev integer;
begin
 if exists(select 1 from public.v2_floor_seatings where reservation_id=p_reservation and restaurant_id=p_restaurant) then
  draft:=public.v2_floor_form(p_restaurant,p_reservation,null)->'selection';
  perform public.v2_floor_apply(p_restaurant,p_reservation,draft||jsonb_build_object('allow_conflict',p_confirmed is true,'allow_extra_seats',p_extra is true));return;
 end if;
 select selection into draft from public.v2_floor_quote_plans where quote_id=p_quote and restaurant_id=p_restaurant;
 if draft is null or (jsonb_array_length(draft->'table_ids')=0 and nullif(draft->>'whole_area_id','') is null and coalesce(jsonb_array_length(draft->'event_area_ids'),0)<2) then return;end if;
 select revision into rev from public.v2_floor_plans where restaurant_id=p_restaurant;
 -- Proposal is tentative. Validate against today's layout and availability at confirmation.
 perform public.v2_floor_apply(p_restaurant,p_reservation,draft||jsonb_build_object('revision',0,'plan_revision',rev,'service_status','reserved','allow_conflict',p_confirmed is true,'allow_extra_seats',p_extra is true));
end $$;

create or replace function public.v2_floor_form(p_restaurant uuid,p_reservation uuid default null,p_quote uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; s jsonb; qrev integer:=0; prev integer; stamp jsonb; area_ids uuid[]; duration integer;
begin
 perform public.v2_floor_authorize(p_restaurant,'read');
 select revision into prev from public.v2_floor_plans where restaurant_id=p_restaurant;
 rid:=p_reservation;
 if p_quote is not null then
  perform 1 from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant and deleted_at is null;
  if not found then raise exception 'FLOOR_QUOTE';end if;
  select id into rid from public.v2_reservations where quote_id=p_quote and restaurant_id=p_restaurant and deleted_at is null limit 1;
  if rid is null then
   select q.area_ids,q.area_duration_minutes into area_ids,duration from public.v2_quotes q where q.id=p_quote and q.restaurant_id=p_restaurant;
   select selection,revision into s,qrev from public.v2_floor_quote_plans where quote_id=p_quote and restaurant_id=p_restaurant;
  end if;
 end if;
 if rid is not null then
  select jsonb_build_object('event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'quote_id',r.quote_id) into stamp
    from public.v2_reservations r where r.id=rid and r.restaurant_id=p_restaurant and r.deleted_at is null;
  if not found then raise exception 'FLOOR_RESERVATION';end if;
  select r.area_ids,r.area_duration_minutes into area_ids,duration from public.v2_reservations r where r.id=rid and r.restaurant_id=p_restaurant;
  select to_jsonb(x) into s from public.v2_floor_seatings x where reservation_id=rid and restaurant_id=p_restaurant;
 end if;
 if s is null and duration is not null then s:=jsonb_build_object('duration_minutes',duration);end if;
 return jsonb_build_object('multi_area_version',1,'area_ids',to_jsonb(coalesce(area_ids,'{}')),'selection',coalesce(s,'{}'::jsonb)||jsonb_build_object('plan_revision',coalesce(prev,0),
  'revision',case when rid is null then coalesce(qrev,0) else coalesce((s->>'revision')::integer,0) end),
  'reservation_id',rid,'proposal',p_quote is not null and rid is null,'source',stamp);
end $$;

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
    'integration_version', 2,
    'revision', coalesce((select p.revision from public.v2_floor_plans p where p.restaurant_id=p_restaurant_id),0),
    'layout', coalesce((select p.layout from public.v2_floor_plans p where p.restaurant_id=p_restaurant_id),'{"areas":[],"tables":[]}'::jsonb),
    'reservations', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'quote_id',r.quote_id,'client_name',r.client_name,'phone',r.phone,
      'event_date',r.event_date,'event_time',r.event_time,'guests',coalesce(r.guests,0),'area',r.area,'area_id',r.area_id,'area_ids',r.area_ids,'area_duration_minutes',r.area_duration_minutes,'status',r.status)
      order by r.event_date,r.event_time,r.id) from public.v2_reservations r
      where r.restaurant_id=p_restaurant_id and r.deleted_at is null and r.event_date between p_date-1 and p_date+1),'[]'::jsonb),
    'seatings', coalesce((select jsonb_agg(to_jsonb(s)) from public.v2_floor_seatings s join public.v2_reservations r on r.id=s.reservation_id
      where s.restaurant_id=p_restaurant_id and r.restaurant_id=p_restaurant_id and r.deleted_at is null
        and r.event_date between p_date-1 and p_date+1),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.v2_event_area_labels(p_restaurant uuid,p_kind text,p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare layout jsonb; rows jsonb;
begin
  perform public.v2_floor_authorize(p_restaurant,'read');
  if p_kind is null or p_kind not in ('quote','reservation') or p_ids is null or cardinality(p_ids)>50 then
    raise exception 'FLOOR_LABEL_INPUT' using errcode='22023';
  end if;
  if cardinality(p_ids)=0 then return jsonb_build_object('layout',jsonb_build_object('areas','[]'::jsonb,'tables','[]'::jsonb),'rows','[]'::jsonb);end if;
  select p.layout into layout from public.v2_floor_plans p where p.restaurant_id=p_restaurant;
  -- Nombres e identidades únicamente: no fotos/fondos, geometría o reservas del día.
  layout:=jsonb_build_object(
    'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a->>'id','name',a->>'name') order by n) from jsonb_array_elements(coalesce(layout->'areas','[]'::jsonb)) with ordinality x(a,n)),'[]'::jsonb),
    'tables',coalesce((select jsonb_agg(jsonb_build_object('id',t->>'id','areaId',t->>'areaId','name',t->>'name') order by n) from jsonb_array_elements(coalesce(layout->'tables','[]'::jsonb)) with ordinality x(t,n)),'[]'::jsonb)
  );
  if p_kind='quote' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'area',coalesce(r.area,q.area,''),'selection',
      case when r.id is not null then
        case when s.reservation_id is null then null else jsonb_build_object('table_ids',s.table_ids,'whole_area_id',s.whole_area_id,'whole_area_ids',s.whole_area_ids) end
      when qp.quote_id is not null and (jsonb_typeof(qp.selection->'table_ids')='array' or nullif(qp.selection->>'whole_area_id','') is not null)
        then jsonb_build_object('table_ids',coalesce(qp.selection->'table_ids','[]'::jsonb),'whole_area_id',qp.selection->'whole_area_id','whole_area_ids',qp.selection->'whole_area_ids')
      else null end
    )),'[]'::jsonb) into rows
    from public.v2_quotes q
    left join lateral (
      select rr.id,rr.area from public.v2_reservations rr
      where rr.quote_id=q.id and rr.restaurant_id=p_restaurant and rr.deleted_at is null
      order by rr.id limit 1
    ) r on true
    left join public.v2_floor_seatings s on s.reservation_id=r.id and s.restaurant_id=p_restaurant
    left join public.v2_floor_quote_plans qp on qp.quote_id=q.id and qp.restaurant_id=p_restaurant
    where q.restaurant_id=p_restaurant and q.id=any(p_ids) and q.deleted_at is null;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'area',coalesce(r.area,''),'selection',
      case when s.reservation_id is null then null else jsonb_build_object('table_ids',s.table_ids,'whole_area_id',s.whole_area_id,'whole_area_ids',s.whole_area_ids) end
    )),'[]'::jsonb) into rows
    from public.v2_reservations r
    left join public.v2_floor_seatings s on s.reservation_id=r.id and s.restaurant_id=p_restaurant
    where r.restaurant_id=p_restaurant and r.id=any(p_ids) and r.deleted_at is null;
  end if;
  return jsonb_build_object('layout',layout,'rows',rows);
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
  if exists(select 1 from public.v2_floor_seatings s cross join lateral unnest(s.whole_area_ids) room(id)
   where s.restaurant_id=p_restaurant_id and exists(select 1 from public.v2_floor_plans p cross join lateral jsonb_array_elements(p.layout->'areas') a where p.restaurant_id=p_restaurant_id and a->>'id'=room.id)
   and not exists(select 1 from jsonb_array_elements(p_layout->'areas') a where a->>'id'=room.id)) then raise exception 'FLOOR_IN_USE';end if;
  -- Moving a table to another area can change exclusive-room availability; require unassignment first.
  if exists(select 1 from public.v2_floor_plans p cross join lateral jsonb_array_elements(p.layout->'tables') oldt
    join jsonb_array_elements(p_layout->'tables') newt on newt->>'id'=oldt->>'id'
    where p.restaurant_id=p_restaurant_id and oldt->>'areaId'<>newt->>'areaId'
      and exists(select 1 from public.v2_floor_seatings s where s.restaurant_id=p_restaurant_id
        and (oldt->>'id'=any(s.table_ids) or s.whole_area_id in (oldt->>'areaId',newt->>'areaId')))) then raise exception 'FLOOR_IN_USE'; end if;
  update public.v2_floor_plans set layout=p_layout, revision=rev+1,updated_at=now() where restaurant_id=p_restaurant_id;
  return rev+1;
end $$;

revoke all on function public.v2_event_area_payload(uuid,jsonb,jsonb),public.v2_event_floor_rooms(uuid,uuid[]),public.v2_floor_check_event_areas(uuid,uuid,text[],text[],integer,text,boolean),public.v2_floor_selection(uuid,jsonb,integer),public.v2_floor_apply(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.v2_event_area_labels(uuid,text,uuid[]) from public,anon;
grant execute on function public.v2_event_area_labels(uuid,text,uuid[]) to authenticated;

create or replace function public.v2_nearby_reservations_for_areas(p_restaurant uuid,p_area_ids uuid[],p_date date,p_time time,p_exclude uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'read');
 if p_area_ids is null or cardinality(p_area_ids)>20 or p_date is null or p_time is null then raise exception 'EVENT_AREAS';end if;
 if exists(select 1 from unnest(p_area_ids) selected(id) where not exists(select 1 from public.v2_reservation_areas a where a.id=selected.id and a.restaurant_id=p_restaurant)) then raise exception 'EVENT_AREAS';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.event_time,x.id),'[]'::jsonb) into result from (
  select r.id,r.client_name,r.event_date,r.event_time,r.guests,r.area from public.v2_reservations r
  where r.restaurant_id=p_restaurant and r.deleted_at is null and (p_exclude is null or r.id<>p_exclude)
   and lower(trim(coalesce(r.status,''))) not in ('cancelada','cancelado','cancelled','canceled')
   and r.event_date=p_date and r.event_date+r.event_time between p_date+p_time-interval '3 hours' and p_date+p_time+interval '3 hours'
   and (r.area_ids&&p_area_ids or r.area_id=any(p_area_ids) or exists(select 1 from public.v2_reservation_areas a where a.restaurant_id=p_restaurant and a.id=any(p_area_ids) and lower(trim(a.name))=lower(trim(r.area))))
  order by r.event_time,r.id limit 250
 ) x;
 return result;
end $$;
revoke all on function public.v2_nearby_reservations_for_areas(uuid,uuid[],date,time,uuid) from public,anon;
grant execute on function public.v2_nearby_reservations_for_areas(uuid,uuid[],date,time,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
