-- MRMAA: ampliar la retención restaurable de la papelera a 365 días.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create index if not exists v2_clients_trash_idx
  on public.v2_clients(restaurant_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists v2_quotes_trash_idx
  on public.v2_quotes(restaurant_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists v2_reservations_trash_idx
  on public.v2_reservations(restaurant_id, deleted_at desc)
  where deleted_at is not null;

create or replace function public.v2_purge_record(entity text, target_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  rid uuid;
  deleted_time timestamptz;
begin
  if entity='clientes' then
    select restaurant_id, deleted_at into rid, deleted_time
    from public.v2_clients where id=target_id;
  elsif entity='cotizaciones' then
    select restaurant_id, deleted_at into rid, deleted_time
    from public.v2_quotes where id=target_id;
  elsif entity='reservaciones' then
    select restaurant_id, deleted_at into rid, deleted_time
    from public.v2_reservations where id=target_id;
  else
    raise exception 'Tipo de registro no permitido';
  end if;

  if rid is null or not public.v2_current_admin(rid) then
    raise exception 'Solo el administrador puede eliminar definitivamente';
  end if;

  if deleted_time is null or deleted_time > now() - interval '365 days' then
    raise exception 'El registro debe permanecer 365 días en la papelera';
  end if;

  perform set_config('mrmaa.recycle_operation', 'allowed', true);
  if entity='clientes' then
    delete from public.v2_clients where id=target_id;
  elsif entity='cotizaciones' then
    delete from public.v2_quotes where id=target_id;
  else
    delete from public.v2_reservations where id=target_id;
  end if;
end $$;

grant execute on function public.v2_purge_record(text, uuid) to authenticated;
