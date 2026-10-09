-- EXCLUSIVO: PROYECTO_NUEVO_PRUEBA. Aplicar después de 43, 44 y 45.
-- Solo funciones: no cambia tablas, columnas, políticas ni registros al instalar.
-- La confirmación de asientos adicionales pertenece a cada guardado.
-- Mantiene capacidad habitual, permisos, restaurante, revisiones y transacciones.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regprocedure('public.v2_floor_transfer_confirmed(uuid,uuid,uuid,boolean)') is null then
 raise exception 'Aplicar primero 43, 44 y 45 en pruebas.';end if;
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

create or replace function public.v2_floor_selection(p_restaurant uuid,p_selection jsonb,p_guests integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lay jsonb; rev integer; ids text[]; cap integer; n integer; room text;
begin
 select layout,revision into lay,rev from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 if not found or rev is distinct from (p_selection->>'plan_revision')::integer then raise exception 'FLOOR_STALE';end if;
 if jsonb_typeof(p_selection->'table_ids') is distinct from 'array' or jsonb_array_length(p_selection->'table_ids')>200
   or coalesce((p_selection->>'duration_minutes')::integer,0) not between 15 and 1440 then raise exception 'FLOOR_ASSIGNMENT';end if;
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

create or replace function public.v2_floor_apply(p_restaurant uuid,p_reservation uuid,p_floor jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.v2_reservations%rowtype; value jsonb; s public.v2_floor_seatings%rowtype; rev integer;
begin
 select * into r from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant;
 if not found then raise exception 'FLOOR_RESERVATION';end if;
 if p_floor is null then
  select * into s from public.v2_floor_seatings where reservation_id=p_reservation and restaurant_id=p_restaurant;
  if not found then return;end if;
  select revision into rev from public.v2_floor_plans where restaurant_id=p_restaurant;
  value:=to_jsonb(s)||jsonb_build_object('plan_revision',rev);
 else value:=p_floor;end if;
 -- Cancellation frees occupancy without discarding its saved seating history.
 if lower(trim(coalesce(r.status,''))) in ('cancelada','cancelado','cancelled','canceled') then return;end if;
 value:=public.v2_floor_selection(p_restaurant,value,r.guests);
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

create or replace function public.v2_floor_transfer_exceptions(p_restaurant uuid,p_reservation uuid,p_quote uuid,p_confirmed boolean,p_extra boolean)
returns void language plpgsql security definer set search_path='' as $$
declare draft jsonb; rev integer;
begin
 if exists(select 1 from public.v2_floor_seatings where reservation_id=p_reservation and restaurant_id=p_restaurant) then
  draft:=public.v2_floor_form(p_restaurant,p_reservation,null)->'selection';
  perform public.v2_floor_apply(p_restaurant,p_reservation,draft||jsonb_build_object('allow_conflict',p_confirmed is true,'allow_extra_seats',p_extra is true));return;
 end if;
 select selection into draft from public.v2_floor_quote_plans where quote_id=p_quote and restaurant_id=p_restaurant;
 if draft is null or (jsonb_array_length(draft->'table_ids')=0 and nullif(draft->>'whole_area_id','') is null) then return;end if;
 select revision into rev from public.v2_floor_plans where restaurant_id=p_restaurant;
 -- Proposal is tentative. Validate against today's layout and availability at confirmation.
 perform public.v2_floor_apply(p_restaurant,p_reservation,draft||jsonb_build_object('revision',0,'plan_revision',rev,'service_status','reserved','allow_conflict',p_confirmed is true,'allow_extra_seats',p_extra is true));
end $$;

create or replace function public.v2_floor_transfer_confirmed(p_restaurant uuid,p_reservation uuid,p_quote uuid,p_confirmed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin perform public.v2_floor_transfer_exceptions(p_restaurant,p_reservation,p_quote,p_confirmed,false);end $$;

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
 insert into public.v2_reservations(restaurant_id,quote_id,client_id,client_name,phone,event_date,event_time,area,area_id,guests,menu,subtotal,discount_pct,tip_pct,total,deposit,payment_method,balance,notes,status)
 values(p_restaurant,p_quote,cid,q.client_name,q.client_phone,q.event_date,q.event_time,q.area,q.area_id,q.guests,coalesce(menu_text,''),q.subtotal,q.discount_pct,q.tip_pct,q.total,q.deposit,q.payment_method,q.balance,q.internal_notes,'confirmada') returning * into r;
 perform public.v2_floor_transfer_exceptions(p_restaurant,r.id,p_quote,p_expected->'allow_conflict'='true'::jsonb,p_expected->'allow_extra_seats'='true'::jsonb);
 return to_jsonb(r);
end $$;

create or replace function public.v2_floor_link_quote_extra_seats(p_restaurant uuid,p_reservation uuid,p_quote uuid,p_allow_conflict boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 select to_jsonb(f) into result from public.v2_link_reservation_quote(p_restaurant=>p_restaurant,p_reservation=>p_reservation,p_quote=>p_quote) f;
 perform public.v2_floor_transfer_exceptions(p_restaurant,p_reservation,p_quote,p_allow_conflict,true);
 return result;
end $$;
revoke all on function public.v2_floor_assign_extra_seats(uuid,uuid,integer,integer,text[],text,integer,text,date,time,integer,boolean),public.v2_floor_link_quote_extra_seats(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.v2_floor_assign_extra_seats(uuid,uuid,integer,integer,text[],text,integer,text,date,time,integer,boolean),public.v2_floor_link_quote_extra_seats(uuid,uuid,uuid,boolean) to authenticated;
revoke all on function public.v2_floor_selection(uuid,jsonb,integer),public.v2_floor_apply(uuid,uuid,jsonb),public.v2_floor_transfer_exceptions(uuid,uuid,uuid,boolean,boolean),public.v2_floor_transfer_confirmed(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.v2_floor_convert_quote(uuid,uuid,jsonb) from public,anon;
grant execute on function public.v2_floor_convert_quote(uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
