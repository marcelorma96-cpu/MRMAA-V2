-- UnoMesa · Deshacer la última acción propia de asignaciones de Horarios.
-- Instalar después de 70_TURNOS_POR_AREA.sql. No cambia horarios al instalar.
-- El historial privado conserva antes/después mientras exista la sucursal.
begin;

create table if not exists public.v2_schedule_change_receipts (
 id uuid primary key,
 sequence bigint generated always as identity unique,
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 actor_id uuid not null,
 label text not null check(label in ('assign','edit','move','copy','delete')),
 request_changes jsonb not null,
 changes jsonb not null,
 cell_versions jsonb not null default '[]'::jsonb,
 change_count integer not null check(change_count between 0 and 5000),
 created_at timestamptz not null default clock_timestamp(),
 undone_at timestamptz
);
create index if not exists v2_schedule_change_receipts_actor on public.v2_schedule_change_receipts(restaurant_id,actor_id,sequence desc);
alter table public.v2_schedule_change_receipts enable row level security;
revoke all on public.v2_schedule_change_receipts from public,anon,authenticated;
revoke all on sequence public.v2_schedule_change_receipts_sequence_seq from public,anon,authenticated;

-- A cell ledger also detects changes followed by deletion (an empty-cell ABA).
-- Installing the trigger does not populate or update existing schedules.
create table if not exists public.v2_schedule_cell_versions (
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,employee_id uuid not null,work_date date not null,
 revision bigint not null default 1,
 primary key(restaurant_id,employee_id,work_date)
);
alter table public.v2_schedule_cell_versions enable row level security;
revoke all on public.v2_schedule_cell_versions from public,anon,authenticated;
create or replace function public.v2_schedule_cell_version_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Account deletion already removes this restaurant and its private history.
 -- Do not recreate a ledger entry during the existing schedule FK cascade.
 if tg_op='DELETE' and not exists(select 1 from public.v2_restaurants r where r.id=old.restaurant_id) then return old; end if;
 if tg_op in ('UPDATE','DELETE') then
   insert into public.v2_schedule_cell_versions(restaurant_id,employee_id,work_date)
   values(old.restaurant_id,old.employee_id,old.work_date)
   on conflict(restaurant_id,employee_id,work_date) do update set revision=public.v2_schedule_cell_versions.revision+1;
 end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and (new.restaurant_id,new.employee_id,new.work_date) is distinct from (old.restaurant_id,old.employee_id,old.work_date)) then
   insert into public.v2_schedule_cell_versions(restaurant_id,employee_id,work_date)
   values(new.restaurant_id,new.employee_id,new.work_date)
   on conflict(restaurant_id,employee_id,work_date) do update set revision=public.v2_schedule_cell_versions.revision+1;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
drop trigger if exists v2_schedule_cell_version_guard on public.v2_schedules;
create trigger v2_schedule_cell_version_guard before insert or update or delete on public.v2_schedules
for each row execute function public.v2_schedule_cell_version_changed();
revoke all on function public.v2_schedule_cell_version_changed() from public,anon,authenticated;

-- Private helpers have no client EXECUTE grants.
create or replace function public.v2_schedule_undo_access(p_restaurant uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare membership jsonb;
begin
 membership:=to_jsonb(public.v2_effective_membership(p_restaurant));
 if p_restaurant is null or auth.uid() is null
   or not coalesce(public.v2_session_alive() and public.v2_can_read(p_restaurant)
     and public.v2_mfa_session_allowed() and public.v2_plan_has_schedules(p_restaurant),false)
   or membership->>'status' is distinct from 'activo'
   or coalesce(membership->>'role','') not in ('administrador','admin','gerente','soporte_editor')
   or not coalesce((to_jsonb(public.v2_account_billing(p_restaurant))->>'can_write')::boolean,false)
 then raise exception 'Acceso restringido.' using errcode='42501'; end if;
end; $$;

-- Canonical comparison accepts HH:MM from forms and HH:MM:SS from PostgreSQL.
create or replace function public.v2_schedule_undo_snapshot(value jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
begin
 if value is null or value='null'::jsonb then return 'null'::jsonb; end if;
 return jsonb_build_object('id',(value->>'id')::uuid,'employee_id',(value->>'employee_id')::uuid,
   'work_date',(value->>'work_date')::date,'area_id',nullif(value->>'area_id','')::uuid,
   'shift_id',nullif(value->>'shift_id','')::uuid,'entry_type',value->>'entry_type',
   'color',nullif(value->>'color',''),'break_start',nullif(value->>'break_start','')::time,
   'break_end',nullif(value->>'break_end','')::time,'notes',coalesce(value->>'notes',''));
end; $$;

create or replace function public.v2_schedule_undo_receipt(receipt public.v2_schedule_change_receipts)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',case when receipt.change_count>0 then receipt.id else null end,
   'count',receipt.change_count,'label',receipt.label,'undone',receipt.undone_at is not null,
   'from',min(v->>'work_date'),'to',max(v->>'work_date'))
 from jsonb_array_elements(receipt.changes) c, lateral (values(c->'before'),(c->'after')) parts(v)
 where v<>'null'::jsonb;
$$;

create or replace function public.v2_last_schedule_change(p_restaurant uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt public.v2_schedule_change_receipts%rowtype;
begin
 perform public.v2_schedule_undo_access(p_restaurant);
 select * into receipt from public.v2_schedule_change_receipts
 where restaurant_id=p_restaurant and actor_id=auth.uid() and change_count>0
 order by sequence desc limit 1;
 if not found or receipt.undone_at is not null then return null; end if;
 return public.v2_schedule_undo_receipt(receipt);
end; $$;

create or replace function public.v2_apply_schedule_change(p_restaurant uuid,p_request uuid,p_changes jsonb,p_label text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 receipt public.v2_schedule_change_receipts%rowtype;
 item jsonb; before_value jsonb; after_value jsonb; actual jsonb; saved jsonb; version text;
 normalized jsonb; journal jsonb; journal_entries jsonb[]:=array[]::jsonb[]; fields text[]; versions jsonb;
 changed integer:=0; emp uuid; shift uuid; area uuid;
begin
 perform public.v2_schedule_undo_access(p_restaurant);
 if p_request is null or p_label is null or p_label not in ('assign','edit','move','copy','delete')
   or jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 5000
   or octet_length(p_changes::text)>8*1024*1024
 then raise exception 'SCHEDULE_ACTION_INVALID' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('schedule-cells:'||p_restaurant::text,0));
 select * into receipt from public.v2_schedule_change_receipts where id=p_request;
 if found then
   if receipt.restaurant_id<>p_restaurant or receipt.actor_id<>auth.uid()
   then raise exception 'Acceso restringido.' using errcode='42501'; end if;
   if receipt.request_changes is distinct from p_changes or receipt.label<>p_label
   then raise exception 'SCHEDULE_REQUEST_REUSED' using errcode='22023'; end if;
   return public.v2_schedule_undo_receipt(receipt);
 end if;
 fields:=array['id','employee_id','work_date','area_id','shift_id','entry_type','color','break_start','break_end','notes'];
 for item in select value from jsonb_array_elements(p_changes) loop
   if jsonb_typeof(item) is distinct from 'object' or item-array['before','after']<>'{}'::jsonb
      or not(item ?& array['before','after'])
      or (item->'before'='null'::jsonb and item->'after'='null'::jsonb)
   then raise exception 'SCHEDULE_ACTION_INVALID' using errcode='22023'; end if;
   for actual in select x from (values(item->'before'),(item->'after')) as parts(x) where x<>'null'::jsonb loop
     if jsonb_typeof(actual) is distinct from 'object' or actual-fields<>'{}'::jsonb
        or nullif(actual->>'id','') is null or nullif(actual->>'employee_id','') is null
        or coalesce(actual->>'work_date','') !~ '^\d{4}-\d{2}-\d{2}$'
        or coalesce(actual->>'entry_type','') not in ('work','rest','permission','vacation')
     then raise exception 'SCHEDULE_ACTION_INVALID' using errcode='22023'; end if;
   end loop;
   before_value:=public.v2_schedule_undo_snapshot(item->'before');
   after_value:=public.v2_schedule_undo_snapshot(item->'after');
   if before_value<>'null'::jsonb and after_value<>'null'::jsonb and before_value->>'id'<>after_value->>'id'
   then raise exception 'SCHEDULE_ACTION_INVALID' using errcode='22023'; end if;
 end loop;
 select jsonb_agg(jsonb_build_object('before',public.v2_schedule_undo_snapshot(c->'before'),'after',public.v2_schedule_undo_snapshot(c->'after')) order by ord) into normalized
 from jsonb_array_elements(p_changes) with ordinality source(c,ord);
 if exists(select 1 from jsonb_array_elements(normalized) c group by coalesce(nullif(c->'before','null'::jsonb)->>'id',c->'after'->>'id') having count(*)>1)
   or exists(select 1 from jsonb_array_elements(normalized) c where c->'after'<>'null'::jsonb
     group by c->'after'->>'employee_id',c->'after'->>'work_date' having count(*)>1)
 then raise exception 'SCHEDULE_ACTION_INVALID' using errcode='22023'; end if;
 -- Existing rows and occupied destinations are locked before comparing anything.
 -- Empty cells remain protected by the existing unique restaurant/employee/date key.
 perform s.id from public.v2_schedules s where s.restaurant_id=p_restaurant and (
   s.id in (select (v->>'id')::uuid from jsonb_array_elements(normalized) c, lateral (values(c->'before'),(c->'after')) x(v) where v<>'null'::jsonb)
   or (s.employee_id,s.work_date) in (select (v->>'employee_id')::uuid,(v->>'work_date')::date
     from jsonb_array_elements(normalized) c, lateral (values(c->'before'),(c->'after')) x(v) where v<>'null'::jsonb))
 order by s.id for update;
 for item in select value from jsonb_array_elements(normalized) loop
   before_value:=item->'before';after_value:=item->'after';
   if before_value='null'::jsonb then
     if exists(select 1 from public.v2_schedules s where s.id=(after_value->>'id')::uuid
       or (s.restaurant_id=p_restaurant and (s.employee_id,s.work_date)=((after_value->>'employee_id')::uuid,(after_value->>'work_date')::date)))
     then raise exception 'SCHEDULE_CHANGED' using errcode='40001'; end if;
   else
     select to_jsonb(s) into actual from public.v2_schedules s
     where s.restaurant_id=p_restaurant and s.id=(before_value->>'id')::uuid;
     if public.v2_schedule_undo_snapshot(actual) is distinct from before_value
     then raise exception 'SCHEDULE_CHANGED' using errcode='40001'; end if;
   end if;
   if after_value<>'null'::jsonb then
     emp:=(after_value->>'employee_id')::uuid;shift:=(after_value->>'shift_id')::uuid;area:=(after_value->>'area_id')::uuid;
     if not exists(select 1 from public.v2_employees e where e.id=emp and e.restaurant_id=p_restaurant and e.active)
       or (area is not null and not exists(select 1 from public.v2_areas a where a.id=area and a.restaurant_id=p_restaurant))
       or (shift is not null and not exists(select 1 from public.v2_shifts s where s.id=shift and s.restaurant_id=p_restaurant))
       or (after_value->>'entry_type'='work' and shift is null)
       or (after_value->>'entry_type'<>'work' and (shift is not null or after_value->>'break_start' is not null or after_value->>'break_end' is not null))
       or ((before_value->'color') is distinct from (after_value->'color') and after_value->>'color' is not null and after_value->>'color'!~'^#[a-fA-F0-9]{6}$')
     then raise exception 'SCHEDULE_ACTION_INVALID' using errcode='23514'; end if;
   end if;
 end loop;
 for item in select value from jsonb_array_elements(normalized) loop
   before_value:=item->'before';after_value:=item->'after';
   if before_value=after_value then continue; end if;
   actual:=null;saved:=null;version:=null;
   if before_value<>'null'::jsonb then
     select to_jsonb(s) into actual from public.v2_schedules s where s.restaurant_id=p_restaurant and s.id=(before_value->>'id')::uuid;
   end if;
   if after_value='null'::jsonb then
     delete from public.v2_schedules where restaurant_id=p_restaurant and id=(before_value->>'id')::uuid;
   elsif before_value='null'::jsonb then
     insert into public.v2_schedules(id,restaurant_id,employee_id,work_date,area_id,shift_id,entry_type,color,break_start,break_end,notes)
     values((after_value->>'id')::uuid,p_restaurant,(after_value->>'employee_id')::uuid,(after_value->>'work_date')::date,
       (after_value->>'area_id')::uuid,(after_value->>'shift_id')::uuid,after_value->>'entry_type',after_value->>'color',
       (after_value->>'break_start')::time,(after_value->>'break_end')::time,after_value->>'notes');
   else
     update public.v2_schedules set employee_id=(after_value->>'employee_id')::uuid,work_date=(after_value->>'work_date')::date,
       area_id=(after_value->>'area_id')::uuid,shift_id=(after_value->>'shift_id')::uuid,entry_type=after_value->>'entry_type',
       color=after_value->>'color',break_start=(after_value->>'break_start')::time,break_end=(after_value->>'break_end')::time,notes=after_value->>'notes'
     where restaurant_id=p_restaurant and id=(before_value->>'id')::uuid;
   end if;
   if not found then raise exception 'SCHEDULE_CHANGED' using errcode='40001'; end if;
   if after_value<>'null'::jsonb then
     select to_jsonb(s),s.xmin::text into saved,version from public.v2_schedules s where s.restaurant_id=p_restaurant and s.id=(after_value->>'id')::uuid;
     if not found then raise exception 'SCHEDULE_CHANGED' using errcode='40001'; end if;
   end if;
   journal_entries:=array_append(journal_entries,jsonb_build_object('before',actual,'after',saved,'xmin',version));
   changed:=changed+1;
 end loop;
 journal:=to_jsonb(journal_entries);
 select coalesce(jsonb_agg(jsonb_build_object('employee_id',v.employee_id,'work_date',v.work_date,'revision',v.revision) order by v.employee_id,v.work_date),'[]'::jsonb) into versions
 from public.v2_schedule_cell_versions v where v.restaurant_id=p_restaurant and (v.employee_id,v.work_date) in (
   select (x->>'employee_id')::uuid,(x->>'work_date')::date from jsonb_array_elements(journal) c,
   lateral (values(c->'before'),(c->'after')) parts(x) where x<>'null'::jsonb);
 insert into public.v2_schedule_change_receipts(id,restaurant_id,actor_id,label,request_changes,changes,cell_versions,change_count)
 values(p_request,p_restaurant,auth.uid(),p_label,p_changes,journal,versions,changed) returning * into receipt;
 return public.v2_schedule_undo_receipt(receipt);
end; $$;

create or replace function public.v2_undo_schedule_change(p_restaurant uuid,p_action uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 receipt public.v2_schedule_change_receipts%rowtype;
 item jsonb; before_value jsonb; after_value jsonb; actual jsonb; version text; latest uuid; columns text; affected bigint;
begin
 perform public.v2_schedule_undo_access(p_restaurant);
 perform pg_advisory_xact_lock(hashtextextended('schedule-cells:'||p_restaurant::text,0));
 select * into receipt from public.v2_schedule_change_receipts where id=p_action for update;
 if not found or receipt.restaurant_id<>p_restaurant or receipt.actor_id<>auth.uid()
 then raise exception 'Acceso restringido.' using errcode='42501'; end if;
 if receipt.undone_at is not null then
   return public.v2_schedule_undo_receipt(receipt);
 end if;
 select id into latest from public.v2_schedule_change_receipts
 where restaurant_id=p_restaurant and actor_id=auth.uid() and change_count>0 order by sequence desc limit 1;
 if latest is distinct from p_action or receipt.change_count=0
 then raise exception 'SCHEDULE_UNDO_NOT_LATEST' using errcode='40001'; end if;
 perform s.id from public.v2_schedules s where s.restaurant_id=p_restaurant and (
   s.id in (select (v->>'id')::uuid from jsonb_array_elements(receipt.changes) c, lateral (values(c->'before'),(c->'after')) x(v) where v<>'null'::jsonb)
   or (s.employee_id,s.work_date) in (select (v->>'employee_id')::uuid,(v->>'work_date')::date
     from jsonb_array_elements(receipt.changes) c, lateral (values(c->'before'),(c->'after')) x(v) where v<>'null'::jsonb))
 order by s.id for update;
 -- Lock cell versions as well as live rows so later empty-cell writes cannot
 -- pass the check and commit unnoticed during restoration.
 perform 1 from public.v2_schedule_cell_versions v where v.restaurant_id=p_restaurant and (v.employee_id,v.work_date) in (
   select (x->>'employee_id')::uuid,(x->>'work_date')::date from jsonb_array_elements(receipt.cell_versions) x)
 order by v.employee_id,v.work_date for update;
 if jsonb_array_length(receipt.cell_versions)=0 or exists(
   select 1 from jsonb_array_elements(receipt.cell_versions) expected
   left join public.v2_schedule_cell_versions current on current.restaurant_id=p_restaurant
     and current.employee_id=(expected->>'employee_id')::uuid and current.work_date=(expected->>'work_date')::date
   where current.revision is distinct from (expected->>'revision')::bigint)
 then raise exception 'SCHEDULE_UNDO_CHANGED' using errcode='40001'; end if;
 -- Check the entire action first, including rows changed by older application versions.
 for item in select value from jsonb_array_elements(receipt.changes) loop
   before_value:=item->'before';after_value:=item->'after';
   if after_value='null'::jsonb then
     if exists(select 1 from public.v2_schedules s where s.id=(before_value->>'id')::uuid)
     then raise exception 'SCHEDULE_UNDO_CHANGED' using errcode='40001'; end if;
   else
     select to_jsonb(s),s.xmin::text into actual,version from public.v2_schedules s
     where s.restaurant_id=p_restaurant and s.id=(after_value->>'id')::uuid;
     if actual is distinct from after_value or version is distinct from item->>'xmin'
     then raise exception 'SCHEDULE_UNDO_CHANGED' using errcode='40001'; end if;
   end if;
 end loop;
 if exists(select 1 from public.v2_schedules s where s.restaurant_id=p_restaurant
   and (s.employee_id,s.work_date) in (select (c->'before'->>'employee_id')::uuid,(c->'before'->>'work_date')::date
     from jsonb_array_elements(receipt.changes) c where c->'before'<>'null'::jsonb)
   and s.id not in (select (c->'after'->>'id')::uuid from jsonb_array_elements(receipt.changes) c where c->'after'<>'null'::jsonb))
 then raise exception 'SCHEDULE_UNDO_CHANGED' using errcode='40001'; end if;
 -- Dynamic column names come only from PostgreSQL's catalog. Preserve historical
 -- defaults/metadata when restoring a deleted row without assuming extra columns.
 select string_agg(quote_ident(a.attname),',' order by a.attnum) into columns
 from pg_attribute a where a.attrelid='public.v2_schedules'::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='';
 for item in select value from jsonb_array_elements(receipt.changes) with ordinality c(value,ord) order by ord desc loop
   before_value:=item->'before';after_value:=item->'after';
   if before_value='null'::jsonb then
     -- Explicit Undo removes only a new assignment made by this exact receipt;
     -- its complete contents remain in the private receipt history.
     delete from public.v2_schedules where restaurant_id=p_restaurant and id=(after_value->>'id')::uuid;
   elsif after_value='null'::jsonb then
     execute format('insert into public.v2_schedules (%s) overriding system value select %s from jsonb_populate_record(null::public.v2_schedules,$1)',columns,columns) using before_value;
   else
     update public.v2_schedules set employee_id=(before_value->>'employee_id')::uuid,work_date=(before_value->>'work_date')::date,
       area_id=(before_value->>'area_id')::uuid,shift_id=(before_value->>'shift_id')::uuid,entry_type=before_value->>'entry_type',
       color=before_value->>'color',break_start=(before_value->>'break_start')::time,break_end=(before_value->>'break_end')::time,notes=before_value->>'notes'
     where restaurant_id=p_restaurant and id=(before_value->>'id')::uuid;
   end if;
   -- ROW_COUNT also covers dynamic INSERT and a trigger that suppresses a row.
   get diagnostics affected=row_count;
   if affected<>1 then raise exception 'SCHEDULE_UNDO_CHANGED' using errcode='40001'; end if;
 end loop;
 update public.v2_schedule_change_receipts set undone_at=clock_timestamp() where id=receipt.id returning * into receipt;
 return public.v2_schedule_undo_receipt(receipt);
end; $$;

revoke all on function public.v2_schedule_undo_receipt(public.v2_schedule_change_receipts) from public,anon,authenticated;
revoke all on function public.v2_schedule_undo_access(uuid) from public,anon,authenticated;
revoke all on function public.v2_schedule_undo_snapshot(jsonb) from public,anon,authenticated;
revoke all on function public.v2_last_schedule_change(uuid) from public,anon;
revoke all on function public.v2_apply_schedule_change(uuid,uuid,jsonb,text) from public,anon;
revoke all on function public.v2_undo_schedule_change(uuid,uuid) from public,anon;
grant execute on function public.v2_last_schedule_change(uuid) to authenticated;
grant execute on function public.v2_apply_schedule_change(uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.v2_undo_schedule_change(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
