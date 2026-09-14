-- MRMAA: Gerente puede enviar reservaciones de su restaurante a la papelera.
-- Ejecute TODO este archivo una vez en SQL Editor. Es seguro repetirlo.
-- Requiere los permisos de roles y la papelera ya instalados en el piloto.
begin;

create or replace function public.v2_soft_delete(entity text, target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  rid uuid;
  previous_recycle text := coalesce(current_setting('mrmaa.recycle_operation',true),'');
begin
  if entity='clientes' then
    select restaurant_id into rid from public.v2_clients
    where id=target_id and deleted_at is null for update;
  elsif entity='cotizaciones' then
    select restaurant_id into rid from public.v2_quotes
    where id=target_id and deleted_at is null for update;
  elsif entity='reservaciones' then
    select restaurant_id into rid from public.v2_reservations
    where id=target_id and deleted_at is null for update;
  else
    raise exception 'Tipo de registro no permitido';
  end if;

  -- Revalide la membresía activa para cada registro, incluso con una sesión antigua.
  if entity='reservaciones' then
    if rid is null or not public.v2_has_role(rid,array['administrador','admin','gerente']) then
      raise exception 'Solo el administrador o gerente puede enviar reservaciones a la papelera';
    end if;
  elsif rid is null or not public.v2_current_admin(rid) then
    raise exception 'Solo el administrador puede enviar registros a la papelera';
  end if;

  perform set_config('mrmaa.recycle_operation','allowed',true);
  if entity='clientes' then
    update public.v2_clients set deleted_at=now(),deleted_by=auth.uid()
    where id=target_id and restaurant_id=rid and deleted_at is null;
  elsif entity='cotizaciones' then
    update public.v2_quotes set deleted_at=now(),deleted_by=auth.uid()
    where id=target_id and restaurant_id=rid and deleted_at is null;
  else
    update public.v2_reservations set deleted_at=now(),deleted_by=auth.uid()
    where id=target_id and restaurant_id=rid and deleted_at is null;
  end if;
  -- Mantenga activos los triggers de auditoría, cotizaciones y sincronización.
  -- No deje habilitado el permiso interno para otras operaciones de la transacción.
  perform set_config('mrmaa.recycle_operation',previous_recycle,true);
end $$;

revoke all on function public.v2_soft_delete(text,uuid) from public,anon;
grant execute on function public.v2_soft_delete(text,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
