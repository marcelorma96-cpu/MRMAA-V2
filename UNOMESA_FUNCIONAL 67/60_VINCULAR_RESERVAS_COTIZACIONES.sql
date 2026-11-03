-- UnoMesa: vincular registros existentes de cualquier estado o cantidad de invitados.
-- Instalar despues de 43–47. Solo define funciones; no modifica datos al instalar.
-- Actualiza el guardado de cotizaciones; conserva tablas, RLS, suscripciones y exenciones.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regprocedure('public.v2_floor_transfer_exceptions(uuid,uuid,uuid,boolean,boolean)') is null then
  raise exception 'Aplique primero los SQL de plano hasta el 46 y sus permisos (47).';
 end if;
end $$;

-- La relacion real determina disponibilidad; el estado de una cotizacion no la excluye.
create or replace function public.v2_linkable_quote_page(p_restaurant uuid,p_search text default '',p_after jsonb default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows_json jsonb; more boolean; cursor_id uuid; cursor_number integer; pattern text; last_row jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'read');
 if p_after is not null then
  cursor_id:=(p_after->>'id')::uuid;cursor_number:=(p_after->>'quote_number')::integer;
  if cursor_id is null or cursor_number is null then raise exception 'EVENT_LINK_INPUT';end if;
 end if;
 pattern:='%'||replace(replace(replace(left(trim(coalesce(p_search,'')),150), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')||'%';
 with candidates as (
  select q.id,q.restaurant_id,q.quote_number,q.client_name,q.event_date,q.event_time,q.area,q.total,q.status
  from public.v2_quotes q
  where q.restaurant_id=p_restaurant and q.deleted_at is null
    and not exists(select 1 from public.v2_reservations r where r.quote_id=q.id)
    and (pattern='%%' or q.client_name ilike pattern or q.client_phone ilike pattern or q.quote_number::text ilike pattern or q.area ilike pattern)
    and (p_after is null or (q.quote_number,q.id)<(cursor_number,cursor_id))
  order by q.quote_number desc,q.id desc limit 26
 ), numbered as (select *,row_number() over(order by quote_number desc,id desc) as n from candidates)
 select coalesce(jsonb_agg(to_jsonb(numbered)-'n' order by n) filter(where n<=25),'[]'::jsonb),count(*)>25 into rows_json,more from numbered;
 last_row:=rows_json->-1;
 return jsonb_build_object('rows',rows_json,'has_more',more,'next',case when more then jsonb_build_object('quote_number',last_row->'quote_number','id',last_row->'id') else null end);
end $$;

-- Copia solo al vincular o guardar una cotizacion: ninguna fila cambia al instalar.
-- Privada: los RPC publicos autorizan, bloquean y validan el vinculo antes de llamarla.
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
  event_date=q.event_date,event_time=q.event_time,area=q.area,area_id=q.area_id,guests=q.guests,
  menu=coalesce(menu_text,''),subtotal=q.subtotal,discount_pct=q.discount_pct,tip_pct=q.tip_pct,
  total=q.total,deposit=q.deposit,payment_method=q.payment_method,balance=q.balance,notes=q.internal_notes
  where id=p_reservation and restaurant_id=p_restaurant and quote_id=p_quote and deleted_at is null;
end $$;
revoke all on function public.v2_event_quote_to_reservation(uuid,uuid,uuid) from public,anon,authenticated;

-- Transaccion explicita: mismo restaurante, permisos vigentes y una relacion por evento.
-- No exige coincidir fecha, invitados, cliente, area o estado. La cotizacion es la referencia.
-- Solo al confirmar la accion: cotizacion Convertida, reserva Confirmada y enlace.
create or replace function public.v2_link_existing_events(p_restaurant uuid,p_reservation uuid,p_quote uuid,
 p_allow_conflict boolean default false,p_allow_extra_seats boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.v2_quotes%rowtype; r public.v2_reservations%rowtype; draft jsonb; planrev integer; seatrev integer; duration integer;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
 -- Same lock order as the floor save/convert routes; competing app requests serialize.
 perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
 select * into q from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant and deleted_at is null for update;
 if not found then raise exception 'EVENT_LINK_QUOTE';end if;
 select * into r from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant and deleted_at is null for update;
 if not found then raise exception 'EVENT_LINK_RESERVATION';end if;
 if r.quote_id=p_quote then return to_jsonb(r);end if; -- Safe repeat after a lost network response.
 if r.quote_id is not null then raise exception 'EVENT_LINK_RESERVATION_USED';end if;
 -- Include trash: never steal a relationship that may be restored later.
 if exists(select 1 from public.v2_reservations where quote_id=p_quote and id<>p_reservation) then
  raise exception 'EVENT_LINK_QUOTE_USED';
 end if;
 -- Mark the quote first, then attach and copy its event fields atomically.
 update public.v2_quotes set status='convertida' where id=p_quote and restaurant_id=p_restaurant;
 update public.v2_reservations set quote_id=p_quote,status='confirmada' where id=p_reservation and restaurant_id=p_restaurant returning * into r;
 perform public.v2_event_quote_to_reservation(p_restaurant,p_reservation,p_quote);
 -- Quote seating replaces reservation seating, including an explicit empty proposal.
 -- Legacy area-only quotes clear old tables; the existing area projection shows Entire area.
 select selection into draft from public.v2_floor_quote_plans where quote_id=p_quote and restaurant_id=p_restaurant;
 select revision,coalesce((layout->>'defaultDurationMinutes')::integer,180) into planrev,duration from public.v2_floor_plans where restaurant_id=p_restaurant;
 select revision into seatrev from public.v2_floor_seatings where reservation_id=p_reservation and restaurant_id=p_restaurant;
 if duration not between 15 and 1440 then duration:=180;end if;
 draft:=coalesce(draft,jsonb_build_object('table_ids','[]'::jsonb,'whole_area_id',null,'duration_minutes',duration));
 perform public.v2_floor_apply(p_restaurant,p_reservation,draft||jsonb_build_object('revision',coalesce(seatrev,0),'plan_revision',planrev,'service_status','reserved','allow_conflict',p_allow_conflict is true,'allow_extra_seats',p_allow_extra_seats is true));
 select * into r from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant;
 return to_jsonb(r);
end $$;
revoke all on function public.v2_linkable_quote_page(uuid,text,jsonb),public.v2_link_existing_events(uuid,uuid,uuid,boolean,boolean) from public,anon;
grant execute on function public.v2_linkable_quote_page(uuid,text,jsonb),public.v2_link_existing_events(uuid,uuid,uuid,boolean,boolean) to authenticated;
-- Later quote edits copy event/menu/amounts before validating floor availability.
-- Existing reservation status is retained during an edit (a canceled event stays canceled).
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
  selected:=public.v2_floor_selection(p_restaurant,p_floor,q.guests);
  insert into public.v2_floor_quote_plans(quote_id,restaurant_id,selection,revision) values(qid,p_restaurant,selected,coalesce(previous,0)+1)
   on conflict(quote_id) do update set selection=excluded.selection,revision=excluded.revision,updated_at=now();
 end if;
 return saved;
end $$;

revoke all on function public.v2_floor_save_quote(uuid,uuid,uuid,jsonb,jsonb,uuid,jsonb) from public,anon;
grant execute on function public.v2_floor_save_quote(uuid,uuid,uuid,jsonb,jsonb,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
