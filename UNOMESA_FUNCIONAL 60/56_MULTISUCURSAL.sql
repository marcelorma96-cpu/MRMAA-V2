-- UnoMesa · Multisucursal. Ejecutar después del SQL 55, primero en staging.
-- Conserva TODAS las filas existentes: no UPDATE/DELETE de datos al instalar.
-- Evolución de esquema: owner_id admite NULL SOLO en sucursales dependientes.
-- Se conserva UNIQUE(owner_id): registro, propiedad y prueba siguen siendo únicos.
-- Las funciones originales de acceso quedan encapsuladas para las cuentas actuales.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('public.v2_store_apply(uuid,uuid,text,text,text,text,text,text,text,boolean,timestamp with time zone,boolean,boolean,boolean)') is null
 or to_regprocedure('public.v2_account_billing(uuid)') is null then
  raise exception 'Falta SQL 55 o la instalación base. No se aplicaron cambios.';
 end if;
end $$;

alter table public.v2_restaurants add column if not exists billing_parent_id uuid references public.v2_restaurants(id) on delete restrict;
alter table public.v2_restaurants alter column owner_id drop not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='v2_branch_owner_shape' and conrelid='public.v2_restaurants'::regclass) then
  alter table public.v2_restaurants add constraint v2_branch_owner_shape check (
   (billing_parent_id is null and owner_id is not null) or (billing_parent_id is not null and owner_id is null and billing_parent_id<>id));
 end if;
end $$;
create index if not exists v2_branch_parent_idx on public.v2_restaurants(billing_parent_id,id) where billing_parent_id is not null;
alter table public.v2_lemon_checkouts add column if not exists branch_quantity integer not null default 1 check(branch_quantity between 1 and 10000);
create table if not exists public.v2_branch_entitlements(
 restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
 capacity integer not null check(capacity between 1 and 10000), provider text not null,
 external_id text not null, checked_at timestamptz not null default now()
);
create table if not exists public.v2_branches(
 restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
 root_id uuid not null references public.v2_restaurants(id) on delete restrict,
 slot integer check(slot>=2), status text not null check(status in('preparing','active','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(root_id,slot), check(restaurant_id<>root_id), check((status='archived')=(slot is null))
);
create index if not exists v2_branches_root_status on public.v2_branches(root_id,status,restaurant_id);
create index if not exists v2_branch_member_lookup on public.v2_members(user_id,status,restaurant_id);
create table if not exists public.v2_branch_jobs(
 id uuid primary key, root_id uuid not null references public.v2_restaurants(id) on delete restrict,
 target_id uuid not null unique references public.v2_restaurants(id) on delete cascade,
 source_id uuid references public.v2_restaurants(id) on delete restrict,
 options jsonb not null default '{}', stage integer not null default 0,
 cursor_id uuid, copied integer not null default 0, retry_after timestamptz not null default now(), error_code text,
 status text not null default 'pending' check(status in('pending','done','paused')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists v2_branch_jobs_pending on public.v2_branch_jobs(updated_at,id) where status='pending';
create table if not exists public.v2_branch_copy_ids(
 job_id uuid not null references public.v2_branch_jobs(id) on delete cascade,
 kind text not null, source_id text not null, target_id uuid not null default gen_random_uuid(),
 primary key(job_id,kind,source_id)
);
create table if not exists public.v2_branch_audit(
 id bigint generated always as identity primary key,
 root_id uuid not null references public.v2_restaurants(id) on delete cascade,
 branch_id uuid, actor_id uuid, action text not null, created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['v2_branch_entitlements','v2_branches','v2_branch_jobs','v2_branch_copy_ids','v2_branch_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.v2_branch_audit_id_seq to service_role;

create or replace function public.v2_billing_root(p_restaurant uuid) returns uuid language sql stable security definer set search_path='' as $$
 select coalesce(billing_parent_id,id) from public.v2_restaurants where id=p_restaurant;
$$;
create or replace function public.v2_branch_capacity(p_root uuid) returns integer language sql stable security definer set search_path='' as $$
 select case when public.v2_billing_exempt(p_root) then 10000
 when r.plan_code<>'advanced' then 1 else coalesce(e.capacity,1) end
 from public.v2_restaurants r left join public.v2_branch_entitlements e on e.restaurant_id=r.id where r.id=p_root and r.billing_parent_id is null;
$$;
create or replace function public.v2_branch_enabled(p_restaurant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when r.billing_parent_id is null then true else exists(
 select 1 from public.v2_branches b where b.restaurant_id=r.id and b.root_id=r.billing_parent_id
 and b.status='active' and b.slot<=public.v2_branch_capacity(b.root_id)) end
 from public.v2_restaurants r where r.id=p_restaurant),false);
$$;

-- Preserve the installed implementation (including custom exemptions/MFA).
do $$ declare n text; begin
 foreach n in array array['v2_billing_can_write','v2_billing_exempt','v2_trial_access_allowed','v2_account_billing'] loop
  if to_regprocedure('public.'||n||'_single(uuid)') is null then
   execute format('alter function public.%I(uuid) rename to %I',n,n||'_single');
  end if;
  execute format('revoke all on function public.%I(uuid) from public,anon,authenticated',n||'_single');
 end loop;
end $$;
create or replace function public.v2_billing_exempt(p_restaurant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.v2_billing_exempt_single(public.v2_billing_root(p_restaurant));
$$;
create or replace function public.v2_trial_access_allowed(p_restaurant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.v2_trial_access_allowed_single(public.v2_billing_root(p_restaurant));
$$;
create or replace function public.v2_billing_can_write(p_restaurant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.v2_billing_can_write_single(public.v2_billing_root(p_restaurant)) and public.v2_branch_enabled(p_restaurant);
$$;
create or replace function public.v2_account_billing(p_restaurant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.v2_restaurants%rowtype; root public.v2_restaurants%rowtype; result jsonb;
begin
 select * into r from public.v2_restaurants where id=p_restaurant;
 if r.id is null then return null; end if;
 if r.billing_parent_id is null then result:=public.v2_account_billing_single(r.id);
 else
  if not coalesce(public.v2_mfa_session_allowed(),false) or not exists(
   select 1 from public.v2_members m where m.restaurant_id=r.id and m.user_id=auth.uid() and m.status='activo'
   and lower(btrim(m.role))=any(array['administrador','admin','gerente','operacion','lectura'])
   and not public.v2_is_support_agent()) then return null; end if;
  select * into root from public.v2_restaurants where id=r.billing_parent_id;
  result:=jsonb_build_object('id',r.id,'name',r.name,'plan_code','advanced','trial_ends_at',root.trial_ends_at,
   'subscription_status',root.subscription_status,'access_status',root.access_status,'billing_enforcement_enabled',root.billing_enforcement_enabled,
   'grace_ends_at',root.grace_ends_at,'export_until',root.export_until,'deletion_scheduled_at',null,
   'billing_cycle',root.billing_cycle,'billing_current_period_end',root.billing_current_period_end,
   'billing_cancel_at_period_end',root.billing_cancel_at_period_end,'can_write',public.v2_billing_can_write(r.id),
   'trial_exempt',public.v2_billing_exempt(root.id),'is_owner',root.owner_id=auth.uid());
 end if;
 if result is null then return null; end if;
 return result||jsonb_build_object('billing_root_id',coalesce(r.billing_parent_id,r.id),
  'branch_capacity',public.v2_branch_capacity(coalesce(r.billing_parent_id,r.id)),
  'branch_enabled',public.v2_branch_enabled(r.id),'branch_can_read',public.v2_trial_access_allowed(r.id));
end $$;

create or replace function public.v2_branch_structure_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.billing_parent_id is distinct from old.billing_parent_id then raise exception 'BRANCH_IMMUTABLE'; end if;
 if new.billing_parent_id is not null then
  if tg_op='INSERT' and auth.uid() is not null then raise exception 'BRANCH_SERVER_ONLY'; end if;
  if not exists(select 1 from public.v2_restaurants r where r.id=new.billing_parent_id and r.billing_parent_id is null and r.owner_id is not null) then raise exception 'BRANCH_ROOT'; end if;
  -- These cached flags keep legacy maintenance from scheduling child deletion.
  -- Actual write permission always checks the principal subscription above.
  new.plan_code:='advanced'; new.billing_enforcement_enabled:=false;
  new.billing_exempt_user_id:=null; new.deletion_scheduled_at:=null;
 end if;

 return new;
end $$;
create or replace trigger zz_v2_branch_structure before insert or update on public.v2_restaurants for each row execute function public.v2_branch_structure_guard();
create or replace function public.v2_branch_owner_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.v2_restaurants child join public.v2_restaurants root on root.id=child.billing_parent_id
  where child.id=old.restaurant_id and root.owner_id=old.user_id) then
  if tg_op='DELETE' then raise exception 'BRANCH_PRIMARY_OWNER'; end if;
  if new.status<>'activo' or new.role not in('administrador','admin') or new.user_id<>old.user_id or new.restaurant_id<>old.restaurant_id then raise exception 'BRANCH_PRIMARY_OWNER'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create or replace trigger v2_branch_owner_guard before update or delete on public.v2_members for each row execute function public.v2_branch_owner_guard();

create or replace function public.v2_branch_authorize(p_root uuid,p_user uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if p_user is null or not exists(select 1 from public.v2_restaurants r join public.v2_members m on m.restaurant_id=r.id and m.user_id=p_user
 where r.id=p_root and r.billing_parent_id is null and r.owner_id=p_user and m.status='activo' and m.role in('administrador','admin'))
 or public.v2_is_support_agent() then raise exception 'BRANCH_ACCESS'; end if;
end $$;

-- Keyset pagination: never download all branches, clients or quotes to switch.
create or replace function public.v2_branch_list(p_restaurant uuid,p_search text default '',p_after_name text default null,p_after_id uuid default null,p_archived boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare root uuid; own boolean; rows jsonb;
begin
 if auth.uid() is null or not public.v2_mfa_session_allowed() or public.v2_is_support_agent() then raise exception 'BRANCH_ACCESS'; end if;
 if not exists(select 1 from public.v2_members where restaurant_id=p_restaurant and user_id=auth.uid() and status='activo') then raise exception 'BRANCH_ACCESS'; end if;
 root:=public.v2_billing_root(p_restaurant);
 select owner_id=auth.uid() into own from public.v2_restaurants where id=root;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_name,q.id),'[]') into rows from (
  select r.id,r.name,lower(r.name) sort_name,m.role,r.id=root is_principal,
   coalesce(b.status,'active') status,public.v2_branch_enabled(r.id) enabled,
   j.status copy_status,j.copied,j.stage,j.error_code
  from public.v2_members m join public.v2_restaurants r on r.id=m.restaurant_id
  left join public.v2_branches b on b.restaurant_id=r.id left join public.v2_branch_jobs j on j.target_id=r.id
  where m.user_id=auth.uid() and m.status='activo' and (r.id=root or r.billing_parent_id=root)
   and (p_archived or coalesce(b.status,'active')<>'archived')
   and (coalesce(p_search,'')='' or position(lower(left(p_search,120)) in lower(r.name))>0)
   and (p_after_name is null or (lower(r.name),r.id)>(p_after_name,p_after_id))
  order by lower(r.name),r.id limit 26
 ) q;
 return jsonb_build_object('root_id',root,'can_manage',coalesce(own,false),'capacity',public.v2_branch_capacity(root),
  'used',1+(select count(*) from public.v2_branches where root_id=root and status<>'archived'),
  'items',rows,'more',jsonb_array_length(rows)>25);
end $$;

create or replace function public.v2_branch_create(p_root uuid,p_user uuid,p_request uuid,p_name text,p_source uuid,p_options jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare source public.v2_restaurants%rowtype; root public.v2_restaurants%rowtype; rid uuid; slot_number integer; opts jsonb;
begin
 select * into root from public.v2_restaurants where id=p_root for update;
 perform public.v2_branch_authorize(p_root,p_user);
 select target_id into rid from public.v2_branch_jobs where id=p_request and root_id=p_root;
 if rid is not null then return rid; end if;
 if p_request is null or length(btrim(coalesce(p_name,''))) not between 2 and 160 or root.plan_code<>'advanced'
 or jsonb_typeof(p_options) is distinct from 'object' or not public.v2_billing_can_write(p_root) then raise exception 'BRANCH_INPUT_OR_PLAN'; end if;
 select n into slot_number from generate_series(2,public.v2_branch_capacity(p_root)) n
  where not exists(select 1 from public.v2_branches where root_id=p_root and slot=n) order by n limit 1;
 if slot_number is null then raise exception 'BRANCH_CAPACITY'; end if;
 if p_source is not null then
  select * into source from public.v2_restaurants where id=p_source and (id=p_root or billing_parent_id=p_root);
  if source.id is null or not public.v2_branch_enabled(source.id) then raise exception 'BRANCH_SOURCE'; end if;
 end if;
 opts:=jsonb_build_object('settings',p_source is not null and p_options->'settings'='true',
  'menus',p_source is not null and p_options->'menus'='true','areas',p_source is not null and (p_options->'areas'='true' or p_options->'floor'='true'),
  'floor',p_source is not null and p_options->'floor'='true','clients',p_source is not null and p_options->'clients'='true');
 insert into public.v2_restaurants(owner_id,billing_parent_id,name,phone,country,language,currency,plan_code,billing_cycle,
  trial_started_at,trial_ends_at,subscription_status,access_status,billing_enforcement_enabled,billing_exempt_user_id)
 values(null,p_root,btrim(p_name),'',root.country,root.language,root.currency,'advanced',root.billing_cycle,
  root.trial_started_at,root.trial_ends_at,root.subscription_status,root.access_status,false,null) returning id into rid;
 insert into public.v2_branches(restaurant_id,root_id,slot,status) values(rid,p_root,slot_number,'preparing');
 insert into public.v2_members(restaurant_id,user_id,name,email,role,status)
  select rid,p_user,m.name,m.email,'administrador','activo' from public.v2_members m where m.restaurant_id=p_root and m.user_id=p_user;
 insert into public.v2_branch_jobs(id,root_id,target_id,source_id,options) values(p_request,p_root,rid,p_source,opts);
 insert into public.v2_branch_audit(root_id,branch_id,actor_id,action) values(p_root,rid,p_user,'created');
 return rid;
end $$;

create or replace function public.v2_branch_set_logo(p_job uuid,p_logo text) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.v2_restaurants r set settings=coalesce(r.settings,'{}')||jsonb_build_object('logo_data_url',p_logo)
 from public.v2_branch_jobs j where j.id=p_job and j.target_id=r.id and j.options->'settings'='true' and j.status='pending';
end $$;
revoke all on function public.v2_branch_set_logo(uuid,text) from public,anon,authenticated;
grant execute on function public.v2_branch_set_logo(uuid,text) to service_role;

-- Each call commits at most 100 copied rows. Cursor and insert commit together.
-- Retry is idempotent. A partially copied branch stays unavailable for editing.
create or replace function public.v2_branch_copy_step(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.v2_branch_jobs%rowtype; tab text; opt text; rowdata jsonb; new_id uuid; n integer:=0; lay jsonb; a jsonb; ts jsonb; v_settings jsonb;
begin
 select * into j from public.v2_branch_jobs where id=p_job for update;
 if j.id is null then raise exception 'BRANCH_JOB'; end if;
 if j.status<>'pending' then return jsonb_build_object('status',j.status,'copied',j.copied); end if;
 if not public.v2_billing_can_write(j.root_id) then update public.v2_branch_jobs set updated_at=now(),retry_after=now()+interval '5 minutes' where id=j.id; return jsonb_build_object('status','payment_required','copied',j.copied); end if;
 if j.stage=0 then
  if j.options->'settings'='true' then
   select coalesce(jsonb_object_agg(key,value),'{}') into v_settings from public.v2_restaurants r,
    lateral jsonb_each(coalesce(r.settings,'{}')) s where r.id=j.source_id and
    (key like 'quote\_%' escape '\' or key like 'reservation\_%' escape '\' or key in('time_format','discounts','tips','fixed_customer_note','customer_note','default_reservation_duration'));
   update public.v2_restaurants set settings=coalesce(v2_restaurants.settings,'{}')||coalesce(v_settings,'{}') where id=j.target_id;
  end if;
  update public.v2_branch_jobs set stage=1,updated_at=now() where id=j.id;
 elsif j.stage between 1 and 3 then
  tab:=case j.stage when 1 then 'v2_quote_products' when 2 then 'v2_reservation_areas' else 'v2_clients' end;
  opt:=case j.stage when 1 then 'menus' when 2 then 'areas' else 'clients' end;
  if j.options->opt='true' then
   for rowdata in execute format('select to_jsonb(t) from public.%I t where restaurant_id=$1 and ($2 is null or id>$2) and (to_jsonb(t)->>''deleted_at'') is null order by id limit 100',tab) using j.source_id,j.cursor_id loop
    insert into public.v2_branch_copy_ids(job_id,kind,source_id) values(j.id,opt,rowdata->>'id') on conflict do nothing;
    select target_id into new_id from public.v2_branch_copy_ids where job_id=j.id and kind=opt and source_id=rowdata->>'id';
    execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).* on conflict(id) do nothing',tab,tab)
      using rowdata||jsonb_build_object('id',new_id,'restaurant_id',j.target_id,'created_at',now(),'updated_at',now(),'deleted_at',null,'deleted_by',null);
    j.cursor_id:=(rowdata->>'id')::uuid; n:=n+1;
   end loop;
  end if;
  update public.v2_branch_jobs set stage=case when n<100 then stage+1 else stage end,
   cursor_id=case when n<100 then null else j.cursor_id end,copied=copied+n,updated_at=now() where id=j.id;
 elsif j.stage=4 then
  if j.options->'floor'='true' then
   select layout into lay from public.v2_floor_plans where restaurant_id=j.source_id;
   if lay is not null then
    insert into public.v2_branch_copy_ids(job_id,kind,source_id) select j.id,'floor_area',value->>'id' from jsonb_array_elements(lay->'areas') on conflict do nothing;
    select coalesce(jsonb_agg((value-'previousNames')||jsonb_build_object('id',i.target_id,'eventAreaId',e.target_id)),'[]') into a
     from jsonb_array_elements(lay->'areas') v join public.v2_branch_copy_ids i on i.job_id=j.id and i.kind='floor_area' and i.source_id=v.value->>'id'
     left join public.v2_branch_copy_ids e on e.job_id=j.id and e.kind='areas' and e.source_id=v.value->>'eventAreaId';
    select coalesce(jsonb_agg(value||jsonb_build_object('id',gen_random_uuid(),'areaId',i.target_id)),'[]') into ts
     from jsonb_array_elements(lay->'tables') v join public.v2_branch_copy_ids i on i.job_id=j.id and i.kind='floor_area' and i.source_id=v.value->>'areaId';
    insert into public.v2_floor_plans(restaurant_id,revision,layout) values(j.target_id,1,lay||jsonb_build_object('areas',a,'tables',ts)) on conflict(restaurant_id) do nothing;
   end if;
  end if;
  update public.v2_branch_jobs set stage=5,status='done',updated_at=now() where id=j.id;
  update public.v2_branches set status='active',updated_at=now() where restaurant_id=j.target_id and status='preparing';
  delete from public.v2_branch_copy_ids where job_id=j.id;
 end if;
 update public.v2_branch_jobs set error_code=null where id=j.id;
 return (select jsonb_build_object('status',status,'stage',stage,'copied',copied,'restaurant_id',target_id) from public.v2_branch_jobs where id=j.id);
end $$;

create or replace function public.v2_branch_archive(p_restaurant uuid,p_user uuid,p_archived boolean) returns void language plpgsql security definer set search_path='' as $$
declare root uuid; sn integer;
begin
 select root_id into root from public.v2_branches where restaurant_id=p_restaurant;
 perform 1 from public.v2_restaurants where id=root for update;
 perform public.v2_branch_authorize(root,p_user);
 if not p_archived then
  if not public.v2_billing_can_write(root) then raise exception 'BRANCH_INPUT_OR_PLAN'; end if;
  if exists(select 1 from public.v2_branches where restaurant_id=p_restaurant and status<>'archived') then return; end if;
  select n into sn from generate_series(2,public.v2_branch_capacity(root)) n where not exists(select 1 from public.v2_branches where root_id=root and slot=n) order by n limit 1;
  if sn is null then raise exception 'BRANCH_CAPACITY'; end if;
 end if;
 update public.v2_branches set slot=sn,status=case when p_archived then 'archived'
 when exists(select 1 from public.v2_branch_jobs where target_id=p_restaurant and status<>'done') then 'preparing' else 'active' end,updated_at=now() where restaurant_id=p_restaurant;
 update public.v2_branch_jobs set status=case when p_archived then 'paused' else 'pending' end where target_id=p_restaurant and status<>'done';
 insert into public.v2_branch_audit(root_id,branch_id,actor_id,action) values(root,p_restaurant,p_user,case when p_archived then 'archived' else 'restored' end);
end $$;

-- Assign an existing employee only inside the same business group. No global
-- Auth lookup is exposed; unrelated accounts are never attached by email.
create or replace function public.v2_branch_link_member(p_target uuid,p_actor uuid,p_email text,p_role text)
returns boolean language plpgsql security definer set search_path='' as $$
declare root uuid; u public.v2_members%rowtype;
begin
 root:=public.v2_billing_root(p_target);
 perform 1 from public.v2_restaurants where id=root for update;
 perform public.v2_branch_authorize(root,p_actor);
 if not public.v2_billing_can_write(p_target) or p_role not in('administrador','gerente','operacion','lectura') then raise exception 'BRANCH_ACCESS'; end if;
 select m.* into u from public.v2_members m join public.v2_restaurants r on r.id=m.restaurant_id
 where (r.id=root or r.billing_parent_id=root) and lower(m.email)=lower(btrim(p_email)) and m.status='activo'
 order by m.restaurant_id limit 1;
 if u.user_id is null then return false; end if;
 if exists(select 1 from public.v2_members where restaurant_id=p_target and user_id=u.user_id) then raise exception 'BRANCH_MEMBER_EXISTS'; end if;
 insert into public.v2_members(restaurant_id,user_id,name,email,role,status) values(p_target,u.user_id,u.name,u.email,p_role,'activo');
 insert into public.v2_branch_audit(root_id,branch_id,actor_id,action) values(root,p_target,p_actor,'member_assigned');
 return true;
end $$;
revoke all on function public.v2_branch_link_member(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.v2_branch_link_member(uuid,uuid,text,text) to service_role;

create or replace function public.v2_branch_transfer_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.billing_parent_id is null and new.owner_id is distinct from old.owner_id then
  insert into public.v2_members(restaurant_id,user_id,name,email,role,status)
   select b.restaurant_id,new.owner_id,m.name,m.email,'administrador','activo' from public.v2_branches b
   join public.v2_members m on m.restaurant_id=new.id and m.user_id=new.owner_id where b.root_id=new.id
   on conflict(restaurant_id,user_id) do update set role='administrador',status='activo';
  update public.v2_members m set role='gerente' from public.v2_branches b where m.restaurant_id=b.restaurant_id and b.root_id=new.id and m.user_id=old.owner_id;
 end if;
 return new;
end $$;
create or replace trigger v2_branch_transfer_owner after update of owner_id on public.v2_restaurants for each row execute function public.v2_branch_transfer_owner();

-- Verified provider capacity, protected by the same per-account billing lease.
create or replace function public.v2_branch_apply_capacity(p_root uuid,p_lease uuid,p_provider text,p_external text,p_capacity integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.v2_restaurants where id=p_root and billing_parent_id is null for update;
 if not found or not exists(select 1 from public.v2_billing_state where restaurant_id=p_root and lease_token=p_lease)
 or not exists(select 1 from public.v2_payment_accounts where restaurant_id=p_root and provider=p_provider and external_subscription_id=p_external)
 or p_capacity is null or p_capacity not between 1 and 10000 then raise exception 'BRANCH_ENTITLEMENT'; end if;
 insert into public.v2_branch_entitlements(restaurant_id,capacity,provider,external_id) values(p_root,p_capacity,p_provider,p_external)
 on conflict(restaurant_id) do update set capacity=excluded.capacity,provider=excluded.provider,external_id=excluded.external_id,checked_at=now();
end $$;

revoke all on function public.v2_billing_root(uuid),public.v2_branch_capacity(uuid),public.v2_branch_enabled(uuid),
 public.v2_branch_authorize(uuid,uuid),public.v2_branch_create(uuid,uuid,uuid,text,uuid,jsonb),public.v2_branch_copy_step(uuid),
 public.v2_branch_archive(uuid,uuid,boolean),public.v2_branch_apply_capacity(uuid,uuid,text,text,integer),
 public.v2_branch_list(uuid,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.v2_branch_list(uuid,text,text,uuid,boolean) to authenticated,service_role;
grant execute on function public.v2_billing_root(uuid),public.v2_branch_capacity(uuid),public.v2_branch_enabled(uuid),
 public.v2_branch_authorize(uuid,uuid),public.v2_branch_create(uuid,uuid,uuid,text,uuid,jsonb),public.v2_branch_copy_step(uuid),
 public.v2_branch_archive(uuid,uuid,boolean),public.v2_branch_apply_capacity(uuid,uuid,text,text,integer) to service_role;
revoke all on function public.v2_billing_exempt(uuid),public.v2_billing_can_write(uuid),public.v2_trial_access_allowed(uuid),public.v2_account_billing(uuid) from public,anon;
grant execute on function public.v2_billing_exempt(uuid),public.v2_billing_can_write(uuid),public.v2_trial_access_allowed(uuid),public.v2_account_billing(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
