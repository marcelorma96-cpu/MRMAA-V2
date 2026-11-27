-- UnoMesa: altas y ediciones de empleados/turnos desde Horarios.
-- Solo administrador/admin y gerente activos. No amplía permisos de Configuración.
-- Instalar después de 70_TURNOS_POR_AREA.sql. La instalación NO modifica registros.
begin;
create or replace function public.v2_save_schedule_catalog(
 p_restaurant uuid,p_kind text,p_id uuid,p_values jsonb,p_expected jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 membership jsonb; previous jsonb; snapshot jsonb; result jsonb; fields text[];
 area uuid; scope uuid[]; nm text; start_at time; end_at time; start_label text; end_label text;
 calc_start time; calc_end time; minutes integer; enabled boolean;
begin
 membership:=to_jsonb(public.v2_effective_membership(p_restaurant));
 if auth.uid() is null or not coalesce(public.v2_session_alive() and public.v2_can_read(p_restaurant)
   and public.v2_mfa_session_allowed() and public.v2_plan_has_schedules(p_restaurant),false)
   or membership->>'status' is distinct from 'activo'
   or coalesce(membership->>'role','') not in ('administrador','admin','gerente')
   or not coalesce((to_jsonb(public.v2_account_billing(p_restaurant))->>'can_write')::boolean,false)
 then raise exception 'Acceso restringido a administradores y gerentes.' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('employee','shift') or p_id is null
   or jsonb_typeof(p_values) is distinct from 'object'
   or (p_expected is not null and jsonb_typeof(p_expected) is distinct from 'object')
 then raise exception 'Datos inválidos.' using errcode='22023'; end if;
 fields:=case when p_kind='employee' then array['name','employee_code','phone','area_id','active']
   else array['name','start_time','end_time','start_text','end_text','calculation_start_time','calculation_end_time','break_minutes','schedule_area_ids','active'] end;
 if p_values-fields<>'{}'::jsonb or not (p_values ?& fields)
   or jsonb_typeof(p_values->'name') is distinct from 'string'
   or jsonb_typeof(p_values->'active') is distinct from 'boolean'
 then raise exception 'Datos inválidos.' using errcode='22023'; end if;
 nm:=btrim(p_values->>'name'); enabled:=(p_values->>'active')::boolean;
 if length(nm)<1 or length(nm)>(case when p_kind='employee' then 160 else 120 end)
 then raise exception 'Nombre inválido.' using errcode='22023'; end if;
 -- Serialize retries for one identity, including concurrent inserts.
 perform pg_advisory_xact_lock(hashtextextended('schedule-catalog:'||p_id::text,0));
 if p_kind='employee' then
   select to_jsonb(e) into previous from public.v2_employees e where e.restaurant_id=p_restaurant and e.id=p_id for update;
 else
   select to_jsonb(s) into previous from public.v2_shifts s where s.restaurant_id=p_restaurant and s.id=p_id for update;
 end if;
 if p_expected is not null then
   select jsonb_object_agg(k,previous->k) into snapshot from unnest(fields) k;
   if previous is null or snapshot is distinct from p_expected
   then raise exception 'SCHEDULE_CATALOG_CHANGED' using errcode='40001'; end if;
 elsif previous is not null then
   raise exception 'El registro ya existe.' using errcode='23505';
 end if;
 if p_kind='employee' then
   if jsonb_typeof(p_values->'employee_code') is distinct from 'string'
      or jsonb_typeof(p_values->'phone') is distinct from 'string'
      or length(p_values->>'employee_code')>80 or length(p_values->>'phone')>60
   then raise exception 'Datos del empleado inválidos.' using errcode='22023'; end if;
   area:=nullif(p_values->>'area_id','')::uuid;
   if area is not null and not exists(select from public.v2_areas a where a.restaurant_id=p_restaurant and a.id=area
      and (a.active or previous->>'area_id'=area::text))
   then raise exception 'Seleccione un área activa de esta sucursal.' using errcode='23514'; end if;
   if p_expected is null then
     insert into public.v2_employees(id,restaurant_id,name,employee_code,phone,area_id,active)
     values(p_id,p_restaurant,nm,btrim(p_values->>'employee_code'),btrim(p_values->>'phone'),area,enabled) returning to_jsonb(v2_employees.*) into result;
   else
     update public.v2_employees set name=nm,employee_code=btrim(p_values->>'employee_code'),phone=btrim(p_values->>'phone'),area_id=area,active=enabled
       where restaurant_id=p_restaurant and id=p_id returning to_jsonb(v2_employees.*) into result;
   end if;
 else
   if jsonb_typeof(p_values->'schedule_area_ids') is distinct from 'array'
     or jsonb_typeof(p_values->'break_minutes') is distinct from 'number'
   then raise exception 'Elige las áreas del turno.' using errcode='22023'; end if;
   select coalesce(array_agg(x::uuid),'{}'::uuid[]) into scope from jsonb_array_elements_text(p_values->'schedule_area_ids') x;
   if cardinality(scope)<>(select count(*) from public.v2_areas a where a.restaurant_id=p_restaurant and a.id=any(scope)
      and (a.active or (previous->'schedule_area_ids')?a.id::text))
   then raise exception 'Seleccione áreas distintas de esta sucursal.' using errcode='23514'; end if;
   if (p_values->>'break_minutes')!~ '^\d+$' then raise exception 'Descanso inválido.' using errcode='22023'; end if;
   minutes:=(p_values->>'break_minutes')::integer;
   start_at:=nullif(p_values->>'start_time','')::time;end_at:=nullif(p_values->>'end_time','')::time;
   start_label:=nullif(btrim(p_values->>'start_text'),'');end_label:=nullif(btrim(p_values->>'end_text'),'');
   calc_start:=nullif(p_values->>'calculation_start_time','')::time;calc_end:=nullif(p_values->>'calculation_end_time','')::time;
   if (start_at is null)=(start_label is null) or (end_at is null)=(end_label is null)
      or length(coalesce(start_label,''))>40 or length(coalesce(end_label,''))>40
      or coalesce(start_label,'')~E'[\n\r]' or coalesce(end_label,'')~E'[\n\r]'
      or (start_label is null and calc_start is not null) or (end_label is null and calc_end is not null)
      or minutes not between 0 and 1440
   then raise exception 'Entrada, salida o descanso inválidos.' using errcode='22023'; end if;
   if p_expected is null then
     insert into public.v2_shifts(id,restaurant_id,name,start_time,end_time,start_text,end_text,calculation_start_time,calculation_end_time,break_minutes,schedule_area_ids,active)
     values(p_id,p_restaurant,nm,start_at,end_at,start_label,end_label,calc_start,calc_end,minutes,scope,enabled) returning to_jsonb(v2_shifts.*) into result;
   else
     update public.v2_shifts set name=nm,start_time=start_at,end_time=end_at,start_text=start_label,end_text=end_label,
       calculation_start_time=calc_start,calculation_end_time=calc_end,break_minutes=minutes,schedule_area_ids=scope,active=enabled
       where restaurant_id=p_restaurant and id=p_id returning to_jsonb(v2_shifts.*) into result;
   end if;
 end if;
 return result;
end; $$;
revoke all on function public.v2_save_schedule_catalog(uuid,text,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.v2_save_schedule_catalog(uuid,text,uuid,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
