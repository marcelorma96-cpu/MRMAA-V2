-- Catálogo de turnos por área de la sucursal. No cambia ninguna asignación existente.
begin;
do $$
begin
  if exists (select from information_schema.columns where table_schema='public' and table_name='v2_shifts' and column_name='schedule_area_ids') then return; end if;
  alter table public.v2_shifts add column schedule_area_ids uuid[];
  update public.v2_shifts t set schedule_area_ids=g.area_ids
  from (
    select s.restaurant_id,s.shift_id,array_agg(distinct a.id order by a.id) as area_ids
    from public.v2_schedules s
    left join public.v2_employees e on e.restaurant_id=s.restaurant_id and e.id=s.employee_id
    join public.v2_areas a on a.restaurant_id=s.restaurant_id and a.id=coalesce(s.area_id,e.area_id)
    where s.shift_id is not null and s.entry_type='work'
    group by s.restaurant_id,s.shift_id
  ) g where t.restaurant_id=g.restaurant_id and t.id=g.shift_id;
end; $$;
comment on column public.v2_shifts.schedule_area_ids is 'NULL: sin clasificar; {}: compartido intencionalmente; identificadores: áreas habilitadas.';
create or replace function public.v2_check_shift_areas() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.schedule_area_ids is not null and cardinality(new.schedule_area_ids) <>
    (select count(*) from public.v2_areas a where a.restaurant_id=new.restaurant_id and a.id=any(new.schedule_area_ids))
  then raise exception 'Seleccione áreas distintas de esta sucursal.' using errcode='23514'; end if;
  return new;
end; $$;
drop trigger if exists v2_shift_areas_check on public.v2_shifts;
create trigger v2_shift_areas_check before insert or update of schedule_area_ids,restaurant_id on public.v2_shifts
for each row execute function public.v2_check_shift_areas();

create or replace function public.v2_check_assignment_area() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.entry_type is distinct from 'work' or new.shift_id is null then return null; end if;
  -- Un turno histórico puede recibir correcciones de notas, comida o color.
  if tg_op='UPDATE' then
    if (old.restaurant_id,old.employee_id,old.work_date,old.shift_id,old.entry_type) is not distinct from
       (new.restaurant_id,new.employee_id,new.work_date,new.shift_id,new.entry_type) then return null; end if;
  end if;
  if not exists (select from public.v2_shifts t join public.v2_employees e on e.restaurant_id=t.restaurant_id
    where t.restaurant_id=new.restaurant_id and t.id=new.shift_id and e.id=new.employee_id and t.active and
    (cardinality(t.schedule_area_ids)=0 or e.area_id=any(t.schedule_area_ids)))
  then raise exception 'El turno no está disponible para el área del empleado.' using errcode='23514'; end if;
  return null;
end; $$;
drop trigger if exists v2_schedule_area_check on public.v2_schedules;
create trigger v2_schedule_area_check after insert or update on public.v2_schedules
for each row execute function public.v2_check_assignment_area();
notify pgrst,'reload schema';
commit;
