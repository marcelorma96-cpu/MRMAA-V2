-- UnoMesa: instrucciones de horario por sucursal, área y mes.
-- Migración adicional. No cambia reservas, empleados, áreas ni turnos existentes.
begin;
create table if not exists public.v2_schedule_area_notes (
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 month_start date not null check(extract(day from month_start)=1),
 area_key text not null,
 instruction text not null check(length(instruction) between 1 and 1000),
 primary key(restaurant_id,month_start,area_key)
);
alter table public.v2_schedule_area_notes enable row level security;
revoke all on public.v2_schedule_area_notes from public,anon,authenticated;

create or replace function public.v2_get_schedule_area_notes(p_restaurant uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.v2_session_alive() and public.v2_can_read(p_restaurant),false)
 then raise exception 'Acceso denegado.' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Periodo inválido.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('month',to_char(n.month_start,'YYYY-MM'),'area',n.area_key,'text',n.instruction))
  from public.v2_schedule_area_notes n where n.restaurant_id=p_restaurant and n.month_start between date_trunc('month',p_from)::date and p_to),'[]'::jsonb);
end; $$;

create or replace function public.v2_set_schedule_area_note(p_restaurant uuid,p_month date,p_area text,p_text text,p_expected text)
returns void language plpgsql security definer set search_path='' as $$
declare membership jsonb; value text:=regexp_replace(coalesce(p_text,''),'^[[:space:]]+|[[:space:]]+$','','g'); previous text;
begin
 if auth.uid() is null or not coalesce(public.v2_session_alive() and public.v2_can_read(p_restaurant),false)
 then raise exception 'Acceso denegado.' using errcode='42501'; end if;
 membership:=to_jsonb(public.v2_effective_membership(p_restaurant));
 if membership->>'status' is distinct from 'activo' or coalesce(membership->>'role','') not in ('administrador','admin','gerente','soporte_editor')
 or not coalesce((to_jsonb(public.v2_account_billing(p_restaurant))->>'can_write')::boolean,false)
 then raise exception 'Acceso denegado.' using errcode='42501'; end if;
 if p_month is null or extract(day from p_month)<>1 or p_area is null or length(value)>1000 then raise exception 'Instrucción o periodo inválido.'; end if;
 if p_area<>'unassigned' and not exists(select 1 from public.v2_areas a where a.restaurant_id=p_restaurant and a.id::text=p_area)
 then raise exception 'Área inválida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text||p_month::text||p_area,0));
 select n.instruction into previous from public.v2_schedule_area_notes n where n.restaurant_id=p_restaurant and n.month_start=p_month and n.area_key=p_area;
 if coalesce(previous,'') is distinct from p_expected then raise exception 'SCHEDULE_NOTE_CONFLICT' using errcode='40001'; end if;
 if value='' then
  delete from public.v2_schedule_area_notes where restaurant_id=p_restaurant and month_start=p_month and area_key=p_area;
 else
  insert into public.v2_schedule_area_notes values(p_restaurant,p_month,p_area,value)
   on conflict(restaurant_id,month_start,area_key) do update set instruction=excluded.instruction;
 end if;
end; $$;
revoke all on function public.v2_get_schedule_area_notes(uuid,date,date),public.v2_set_schedule_area_note(uuid,date,text,text,text) from public,anon;
grant execute on function public.v2_get_schedule_area_notes(uuid,date,date),public.v2_set_schedule_area_note(uuid,date,text,text,text) to authenticated;
do $$ begin
 if to_regprocedure('public.v2_emit_sync_change()') is not null then
  create or replace trigger mrmaa_sync_insert after insert on public.v2_schedule_area_notes referencing new table as new_rows for each statement execute function public.v2_emit_sync_change();
  create or replace trigger mrmaa_sync_update after update on public.v2_schedule_area_notes referencing old table as old_rows new table as new_rows for each statement execute function public.v2_emit_sync_change();
  create or replace trigger mrmaa_sync_delete after delete on public.v2_schedule_area_notes referencing old table as old_rows for each statement execute function public.v2_emit_sync_change();
 end if;
end $$;
notify pgrst,'reload schema';
commit;
