-- UnoMesa · Accesos del equipo por sucursal. Requiere 56 y 57.
-- Aditivo y repetible. No reasigna ni elimina usuarios/datos al instalar.
-- Las funciones son privadas: el servidor valida sesión/MFA antes de llamarlas.
begin;
do $$ begin
 if to_regprocedure('public.v2_branch_trash(uuid,uuid,uuid,boolean)') is null then
  raise exception 'Instale primero 56_MULTISUCURSAL.sql y 57_SUCURSALES_PAPELERA.sql';
 end if;
end $$;

create or replace function public.v2_team_authorize(p_context uuid,p_actor uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare root uuid;
begin
 root:=public.v2_billing_root(p_context);
 if root is null or p_actor is null or public.v2_is_support_agent() or not exists(
  select 1 from public.v2_members where restaurant_id=p_context and user_id=p_actor and status='activo' and role in('administrador','admin')
 ) or not public.v2_trial_access_allowed(p_context) then raise exception 'TEAM_ACCESS'; end if;
 return root;
end $$;

-- Search/keyset pagination avoids downloading the company's full member list.
create or replace function public.v2_team_catalog(p_context uuid,p_actor uuid,p_user uuid default null,p_search text default '',p_after_name text default null,p_after_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare root uuid; own boolean; rows jsonb; company text;
begin
 root:=public.v2_team_authorize(p_context,p_actor);
 select owner_id=p_actor,name into own,company from public.v2_restaurants where id=root;
 if own then perform public.v2_branch_authorize(root,p_actor); end if;
 if p_user is not null and not exists(select 1 from public.v2_members where restaurant_id=p_context and user_id=p_user) then raise exception 'TEAM_MEMBER'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_name,q.id),'[]'::jsonb) into rows from (
  select r.id,r.name,lower(r.name) sort_name,m.role,m.status,
   m.user_id is not null assigned,r.id=root is_principal,
   coalesce(b.status,'active') branch_status,
   public.v2_billing_can_write(r.id) writable
  from public.v2_restaurants r left join public.v2_branches b on b.restaurant_id=r.id
  left join public.v2_members m on m.restaurant_id=r.id and m.user_id=p_user
  where (r.id=root or r.billing_parent_id=root) and (own or r.id=p_context)
   and b.deleted_at is null
   and (coalesce(p_search,'')='' or r.name ilike '%'||left(p_search,100)||'%')
   and (p_after_name is null or (lower(r.name),r.id)>(p_after_name,p_after_id))
  order by lower(r.name),r.id limit 26
 ) q;
 return jsonb_build_object('company',company,'can_manage_branches',own,'assigned_count',(select count(*) from public.v2_members m join public.v2_restaurants r on r.id=m.restaurant_id left join public.v2_branches b on b.restaurant_id=r.id where m.user_id=p_user and (r.id=root or r.billing_parent_id=root) and (own or r.id=p_context) and b.deleted_at is null),'items',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(rows) with ordinality t(value,n) where n<=25),
  'next',case when jsonb_array_length(rows)>25 then jsonb_build_object('name',rows->24->>'sort_name','id',rows->24->>'id') else null end);
end $$;

-- Validate the exact requested changes. Unmentioned locations are preserved.
-- Called again inside the mutation transaction after locking the company.
create or replace function public.v2_team_check(p_context uuid,p_actor uuid,p_changes jsonb,p_user uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare root uuid; own boolean; item jsonb; rid uuid; old public.v2_members%rowtype; cnt integer; lim integer;
begin
 root:=public.v2_team_authorize(p_context,p_actor);
 perform 1 from public.v2_restaurants where id=root for update;
 select owner_id=p_actor into own from public.v2_restaurants where id=root;
 if own then perform public.v2_branch_authorize(root,p_actor); end if;
 if not public.v2_billing_can_write(p_context) then raise exception 'TEAM_READ_ONLY'; end if;
 if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)>500 then raise exception 'TEAM_SELECTION'; end if;
 if (select count(*) from jsonb_array_elements(p_changes))<>(select count(distinct value->>'id') from jsonb_array_elements(p_changes)) then raise exception 'TEAM_SELECTION'; end if;
 for item in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
  rid:=(item->>'id')::uuid;
  if rid is null or jsonb_typeof(item->'selected') is distinct from 'boolean' or not exists(
   select 1 from public.v2_restaurants r left join public.v2_branches b on b.restaurant_id=r.id
    where r.id=rid and (r.id=root or r.billing_parent_id=root) and b.deleted_at is null
  ) or (not own and rid<>p_context) then raise exception 'TEAM_ACCESS'; end if;
  select * into old from public.v2_members where restaurant_id=rid and user_id=p_user for update;
  if item ? 'expected' and (item->'expected') is distinct from
    (case when old.user_id is null then 'null'::jsonb else jsonb_build_object('role',old.role,'status',old.status) end)
   then raise exception 'TEAM_CHANGED'; end if;
  if (item->>'selected')::boolean then
   if item->>'role' is null or item->>'role' not in('administrador','gerente','operacion','lectura') then raise exception 'TEAM_ROLE'; end if;
   if not public.v2_billing_can_write(rid) then raise exception 'TEAM_READ_ONLY'; end if;
   if old.user_id is null then
    lim:=public.v2_plan_user_limit(rid);
    select count(*) into cnt from public.v2_members where restaurant_id=rid and status in('activo','invitado');
    if lim is null or cnt>=lim then raise exception 'TEAM_CAPACITY: %', (select name from public.v2_restaurants where id=rid); end if;
   end if;
  end if;
  if old.user_id is not null and (not (item->>'selected')::boolean or item->>'role'<>old.role) then
   if exists(select 1 from public.v2_restaurants where id=root and owner_id=p_user) then raise exception 'TEAM_OWNER'; end if;
   if p_user=p_actor then raise exception 'TEAM_SELF'; end if;
   if old.role in('administrador','admin') and old.status='activo' and
    (not (item->>'selected')::boolean or item->>'role'<>'administrador') and not exists(
     select 1 from public.v2_members where restaurant_id=rid and user_id<>p_user and status='activo' and role in('administrador','admin')
    ) then raise exception 'TEAM_LAST_ADMIN'; end if;
  end if;
 end loop;
 return root;
end $$;

-- Returns an existing user only within the caller's authorized company/sucursal.
-- No Auth-directory search and no disclosure of other companies' accounts.
create or replace function public.v2_team_invite_check(p_context uuid,p_actor uuid,p_email text,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare root uuid; known uuid; st text; own boolean; info jsonb;
begin
 root:=public.v2_team_authorize(p_context,p_actor);
 select owner_id=p_actor into own from public.v2_restaurants where id=root;
 select m.user_id,m.status into known,st from public.v2_members m join public.v2_restaurants r on r.id=m.restaurant_id
 where (r.id=root or r.billing_parent_id=root) and (own or r.id=p_context) and lower(m.email)=lower(btrim(p_email))
 order by case m.status when 'activo' then 0 when 'invitado' then 1 else 2 end,m.restaurant_id limit 1;
 perform public.v2_team_check(p_context,p_actor,p_changes,known);
 if jsonb_array_length(p_changes)=0 or exists(select 1 from jsonb_array_elements(p_changes) x where not (x->>'selected')::boolean) then raise exception 'TEAM_SELECTION'; end if;
 if known is not null and exists(select 1 from public.v2_members m join jsonb_array_elements(p_changes) x on m.restaurant_id=(x->>'id')::uuid where m.user_id=known and m.status<>'invitado') then raise exception 'TEAM_EXISTS'; end if;
 select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'role',x->>'role') order by lower(r.name),r.id) into info
 from jsonb_array_elements(p_changes) x join public.v2_restaurants r on r.id=(x->>'id')::uuid;
 return jsonb_build_object('user_id',known,'status',st,'company',(select name from public.v2_restaurants where id=root),'branches',info);
end $$;

create or replace function public.v2_team_apply(p_context uuid,p_actor uuid,p_user uuid,p_name text,p_email text,p_changes jsonb,p_mode text default 'edit',p_hash text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare root uuid; item jsonb; old public.v2_members%rowtype; known public.v2_members%rowtype; st text; token text; found_user uuid; result jsonb;
begin
 if p_user is null or length(btrim(p_name)) not between 1 and 120 or p_mode not in('edit','invite') then raise exception 'TEAM_SELECTION'; end if;
 root:=public.v2_team_check(p_context,p_actor,p_changes,p_user);
 if p_mode='edit' then
  select * into known from public.v2_members where restaurant_id=p_context and user_id=p_user for update;
  if known.user_id is null then raise exception 'TEAM_MEMBER'; end if;
  if not exists(select 1 from public.v2_members m join public.v2_restaurants r on r.id=m.restaurant_id
   where m.user_id=p_user and (r.id=root or r.billing_parent_id=root) and not exists(select 1 from jsonb_array_elements(p_changes) x where (x->>'id')::uuid=m.restaurant_id and not (x->>'selected')::boolean))
   and not exists(select 1 from jsonb_array_elements(p_changes) x where (x->>'selected')::boolean)
   then raise exception 'TEAM_LAST_LOCATION'; end if;
  st:=known.status;token:=known.invite_token_hash;
  if st not in('activo','invitado') and exists(select 1 from jsonb_array_elements(p_changes) x where (x->>'selected')::boolean and not exists(select 1 from public.v2_members where restaurant_id=(x->>'id')::uuid and user_id=p_user)) then raise exception 'TEAM_INACTIVE'; end if;
 else
  result:=public.v2_team_invite_check(p_context,p_actor,p_email,p_changes);
  found_user:=(result->>'user_id')::uuid;
  if found_user is not null and found_user<>p_user then raise exception 'TEAM_CHANGED'; end if;
  -- Existing accounts may be linked only when already active in this company.
  if found_user is not null and result->>'status'='inactivo' then raise exception 'TEAM_INACTIVE'; end if;
  st:=case when result->>'status'='activo' then 'activo' else 'invitado' end;
  token:=case when st='invitado' then p_hash else null end;
  if st='invitado' and (token is null or token !~ '^[a-f0-9]{64}$') then raise exception 'TEAM_SELECTION'; end if;
 end if;
 for item in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
  select * into old from public.v2_members where restaurant_id=(item->>'id')::uuid and user_id=p_user;
  if (item->>'selected')::boolean then
   if old.user_id is null then
    insert into public.v2_members(restaurant_id,user_id,name,email,role,status,invited_at,last_invited_at,invite_token_hash)
     values((item->>'id')::uuid,p_user,btrim(p_name),case when p_mode='edit' then known.email else lower(btrim(p_email)) end,item->>'role',st,
      case when st='invitado' then now() end,case when st='invitado' then now() end,token);
   elsif p_mode='invite' then
    update public.v2_members set name=btrim(p_name),role=item->>'role',status=st,invite_token_hash=token,last_invited_at=now()
     where restaurant_id=old.restaurant_id and user_id=p_user;
   else
    update public.v2_members set name=btrim(p_name),role=item->>'role' where restaurant_id=old.restaurant_id and user_id=p_user;
   end if;
  elsif old.user_id is not null then
   -- Revokes only this membership; preserves Auth and every business record.
   delete from public.v2_members where restaurant_id=old.restaurant_id and user_id=p_user;
  end if;
  insert into public.v2_branch_audit(root_id,branch_id,actor_id,action) values(root,(item->>'id')::uuid,p_actor,case when (item->>'selected')::boolean then 'member_access_updated' else 'member_access_removed' end);
 end loop;
 if p_mode='edit' then update public.v2_members set name=btrim(p_name) where restaurant_id=p_context and user_id=p_user; end if;
 return jsonb_build_object('ok',true,'linked',st='activo','status',st);
end $$;

-- One invitation can contain several permissions within ONE company.
-- A private claim prevents reuse; conditional rollback never resurrects revoked access.
create or replace function public.v2_team_invitation(p_context uuid,p_user uuid,p_hash text,p_action text default 'preview',p_claim text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare root uuid; rows jsonb; amount integer;
begin
 root:=public.v2_billing_root(p_context);
 if root is null or p_user is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_action not in('preview','claim','complete','rollback') then raise exception 'TEAM_INVITATION'; end if;
 perform 1 from public.v2_restaurants where id=root for update;
 select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'role',m.role) order by (r.id=p_context) desc,lower(r.name),r.id) into rows
 from public.v2_members m join public.v2_restaurants r on r.id=m.restaurant_id left join public.v2_branches b on b.restaurant_id=r.id
 where m.user_id=p_user and m.status='invitado' and m.invite_token_hash=p_hash and (r.id=root or r.billing_parent_id=root) and b.deleted_at is null;
 if rows is null then raise exception 'TEAM_INVITATION'; end if;
 if p_action='claim' then
  if p_claim is null or p_claim !~ '^[a-f0-9]{64}$' or p_claim=p_hash then raise exception 'TEAM_INVITATION'; end if;
  update public.v2_members m set invite_token_hash=p_claim from public.v2_restaurants r
   where r.id=m.restaurant_id and (r.id=root or r.billing_parent_id=root) and m.user_id=p_user and m.status='invitado' and m.invite_token_hash=p_hash
    and m.restaurant_id in(select (x->>'id')::uuid from jsonb_array_elements(rows) x);
 elsif p_action='complete' then
  update public.v2_members m set status='activo',invite_token_hash=null from public.v2_restaurants r
   where r.id=m.restaurant_id and (r.id=root or r.billing_parent_id=root) and m.user_id=p_user and m.status='invitado' and m.invite_token_hash=p_hash
    and m.restaurant_id in(select (x->>'id')::uuid from jsonb_array_elements(rows) x);
 elsif p_action='rollback' then
  if p_claim is null or p_claim !~ '^[a-f0-9]{64}$' then raise exception 'TEAM_INVITATION'; end if;
  update public.v2_members m set invite_token_hash=p_claim from public.v2_restaurants r
   where r.id=m.restaurant_id and (r.id=root or r.billing_parent_id=root) and m.user_id=p_user and m.status='invitado' and m.invite_token_hash=p_hash
    and m.restaurant_id in(select (x->>'id')::uuid from jsonb_array_elements(rows) x);
 end if;
 return jsonb_build_object('company',(select name from public.v2_restaurants where id=root),'branches',rows,'restaurant_id',rows->0->>'id');
end $$;

-- Rotate only the invitation containing the selected user's current membership.
create or replace function public.v2_team_resend(p_context uuid,p_actor uuid,p_user uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare root uuid; old public.v2_members%rowtype; result jsonb;
begin
 root:=public.v2_team_authorize(p_context,p_actor);
 perform 1 from public.v2_restaurants where id=root for update;
 if not public.v2_billing_can_write(p_context) then raise exception 'TEAM_READ_ONLY'; end if;
 select * into old from public.v2_members where restaurant_id=p_context and user_id=p_user for update;
 if old.status is distinct from 'invitado' or old.invite_token_hash is null then raise exception 'TEAM_INVITATION'; end if;
 if old.last_invited_at>now()-interval '60 seconds' then raise exception 'TEAM_RESEND_WAIT'; end if;
 result:=public.v2_team_invitation(p_context,p_user,old.invite_token_hash,'claim',p_hash);
 update public.v2_members m set last_invited_at=now() from public.v2_restaurants r where r.id=m.restaurant_id and (r.id=root or r.billing_parent_id=root) and m.user_id=p_user and m.invite_token_hash=p_hash and m.status='invitado';
 return result;
end $$;

revoke all on function public.v2_team_authorize(uuid,uuid), public.v2_team_catalog(uuid,uuid,uuid,text,text,uuid),public.v2_team_check(uuid,uuid,jsonb,uuid),public.v2_team_invite_check(uuid,uuid,text,jsonb),public.v2_team_apply(uuid,uuid,uuid,text,text,jsonb,text,text),public.v2_team_invitation(uuid,uuid,text,text,text),public.v2_team_resend(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.v2_team_authorize(uuid,uuid), public.v2_team_catalog(uuid,uuid,uuid,text,text,uuid),public.v2_team_check(uuid,uuid,jsonb,uuid),public.v2_team_invite_check(uuid,uuid,text,jsonb),public.v2_team_apply(uuid,uuid,uuid,text,text,jsonb,text,text),public.v2_team_invitation(uuid,uuid,text,text,text),public.v2_team_resend(uuid,uuid,uuid,text) to service_role;
commit;
