-- Ejecutar completo una vez antes de desplegar. Repetible.
begin;
create or replace function public.v2_area_key(value text)
returns text language sql immutable set search_path=public as $$
 select lower(regexp_replace(trim(translate(coalesce(value,''),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'\s+',' ','g'))
$$;
alter table public.v2_reservations add column if not exists area_id uuid;
alter table public.v2_quotes add column if not exists area_id uuid;

-- Mantener el vínculo sin cambiar los nombres históricos. Solo asociar
-- nombres inequívocos. Los no reconocidos permanecen intactos.
do $$ declare t text; begin
 foreach t in array array['v2_reservations','v2_quotes'] loop
 execute format('update public.%I r set area_id=a.id from public.v2_areas a
 where r.area_id is null and r.restaurant_id=a.restaurant_id
 and public.v2_area_key(r.area)=public.v2_area_key(a.name)
 and (select count(*) from public.v2_areas b where b.restaurant_id=a.restaurant_id
 and public.v2_area_key(b.name)=public.v2_area_key(a.name))=1',t);
 end loop;
end $$;

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
   select name into selected_name from public.v2_areas
     where id=new.area_id and restaurant_id=new.restaurant_id;
   if not found then raise exception 'Seleccione un área válida de este restaurante.'; end if;
   new.area := selected_name;
 else
   select (array_agg(id))[1] into selected_id from public.v2_areas
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
 join public.v2_areas a on a.id=p_area and a.restaurant_id=p_restaurant
 where r.restaurant_id=p_restaurant and r.event_date=p_date and r.deleted_at is null
 and (p_exclude is null or r.id<>p_exclude)
 and (r.area_id=p_area or (r.area_id is null and public.v2_area_key(r.area)=public.v2_area_key(a.name)))
 and coalesce(lower(r.status),'') not in ('cancelada','cancelado','cancelled','canceled')
 and abs(extract(epoch from (r.event_time-p_time)))<=10800
 order by r.event_time,r.id limit 11
$$;
revoke all on function public.v2_nearby_reservations(uuid,uuid,date,time,uuid) from public,anon;
grant execute on function public.v2_nearby_reservations(uuid,uuid,date,time,uuid) to authenticated;
commit;
notify pgrst,'reload schema';
