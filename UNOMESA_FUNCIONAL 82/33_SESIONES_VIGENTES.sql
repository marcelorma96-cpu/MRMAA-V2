-- MRMAA: sesiones vigentes y cierre por inactividad (23 septiembre 2026).
-- INCREMENTAL: ejecutar completo, antes de desplegar el ZIP actualizado.
-- Sirve para el piloto ya actualizado y para instalaciones con SQL 29 instalado.
-- No repetir los SQL base del piloto. No modifica restaurantes, miembros,
-- reservas, clientes, pagos ni exenciones. No elimina usuarios de Authentication.
-- Las sesiones antiguas sin actividad durante una hora dejan de tener acceso
-- a MRMAA y de aparecer en la lista. Esos usuarios deberán iniciar sesión otra vez.
-- Una pestaña cerrada sin conexión caduca según su último plazo de actividad.
-- Reejecutable: no reinicia los plazos ni reactiva sesiones cerradas.

begin;
set local lock_timeout='10s';
do $$ begin
 if to_regclass('public.v2_device_sessions') is null
 or to_regprocedure('public.v2_mfa_session_allowed()') is null
 or to_regprocedure('public.v2_session_list(uuid,uuid,text)') is null
 or to_regprocedure('public.v2_session_revoke(uuid,uuid,boolean)') is null then
  raise exception 'Falta la instalación previa de sesiones. No se aplicó esta actualización.';
 end if;
end $$;
alter table public.v2_device_sessions add column if not exists idle_expires_at timestamptz;

-- Única regla compartida por autorización, comprobaciones y lista.
-- updated_at de Auth no sirve como actividad: una renovación automática puede moverlo.
create or replace function public.v2_session_is_active(p_session uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s
 left join public.v2_device_sessions d on d.session_id=s.id
 where s.id=p_session and s.user_id=p_user
 and (s.not_after is null or s.not_after>now()) and d.revoked_at is null
 and coalesce(d.idle_expires_at,d.last_seen_at+interval '1 hour',s.created_at+interval '1 hour')>now());
$$;
revoke all on function public.v2_session_is_active(uuid,uuid) from public,anon,authenticated;

create or replace function public.v2_session_alive() returns boolean
language sql stable security definer set search_path='' as $$
 select public.v2_session_is_active(nullif(auth.jwt()->>'session_id','')::uuid,auth.uid());
$$;

-- El cliente comunica el tiempo restante de la hora de inactividad, no una
-- fecha absoluta: no depende de que el reloj del dispositivo coincida con el servidor.
create or replace function public.v2_session_touch_active(p_device text default '',p_idle_seconds integer default 3600) returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 seconds_left integer:=least(3600,greatest(0,coalesce(p_idle_seconds,0)));
 deadline timestamptz; activity_at timestamptz;
begin
 if not public.v2_session_alive() then return false; end if;
 if seconds_left=0 then return false; end if;
 deadline:=now()+make_interval(secs=>seconds_left);
 activity_at:=deadline-interval '1 hour';
 insert into public.v2_device_sessions(session_id,user_id,device,last_seen_at,idle_expires_at)
 values(sid,auth.uid(),left(coalesce(p_device,''),160),activity_at,deadline)
 on conflict(session_id) do update set
  device=excluded.device,
  last_seen_at=greatest(v2_device_sessions.last_seen_at,excluded.last_seen_at),
  idle_expires_at=greatest(v2_device_sessions.idle_expires_at,excluded.idle_expires_at)
 where v2_device_sessions.revoked_at is null
 and coalesce(v2_device_sessions.idle_expires_at,v2_device_sessions.last_seen_at+interval '1 hour')>now()
 and (v2_device_sessions.idle_expires_at is null
   or excluded.idle_expires_at>v2_device_sessions.idle_expires_at+interval '1 second'
   or v2_device_sessions.device is distinct from excluded.device);
 -- Un ping en vuelo nunca anula una revocación ni reabre una sesión caducada.
 return public.v2_session_alive();
end $$;

-- Compatibilidad durante el despliegue: las pestañas con el código anterior
-- conservan su comprobación existente mientras continúen activas.
create or replace function public.v2_session_touch(p_device text default '') returns boolean
language sql security definer set search_path='' as $$
 select public.v2_session_touch_active(p_device,3600);
$$;

-- Se puede cerrar la sesión propia incluso después de caducar o antes del MFA.
-- Nunca acepta un usuario o una sesión suministrados por el cliente.
create or replace function public.v2_session_close() returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 if auth.uid() is null or sid is null then return false; end if;
 insert into public.v2_device_sessions(session_id,user_id,device,revoked_at,revoked_by)
 select s.id,s.user_id,left(coalesce(s.user_agent,''),160),now(),auth.uid()
 from auth.sessions s where s.id=sid and s.user_id=auth.uid()
 on conflict(session_id) do update set
 revoked_at=coalesce(v2_device_sessions.revoked_at,excluded.revoked_at),
 revoked_by=coalesce(v2_device_sessions.revoked_by,excluded.revoked_by);
 return true;
end $$;

create or replace function public.v2_session_list(p_restaurant uuid default null,p_after uuid default null,p_search text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.v2_mfa_session_allowed() then raise exception 'SESSION_DENIED' using errcode='42501'; end if;
 if p_restaurant is not null and not exists(select 1 from public.v2_restaurants r where r.id=p_restaurant and r.owner_id=auth.uid() and public.v2_current_admin(r.id)) then
  raise exception 'SESSION_DENIED' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(x order by x.id) from (
 select s.id,s.user_id,coalesce(m.name,u.email,'') as name,coalesce(u.email,'') as email,
 coalesce(nullif(d.device,''),nullif(left(s.user_agent,160),''),'Unknown / Desconocido') as device,
 s.created_at,coalesce(d.last_seen_at,s.updated_at,s.created_at) as last_seen_at,
 s.id::text=auth.jwt()->>'session_id' as current
 from auth.sessions s join auth.users u on u.id=s.user_id
 left join public.v2_device_sessions d on d.session_id=s.id
 left join public.v2_members m on m.restaurant_id=p_restaurant and m.user_id=s.user_id
 where (case when p_restaurant is null then s.user_id=auth.uid() else m.status='activo' end)
 and public.v2_session_is_active(s.id,s.user_id)
 and (p_after is null or s.id>p_after)
 and (coalesce(trim(p_search),'')='' or concat_ws(' ',m.name,u.email,d.device,s.user_agent) ilike '%'||left(trim(p_search),100)||'%')
 order by s.id limit 51
 )x),'[]'::jsonb);
end $$;

revoke all on function public.v2_session_alive(),public.v2_session_touch(text),
 public.v2_session_touch_active(text,integer),public.v2_session_close(),
 public.v2_session_list(uuid,uuid,text) from public,anon;
grant execute on function public.v2_session_alive(),public.v2_session_touch(text),
 public.v2_session_touch_active(text,integer),public.v2_session_close(),
 public.v2_session_list(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
select 'Sesiones actualizadas: solo accesos vigentes; caducidad por inactividad habilitada.' as resultado;
