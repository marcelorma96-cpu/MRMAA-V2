-- UnoMesa · Sucursales: creación, edición y papelera recuperable durante 30 días.
-- Ejecutar DESPUÉS del SQL 56. No cambia ni elimina registros existentes al instalar.
-- Solo una acción explícita del propietario sobre una sucursal ARCHIVADA inicia el plazo.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('public.v2_branch_create(uuid,uuid,uuid,text,uuid,jsonb)') is null then
  raise exception 'Falta SQL 56. No se aplicaron cambios.';
 end if;
end $$;
alter table public.v2_branches add column if not exists deleted_at timestamptz;
alter table public.v2_branches add column if not exists purge_after timestamptz;
alter table public.v2_branches add column if not exists deleted_by uuid;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='v2_branch_trash_shape' and conrelid='public.v2_branches'::regclass) then
  alter table public.v2_branches add constraint v2_branch_trash_shape check(
   (deleted_at is null and purge_after is null and deleted_by is null) or
   (deleted_at is not null and deleted_by is not null and status='archived' and slot is null and purge_after=deleted_at+interval '30 days'));
 end if;
end $$;
create index if not exists v2_branches_trash_due on public.v2_branches(purge_after,restaurant_id) where deleted_at is not null;
-- No foreign key to a deleted restaurant: retain the cleanup reference after row deletion.
create table if not exists public.v2_branch_purge_jobs(
 branch_id uuid primary key,root_id uuid not null,
 status text not null default 'records' check(status in('records','files','done')),
 retry_after timestamptz not null default now(),error_code text,updated_at timestamptz not null default now()
);
alter table public.v2_branch_purge_jobs enable row level security;
revoke all on public.v2_branch_purge_jobs from public,anon,authenticated;
grant all on public.v2_branch_purge_jobs to service_role;
create index if not exists v2_branch_purge_pending on public.v2_branch_purge_jobs(retry_after,branch_id) where status<>'done';
create or replace function public.v2_trial_access_allowed(p_restaurant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.v2_branches where restaurant_id=p_restaurant and deleted_at is not null) and public.v2_trial_access_allowed_single(public.v2_billing_root(p_restaurant));
$$;

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
   and b.deleted_at is null
   and (p_archived or coalesce(b.status,'active')<>'archived')
   and (coalesce(p_search,'')='' or position(lower(left(p_search,120)) in lower(r.name))>0)
   and (p_after_name is null or (lower(r.name),r.id)>(p_after_name,p_after_id))
  order by lower(r.name),r.id limit 26
 ) q;
 return jsonb_build_object('root_id',root,'can_manage',coalesce(own,false),'capacity',public.v2_branch_capacity(root),
  'trash_supported',true,
  'used',1+(select count(*) from public.v2_branches where root_id=root and status<>'archived'),
  'items',rows,'more',jsonb_array_length(rows)>25);
end $$;

create or replace function public.v2_branch_archive(p_restaurant uuid,p_user uuid,p_archived boolean) returns void language plpgsql security definer set search_path='' as $$
declare root uuid; sn integer;
begin
 select root_id into root from public.v2_branches where restaurant_id=p_restaurant;
 perform 1 from public.v2_restaurants where id=root for update;
 perform public.v2_branch_authorize(root,p_user);
 if exists(select 1 from public.v2_branches where restaurant_id=p_restaurant and deleted_at is not null) then raise exception 'BRANCH_IN_TRASH'; end if;
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
  'branch_deleted_at',(select deleted_at from public.v2_branches where restaurant_id=r.id),
  'branch_enabled',public.v2_branch_enabled(r.id),'branch_can_read',public.v2_trial_access_allowed(r.id));
end $$;

create or replace function public.v2_branch_owner_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Background purge only after the owner's 30-day deadline; never for authenticated callers.
 if tg_op='DELETE' and auth.uid() is null and exists(select 1 from public.v2_branches b join public.v2_branch_purge_jobs j on j.branch_id=b.restaurant_id where b.restaurant_id=old.restaurant_id and b.deleted_at is not null and b.purge_after<=now() and j.status='records') then return old; end if;
 if exists(select 1 from public.v2_restaurants child join public.v2_restaurants root on root.id=child.billing_parent_id
  where child.id=old.restaurant_id and root.owner_id=old.user_id) then
  if tg_op='DELETE' then raise exception 'BRANCH_PRIMARY_OWNER'; end if;
  if new.status<>'activo' or new.role not in('administrador','admin') or new.user_id<>old.user_id or new.restaurant_id<>old.restaurant_id then raise exception 'BRANCH_PRIMARY_OWNER'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
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
 if not exists(select 1 from jsonb_each(opts) where value='true'::jsonb) then
  update public.v2_branch_jobs set stage=5,status='done',updated_at=now() where id=p_request;
  update public.v2_branches set status='active',updated_at=now() where restaurant_id=rid;
 end if;
 return rid;
end $$;

create or replace function public.v2_branch_rename(p_root uuid,p_restaurant uuid,p_user uuid,p_name text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.v2_restaurants where id=p_root for update;
 perform public.v2_branch_authorize(p_root,p_user);
 if length(btrim(coalesce(p_name,''))) not between 2 and 160 then raise exception 'BRANCH_NAME'; end if;
 if not exists(select 1 from public.v2_branches where root_id=p_root and restaurant_id=p_restaurant and deleted_at is null) then raise exception 'BRANCH_ACCESS'; end if;
 update public.v2_restaurants set name=btrim(p_name) where id=p_restaurant;
 insert into public.v2_branch_audit(root_id,branch_id,actor_id,action) values(p_root,p_restaurant,p_user,'renamed');
end $$;
create or replace function public.v2_branch_trash(p_root uuid,p_restaurant uuid,p_user uuid,p_restore boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare b public.v2_branches%rowtype;
begin
 perform 1 from public.v2_restaurants where id=p_root for update;
 perform public.v2_branch_authorize(p_root,p_user);
 select * into b from public.v2_branches where restaurant_id=p_restaurant and root_id=p_root for update;
 if b.restaurant_id is null then raise exception 'BRANCH_ACCESS'; end if;
 if p_restore then
  if b.deleted_at is null then return; end if;
  if b.purge_after<=now() then raise exception 'BRANCH_TRASH_EXPIRED'; end if;
  update public.v2_branches set deleted_at=null,purge_after=null,deleted_by=null,updated_at=now() where restaurant_id=p_restaurant;
 else
  if b.deleted_at is not null then return; end if; -- Retrying never extends the deadline.
  if b.status<>'archived' then raise exception 'BRANCH_ARCHIVE_FIRST'; end if;
  if exists(select 1 from public.v2_branch_jobs where source_id=p_restaurant and status<>'done') then raise exception 'BRANCH_COPY_IN_USE'; end if;
  update public.v2_branches set deleted_at=now(),purge_after=now()+interval '30 days',deleted_by=p_user,updated_at=now() where restaurant_id=p_restaurant;
 end if;
 insert into public.v2_branch_audit(root_id,branch_id,actor_id,action) values(p_root,p_restaurant,p_user,case when p_restore then 'recovered_to_archive' else 'trashed_30_days' end);
end $$;
create or replace function public.v2_branch_trash_list(p_restaurant uuid,p_search text default '',p_after_name text default null,p_after_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare root uuid; rows jsonb;
begin
 if auth.uid() is null or not public.v2_mfa_session_allowed() then raise exception 'BRANCH_ACCESS'; end if;
 root:=public.v2_billing_root(p_restaurant);
 perform public.v2_branch_authorize(root,auth.uid());
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_name,q.id),'[]') into rows from(
  select r.id,r.name,lower(r.name) sort_name,b.status,b.deleted_at,b.purge_after,b.purge_after>now() recoverable,false is_principal,false enabled
  from public.v2_branches b join public.v2_restaurants r on r.id=b.restaurant_id
  where b.root_id=root and b.deleted_at is not null
   and (coalesce(p_search,'')='' or position(lower(left(p_search,120)) in lower(r.name))>0)
   and (p_after_name is null or (lower(r.name),r.id)>(p_after_name,p_after_id))
  order by lower(r.name),r.id limit 26
 )q;
 return jsonb_build_object('root_id',root,'can_manage',true,'items',rows,'more',jsonb_array_length(rows)>25);
end $$;
-- Purge is deliberately separate from unpaid-account retention. It processes only
-- explicit branch deletions after 30 days, never archived-only or principal accounts.
-- Bounded batches: a large restaurant is removed over several worker invocations.
create or replace function public.v2_branch_purge_step(p_restaurant uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.v2_branches%rowtype; tab record; n integer; total integer:=0; remaining boolean;
begin
 perform 1 from public.v2_restaurants where id=(select root_id from public.v2_branches where restaurant_id=p_restaurant) for update;
 select * into b from public.v2_branches where restaurant_id=p_restaurant for update;
 if b.restaurant_id is null or b.deleted_at is null or b.purge_after>now() or b.status<>'archived' then return jsonb_build_object('deleted',false); end if;
 if not exists(select 1 from public.v2_restaurants where id=p_restaurant and billing_parent_id=b.root_id and owner_id is null) then raise exception 'BRANCH_ACCESS'; end if;
 if exists(select 1 from public.v2_branch_jobs where source_id=p_restaurant and status<>'done') then raise exception 'BRANCH_COPY_IN_USE'; end if;
 insert into public.v2_branch_purge_jobs(branch_id,root_id) values(p_restaurant,b.root_id) on conflict do nothing;
 -- Quote lines have no restaurant_id. Their ownership is checked through the quote.
 if to_regclass('public.v2_quote_items') is not null and to_regclass('public.v2_quotes') is not null then
  execute 'delete from public.v2_quote_items where ctid in(select i.ctid from public.v2_quote_items i join public.v2_quotes q on q.id=i.quote_id where q.restaurant_id=$1 limit 500)' using p_restaurant;
  get diagnostics total=row_count;
  execute 'select exists(select 1 from public.v2_quote_items i join public.v2_quotes q on q.id=i.quote_id where q.restaurant_id=$1)' into remaining using p_restaurant;
  if remaining then return jsonb_build_object('deleted',false,'removed',total); end if;
 end if;
 delete from public.v2_branch_copy_ids where ctid in(select i.ctid from public.v2_branch_copy_ids i join public.v2_branch_jobs j on j.id=i.job_id where j.target_id=p_restaurant limit 500);
 get diagnostics n=row_count; total:=total+n;
 if exists(select 1 from public.v2_branch_copy_ids i join public.v2_branch_jobs j on j.id=i.job_id where j.target_id=p_restaurant) then return jsonb_build_object('deleted',false,'removed',total); end if;
 -- Only tables explicitly scoped by a UUID restaurant_id; never Auth or another tenant.
 for tab in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace s on s.oid=c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attname='restaurant_id' and not a.attisdropped
  where s.nspname='public' and c.relkind='r' and c.relname like 'v2\_%' escape '\'
  and a.atttypid='uuid'::regtype and c.relname<>'v2_branches' order by c.relname loop
  begin
   execute format('delete from public.%I where ctid in(select ctid from public.%I where restaurant_id=$1 limit 500)',tab.relname,tab.relname) using p_restaurant;
   get diagnostics n=row_count; total:=total+n;
  exception when foreign_key_violation then null; -- Delete dependent rows first, retry parent next pass.
  end;
  if total>=2000 then return jsonb_build_object('deleted',false,'removed',total); end if;
 end loop;
 -- Never let the final restaurant cascade silently bypass bounded cleanup.
 for tab in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace s on s.oid=c.relnamespace
  join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attname='restaurant_id' and not a.attisdropped
  where s.nspname='public' and c.relkind='r' and c.relname like 'v2\_%' escape '\'
  and a.atttypid='uuid'::regtype and c.relname<>'v2_branches' loop
  execute format('select exists(select 1 from public.%I where restaurant_id=$1)',tab.relname) into remaining using p_restaurant;
  if remaining then return jsonb_build_object('deleted',false,'removed',total,'blocked',total=0); end if;
 end loop;
 -- Existing copies are independent; completed jobs no longer need the source FK.
 update public.v2_branch_jobs set source_id=null where source_id=p_restaurant and status='done';
 begin
  delete from public.v2_restaurants where id=p_restaurant and billing_parent_id=b.root_id;
 exception when foreign_key_violation then
  return jsonb_build_object('deleted',false,'removed',total,'blocked',total=0);
 end;
 update public.v2_branch_purge_jobs set status='files',updated_at=now(),error_code=null where branch_id=p_restaurant;
 insert into public.v2_branch_audit(root_id,branch_id,action) values(b.root_id,p_restaurant,'purged_after_30_days');
 return jsonb_build_object('deleted',true,'removed',total);
end $$;
create or replace function public.v2_branch_purge_due(p_limit integer default 2)
returns table(restaurant_id uuid,root_id uuid) language sql stable security definer set search_path='' as $$
 select b.restaurant_id,b.root_id from public.v2_branches b left join public.v2_branch_purge_jobs j on j.branch_id=b.restaurant_id
 where b.deleted_at is not null and b.purge_after<=now() and b.status='archived' and (j.retry_after is null or j.retry_after<=now())
 order by b.purge_after,b.restaurant_id limit greatest(1,least(coalesce(p_limit,2),5));
$$;
revoke all on function public.v2_branch_purge_due(integer) from public,anon,authenticated;
grant execute on function public.v2_branch_purge_due(integer) to service_role;
-- Public links must stop accepting new requests while their branch is in trash.
do $install$ begin
 if to_regprocedure('public.v2_public_page(text)') is not null then
  if to_regprocedure('public.v2_public_page_before_branch_trash(text)') is null then alter function public.v2_public_page(text) rename to v2_public_page_before_branch_trash; end if;
  execute $fn$create or replace function public.v2_public_page(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
   select public.v2_public_page_before_branch_trash(p_slug) where not exists(select 1 from public.v2_public_aliases a join public.v2_branches b on b.restaurant_id=a.restaurant_id where a.slug=p_slug and b.deleted_at is not null)
  $$$fn$;
  revoke all on function public.v2_public_page_before_branch_trash(text) from public,anon,authenticated;
  revoke all on function public.v2_public_page(text) from public;
  grant execute on function public.v2_public_page(text) to anon,authenticated,service_role;
 end if;
 if to_regprocedure('public.v2_public_submit(text,uuid,jsonb)') is not null then
  if to_regprocedure('public.v2_public_submit_before_branch_trash(text,uuid,jsonb)') is null then alter function public.v2_public_submit(text,uuid,jsonb) rename to v2_public_submit_before_branch_trash; end if;
  execute $fn$create or replace function public.v2_public_submit(p_slug text,p_id uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
   begin
    if exists(select 1 from public.v2_public_aliases a join public.v2_branches b on b.restaurant_id=a.restaurant_id where a.slug=p_slug and b.deleted_at is not null) then raise exception 'PUBLIC_NOT_FOUND'; end if;
    perform public.v2_public_submit_before_branch_trash(p_slug,p_id,p_data);
   end
  $$$fn$;
  revoke all on function public.v2_public_submit_before_branch_trash(text,uuid,jsonb),public.v2_public_submit(text,uuid,jsonb) from public,anon,authenticated;
  grant execute on function public.v2_public_submit(text,uuid,jsonb) to service_role;
 end if;
end $install$;
revoke all on function public.v2_branch_rename(uuid,uuid,uuid,text),public.v2_branch_trash(uuid,uuid,uuid,boolean),public.v2_branch_purge_step(uuid),public.v2_branch_trash_list(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.v2_branch_rename(uuid,uuid,uuid,text),public.v2_branch_trash(uuid,uuid,uuid,boolean),public.v2_branch_purge_step(uuid) to service_role;
grant execute on function public.v2_branch_trash_list(uuid,text,text,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
