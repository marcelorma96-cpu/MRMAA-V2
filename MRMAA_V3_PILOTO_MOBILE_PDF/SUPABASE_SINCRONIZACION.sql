-- MRMAA PILOTO. Aplicar en el proyecto actual antes de desplegar este paquete.
-- Requiere el esquema y los permisos de MRMAA ya instalados.
-- No modifica datos existentes ni sus políticas. Reejecutable.
begin;

-- Realtime administra su propio esquema. Fallar claramente si no está disponible.
do $$ begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    raise exception 'Este proyecto necesita Realtime Broadcast de Supabase.';
  end if;
end $$;

create or replace function public.v2_sync_topic_allowed(p_topic text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.v2_members m
    where m.restaurant_id = case
      when p_topic ~ '^mrmaa:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substring(p_topic from 7)::uuid else null end
      and m.user_id = (select auth.uid()) and m.status = 'activo'
      and lower(btrim(m.role)) in ('administrador','admin','gerente','operacion','lectura')
  );
$$;
revoke all on function public.v2_sync_topic_allowed(text) from public, anon;
grant execute on function public.v2_sync_topic_allowed(text) to authenticated;

drop policy if exists mrmaa_sync_receive on realtime.messages;
create policy mrmaa_sync_receive on realtime.messages for select to authenticated
using (extension = 'broadcast' and topic = (select realtime.topic())
  and public.v2_sync_topic_allowed(topic));
-- Limita este espacio de nombres incluso si otra integración tiene una política amplia.
drop policy if exists mrmaa_sync_receive_scope on realtime.messages;
create policy mrmaa_sync_receive_scope on realtime.messages as restrictive for select to public
using (topic not like 'mrmaa:%' or
  (extension = 'broadcast' and topic = (select realtime.topic())
   and auth.role() = 'authenticated' and public.v2_sync_topic_allowed(topic)));
drop policy if exists mrmaa_sync_server_only on realtime.messages;
create policy mrmaa_sync_server_only on realtime.messages as restrictive for insert to public
with check (topic not like 'mrmaa:%');

create or replace function public.v2_emit_sync_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
  rid uuid;
  projection text;
  source_rows text;
  cache_key text;
begin
  -- La auditoría creada por otro trigger ya viaja con el aviso de su tabla.
  -- Evita ejecutar consultas de notificación por cada fila auditada de una importación.
  -- Exportar/imprimir registra auditoría directamente y sí emite su propio aviso.
  if tg_table_name = 'v2_audit_log' and pg_trigger_depth() > 1 then return null; end if;
  -- Tablas de transición: una notificación por restaurante/tabla/transacción,
  -- aunque una importación inserte cientos de filas. Sin nombres ni datos de filas.
  source_rows := case tg_op
    when 'INSERT' then 'select * from new_rows'
    when 'DELETE' then 'select * from old_rows'
    else 'select * from new_rows union all select * from old_rows' end;
  if tg_table_name = 'v2_quote_items' then
    projection := 'select distinct q.restaurant_id as rid from (' || source_rows || ') x join public.v2_quotes q on q.id=x.quote_id';
  elsif tg_table_name = 'v2_restaurants' then
    projection := 'select distinct x.id as rid from (' || source_rows || ') x';
  else
    projection := 'select distinct x.restaurant_id as rid from (' || source_rows || ') x';
  end if;
  execute 'select array_agg(rid) from (' || projection || ') tenants' into ids;
  foreach rid in array coalesce(ids, array[]::uuid[]) loop
    if rid is null then continue; end if;
    cache_key := 'mrmaa_sync.k' || md5(rid::text || tg_table_name);
    if current_setting(cache_key, true) = 'sent' then continue; end if;
    begin
      perform realtime.send(jsonb_build_object('v',1,'restaurant_id',rid,'table',tg_table_name),
        'changed', 'mrmaa:' || rid::text, true);
      perform set_config(cache_key, 'sent', true);
    exception when others then
      -- Una interrupción de notificaciones no debe impedir guardar el trabajo.
      -- Sin datos del cliente en logs. El cliente recupera datos al reconectar.
      raise warning 'MRMAA: notificación temporalmente no disponible (%)', sqlstate;
    end;
  end loop;
  return null;
end;
$$;
revoke all on function public.v2_emit_sync_change() from public, anon, authenticated;

do $$
declare tbl text;
begin
  foreach tbl in array array['v2_restaurants','v2_members','v2_clients','v2_quotes',
    'v2_quote_items','v2_quote_products','v2_reservations','v2_reservation_areas','v2_areas',
    'v2_employees','v2_shifts','v2_schedules','v2_audit_log',
    'v2_communication_settings','v2_message_templates'] loop
    if to_regclass('public.' || tbl) is null then
      raise exception 'Falta la tabla %. Copie primero el esquema completo de MRMAA.', tbl;
    end if;
    execute format('drop trigger if exists mrmaa_sync_insert on public.%I', tbl);
    execute format('drop trigger if exists mrmaa_sync_update on public.%I', tbl);
    execute format('drop trigger if exists mrmaa_sync_delete on public.%I', tbl);
    execute format('create trigger mrmaa_sync_insert after insert on public.%I referencing new table as new_rows for each statement execute function public.v2_emit_sync_change()', tbl);
    execute format('create trigger mrmaa_sync_update after update on public.%I referencing old table as old_rows new table as new_rows for each statement execute function public.v2_emit_sync_change()', tbl);
    execute format('create trigger mrmaa_sync_delete after delete on public.%I referencing old table as old_rows for each statement execute function public.v2_emit_sync_change()', tbl);
  end loop;
end $$;
commit;
