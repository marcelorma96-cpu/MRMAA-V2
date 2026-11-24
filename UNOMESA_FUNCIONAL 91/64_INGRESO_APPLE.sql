-- UnoMesa: ingreso nativo con Apple. Incremental, reejecutable, sin borrar datos.
-- Requiere la instalación existente de Google (40/41) y sesiones (33/48).
begin;
set local lock_timeout='10s';
do $$ begin
 if to_regprocedure('public.v2_google_registration_state(uuid,uuid)') is null
 or to_regprocedure('public.v2_google_start_trial(uuid,uuid,jsonb)') is null then
 raise exception 'Faltan las funciones de registro 40/41. No se modificó nada.';
 end if;
end $$;
create or replace function public.v2_apple_registration_state(p_user uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare u auth.users%rowtype;
begin
 if not public.v2_session_is_active(p_session,p_user) then return 'blocked'; end if;
 select * into u from auth.users where id=p_user;
 if u.id is null or u.email_confirmed_at is null or coalesce(u.is_anonymous,false)
 or not exists(select 1 from auth.identities i where i.user_id=p_user and i.provider='apple') then return 'blocked'; end if;
 if exists(select 1 from public.v2_members where user_id=p_user and status='activo') then return 'ready'; end if;
 -- Pending/deactivated invitations or existing owners are never converted into
 -- another owner account. Old email-only orphan accounts need their original flow.
 if u.invited_at is not null or u.raw_app_meta_data->>'provider' is distinct from 'apple'
 or exists(select 1 from public.v2_members where user_id=p_user)
 or exists(select 1 from public.v2_restaurants where owner_id=p_user) then return 'blocked'; end if;
 return 'needs_profile';
end $$;

create or replace function public.v2_apple_start_trial(p_user uuid,p_session uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare state text; rid uuid; email_address text; lang text;
begin
 -- El mismo candado que los otros registros evita crear dos restaurantes.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,3422));
 perform 1 from auth.sessions where id=p_session and user_id=p_user for update;
 perform 1 from public.v2_device_sessions where session_id=p_session for update;
 state:=public.v2_apple_registration_state(p_user,p_session);
 if state='ready' then
  select restaurant_id into rid from public.v2_members where user_id=p_user and status='activo' order by restaurant_id limit 1;
  return jsonb_build_object('restaurant_id',rid,'created',false);
 end if;
 if state<>'needs_profile' then raise exception 'GOOGLE_ACCESS'; end if;
 lang:=coalesce(p_data->>'language','');
 if coalesce(p_data->'accepted','false'::jsonb)<>'true'::jsonb
 or coalesce(p_data->>'legal_version','')<>'2026-09-10'
 or length(btrim(coalesce(p_data->>'full_name',''))) not between 2 and 120
 or length(coalesce(p_data->>'country',''))>100
 or lang not in ('es','en')
 or coalesce(p_data->>'currency','') not in ('GTQ','USD','MXN') then raise exception 'GOOGLE_INPUT'; end if;
 select lower(email) into email_address from auth.users where id=p_user;
 insert into public.v2_restaurants(owner_id,name,phone,country,language,currency,plan_code,billing_cycle,
  trial_started_at,trial_ends_at,subscription_status,access_status,billing_enforcement_enabled,billing_exempt_user_id,settings)
 values(p_user,case when lang='en' then 'My restaurant' else 'Mi restaurante' end,'',coalesce(p_data->>'country',''),lang,p_data->>'currency',
  'advanced','month',now(),now()+interval '10 days','trialing','trialing',true,null,
  jsonb_build_object('google_onboarding',jsonb_build_object('profile_pending',true,'direct_dashboard',true))) returning id into rid;
 insert into public.v2_members(restaurant_id,user_id,name,email,role,status)
 values(rid,p_user,btrim(p_data->>'full_name'),email_address,'administrador','activo');
 insert into public.v2_legal_acceptances(user_id,restaurant_id,legal_version,user_agent)
 values(p_user,rid,'2026-09-10','UnoMesa: continuar con Apple; términos visibles junto al botón') on conflict(user_id,legal_version) do nothing;
 return jsonb_build_object('restaurant_id',rid,'created',true);
end $$;


revoke all on function public.v2_apple_registration_state(uuid,uuid), public.v2_apple_start_trial(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.v2_apple_registration_state(uuid,uuid), public.v2_apple_start_trial(uuid,uuid,jsonb) to service_role;
-- Auth user deletion detaches the grant; the existing hourly worker then revokes
-- it at Apple. Branch/member deletion and sign-out never enqueue anything.
create table if not exists public.v2_apple_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references auth.users(id) on delete set null,
 subject_hash text not null, sealed_token text not null, last_attempt timestamptz
);
create index if not exists v2_apple_revocation_due on public.v2_apple_grants(last_attempt nulls first) where user_id is null;
alter table public.v2_apple_grants enable row level security;
revoke all on public.v2_apple_grants from public,anon,authenticated;
grant select,insert,update,delete on public.v2_apple_grants to service_role;
notify pgrst,'reload schema';
commit;
