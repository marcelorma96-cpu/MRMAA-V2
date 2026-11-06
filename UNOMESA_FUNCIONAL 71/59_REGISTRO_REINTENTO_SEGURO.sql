-- UnoMesa · Reintentar el registro y reenviar la confirmación.
-- Aditivo y repetible. No borra usuarios ni modifica restaurantes, pruebas,
-- suscripciones, clientes, cotizaciones, reservas o accesos existentes.
-- Conserva el token original del registro: los enlaces ya enviados siguen válidos.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if to_regprocedure('public.v2_begin_registration(jsonb)') is null
 or to_regclass('public.v2_registration_intents') is null then
  raise exception 'Falta el registro original de UnoMesa. No se modificó nada.';
 end if;
end $$;
create table if not exists public.v2_registration_attempts (
 email text primary key, attempt_id uuid,
 lease_until timestamptz not null default now()
);
alter table public.v2_registration_attempts enable row level security;
revoke all on public.v2_registration_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.v2_registration_attempts to service_role;

-- Solo el servidor puede obtener un token. Nunca se entrega al navegador.
create or replace function public.v2_registration_acquire(p_data jsonb,p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e text:=lower(btrim(p_data->>'email')); u auth.users%rowtype;
 i public.v2_registration_intents%rowtype; a public.v2_registration_attempts%rowtype;
 action text; attempt uuid:=gen_random_uuid();
begin
 if e is null or length(e)>254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'REGISTRATION_DATA'; end if;
 -- Same lock as the original registration RPC.
 perform pg_advisory_xact_lock(hashtextextended(e,3421));
 select * into u from auth.users where lower(email)=e limit 1;
 select * into i from public.v2_registration_intents where email=e for update;
 if exists(select 1 from public.v2_members where lower(email)=e or user_id=u.id)
 or exists(select 1 from public.v2_restaurants where owner_id=u.id)
 or exists(select 1 from public.v2_legal_acceptances where user_id=u.id)
 or i.consumed_at is not null then return jsonb_build_object('state','existing'); end if;
 if u.id is not null then
  if u.email_confirmed_at is not null or u.invited_at is not null
   or i.token is null or i.token::text is distinct from u.raw_user_meta_data->>'registration_token'
   or (i.user_id is not null and i.user_id<>u.id) then return jsonb_build_object('state','existing'); end if;
  -- Never change an unconfirmed account's password or metadata.
  action:='resend';
 else
  if p_resend then return jsonb_build_object('state','retry_registration'); end if;
  if i.user_id is not null then return jsonb_build_object('state','existing'); end if;
  action:='signup';
 end if;
 select * into a from public.v2_registration_attempts where email=e for update;
 if a.lease_until>now() then
  return jsonb_build_object('state','busy','retry_after',greatest(1,ceil(extract(epoch from a.lease_until-now()))::integer));
 end if;
 if action='signup' and i.token is null then
  -- Preserve the installed validation/provisioning rules for new accounts.
  perform public.v2_begin_registration(p_data);
  select * into i from public.v2_registration_intents where email=e for update;
 end if;
 if i.token is null then raise exception 'REGISTRATION_INTENT'; end if;
 insert into public.v2_registration_attempts(email,attempt_id,lease_until)
 values(e,attempt,now()+interval '90 seconds')
 on conflict(email) do update set attempt_id=excluded.attempt_id,lease_until=excluded.lease_until;
 return jsonb_build_object('state',action,'attempt_id',attempt,'registration_token',i.token,
  'full_name',i.full_name,'language',i.language);
end $$;

create or replace function public.v2_registration_release(p_email text,p_attempt uuid,p_wait integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 -- A delayed response cannot release a newer request's lease.
 update public.v2_registration_attempts set attempt_id=null,
  lease_until=now()+make_interval(secs=>greatest(0,least(coalesce(p_wait,90),300)))
 where email=lower(btrim(p_email)) and attempt_id=p_attempt;
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.v2_registration_acquire(jsonb,boolean),public.v2_registration_release(text,uuid,integer) from public,anon,authenticated;
grant execute on function public.v2_registration_acquire(jsonb,boolean),public.v2_registration_release(text,uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
