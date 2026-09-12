-- Ejecutar después de SUPABASE_AREAS_AVISOS.sql. No copia áreas de Horarios.
begin;
create table if not exists public.v2_reservation_areas (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null check(length(trim(name))>0),
 active boolean not null default true
);
create unique index if not exists v2_reservation_areas_name_key
 on public.v2_reservation_areas(restaurant_id, public.v2_area_key(name));
alter table public.v2_reservation_areas enable row level security;
revoke all on public.v2_reservation_areas from public, anon;
grant select,insert,update,delete on public.v2_reservation_areas to authenticated;
grant all on public.v2_reservation_areas to service_role;
drop policy if exists reservation_areas_read on public.v2_reservation_areas;
create policy reservation_areas_read on public.v2_reservation_areas for select to authenticated
 using(public.v2_can_read(restaurant_id));
drop policy if exists reservation_areas_write on public.v2_reservation_areas;
create policy reservation_areas_write on public.v2_reservation_areas for all to authenticated
 using(public.v2_current_admin(restaurant_id)) with check(public.v2_current_admin(restaurant_id));
create or replace function public.v2_resolve_reservation_area()
returns trigger language plpgsql security invoker set search_path=public as $$
declare selected_name text; selected_id uuid;
begin
 if TG_OP='UPDATE' then
   if new.area is distinct from old.area and new.area_id is not distinct from old.area_id then
     new.area_id := null;
   end if;
 end if;
 if new.area_id is not null then
   select name into selected_name from public.v2_reservation_areas
     where id=new.area_id and restaurant_id=new.restaurant_id;
   if not found then raise exception 'Seleccione un área válida de este restaurante.'; end if;
   new.area := selected_name;
 else
   select (array_agg(id))[1] into selected_id from public.v2_reservation_areas
     where restaurant_id=new.restaurant_id and public.v2_area_key(name)=public.v2_area_key(new.area)
     having count(*)=1;
   new.area_id := selected_id;
 end if;
 return new;
end $$;
drop trigger if exists v2_resolve_area on public.v2_reservations;
create trigger v2_resolve_area before insert or update of area,area_id,restaurant_id
 on public.v2_reservations for each row execute function public.v2_resolve_reservation_area();
drop trigger if exists v2_resolve_area on public.v2_quotes;
create trigger v2_resolve_area before insert or update of area,area_id,restaurant_id
 on public.v2_quotes for each row execute function public.v2_resolve_reservation_area();

-- SECURITY INVOKER: conserva las políticas RLS y permisos del usuario.
create or replace function public.v2_nearby_reservations(
 p_restaurant uuid,p_area uuid,p_date date,p_time time,p_exclude uuid default null)
returns table(id uuid,event_time time,guests integer)
language sql stable security invoker set search_path=public as $$
 select r.id,r.event_time,r.guests::integer from public.v2_reservations r
 join public.v2_reservation_areas a on a.id=p_area and a.restaurant_id=p_restaurant
 where r.restaurant_id=p_restaurant and r.event_date=p_date and r.deleted_at is null
 and (p_exclude is null or r.id<>p_exclude)
 and (r.area_id=p_area or (r.area_id is null and public.v2_area_key(r.area)=public.v2_area_key(a.name)))
 and coalesce(lower(r.status),'') not in ('cancelada','cancelado','cancelled','canceled')
 and abs(extract(epoch from (r.event_time-p_time)))<=10800
 order by r.event_time,r.id limit 11
$$;
revoke all on function public.v2_nearby_reservations(uuid,uuid,date,time,uuid) from public,anon;
grant execute on function public.v2_nearby_reservations(uuid,uuid,date,time,uuid) to authenticated;
-- Al configurar un área, vincular históricos con ese nombre inequívoco.
create or replace function public.v2_link_reservation_area_history()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 update public.v2_reservations set area_id=new.id
 where restaurant_id=new.restaurant_id and area_id is null
 and public.v2_area_key(area)=public.v2_area_key(new.name);
 update public.v2_quotes set area_id=new.id
 where restaurant_id=new.restaurant_id and area_id is null
 and public.v2_area_key(area)=public.v2_area_key(new.name);
 return new;
end $$;
drop trigger if exists v2_link_area_history on public.v2_reservation_areas;
create trigger v2_link_area_history after insert on public.v2_reservation_areas
 for each row execute function public.v2_link_reservation_area_history();

-- Desvincular solo IDs del catálogo anterior; conservar los textos históricos.
update public.v2_reservations r set area_id=null
 where exists(select 1 from public.v2_areas a where a.id=r.area_id)
 and not exists(select 1 from public.v2_reservation_areas a where a.id=r.area_id);
update public.v2_quotes r set area_id=null
 where exists(select 1 from public.v2_areas a where a.id=r.area_id)
 and not exists(select 1 from public.v2_reservation_areas a where a.id=r.area_id);
commit;
notify pgrst,'reload schema';
