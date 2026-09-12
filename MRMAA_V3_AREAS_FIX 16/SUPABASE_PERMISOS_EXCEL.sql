-- MRMAA: permiso de descargas Excel del equipo.
-- Ejecutar completo una vez ANTES de desplegar esta actualización.
begin;

-- Separado de settings para que guardar otras preferencias no lo sobrescriba.
alter table public.v2_restaurants
  add column if not exists allow_team_excel_exports boolean not null default true;

create or replace function public.v2_excel_export_access(p_restaurant_id uuid)
returns table(allowed boolean, can_manage boolean, team_enabled boolean)
language sql stable security invoker set search_path = '' as $$
  select
    m.role in ('administrador','admin') or r.allow_team_excel_exports,
    m.role in ('administrador','admin'),
    r.allow_team_excel_exports
  from public.v2_restaurants r
  join public.v2_members m on m.restaurant_id=r.id
  where r.id=p_restaurant_id and m.user_id=auth.uid()
    and m.status='activo'
    and m.role in ('administrador','admin','gerente','operacion','lectura');
$$;

create or replace function public.v2_set_team_excel_exports(p_restaurant_id uuid, p_enabled boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.v2_current_admin(p_restaurant_id) then
    raise exception 'Solo el administrador puede cambiar este permiso.' using errcode='42501';
  end if;
  if p_enabled is null then
    raise exception 'Seleccione un permiso válido.' using errcode='22023';
  end if;
  update public.v2_restaurants set allow_team_excel_exports=p_enabled
    where id=p_restaurant_id;
  if not found then
    raise exception 'No se pudo guardar el permiso.' using errcode='42501';
  end if;
  return p_enabled;
end;
$$;

revoke all on function public.v2_excel_export_access(uuid) from public, anon;
revoke all on function public.v2_set_team_excel_exports(uuid,boolean) from public, anon;
grant execute on function public.v2_excel_export_access(uuid),
  public.v2_set_team_excel_exports(uuid,boolean) to authenticated;

-- Las políticas existentes siguen limitando la edición del restaurante al administrador.
-- Registrar este cambio sin conceder escritura directa sobre el historial al cliente.
create or replace function public.v2_audit_excel_permission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.v2_audit_log(
    restaurant_id,table_name,record_id,action,old_data,new_data,changed_by
  ) values (
    new.id,'v2_restaurants',new.id,'modificado',
    jsonb_build_object('allow_team_excel_exports',old.allow_team_excel_exports),
    jsonb_build_object('allow_team_excel_exports',new.allow_team_excel_exports),auth.uid()
  );
  return new;
end;
$$;
revoke all on function public.v2_audit_excel_permission() from public, anon, authenticated;
drop trigger if exists v2_audit_excel_permission on public.v2_restaurants;
create trigger v2_audit_excel_permission after update of allow_team_excel_exports
  on public.v2_restaurants for each row
  when (old.allow_team_excel_exports is distinct from new.allow_team_excel_exports)
  execute function public.v2_audit_excel_permission();

notify pgrst, 'reload schema';
commit;
