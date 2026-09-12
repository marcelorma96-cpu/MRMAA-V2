-- MRMAA - auditoría de exportaciones e impresiones.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.v2_audit_log
  drop constraint if exists v2_audit_log_action_check;

alter table public.v2_audit_log
  add constraint v2_audit_log_action_check check (
    action in (
      'creado', 'modificado', 'enviado_papelera', 'restaurado',
      'eliminado_definitivamente', 'excel_exportado', 'impresion'
    )
  );

create or replace function public.v2_record_activity(
  target_restaurant uuid,
  activity text,
  section text,
  details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  current_actor_name text;
  current_actor_role text;
begin
  if activity not in ('excel_exportado', 'impresion') then
    raise exception 'Actividad no permitida';
  end if;

  select coalesce(nullif(name, ''), nullif(email, ''), 'Usuario'), role
    into current_actor_name, current_actor_role
  from public.v2_members
  where restaurant_id=target_restaurant
    and user_id=auth.uid()
    and coalesce(status, 'activo')='activo'
  limit 1;

  if current_actor_role is null then
    raise exception 'Acceso no autorizado';
  end if;

  insert into public.v2_audit_log(
    restaurant_id, table_name, record_id, action, new_data,
    changed_by, actor_name, actor_role
  ) values (
    target_restaurant,
    left(coalesce(nullif(section, ''), 'sistema'), 80),
    target_restaurant,
    activity,
    coalesce(details, '{}'::jsonb),
    auth.uid(),
    current_actor_name,
    current_actor_role
  );
end;
$$;

revoke all on function public.v2_record_activity(uuid,text,text,jsonb) from public;
grant execute on function public.v2_record_activity(uuid,text,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
