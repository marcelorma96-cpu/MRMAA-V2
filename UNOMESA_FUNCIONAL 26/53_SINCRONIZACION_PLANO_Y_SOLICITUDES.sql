-- UnoMesa: avisos privados del plano y del buzón (10 octubre 2026).
-- Ejecutar UNA VEZ en la misma base, después de los SQL 43, 44 y 50.
-- No actualiza ni elimina registros. No cambia RLS, permisos, planes o pagos.
-- Añade 12 triggers de notificación; repetirlo conserva los mismos 12.
-- Requiere la sincronización privada ya instalada y
-- NEXT_PUBLIC_MRMAA_REALTIME=true en el despliegue de la aplicación.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

do $preflight$
declare tab text;
begin
  if to_regprocedure('public.v2_emit_sync_change()') is null
     or to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    raise exception 'Falta la sincronización privada base. No se aplicó ningún cambio.';
  end if;
  foreach tab in array array['v2_floor_plans','v2_floor_seatings','v2_floor_quote_plans','v2_public_requests'] loop
    if to_regclass('public.' || tab) is null then
      raise exception 'Falta la tabla %. Revise los SQL previos. No se aplicó ningún cambio.', tab;
    end if;
  end loop;
end;
$preflight$;

-- Se reutiliza el emisor instalado: un aviso por restaurante/tabla/transacción.
-- Solo transmite versión, identificador del restaurante y nombre de tabla.
-- Los clientes vuelven a leer por sus RPC autorizadas; no se transmiten filas.
do $install$
declare tab text;
begin
  foreach tab in array array['v2_floor_plans','v2_floor_seatings','v2_floor_quote_plans','v2_public_requests'] loop
    execute format('create or replace trigger mrmaa_sync_insert after insert on public.%I referencing new table as new_rows for each statement execute function public.v2_emit_sync_change()', tab);
    execute format('create or replace trigger mrmaa_sync_update after update on public.%I referencing old table as old_rows new table as new_rows for each statement execute function public.v2_emit_sync_change()', tab);
    execute format('create or replace trigger mrmaa_sync_delete after delete on public.%I referencing old table as old_rows for each statement execute function public.v2_emit_sync_change()', tab);
  end loop;
end;
$install$;
commit;
