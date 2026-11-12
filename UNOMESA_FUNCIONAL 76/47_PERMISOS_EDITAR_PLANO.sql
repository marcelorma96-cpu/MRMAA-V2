-- UnoMesa: Editar plano solamente para Administrador y Gerente.
-- Aplicar despues del SQL 43. No vuelve a instalar 43-46.
-- No cambia tablas, columnas, registros, areas, asignaciones, pagos ni exenciones.
-- Conserva las autorizaciones de lectura y de operacion. Restringe solo layout.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
 if to_regprocedure('public.v2_floor_authorize(uuid,text)') is null then
  raise exception 'Active primero el plano con SQL 43. No se cambiaron permisos.';
 end if;
end $$;

create or replace function public.v2_floor_authorize(p_restaurant_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare m jsonb; b jsonb; r text;
begin
  if auth.uid() is null or not coalesce(public.v2_session_alive(),false)
    or not coalesce(public.v2_can_read(p_restaurant_id),false) then
    raise exception 'FLOOR_ACCESS';
  end if;
  m := to_jsonb(public.v2_effective_membership(p_restaurant_id));
  r := lower(m->>'role');
  if m->>'status' is distinct from 'activo' then raise exception 'FLOOR_ACCESS'; end if;
  if p_action = 'read' and r in ('administrador','admin','gerente','operacion','lectura','soporte_editor','soporte_lectura') then return; end if;
  if p_action not in ('operate','layout') or r is null then raise exception 'FLOOR_ACCESS'; end if;
  if p_action = 'operate' and r not in ('administrador','admin','gerente','operacion','soporte_editor') then raise exception 'FLOOR_ACCESS'; end if;
  if p_action = 'layout' and r not in ('administrador','admin','gerente') then raise exception 'FLOOR_ACCESS'; end if;
  b := to_jsonb(public.v2_account_billing(p_restaurant_id));
  if not coalesce((b->>'can_write')::boolean,false) then raise exception 'FLOOR_ACCESS'; end if;
end $$;
revoke all on function public.v2_floor_authorize(uuid,text) from public, anon, authenticated;

notify pgrst,'reload schema';
commit;
