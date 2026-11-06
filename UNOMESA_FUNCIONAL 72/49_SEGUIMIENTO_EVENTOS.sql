-- UnoMesa · Seguimiento interno de eventos · 5 octubre 2026
-- Ejecutar completo para habilitar Pendientes del equipo en web e iOS.
-- Aditivo: crea únicamente objetos v2_event_*. NO modifica filas, columnas,
-- políticas ni funciones existentes. No activa reservas públicas ni cobros.
-- Puede ejecutarse nuevamente. No ejecuta ninguna migración anterior.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if to_regprocedure('public.v2_can_read(uuid)') is null
    or to_regprocedure('public.v2_effective_membership(uuid)') is null
    or to_regprocedure('public.v2_account_billing(uuid)') is null
    or to_regprocedure('public.v2_session_alive()') is null then
    raise exception 'Faltan funciones de acceso. No se aplicó seguimiento.';
  end if;
end $$;

create table if not exists public.v2_event_tasks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
  quote_id uuid references public.v2_quotes(id) on delete cascade,
  reservation_id uuid references public.v2_reservations(id) on delete cascade,
  category text not null default 'custom' check(category in ('confirmation','deposit','menu','details','team','custom')),
  title text not null check(length(btrim(title)) between 1 and 160),
  status text not null default 'pending' check(status in ('pending','waiting','done','not_needed')),
  assignee text not null default '' check(length(assignee)<=100),
  due_date date check(due_date between date '2000-01-01' and date '2100-12-31'),
  notes text not null default '' check(length(notes)<=4000),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check(num_nonnulls(quote_id,reservation_id)=1)
);
create index if not exists v2_event_tasks_quote on public.v2_event_tasks(restaurant_id,quote_id);
create index if not exists v2_event_tasks_reservation on public.v2_event_tasks(restaurant_id,reservation_id);
create index if not exists v2_event_tasks_pending on public.v2_event_tasks(restaurant_id,due_date,id) where status in ('pending','waiting');
alter table public.v2_event_tasks enable row level security;
revoke all on public.v2_event_tasks from public,anon,authenticated;

create or replace function public.v2_event_authorize(p_restaurant_id uuid,p_write boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare m jsonb; b jsonb; r text;
begin
  if auth.uid() is null or not coalesce(public.v2_session_alive(),false)
    or not coalesce(public.v2_can_read(p_restaurant_id),false) then raise exception 'EVENT_ACCESS'; end if;
  m:=to_jsonb(public.v2_effective_membership(p_restaurant_id)); r:=lower(m->>'role');
  if m->>'status' is distinct from 'activo' or r is null or r not in ('administrador','admin','gerente','operacion','lectura','soporte_editor','soporte_lectura') then raise exception 'EVENT_ACCESS'; end if;
  if p_write then
    if r not in ('administrador','admin','gerente','operacion','soporte_editor') then raise exception 'EVENT_ACCESS'; end if;
    b:=to_jsonb(public.v2_account_billing(p_restaurant_id));
    if not coalesce((b->>'can_write')::boolean,false) then raise exception 'EVENT_READ_ONLY'; end if;
  end if;
end $$;

-- The linked group is resolved on every read/write. Nothing is copied or
-- rewritten on quote conversion, linking, unlinking, trash or restoration.
create or replace function public.v2_event_context(p_restaurant_id uuid,p_kind text,p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q uuid; ids uuid[]; item jsonb;
begin
  if p_kind='quote' then
    select jsonb_build_object('id',x.id,'kind','quote','quote_number',x.quote_number,'client_name',x.client_name,'phone',x.client_phone,'event_date',x.event_date,'event_time',x.event_time,'area',x.area,'guests',x.guests,'status',x.status),x.id into item,q
      from public.v2_quotes x where x.id=p_id and x.restaurant_id=p_restaurant_id and x.deleted_at is null;
  elsif p_kind='reservation' then
    select jsonb_build_object('id',x.id,'kind','reservation','client_name',x.client_name,'phone',x.phone,'event_date',x.event_date,'event_time',x.event_time,'area',x.area,'guests',x.guests,'status',x.status),x.quote_id into item,q
      from public.v2_reservations x where x.id=p_id and x.restaurant_id=p_restaurant_id and x.deleted_at is null;
    if q is not null and not exists(select 1 from public.v2_quotes x where x.id=q and x.restaurant_id=p_restaurant_id and x.deleted_at is null) then q:=null; end if;
  else raise exception 'EVENT_INPUT'; end if;
  if item is null then raise exception 'EVENT_NOT_FOUND'; end if;
  select coalesce(array_agg(x.id),'{}'::uuid[]) into ids from public.v2_reservations x
    where x.restaurant_id=p_restaurant_id and x.deleted_at is null and ((q is not null and x.quote_id=q) or (p_kind='reservation' and x.id=p_id));
  return jsonb_build_object('event',item,'quote_id',q,'reservation_ids',ids);
end $$;

create or replace function public.v2_event_read(p_restaurant_id uuid,p_kind text,p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; tasks jsonb;
begin
  perform public.v2_event_authorize(p_restaurant_id,false);
  c:=public.v2_event_context(p_restaurant_id,p_kind,p_id);
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_order,t.id),'[]'::jsonb) into tasks from (
    select x.*,case x.category when 'confirmation' then 1 when 'deposit' then 2 when 'menu' then 3 when 'details' then 4 when 'team' then 5 else 6 end as created_order
      from public.v2_event_tasks x where x.restaurant_id=p_restaurant_id
      and (x.quote_id=(c->>'quote_id')::uuid or x.reservation_id in (select value::uuid from jsonb_array_elements_text(c->'reservation_ids')))
  ) t;
  return c||jsonb_build_object('tasks',tasks);
end $$;

create or replace function public.v2_event_save_task(p_restaurant_id uuid,p_kind text,p_id uuid,p_task_id uuid,p_revision integer,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; t public.v2_event_tasks; v_title text; v_status text; v_category text; v_assignee text; v_notes text; v_due date;
begin
  perform public.v2_event_authorize(p_restaurant_id,true);
  c:=public.v2_event_context(p_restaurant_id,p_kind,p_id);
  if p_task_id is null or p_revision is null or p_revision<0 or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'EVENT_INPUT'; end if;
  v_title:=btrim(coalesce(p_payload->>'title','')); v_status:=coalesce(p_payload->>'status','pending'); v_category:=coalesce(p_payload->>'category','custom');
  v_assignee:=btrim(coalesce(p_payload->>'assignee','')); v_notes:=coalesce(p_payload->>'notes',''); v_due:=nullif(p_payload->>'due_date','')::date;
  if length(v_title) not between 1 and 160 or length(v_assignee)>100 or length(v_notes)>4000
    or v_status not in ('pending','waiting','done','not_needed') or v_category not in ('confirmation','deposit','menu','details','team','custom')
    or (v_due is not null and v_due not between date '2000-01-01' and date '2100-12-31') then raise exception 'EVENT_INPUT'; end if;
  -- Serialize additions for this group, including template retries.
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text||coalesce(c->>'quote_id',p_id::text),0));
  select * into t from public.v2_event_tasks x where x.id=p_task_id for update;
  if found then
    if t.restaurant_id<>p_restaurant_id or not coalesce(t.quote_id=(c->>'quote_id')::uuid or t.reservation_id in (select value::uuid from jsonb_array_elements_text(c->'reservation_ids')),false) then raise exception 'EVENT_NOT_FOUND'; end if;
    if p_revision=0 then return to_jsonb(t); end if; -- idempotent creation retry
    if t.revision<>p_revision then raise exception 'EVENT_STALE'; end if;
    update public.v2_event_tasks set title=v_title,status=v_status,assignee=v_assignee,due_date=v_due,notes=v_notes,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=t.id returning * into t;
  else
    if p_revision<>0 then raise exception 'EVENT_STALE'; end if;
    if (select count(*) from public.v2_event_tasks x where x.restaurant_id=p_restaurant_id and (x.quote_id=(c->>'quote_id')::uuid or x.reservation_id in (select value::uuid from jsonb_array_elements_text(c->'reservation_ids'))))>=200 then raise exception 'EVENT_LIMIT'; end if;
    insert into public.v2_event_tasks(id,restaurant_id,quote_id,reservation_id,category,title,status,assignee,due_date,notes,updated_by)
      values(p_task_id,p_restaurant_id,(c->>'quote_id')::uuid,case when c->>'quote_id' is null then p_id else null end,v_category,v_title,v_status,v_assignee,v_due,v_notes,auth.uid()) returning * into t;
  end if;
  return to_jsonb(t);
end $$;

create or replace function public.v2_event_add_steps(p_restaurant_id uuid,p_kind text,p_id uuid,p_english boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; step record;
begin
  perform public.v2_event_authorize(p_restaurant_id,true);
  c:=public.v2_event_context(p_restaurant_id,p_kind,p_id);
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text||coalesce(c->>'quote_id',p_id::text),0));
  for step in select * from (values
    ('confirmation','Confirmar evento','Confirm event'),('deposit','Verificar anticipo','Check deposit'),('menu','Definir menú','Finalize menu'),('details','Revisar montaje y detalles','Review setup and details'),('team','Asignar responsable del evento','Assign event lead')) as s(category,es,en)
  loop
    if not exists(select 1 from public.v2_event_tasks x where x.restaurant_id=p_restaurant_id and x.category=step.category
      and (x.quote_id=(c->>'quote_id')::uuid or x.reservation_id in (select value::uuid from jsonb_array_elements_text(c->'reservation_ids')))) then
      perform public.v2_event_save_task(p_restaurant_id,p_kind,p_id,gen_random_uuid(),0,jsonb_build_object('title',case when p_english then step.en else step.es end,'category',step.category));
    end if;
  end loop;
  return public.v2_event_read(p_restaurant_id,p_kind,p_id);
end $$;

create or replace function public.v2_event_inbox(p_restaurant_id uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.v2_event_authorize(p_restaurant_id,false);
  if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'EVENT_INPUT'; end if;
  with pending as (
    select t.id,t.title,t.status,t.assignee,t.due_date,t.updated_at,
      case when t.quote_id is not null then 'quote' else 'reservation' end as kind,
      coalesce(t.quote_id,t.reservation_id) as event_id,coalesce(q.client_name,r.client_name) as client_name,
      coalesce(q.event_date,r.event_date) as event_date,coalesce(q.event_time,r.event_time) as event_time
    from public.v2_event_tasks t
    left join public.v2_quotes q on q.id=t.quote_id and q.restaurant_id=p_restaurant_id and q.deleted_at is null
    left join public.v2_reservations r on r.id=t.reservation_id and r.restaurant_id=p_restaurant_id and r.deleted_at is null
    where t.restaurant_id=p_restaurant_id and t.status in ('pending','waiting') and (q.id is not null or r.id is not null)
  ) select jsonb_build_object('total',(select count(*) from pending),'rows',coalesce((select jsonb_agg(x) from (
    select * from pending order by due_date nulls last,event_date nulls last,event_time nulls last,id offset p_offset limit 50) x),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.v2_event_authorize(uuid,boolean),public.v2_event_context(uuid,text,uuid),public.v2_event_read(uuid,text,uuid),public.v2_event_save_task(uuid,text,uuid,uuid,integer,jsonb),public.v2_event_add_steps(uuid,text,uuid,boolean),public.v2_event_inbox(uuid,integer) from public,anon,authenticated;
grant execute on function public.v2_event_read(uuid,text,uuid),public.v2_event_save_task(uuid,text,uuid,uuid,integer,jsonb),public.v2_event_add_steps(uuid,text,uuid,boolean),public.v2_event_inbox(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
