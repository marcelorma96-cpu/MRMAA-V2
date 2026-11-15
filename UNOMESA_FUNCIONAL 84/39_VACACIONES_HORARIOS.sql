-- UnoMesa: habilitar Vacaciones en Horarios (29 septiembre 2026).
-- Ejecutar completo una vez, ANTES de desplegar el ZIP actualizado.
-- Incremental y reejecutable. No borra ni actualiza registros existentes.
-- Conserva tablas, políticas RLS, permisos, funciones y demás restricciones.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.v2_schedules') is null then
    raise exception 'Falta la instalación existente de Horarios. No se aplicó el cambio.';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.v2_schedules'::regclass
      and conname = 'v2_schedules_entry_type_check' and contype = 'c'
  ) then
    raise exception 'No se encontró la validación esperada de tipos de horario. Revise la instalación antes de continuar.';
  end if;
end $$;

alter table public.v2_schedules drop constraint v2_schedules_entry_type_check;
alter table public.v2_schedules add constraint v2_schedules_entry_type_check
  check (entry_type in ('work', 'rest', 'permission', 'vacation'));

-- Las vacaciones no deben mantener un turno ni tiempos de comida vinculados.
alter table public.v2_schedules drop constraint if exists v2_schedules_vacation_no_shift;
alter table public.v2_schedules add constraint v2_schedules_vacation_no_shift
  check (entry_type <> 'vacation' or (shift_id is null and break_start is null and break_end is null));

notify pgrst, 'reload schema';
commit;
