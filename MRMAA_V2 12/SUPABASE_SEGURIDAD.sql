-- MRMAA - papelera, auditoría y recuperación.
-- Ejecutar una sola vez en Supabase > SQL Editor antes de publicar esta versión.

alter table public.v2_clients add column if not exists deleted_at timestamptz;
alter table public.v2_clients add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.v2_quotes add column if not exists deleted_at timestamptz;
alter table public.v2_quotes add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.v2_reservations add column if not exists deleted_at timestamptz;
alter table public.v2_reservations add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create table if not exists public.v2_audit_log (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('creado','modificado','enviado_papelera','restaurado','eliminado_definitivamente')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_role text,
  changed_at timestamptz not null default now()
);
alter table public.v2_audit_log add column if not exists actor_name text;
alter table public.v2_audit_log add column if not exists actor_role text;

create index if not exists v2_clients_active_idx on public.v2_clients(restaurant_id,name) where deleted_at is null;
create index if not exists v2_quotes_active_idx on public.v2_quotes(restaurant_id,quote_number desc) where deleted_at is null;
create index if not exists v2_reservations_active_idx on public.v2_reservations(restaurant_id,event_date,event_time) where deleted_at is null;
create index if not exists v2_audit_restaurant_time_idx on public.v2_audit_log(restaurant_id,changed_at desc);

create or replace function public.v2_current_admin(target_restaurant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.v2_members
    where restaurant_id=target_restaurant
      and user_id=auth.uid()
      and role in ('administrador','admin')
  );
$$;

create or replace function public.v2_protect_recycle_fields()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' and coalesce(current_setting('mrmaa.recycle_operation',true),'') <> 'allowed' then
    raise exception 'Use la papelera de MRMAA para eliminar este registro.';
  end if;
  if tg_op='UPDATE'
     and (old.deleted_at is distinct from new.deleted_at or old.deleted_by is distinct from new.deleted_by)
     and coalesce(current_setting('mrmaa.recycle_operation',true),'') <> 'allowed' then
    raise exception 'Los campos de papelera solo pueden modificarse desde MRMAA.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists v2_clients_protect_recycle on public.v2_clients;
create trigger v2_clients_protect_recycle before update or delete on public.v2_clients
for each row execute function public.v2_protect_recycle_fields();
drop trigger if exists v2_quotes_protect_recycle on public.v2_quotes;
create trigger v2_quotes_protect_recycle before update or delete on public.v2_quotes
for each row execute function public.v2_protect_recycle_fields();
drop trigger if exists v2_reservations_protect_recycle on public.v2_reservations;
create trigger v2_reservations_protect_recycle before update or delete on public.v2_reservations
for each row execute function public.v2_protect_recycle_fields();

create or replace function public.v2_write_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  before_row jsonb := case when tg_op='INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op='DELETE' then null else to_jsonb(new) end;
  rid uuid := coalesce((after_row->>'restaurant_id')::uuid,(before_row->>'restaurant_id')::uuid);
  rec_id uuid;
  rid_action text;
  current_actor_name text;
  current_actor_role text;
begin
  if tg_op='INSERT' then rid_action := 'creado'; rec_id := new.id;
  elsif tg_op='DELETE' then rid_action := 'eliminado_definitivamente'; rec_id := old.id;
  elsif old.deleted_at is null and new.deleted_at is not null then rid_action := 'enviado_papelera';
  elsif old.deleted_at is not null and new.deleted_at is null then rid_action := 'restaurado';
  else rid_action := 'modificado';
  end if;
  if tg_op='UPDATE' then rec_id := new.id; end if;
  select coalesce(nullif(name,''),nullif(email,''),'Usuario'), role
  into current_actor_name, current_actor_role
  from public.v2_members where restaurant_id=rid and user_id=auth.uid() limit 1;
  insert into public.v2_audit_log(restaurant_id,table_name,record_id,action,old_data,new_data,changed_by,actor_name,actor_role)
  values(rid,tg_table_name,rec_id,rid_action,before_row,after_row,auth.uid(),coalesce(current_actor_name,'Sistema'),current_actor_role);
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists v2_clients_audit on public.v2_clients;
create trigger v2_clients_audit after insert or update or delete on public.v2_clients
for each row execute function public.v2_write_audit();
drop trigger if exists v2_quotes_audit on public.v2_quotes;
create trigger v2_quotes_audit after insert or update or delete on public.v2_quotes
for each row execute function public.v2_write_audit();
drop trigger if exists v2_reservations_audit on public.v2_reservations;
create trigger v2_reservations_audit after insert or update or delete on public.v2_reservations
for each row execute function public.v2_write_audit();

create or replace function public.v2_soft_delete(entity text, target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
  if entity='clientes' then select restaurant_id into rid from public.v2_clients where id=target_id and deleted_at is null;
  elsif entity='cotizaciones' then select restaurant_id into rid from public.v2_quotes where id=target_id and deleted_at is null;
  elsif entity='reservaciones' then select restaurant_id into rid from public.v2_reservations where id=target_id and deleted_at is null;
  else raise exception 'Tipo de registro no permitido'; end if;
  if rid is null or not public.v2_current_admin(rid) then raise exception 'Solo el administrador puede enviar registros a la papelera'; end if;
  perform set_config('mrmaa.recycle_operation','allowed',true);
  if entity='clientes' then update public.v2_clients set deleted_at=now(),deleted_by=auth.uid() where id=target_id;
  elsif entity='cotizaciones' then update public.v2_quotes set deleted_at=now(),deleted_by=auth.uid() where id=target_id;
  else update public.v2_reservations set deleted_at=now(),deleted_by=auth.uid() where id=target_id; end if;
end $$;

create or replace function public.v2_restore_record(entity text, target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
  if entity='clientes' then select restaurant_id into rid from public.v2_clients where id=target_id and deleted_at is not null;
  elsif entity='cotizaciones' then select restaurant_id into rid from public.v2_quotes where id=target_id and deleted_at is not null;
  elsif entity='reservaciones' then select restaurant_id into rid from public.v2_reservations where id=target_id and deleted_at is not null;
  else raise exception 'Tipo de registro no permitido'; end if;
  if rid is null or not public.v2_current_admin(rid) then raise exception 'Solo el administrador puede restaurar registros'; end if;
  perform set_config('mrmaa.recycle_operation','allowed',true);
  if entity='clientes' then update public.v2_clients set deleted_at=null,deleted_by=null where id=target_id;
  elsif entity='cotizaciones' then update public.v2_quotes set deleted_at=null,deleted_by=null where id=target_id;
  else update public.v2_reservations set deleted_at=null,deleted_by=null where id=target_id; end if;
end $$;

create or replace function public.v2_purge_record(entity text, target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare rid uuid; deleted_time timestamptz;
begin
  if entity='clientes' then select restaurant_id,deleted_at into rid,deleted_time from public.v2_clients where id=target_id;
  elsif entity='cotizaciones' then select restaurant_id,deleted_at into rid,deleted_time from public.v2_quotes where id=target_id;
  elsif entity='reservaciones' then select restaurant_id,deleted_at into rid,deleted_time from public.v2_reservations where id=target_id;
  else raise exception 'Tipo de registro no permitido'; end if;
  if rid is null or not public.v2_current_admin(rid) then raise exception 'Solo el administrador puede eliminar definitivamente'; end if;
  if deleted_time is null or deleted_time > now()-interval '30 days' then raise exception 'El registro debe permanecer 30 días en la papelera'; end if;
  perform set_config('mrmaa.recycle_operation','allowed',true);
  if entity='clientes' then delete from public.v2_clients where id=target_id;
  elsif entity='cotizaciones' then delete from public.v2_quotes where id=target_id;
  else delete from public.v2_reservations where id=target_id; end if;
end $$;

grant execute on function public.v2_soft_delete(text,uuid) to authenticated;
grant execute on function public.v2_restore_record(text,uuid) to authenticated;
grant execute on function public.v2_purge_record(text,uuid) to authenticated;

alter table public.v2_audit_log enable row level security;
drop policy if exists v2_audit_admin_read on public.v2_audit_log;
create policy v2_audit_admin_read on public.v2_audit_log for select to authenticated
using(public.v2_current_admin(restaurant_id));

notify pgrst,'reload schema';
