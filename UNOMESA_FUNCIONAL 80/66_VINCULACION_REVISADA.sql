-- UnoMesa · Revisar antes de vincular dos eventos existentes. Requiere SQL 61.
-- Instalación repetible: solo define funciones y permisos; no modifica filas.
begin;
set local lock_timeout='5s';
do $$ begin
 if to_regprocedure('public.v2_event_floor_rooms(uuid,uuid[])') is null then
 raise exception 'Instale primero 61_RESERVAS_VARIAS_AREAS.sql.'; end if;
end $$;

-- Support the catalog, older single-area rows and floor-only proposals.
create or replace function public.v2_event_link_place(p_restaurant uuid, doc jsonb, sel jsonb, lay jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids uuid[]:='{}'; rooms text[]; room text; nm text; label text; matches uuid[]; part text; by_name uuid[]:='{}'; unknown_name boolean:=false;
 tabs jsonb; shown jsonb; whole text:=nullif(sel->>'whole_area_id','');
begin
 tabs:=coalesce(nullif(sel->'table_ids','null'),'[]');
 if jsonb_array_length(coalesce(nullif(sel->'event_area_ids','null'),'[]'))>1 and jsonb_array_length(coalesce(nullif(doc->'area_ids','null'),'[]'))<2 then
  ids:=array(select value::uuid from jsonb_array_elements_text(sel->'event_area_ids'));
 elsif jsonb_array_length(coalesce(nullif(doc->'area_ids','null'),'[]'))>0 then
  ids:=array(select value::uuid from jsonb_array_elements_text(doc->'area_ids'));
 elsif jsonb_array_length(coalesce(nullif(sel->'event_area_ids','null'),'[]'))>0 then
  ids:=array(select value::uuid from jsonb_array_elements_text(sel->'event_area_ids'));
 elsif doc->>'area_id' is not null then ids:=array[(doc->>'area_id')::uuid];end if;
 label:=nullif(btrim(doc->>'area'),'');
 if label is not null and (cardinality(ids)=0 or (cardinality(ids)=1 and strpos(label,' + ')>0)) then
  -- Match an entire configured name first (including one containing " + ").
  select array_agg(id) into matches from public.v2_reservation_areas where restaurant_id=p_restaurant and lower(btrim(name))=lower(label);
  if cardinality(matches)=1 and (cardinality(ids)=0 or ids=matches) then ids:=matches;
  else
   foreach part in array string_to_array(label,' + ') loop
    select array_agg(id) into matches from public.v2_reservation_areas where restaurant_id=p_restaurant and lower(btrim(name))=lower(btrim(part));
    if cardinality(matches)=1 then by_name:=array_append(by_name,matches[1]);else unknown_name:=true;end if;
   end loop;
   if not unknown_name and ids<@by_name then ids:=by_name;end if;
  end if;
 end if;
 if cardinality(ids)=0 then
  for room in select distinct value from (
    select whole as value union all select jsonb_array_elements_text(coalesce(nullif(sel->'whole_area_ids','null'),'[]'))
    union all select t->>'areaId' from jsonb_array_elements(lay->'tables') t where tabs ? (t->>'id')) z where value is not null order by value loop
   select a->>'name' into nm from jsonb_array_elements(lay->'areas') a where a->>'id'=room;
   select array_agg(c.id) into matches from public.v2_reservation_areas c where c.restaurant_id=p_restaurant and
    (room='catalog-'||c.id::text or exists(select 1 from jsonb_array_elements(lay->'areas') x where x->>'id'=room and
    (x->>'eventAreaId'=c.id::text or (nullif(x->>'eventAreaId','') is null and lower(btrim(x->>'name'))=lower(btrim(c.name))))));
   if cardinality(matches)=1 and not(matches[1]=any(ids)) then ids:=array_append(ids,matches[1]);end if;
   label:=coalesce(label,nm);
  end loop;
 end if;
 rooms:=public.v2_event_floor_rooms(p_restaurant,ids);
 if cardinality(ids)>0 then select string_agg(c.name,' + ' order by x.n) into label from unnest(ids) with ordinality x(id,n)
 join public.v2_reservation_areas c on c.id=x.id and c.restaurant_id=p_restaurant;end if;
 -- A selected room can legitimately have zero tables. Its catalog ID carries occupancy.
 if whole is not null and whole=any(rooms) and not exists(select 1 from jsonb_array_elements(lay->'tables') t where t->>'areaId'=whole)
 then whole:=null;end if;
 if cardinality(ids)>1 or whole is not null then
  select coalesce(jsonb_agg(t->>'id' order by t->>'id'),'[]') into tabs from jsonb_array_elements(lay->'tables') t
  where case when cardinality(ids)>1 then t->>'areaId'=any(rooms) else t->>'areaId'=whole end;
 end if;
 select coalesce(jsonb_agg(coalesce(a->>'name'||' · ','')||coalesce(t->>'name',k) order by k),'[]') into shown
 from jsonb_array_elements_text(tabs) k left join jsonb_array_elements(lay->'tables') t on t->>'id'=k
 left join jsonb_array_elements(lay->'areas') a on a->>'id'=t->>'areaId';
 return jsonb_build_object('ids',ids,'name',coalesce(label,''),'table_ids',tabs,'tables',shown,'whole_area_id',whole,
  'whole',cardinality(ids)>1 or whole is not null or (label is not null and jsonb_array_length(tabs)=0));
end $$;

create or replace function public.v2_event_link_candidates(p_restaurant uuid,p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.v2_floor_authorize(p_restaurant,'read');
 if cardinality(p_ids)>50 then raise exception 'EVENT_LINK_INPUT';end if;
 return (select coalesce(jsonb_agg(q.id),'[]') from public.v2_quotes q where q.restaurant_id=p_restaurant and q.id=any(p_ids)
  and q.deleted_at is null and not exists(select 1 from public.v2_reservations r where r.quote_id=q.id));
end $$;

-- NULL expected = read-only review; confirmed writes use precisely the reviewed pair.
create or replace function public.v2_review_event_link(p_restaurant uuid,p_reservation uuid,p_quote uuid,
 p_expected text default null,p_allow_conflict boolean default false,p_allow_extra_seats boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.v2_quotes%rowtype; r public.v2_reservations%rowtype; lay jsonb; planrev int; seat jsonb; draft jsonb; rp jsonb; qp jsonb; dest jsonb;
 keep_place boolean; olddur int; dur int; defdur int; menu_text text; olddata jsonb; newdata jsonb; stamp text; cid uuid; aids uuid[]; status_now text; named text; at_time time;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 if p_expected is not null then
  insert into public.v2_floor_plans(restaurant_id) values(p_restaurant) on conflict do nothing;
  perform 1 from public.v2_floor_plans where restaurant_id=p_restaurant for update;
  perform 1 from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant for update;
  perform 1 from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant for update;
 end if;
 select * into q from public.v2_quotes where id=p_quote and restaurant_id=p_restaurant and deleted_at is null;
 if not found then raise exception 'EVENT_LINK_QUOTE';end if;
 select * into r from public.v2_reservations where id=p_reservation and restaurant_id=p_restaurant and deleted_at is null;
 if not found then raise exception 'EVENT_LINK_RESERVATION';end if;
 if r.quote_id=p_quote and p_expected is not null then return jsonb_build_object('linked',true);end if;
 if r.quote_id is not null then raise exception 'EVENT_LINK_RESERVATION_USED';end if;
 if exists(select 1 from public.v2_reservations where quote_id=p_quote) then raise exception 'EVENT_LINK_QUOTE_USED';end if;
 select layout,revision into lay,planrev from public.v2_floor_plans where restaurant_id=p_restaurant;
 lay:=coalesce(lay,'{"areas":[],"tables":[]}');planrev:=coalesce(planrev,0);defdur:=coalesce((lay->>'defaultDurationMinutes')::int,180);
 select to_jsonb(s) into seat from public.v2_floor_seatings s where s.restaurant_id=p_restaurant and s.reservation_id=p_reservation;
 select selection into draft from public.v2_floor_quote_plans where restaurant_id=p_restaurant and quote_id=p_quote;
 rp:=public.v2_event_link_place(p_restaurant,to_jsonb(r),seat,lay);
 qp:=public.v2_event_link_place(p_restaurant,to_jsonb(q),draft,lay);
 keep_place:=qp->>'name'='' and jsonb_array_length(qp->'table_ids')=0 and qp->>'whole_area_id' is null;
 dest:=case when keep_place then rp else qp end;
 aids:=array(select value::uuid from jsonb_array_elements_text(dest->'ids'));named:=dest->>'name';
 at_time:=coalesce(q.event_time,r.event_time);
 olddur:=coalesce((seat->>'duration_minutes')::int,r.area_duration_minutes,defdur);
 dur:=case when keep_place then olddur else coalesce((draft->>'duration_minutes')::int,q.area_duration_minutes,defdur) end;
 status_now:=coalesce(seat->>'service_status','reserved');
 select string_agg(i.name||case when i.quantity<>1 then ' × '||i.quantity::text else '' end,', ' order by i.position,i.name,i.quantity) into menu_text from public.v2_quote_items i where i.quote_id=p_quote;
 olddata:=jsonb_build_object('client',r.client_name,'phone',r.phone,'date',r.event_date,'time',r.event_time,'guests',r.guests,'area',rp->'name','tables',rp->'tables','whole',rp->'whole','minutes',olddur,
  'menu',coalesce(r.menu,''),'subtotal',r.subtotal,'discount',r.discount_pct,'tip',r.tip_pct,'total',r.total,'deposit',r.deposit,'payment',r.payment_method,'balance',r.balance,'notes',r.notes,'reservation_status',r.status,'quote_status',q.status,'service',status_now);
 newdata:=jsonb_build_object('client',q.client_name,'phone',q.client_phone,'date',q.event_date,'time',at_time,'guests',q.guests,'area',named,'tables',dest->'tables','whole',dest->'whole','minutes',dur,
  'menu',coalesce(menu_text,''),'subtotal',q.subtotal,'discount',q.discount_pct,'tip',q.tip_pct,'total',q.total,'deposit',q.deposit,'payment',q.payment_method,'balance',q.balance,'notes',q.internal_notes,'reservation_status','confirmada','quote_status','convertida','service','reserved');
 stamp:=md5(jsonb_build_array(p_restaurant,r.id,q.id,r.client_id,q.client_id,q.client_email,q.event_time,olddata,newdata,rp,qp,keep_place,planrev,seat->'revision')::text);
 if p_expected is null then return jsonb_build_object('before',olddata,'after',newdata,'token',stamp,'keeps_place',keep_place,'keeps_time',q.event_time is null and r.event_time is not null,'client_change',q.client_id is distinct from r.client_id);end if;
 if stamp<>p_expected then raise exception 'EVENT_LINK_REVIEW_STALE';end if;
 cid:=q.client_id;
 if cid is null then cid:=public.v2_find_or_create_client(p_restaurant_id=>p_restaurant,p_name=>q.client_name,p_phone=>q.client_phone,p_email=>q.client_email);
 elsif not exists(select 1 from public.v2_clients where id=cid and restaurant_id=p_restaurant and deleted_at is null) then raise exception 'EVENT_LINK_CLIENT';end if;
 update public.v2_quotes set status='convertida',event_time=at_time,area=named,area_ids=aids,area_id=aids[1],area_duration_minutes=dur where id=q.id and restaurant_id=p_restaurant;
 update public.v2_reservations set quote_id=q.id,status='confirmada',client_id=cid,client_name=q.client_name,phone=q.client_phone,event_date=q.event_date,event_time=at_time,
  area=named,area_ids=aids,area_id=aids[1],area_duration_minutes=dur,guests=q.guests,menu=coalesce(menu_text,''),subtotal=q.subtotal,discount_pct=q.discount_pct,tip_pct=q.tip_pct,
  total=q.total,deposit=q.deposit,payment_method=q.payment_method,balance=q.balance,notes=q.internal_notes where id=r.id and restaurant_id=p_restaurant;
 perform public.v2_floor_apply(p_restaurant,r.id,jsonb_build_object('table_ids',dest->'table_ids','whole_area_id',dest->'whole_area_id','event_area_ids',aids,
  'duration_minutes',dur,'plan_revision',planrev,'revision',coalesce((seat->>'revision')::int,0),'service_status','reserved','allow_conflict',p_allow_conflict is true,'allow_extra_seats',p_allow_extra_seats is true));
 return jsonb_build_object('linked',true);
end $$;
-- Cached clients may not silently bypass review.
create or replace function public.v2_link_existing_events(p_restaurant uuid,p_reservation uuid,p_quote uuid,
 p_allow_conflict boolean default false,p_allow_extra_seats boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.v2_floor_authorize(p_restaurant,'operate');
 select to_jsonb(r) into result from public.v2_reservations r join public.v2_quotes q on q.id=r.quote_id and q.restaurant_id=r.restaurant_id
 where r.restaurant_id=p_restaurant and r.id=p_reservation and q.id=p_quote and r.deleted_at is null and q.deleted_at is null;
 if result is not null then return result;end if;
 raise exception 'EVENT_LINK_REVIEW_REQUIRED: Actualice la página para revisar el vínculo.';
end $$;
revoke all on function public.v2_event_link_place(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.v2_event_link_candidates(uuid,uuid[]),public.v2_review_event_link(uuid,uuid,uuid,text,boolean,boolean) from public,anon;
grant execute on function public.v2_event_link_candidates(uuid,uuid[]),public.v2_review_event_link(uuid,uuid,uuid,text,boolean,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
