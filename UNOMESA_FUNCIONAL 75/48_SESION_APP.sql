-- UnoMesa · Sesión recordada en el dispositivo personal (30 días).
-- Ejecutar solo este archivo nuevo sobre la instalación actual, antes del ZIP.
-- No cambia tablas, columnas, reservas, cotizaciones, clientes, planes ni exenciones.
-- Al ejecutarlo solo crea una función. La app amplía posteriormente el vencimiento
-- de SU sesión validada. No reabre sesiones caducadas/revocadas ni omite MFA.
begin;
set local lock_timeout='10s';
do $$ begin
 if to_regprocedure('public.v2_session_alive()') is null
 or to_regprocedure('public.v2_mfa_session_allowed()') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='v2_device_sessions' and column_name='idle_expires_at') then
 raise exception 'Falta la instalación previa de sesiones (SQL 33). No se aplicaron cambios.';
 end if;
end $$;
create or replace function public.v2_session_remember_device(p_device text default '') returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 if auth.uid() is null or sid is null then return false; end if;
 if not public.v2_session_alive() or not public.v2_mfa_session_allowed() then return false; end if;
 insert into public.v2_device_sessions(session_id,user_id,device,last_seen_at,idle_expires_at)
 values(sid,auth.uid(),left(coalesce(p_device,''),160),now(),now()+interval '30 days')
 on conflict(session_id) do update set
  device=excluded.device,last_seen_at=excluded.last_seen_at,idle_expires_at=excluded.idle_expires_at
 where v2_device_sessions.user_id=auth.uid()
 and v2_device_sessions.revoked_at is null
 and coalesce(v2_device_sessions.idle_expires_at,v2_device_sessions.last_seen_at+interval '1 hour')>now();
 return public.v2_session_alive();
end $$;
revoke all on function public.v2_session_remember_device(text) from public,anon;
grant execute on function public.v2_session_remember_device(text) to authenticated;
notify pgrst,'reload schema';
commit;
