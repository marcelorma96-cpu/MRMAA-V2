-- MRMAA - gerente y operación pueden agregar o modificar productos.
-- Eliminar productos continúa reservado al administrador.
-- Ejecutar una sola vez en Supabase > SQL Editor.

begin;

drop policy if exists v2_products_write on public.v2_quote_products;
drop policy if exists v2_products_insert on public.v2_quote_products;
drop policy if exists v2_products_update on public.v2_quote_products;
drop policy if exists v2_products_delete on public.v2_quote_products;

create policy v2_products_insert on public.v2_quote_products
for insert to authenticated
with check(public.v2_can_operate(restaurant_id));

create policy v2_products_update on public.v2_quote_products
for update to authenticated
using(public.v2_can_operate(restaurant_id))
with check(public.v2_can_operate(restaurant_id));

create policy v2_products_delete on public.v2_quote_products
for delete to authenticated
using(public.v2_current_admin(restaurant_id));

commit;
notify pgrst, 'reload schema';
