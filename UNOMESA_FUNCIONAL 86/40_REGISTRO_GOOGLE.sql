-- UnoMesa: completar registros verificados con Google.
-- Incremental y reejecutable. Ejecutar antes de activar el botón de Google.
-- Agrega dos funciones exclusivas del servidor; no reemplaza las funciones
-- existentes de registro, invitaciones, MFA, sesiones, pagos ni permisos.
begin;
set local lock_timeout = '10s';
do $$ begin
 if to_regclass('public.v2_legal_acceptances') is null
 or to_regclass('public.v2_registration_intents') is null
 or to_regclass('auth.identities') is null
 or to_regprocedure('public.v2_session_is_active(uuid,uuid)') is null then
  raise exception 'Falta la instalación previa de UnoMesa y sesiones (SQL 33). No se aplicó ningún cambio.';
 end if;
end $$;

create or replace function public.v2_google_registration_state(p_user uuid, p_session uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare u auth.users%rowtype;
begin
 if not public.v2_session_is_active(p_session,p_user) then return 'blocked'; end if;
 select * into u from auth.users where id=p_user;
 if u.id is null or u.email_confirmed_at is null or coalesce(u.is_anonymous,false)
 or not exists(select 1 from auth.identities i where i.user_id=p_user and i.provider='google') then return 'blocked'; end if;
 if exists(select 1 from public.v2_members where user_id=p_user and status='activo') then return 'ready'; end if;
 -- Pending/deactivated invitations or existing owners are never converted into
 -- another owner account. Old email-only orphan accounts need their original flow.
 if u.invited_at is not null or u.raw_app_meta_data->>'provider' is distinct from 'google'
 or exists(select 1 from public.v2_members where user_id=p_user)
 or exists(select 1 from public.v2_restaurants where owner_id=p_user) then return 'blocked'; end if;
 return 'needs_profile';
end $$;

create or replace function public.v2_google_finish_registration(p_user uuid,p_session uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare state text; rid uuid; email_address text;
begin
 -- Same lock as the email registration finalizer; repeated requests are safe.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,3422));
 -- Prevent a concurrent revocation from racing the provisioning transaction.
 perform 1 from auth.sessions where id=p_session and user_id=p_user for update;
 perform 1 from public.v2_device_sessions where session_id=p_session for update;
 state:=public.v2_google_registration_state(p_user,p_session);
 if state='ready' then
  select restaurant_id into rid from public.v2_members where user_id=p_user and status='activo' order by restaurant_id limit 1;
  return jsonb_build_object('restaurant_id',rid,'created',false);
 end if;
 if state<>'needs_profile' then raise exception 'GOOGLE_ACCESS'; end if;
 if coalesce(p_data->'accepted','false'::jsonb)<>'true'::jsonb
 or length(btrim(coalesce(p_data->>'full_name',''))) not between 2 and 120
 or length(btrim(coalesce(p_data->>'restaurant_name',''))) not between 2 and 160
 or coalesce(p_data->>'phone','') !~ '^\+[1-9][0-9]{6,14}$'
 or length(btrim(coalesce(p_data->>'country',''))) not between 2 and 100
 or coalesce(p_data->>'language','') not in ('es','en')
 or coalesce(p_data->>'currency','') not in ('GTQ','USD','MXN') then raise exception 'GOOGLE_INPUT'; end if;
 select lower(email) into email_address from auth.users where id=p_user;
 insert into public.v2_restaurants(owner_id,name,phone,country,language,currency,plan_code,billing_cycle,
  trial_started_at,trial_ends_at,subscription_status,access_status,billing_enforcement_enabled,billing_exempt_user_id)
 values(p_user,btrim(p_data->>'restaurant_name'),p_data->>'phone',p_data->>'country',p_data->>'language',p_data->>'currency',
  'advanced','month',now(),now()+interval '10 days','trialing','trialing',true,null) returning id into rid;
 insert into public.v2_members(restaurant_id,user_id,name,email,role,status)
 values(rid,p_user,btrim(p_data->>'full_name'),email_address,'administrador','activo');
 insert into public.v2_legal_acceptances(user_id,restaurant_id,legal_version,user_agent)
 values(p_user,rid,'2026-09-10','Registro Google UnoMesa') on conflict(user_id,legal_version) do nothing;
 return jsonb_build_object('restaurant_id',rid,'created',true);
end $$;

-- Only the server can call these after Auth getUser + OAuth + MFA checks.
revoke all on function public.v2_google_registration_state(uuid,uuid),
 public.v2_google_finish_registration(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.v2_google_registration_state(uuid,uuid),
 public.v2_google_finish_registration(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
select 'Registro Google preparado. Configure Google/Supabase antes de activar el botón.' as resultado;
