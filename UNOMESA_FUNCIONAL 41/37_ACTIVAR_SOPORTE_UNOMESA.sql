-- UnoMesa: traslado de la cuenta de soporte. 26 septiembre 2026.
-- Ejecutar TODO el archivo en Supabase > SQL Editor, en el proyecto revisado.
-- Autoriza la cuenta nueva y deshabilita el permiso de soporte de la anterior.
-- Reasigna solicitudes sin cambiar su contenido, estado, permisos ni vencimiento.
-- Conserva ambas cuentas de Authentication y el historial de auditoria.
-- No cambia reservas, clientes, cotizaciones, pagos, planes ni exenciones del piloto.
-- No configura buzones, DNS o SMTP y no reenvia correos anteriores.
-- Transaccional y repetible: si una comprobacion falla, no aplica el traslado.
-- Revision 2: adapta la restriccion de correo que rechazo la primera ejecucion.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '30s';

do $migration$
declare
  old_user constant uuid := '83260863-d0e4-492d-b8ab-1d4df8a40e83';
  new_user constant uuid := '90ea24b3-8387-452f-a603-c6d61a359f10';
  old_email constant text := 'support@mrmaa.com';
  new_email constant text := 'support@unomesa.com';
  function_id regprocedure;
  definition text;
  email_check text;
  email_check_no_inherit boolean;
  before_count bigint;
  after_count bigint;
  moved_count bigint;
begin
  if to_regclass('public.v2_support_agents') is null
     or to_regclass('public.v2_support_grants') is null
     or to_regclass('public.v2_members') is null then
    raise exception 'Falta la instalacion de soporte. No se aplico el traslado.';
  end if;

  function_id := to_regprocedure('public.v2_support_authorize(uuid,uuid,text,text)');
  if function_id is null then
    raise exception 'No existe la funcion de autorizacion esperada.';
  end if;
  select pg_get_functiondef(function_id) into definition;
  if position(quote_literal(old_email) in definition) = 0
     and position(quote_literal(new_email) in definition) = 0 then
    raise exception 'La funcion de soporte tiene otra configuracion. No se modifico.';
  end if;

  -- Verificar las identidades exactas confirmadas en el diagnostico.
  perform 1 from auth.users
    where id = old_user and lower(email) = old_email for update;
  if not found then
    raise exception 'La cuenta anterior no coincide con el diagnostico.';
  end if;
  perform 1 from auth.users
    where id = new_user and lower(email) = new_email
      and email_confirmed_at is not null for update;
  if not found then
    raise exception 'La cuenta nueva no coincide o su correo no esta confirmado.';
  end if;

  lock table public.v2_support_agents in share row exclusive mode;
  lock table public.v2_support_grants in share row exclusive mode;
  lock table public.v2_members in share row exclusive mode;

  if not exists(select 1 from public.v2_support_agents
                where user_id = old_user and email = old_email) then
    raise exception 'No se encontro el agente anterior esperado.';
  end if;
  if exists(select 1 from public.v2_support_agents
            where (email = new_email and user_id <> new_user)
               or (user_id = new_user and email <> new_email)) then
    raise exception 'El correo o ID nuevo ya tiene otra autorizacion. No se modifico.';
  end if;
  if exists(select 1 from public.v2_members where user_id = new_user) then
    raise exception 'La cuenta nueva tiene una membresia de restaurante. Revisarla antes de convertirla en soporte; no se borro ningun dato.';
  end if;

  -- Conservar la validacion instalada y admitir la nueva direccion solamente
  -- para el usuario exacto confirmado arriba. No se abre el rol a otros correos.
  select pg_get_expr(c.conbin, c.conrelid), c.connoinherit
    into email_check, email_check_no_inherit
  from pg_constraint c
  where c.conrelid = 'public.v2_support_agents'::regclass
    and c.conname = 'v2_support_agents_email_check'
    and c.contype = 'c' and c.conislocal and c.coninhcount = 0;
  if email_check is null then
    raise exception 'No se encontro la restriccion de correo esperada. No se aplico el traslado.';
  end if;

  if position(quote_literal(new_email) in email_check) = 0 then
    if position(quote_literal(old_email) in email_check) = 0 then
      raise exception 'La restriccion de correo tiene otra configuracion. No se modifico.';
    end if;
    alter table public.v2_support_agents
      drop constraint v2_support_agents_email_check;
    execute format(
      'alter table public.v2_support_agents add constraint v2_support_agents_email_check check ((%s) or (user_id = %L::uuid and email = %L and (%s)))%s',
      email_check, new_user, new_email,
      replace(email_check, quote_literal(old_email), quote_literal(new_email)),
      case when email_check_no_inherit then ' no inherit' else '' end
    );
  end if;

  select count(*) into before_count
  from public.v2_support_grants where agent_id in (old_user, new_user);

  if exists(select 1 from public.v2_support_agents where user_id = new_user) then
    update public.v2_support_agents set enabled = true
      where user_id = new_user and email = new_email;
  else
    insert into public.v2_support_agents(user_id, email, enabled)
      values(new_user, new_email, true);
  end if;

  -- Modifica unicamente el correo de destino en la definicion instalada.
  -- Conserva validaciones, permisos SQL, limites y registro de auditoria.
  if position(quote_literal(old_email) in definition) > 0 then
    execute replace(definition, quote_literal(old_email), quote_literal(new_email));
  end if;

  update public.v2_support_grants set agent_id = new_user
    where agent_id = old_user;
  get diagnostics moved_count = row_count;

  update public.v2_support_agents set enabled = false
    where user_id = old_user and email = old_email;

  select count(*) into after_count
  from public.v2_support_grants where agent_id = new_user;
  if after_count <> before_count then
    raise exception 'No coincide el total de solicitudes. Se cancelo el traslado.';
  end if;

  -- The old address can never regain support access by toggling enabled.
  execute $ddl$CREATE OR REPLACE FUNCTION public.v2_is_support_agent()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
    AS $body$
      select exists(select 1 from public.v2_support_agents a
        join auth.users u on u.id=a.user_id
        where a.user_id=auth.uid() and a.enabled
          and a.user_id='90ea24b3-8387-452f-a603-c6d61a359f10'::uuid
          and a.email='support@unomesa.com'
          and lower(u.email)=a.email and u.email_confirmed_at is not null);
    $body$ $ddl$;

  raise notice 'Soporte UnoMesa habilitado. Solicitudes reasignadas: %.', moved_count;
end;
$migration$;

commit;

-- Resultado esperado: support@unomesa.com habilitado=true y confirmado=true;
-- support@mrmaa.com habilitado=false. La funcion apunta al correo nuevo.
select a.email as correo_soporte, a.enabled as habilitado,
       u.email_confirmed_at is not null as confirmado,
       (select count(*) from public.v2_support_grants g
         where g.agent_id = a.user_id) as solicitudes_asignadas,
       position(quote_literal('support@unomesa.com') in
         pg_get_functiondef('public.v2_support_authorize(uuid,uuid,text,text)'::regprocedure)) > 0
         as solicitudes_nuevas_a_unomesa
from public.v2_support_agents a
join auth.users u on u.id = a.user_id
where a.user_id in ('83260863-d0e4-492d-b8ab-1d4df8a40e83'::uuid,
                    '90ea24b3-8387-452f-a603-c6d61a359f10'::uuid)
order by a.email;
