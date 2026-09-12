-- MRMAA - impide que una cuenta sin acceso cree un restaurante al iniciar sesión.
-- Ejecutar una sola vez en Supabase > SQL Editor antes de desplegar esta versión.

create or replace function public.v2_ensure_restaurant()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión';
  end if;

  select m.restaurant_id
    into rid
  from public.v2_members m
  join public.v2_restaurants r on r.id=m.restaurant_id
  where m.user_id=auth.uid()
    and m.status='activo'
  order by (r.owner_id=auth.uid()) desc, m.restaurant_id
  limit 1;

  if rid is null then
    raise exception 'Acceso no autorizado';
  end if;

  return rid;
end
$$;

revoke all on function public.v2_ensure_restaurant() from public;
grant execute on function public.v2_ensure_restaurant() to authenticated;

notify pgrst, 'reload schema';
