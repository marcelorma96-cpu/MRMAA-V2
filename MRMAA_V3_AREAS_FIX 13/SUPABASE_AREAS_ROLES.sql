-- Actualización V3. Ejecutar completo una sola vez; es repetible.
-- Agregar, editar y retirar áreas de reservaciones para roles operativos.
-- Eliminar en la interfaz retira el área (active=false) y conserva el historial.
begin;

alter table public.v2_reservation_areas enable row level security;
revoke all on public.v2_reservation_areas from public, anon;
grant select, insert, update, delete on public.v2_reservation_areas to authenticated;

drop policy if exists reservation_areas_write on public.v2_reservation_areas;
drop policy if exists reservation_areas_insert on public.v2_reservation_areas;
drop policy if exists reservation_areas_update on public.v2_reservation_areas;
drop policy if exists reservation_areas_delete on public.v2_reservation_areas;

create policy reservation_areas_insert on public.v2_reservation_areas
for insert to authenticated with check(public.v2_can_operate(restaurant_id));

create policy reservation_areas_update on public.v2_reservation_areas
for update to authenticated
using(public.v2_can_operate(restaurant_id))
with check(public.v2_can_operate(restaurant_id));

-- El borrado físico continúa restringido al administrador.
create policy reservation_areas_delete on public.v2_reservation_areas
for delete to authenticated using(public.v2_current_admin(restaurant_id));

commit;
notify pgrst, 'reload schema';
