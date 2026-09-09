-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Reconoce como administrador al propietario del negocio y al miembro administrador.

create or replace function public.v2_current_admin(target_restaurant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    exists (
      select 1 from public.v2_restaurants
      where id=target_restaurant and owner_id=auth.uid()
    )
    or exists (
      select 1 from public.v2_members
      where restaurant_id=target_restaurant
        and user_id=auth.uid()
        and lower(trim(role)) in ('administrador','admin')
        and coalesce(status,'activo') <> 'inactivo'
    );
$$;

grant execute on function public.v2_current_admin(uuid) to authenticated;
