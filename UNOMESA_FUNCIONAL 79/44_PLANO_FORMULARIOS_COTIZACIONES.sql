-- EXCLUSIVO: Proyecto nuevo prueba. No ejecutar en UnoMesa funcional.
-- Ejecutar después de 43_PLANO_MESAS.sql. No ejecuta cambios en registros existentes.
-- Añade propuestas de mesas y RPCs transaccionales. Conserva las funciones antiguas.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regprocedure('public.v2_floor_read(uuid,date)') is null then raise exception 'Aplicar primero 43_PLANO_MESAS.sql en pruebas.';end if;
end $$;
create table if not exists public.v2_floor_quote_plans(
 quote_id uuid primary key references public.v2_quotes(id) on delete cascade,
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 selection jsonb not null, revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create index if not exists v2_floor_quote_plans_restaurant on public.v2_floor_quote_plans(restaurant_id);
alter table public.v2_floor_quote_plans enable row level security;
revoke all on public.v2_floor_quote_plans from public,anon,authenticated;

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
 if cap<coalesce(p_guests,0) then raise exception 'FLOOR_CAPACITY';end if;
 return p_selection||jsonb_build_object('table_ids',to_jsonb(ids),'whole_area_id',room);
end $$;
revoke all on function public.v2_floor_selection(uuid,jsonb,integer) from public,anon,authenticated;

create or replace function public.v2_floor_form(p_restaurant uuid,p_reservation uuid default null,p_quote uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; s jsonb; qrev integer:=0; prev integer; stamp jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'read');
 select revision into prev from public.v2_floor_plans where restaurant_id=p_restaurant;
 rid:=p_reservation;
 if p_quote is not null then
  perform 1 from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant and deleted_at is null;
  if not found then raise exception 'FLOOR_QUOTE';end if;
  select id into rid from public.v2_reservations where quote_id=p_quote and restaurant_id=p_restaurant and deleted_at is null limit 1;
  if rid is null then
   select selection,revision into s,qrev from public.v2_floor_quote_plans where quote_id=p_quote and restaurant_id=p_restaurant;
  end if;
 end if;
 if rid is not null then
  select jsonb_build_object('event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'quote_id',r.quote_id) into stamp
    from public.v2_reservations r where r.id=rid and r.restaurant_id=p_restaurant and r.deleted_at is null;
  if not found then raise exception 'FLOOR_RESERVATION';end if;
  select to_jsonb(x) into s from public.v2_floor_seatings x where reservation_id=rid and restaurant_id=p_restaurant;
 end if;
 return jsonb_build_object('selection',coalesce(s,'{}'::jsonb)||jsonb_build_object('plan_revision',coalesce(prev,0),
  'revision',case when rid is null then coalesce(qrev,0) else coalesce((s->>'revision')::integer,0) end),
  'reservation_id',rid,'proposal',p_quote is not null and rid is null,'source',stamp);
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
 perform public.v2_floor_assign(p_restaurant,r.id,coalesce((value->>'revision')::integer,0),(value->>'plan_revision')::integer,
   array(select jsonb_array_elements_text(value->'table_ids')),nullif(value->>'whole_area_id',''),(value->>'duration_minutes')::integer,
   coalesce(value->>'service_status','reserved'),r.event_date,r.event_time,coalesce(r.guests,0));
end $$;
revoke all on function public.v2_floor_apply(uuid,uuid,jsonb) from public,anon,authenticated;

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
 v:=jsonb_populate_record(r,p_payload);
 if length(trim(coalesce(v.client_name,'')))=0 or v.event_date is null or coalesce(v.guests,0)<1 then raise exception 'FLOOR_RESERVATION';end if;
 if v.client_id is not null and not exists(select 1 from public.v2_clients where id=v.client_id and restaurant_id=p_restaurant and deleted_at is null) then raise exception 'FLOOR_RESERVATION';end if;
 if v.area_id is not null and not exists(select 1 from public.v2_reservation_areas where id=v.area_id and restaurant_id=p_restaurant) then raise exception 'FLOOR_RESERVATION';end if;
 if p_new then
  insert into public.v2_reservations(id,restaurant_id,client_id,client_name,phone,event_date,event_time,area,area_id,guests,menu,deposit,payment_method,notes,status,subtotal,discount_pct,tip_pct,total,balance)
  values(p_id,p_restaurant,v.client_id,v.client_name,v.phone,v.event_date,v.event_time,v.area,v.area_id,v.guests,v.menu,coalesce(v.deposit,0),v.payment_method,v.notes,v.status,0,0,0,0,0);
 else
  -- Keep existing commercial amounts; the reservation form does not edit them.
  update public.v2_reservations set client_id=v.client_id,client_name=v.client_name,phone=v.phone,event_date=v.event_date,event_time=v.event_time,
    area=v.area,area_id=v.area_id,guests=v.guests,menu=v.menu,deposit=v.deposit,payment_method=v.payment_method,notes=v.notes,status=v.status
    where id=p_id and restaurant_id=p_restaurant;
 end if;
 perform public.v2_floor_apply(p_restaurant,p_id,p_floor);
 select * into r from public.v2_reservations where id=p_id and restaurant_id=p_restaurant;
 return to_jsonb(r);
end $$;

create or replace function public.v2_floor_save_quote(p_restaurant uuid,p_quote_id uuid,p_request_id uuid,p_payload jsonb,p_items jsonb,p_reservation uuid,p_floor jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb; qid uuid; rid uuid; previous integer; selected jsonb; existing_link uuid; q public.v2_quotes%rowtype;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 select id into rid from public.v2_reservations where restaurant_id=p_restaurant and deleted_at is null
  and ((p_reservation is not null and id=p_reservation) or (p_quote_id is not null and quote_id=p_quote_id)) limit 1 for update;
 if rid is not null and p_floor->'source' is not null and p_floor->'source'<>'null'::jsonb and
  p_floor->'source' is distinct from (select jsonb_build_object('event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'quote_id',r.quote_id) from public.v2_reservations r where r.id=rid) then raise exception 'FLOOR_STALE';end if;
 if rid is not null then select quote_id into existing_link from public.v2_reservations where id=rid;end if;
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
 select id into rid from public.v2_reservations where quote_id=qid and restaurant_id=p_restaurant and deleted_at is null limit 1;
 if rid is not null then
  perform public.v2_floor_apply(p_restaurant,rid,p_floor);
 elsif p_floor is not null then
  select revision into previous from public.v2_floor_quote_plans where quote_id=qid and restaurant_id=p_restaurant;
  if coalesce(previous,0) is distinct from coalesce((p_floor->>'revision')::integer,0) then raise exception 'FLOOR_STALE';end if;
  selected:=public.v2_floor_selection(p_restaurant,p_floor,q.guests);
  insert into public.v2_floor_quote_plans(quote_id,restaurant_id,selection,revision) values(qid,p_restaurant,selected,coalesce(previous,0)+1)
   on conflict(quote_id) do update set selection=excluded.selection,revision=excluded.revision,updated_at=now();
 end if;
 return saved;
end $$;

create or replace function public.v2_floor_transfer_proposal(p_restaurant uuid,p_reservation uuid,p_quote uuid)
returns void language plpgsql security definer set search_path='' as $$
declare draft jsonb; rev integer;
begin
 if exists(select 1 from public.v2_floor_seatings where reservation_id=p_reservation and restaurant_id=p_restaurant) then
  perform public.v2_floor_apply(p_restaurant,p_reservation,null);return;
 end if;
 select selection into draft from public.v2_floor_quote_plans where quote_id=p_quote and restaurant_id=p_restaurant;
 if draft is null or (jsonb_array_length(draft->'table_ids')=0 and nullif(draft->>'whole_area_id','') is null) then return;end if;
 select revision into rev from public.v2_floor_plans where restaurant_id=p_restaurant;
 -- Proposal is tentative. Validate against today's layout and availability at confirmation.
 perform public.v2_floor_apply(p_restaurant,p_reservation,draft||jsonb_build_object('revision',0,'plan_revision',rev,'service_status','reserved'));
end $$;
revoke all on function public.v2_floor_transfer_proposal(uuid,uuid,uuid) from public,anon,authenticated;

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
 perform public.v2_floor_transfer_proposal(p_restaurant,r.id,p_quote);
 return to_jsonb(r);
end $$;

create or replace function public.v2_floor_link_quote(p_restaurant uuid,p_reservation uuid,p_quote uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 select to_jsonb(f) into result from public.v2_link_reservation_quote(p_restaurant=>p_restaurant,p_reservation=>p_reservation,p_quote=>p_quote) f;
 perform public.v2_floor_transfer_proposal(p_restaurant,p_reservation,p_quote);
 return result;
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
      'event_date',r.event_date,'event_time',r.event_time,'guests',coalesce(r.guests,0),'area',r.area,'status',r.status)
      order by r.event_date,r.event_time,r.id) from public.v2_reservations r
      where r.restaurant_id=p_restaurant_id and r.deleted_at is null and r.event_date between p_date-1 and p_date+1),'[]'::jsonb),
    'seatings', coalesce((select jsonb_agg(to_jsonb(s)) from public.v2_floor_seatings s join public.v2_reservations r on r.id=s.reservation_id
      where s.restaurant_id=p_restaurant_id and r.restaurant_id=p_restaurant_id and r.deleted_at is null
        and r.event_date between p_date-1 and p_date+1),'[]'::jsonb)
  ) into result;
  return result;
end $$;


revoke all on function public.v2_floor_form(uuid,uuid,uuid),public.v2_floor_save_reservation(uuid,uuid,boolean,jsonb,jsonb),public.v2_floor_save_quote(uuid,uuid,uuid,jsonb,jsonb,uuid,jsonb),public.v2_floor_convert_quote(uuid,uuid,jsonb),public.v2_floor_link_quote(uuid,uuid,uuid) from public,anon;
grant execute on function public.v2_floor_form(uuid,uuid,uuid),public.v2_floor_save_reservation(uuid,uuid,boolean,jsonb,jsonb),public.v2_floor_save_quote(uuid,uuid,uuid,jsonb,jsonb,uuid,jsonb),public.v2_floor_convert_quote(uuid,uuid,jsonb),public.v2_floor_link_quote(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
