-- MRMAA — endurecimiento de producción, roles y aceptación legal.
-- Ejecutar UNA VEZ en Supabase > SQL Editor después de los scripts anteriores.
-- No elimina datos. Sustituye las políticas RLS permisivas por permisos por rol.

begin;

alter table public.v2_members add column if not exists status text not null default 'activo';

create or replace function public.v2_has_role(target_restaurant uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.v2_members
    where restaurant_id=target_restaurant
      and user_id=auth.uid()
      and status='activo'
      and lower(role)=any(allowed_roles)
  );
$$;
revoke all on function public.v2_has_role(uuid,text[]) from public;
grant execute on function public.v2_has_role(uuid,text[]) to authenticated;

create or replace function public.v2_current_admin(target_restaurant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.v2_has_role(target_restaurant,array['administrador','admin']);
$$;
revoke all on function public.v2_current_admin(uuid) from public;
grant execute on function public.v2_current_admin(uuid) to authenticated;

-- Impide que el propietario pierda accidentalmente el rol principal. La ruta
-- segura de transferencia cambia primero owner_id y después ajusta el rol.
create or replace function public.v2_protect_primary_admin_role()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.role in ('administrador','admin') and new.role not in ('administrador','admin')
     and exists(select 1 from public.v2_restaurants r where r.id=old.restaurant_id and r.owner_id=old.user_id) then
    raise exception 'Transfiera primero la administración principal desde Configuración > Cuenta';
  end if;
  return new;
end; $$;
drop trigger if exists v2_protect_primary_admin_role on public.v2_members;
create trigger v2_protect_primary_admin_role before update of role on public.v2_members
for each row execute function public.v2_protect_primary_admin_role();

create or replace function public.v2_can_read(target_restaurant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.v2_has_role(target_restaurant,array['administrador','admin','gerente','operacion','lectura']);
$$;
create or replace function public.v2_can_operate(target_restaurant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.v2_has_role(target_restaurant,array['administrador','admin','gerente','operacion']);
$$;
create or replace function public.v2_can_schedule(target_restaurant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.v2_has_role(target_restaurant,array['administrador','admin','gerente']);
$$;
revoke all on function public.v2_can_read(uuid) from public;
revoke all on function public.v2_can_operate(uuid) from public;
revoke all on function public.v2_can_schedule(uuid) from public;
grant execute on function public.v2_can_read(uuid), public.v2_can_operate(uuid), public.v2_can_schedule(uuid) to authenticated;

create or replace function public.v2_activate_my_membership()
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  update public.v2_members set status='activo'
  where user_id=auth.uid() and status='invitado';
end $$;
revoke all on function public.v2_activate_my_membership() from public;
grant execute on function public.v2_activate_my_membership() to authenticated;

-- Quitar políticas anteriores de las tablas protegidas para evitar accesos acumulativos.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and tablename=any(array[
      'v2_restaurants','v2_members','v2_clients','v2_quotes','v2_quote_items','v2_reservations',
      'v2_areas','v2_employees','v2_shifts','v2_schedules','v2_message_templates',
      'v2_quote_products','v2_communication_settings','v2_audit_log'
    ])
  loop
    execute format('drop policy if exists %I on %I.%I',policy_row.policyname,policy_row.schemaname,policy_row.tablename);
  end loop;
end $$;

alter table public.v2_restaurants enable row level security;
create policy v2_restaurants_read on public.v2_restaurants for select to authenticated using(public.v2_can_read(id));
create policy v2_restaurants_admin_update on public.v2_restaurants for update to authenticated using(public.v2_current_admin(id)) with check(public.v2_current_admin(id));

alter table public.v2_members enable row level security;
create policy v2_members_self_or_admin_read on public.v2_members for select to authenticated
using(user_id=auth.uid() or public.v2_current_admin(restaurant_id));
-- La escritura de miembros se realiza únicamente mediante /api/users con clave de servidor.

alter table public.v2_clients enable row level security;
create policy v2_clients_read on public.v2_clients for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_clients_insert on public.v2_clients for insert to authenticated with check(public.v2_can_operate(restaurant_id));
create policy v2_clients_update on public.v2_clients for update to authenticated using(public.v2_can_operate(restaurant_id)) with check(public.v2_can_operate(restaurant_id));
create policy v2_clients_delete on public.v2_clients for delete to authenticated using(public.v2_current_admin(restaurant_id));

alter table public.v2_quotes enable row level security;
create policy v2_quotes_read on public.v2_quotes for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_quotes_insert on public.v2_quotes for insert to authenticated with check(public.v2_can_operate(restaurant_id));
create policy v2_quotes_update on public.v2_quotes for update to authenticated using(public.v2_can_operate(restaurant_id)) with check(public.v2_can_operate(restaurant_id));
create policy v2_quotes_delete on public.v2_quotes for delete to authenticated using(public.v2_current_admin(restaurant_id));

alter table public.v2_quote_items enable row level security;
create policy v2_quote_items_read on public.v2_quote_items for select to authenticated using(
  exists(select 1 from public.v2_quotes q where q.id=quote_id and public.v2_can_read(q.restaurant_id))
);
create policy v2_quote_items_insert on public.v2_quote_items for insert to authenticated with check(
  exists(select 1 from public.v2_quotes q where q.id=quote_id and public.v2_can_operate(q.restaurant_id))
);
create policy v2_quote_items_update on public.v2_quote_items for update to authenticated using(
  exists(select 1 from public.v2_quotes q where q.id=quote_id and public.v2_can_operate(q.restaurant_id))
) with check(exists(select 1 from public.v2_quotes q where q.id=quote_id and public.v2_can_operate(q.restaurant_id)));
create policy v2_quote_items_delete on public.v2_quote_items for delete to authenticated using(
  exists(select 1 from public.v2_quotes q where q.id=quote_id and public.v2_can_operate(q.restaurant_id))
);

alter table public.v2_reservations enable row level security;
create policy v2_reservations_read on public.v2_reservations for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_reservations_insert on public.v2_reservations for insert to authenticated with check(public.v2_can_operate(restaurant_id));
create policy v2_reservations_update on public.v2_reservations for update to authenticated using(public.v2_can_operate(restaurant_id)) with check(public.v2_can_operate(restaurant_id));
create policy v2_reservations_delete on public.v2_reservations for delete to authenticated using(public.v2_current_admin(restaurant_id));

alter table public.v2_areas enable row level security;
create policy v2_areas_read on public.v2_areas for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_areas_write on public.v2_areas for all to authenticated using(public.v2_can_schedule(restaurant_id)) with check(public.v2_can_schedule(restaurant_id));
alter table public.v2_employees enable row level security;
create policy v2_employees_read on public.v2_employees for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_employees_write on public.v2_employees for all to authenticated using(public.v2_can_schedule(restaurant_id)) with check(public.v2_can_schedule(restaurant_id));
alter table public.v2_shifts enable row level security;
create policy v2_shifts_read on public.v2_shifts for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_shifts_write on public.v2_shifts for all to authenticated using(public.v2_can_schedule(restaurant_id)) with check(public.v2_can_schedule(restaurant_id));
alter table public.v2_schedules enable row level security;
create policy v2_schedules_read on public.v2_schedules for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_schedules_write on public.v2_schedules for all to authenticated using(public.v2_can_schedule(restaurant_id)) with check(public.v2_can_schedule(restaurant_id));

alter table public.v2_message_templates enable row level security;
create policy v2_templates_read on public.v2_message_templates for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_templates_write on public.v2_message_templates for all to authenticated using(public.v2_can_schedule(restaurant_id)) with check(public.v2_can_schedule(restaurant_id));
alter table public.v2_quote_products enable row level security;
create policy v2_products_read on public.v2_quote_products for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_products_write on public.v2_quote_products for all to authenticated using(public.v2_can_operate(restaurant_id)) with check(public.v2_can_operate(restaurant_id));
alter table public.v2_communication_settings enable row level security;
create policy v2_comms_read on public.v2_communication_settings for select to authenticated using(public.v2_can_read(restaurant_id));
create policy v2_comms_write on public.v2_communication_settings for all to authenticated using(public.v2_can_schedule(restaurant_id)) with check(public.v2_can_schedule(restaurant_id));

alter table public.v2_audit_log enable row level security;
create policy v2_audit_admin_read on public.v2_audit_log for select to authenticated using(public.v2_current_admin(restaurant_id));

create table if not exists public.v2_legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid references public.v2_restaurants(id) on delete cascade,
  legal_version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  unique(user_id,legal_version)
);
alter table public.v2_legal_acceptances enable row level security;
create policy v2_legal_self_read on public.v2_legal_acceptances for select to authenticated using(user_id=auth.uid());

create or replace function public.v2_accept_legal(version text, browser text default null)
returns void language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if version !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Versión legal inválida'; end if;
  select restaurant_id into rid from public.v2_members where user_id=auth.uid() order by restaurant_id limit 1;
  insert into public.v2_legal_acceptances(user_id,restaurant_id,legal_version,user_agent)
  values(auth.uid(),rid,version,left(coalesce(browser,''),500)) on conflict(user_id,legal_version) do nothing;
end $$;
revoke all on function public.v2_accept_legal(text,text) from public;
grant execute on function public.v2_accept_legal(text,text) to authenticated;

commit;
notify pgrst,'reload schema';
