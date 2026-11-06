-- Ejecutar antes de desplegar el ZIP actualizado. Requiere SQL 33.
-- Cambia el plazo comunicado por la web a 2 horas; no reactiva sesiones
-- caducadas/revocadas ni modifica datos de negocio. No altera la sesión nativa.
-- Las pestañas antiguas mantienen su plazo hasta recargarlas.
begin;
set local lock_timeout='10s';
create or replace function public.v2_session_touch_active(p_device text default '',p_idle_seconds integer default 7200) returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 seconds_left integer:=least(7200,greatest(0,coalesce(p_idle_seconds,0)));
 deadline timestamptz; activity_at timestamptz;
begin
 if not public.v2_session_alive() then return false; end if;
 if seconds_left=0 then return false; end if;
 deadline:=now()+make_interval(secs=>seconds_left);
 activity_at:=deadline-interval '2 hours';
 insert into public.v2_device_sessions(session_id,user_id,device,last_seen_at,idle_expires_at)
 values(sid,auth.uid(),left(coalesce(p_device,''),160),activity_at,deadline)
 on conflict(session_id) do update set
  device=excluded.device,
  last_seen_at=greatest(v2_device_sessions.last_seen_at,excluded.last_seen_at),
  idle_expires_at=greatest(v2_device_sessions.idle_expires_at,excluded.idle_expires_at)
 where v2_device_sessions.revoked_at is null
 and coalesce(v2_device_sessions.idle_expires_at,v2_device_sessions.last_seen_at+interval '2 hours')>now()
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
 select public.v2_session_touch_active(p_device,7200);
$$;

revoke all on function public.v2_session_touch_active(text,integer),public.v2_session_touch(text) from public,anon;
grant execute on function public.v2_session_touch_active(text,integer),public.v2_session_touch(text) to authenticated;
notify pgrst,'reload schema';
commit;
