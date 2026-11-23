-- Instala una operación atómica. La instalación no modifica ningún horario.
begin;
create or replace function public.v2_schedule_cells(p_restaurant uuid,p_mode text,p_cells jsonb,p_patch jsonb default '{}'::jsonb)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 m jsonb; c jsonb; src public.v2_schedules%rowtype; old jsonb;
 emp uuid; dt date; target_emp uuid; target_day date; area uuid; typ text; shift uuid;
 meal_start time; meal_end time; tint text; note text; n integer:=0;
begin
 m:=to_jsonb(public.v2_effective_membership(p_restaurant));
 if auth.uid() is null or not coalesce(public.v2_session_alive() and public.v2_can_read(p_restaurant),false)
    or m->>'status' is distinct from 'activo' or coalesce(m->>'role','') not in ('admin','administrador','gerente','soporte_editor')
    or not coalesce((to_jsonb(public.v2_account_billing(p_restaurant))->>'can_write')::boolean,false)
 then raise exception 'Acceso restringido.' using errcode='42501'; end if;
 if p_mode is null or p_mode not in ('edit','move') or jsonb_typeof(p_cells) is distinct from 'array'
    or jsonb_array_length(p_cells) not between 1 and 500 or jsonb_typeof(p_patch) is distinct from 'object'
    or p_patch-array['entry_type','shift_id','color','break_start','break_end','notes']<>'{}'::jsonb
    or ((p_mode='edit')=(p_patch='{}'::jsonb))
 then raise exception 'Selección inválida.'; end if;
 if exists(select 1 from jsonb_array_elements(p_cells) x group by (x->>'employee_id')::uuid,(x->>'work_date')::date having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_cells) x group by (x->'to'->>'employee_id')::uuid,(x->'to'->>'work_date')::date having count(*)>1)
 then raise exception 'Casillas repetidas.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('schedule-cells:'||p_restaurant::text,0));
 for c in select value from jsonb_array_elements(p_cells) with ordinality a(value,ord) order by ord loop
   emp:=(c->>'employee_id')::uuid; dt:=(c->>'work_date')::date;
   target_emp:=(c->'to'->>'employee_id')::uuid; target_day:=(c->'to'->>'work_date')::date;
   if emp is null or dt is null or target_emp is null or target_day is null
      or not exists(select from public.v2_employees e where e.restaurant_id=p_restaurant and e.id=emp and e.active)
   then raise exception 'Empleado o fecha inválidos.'; end if;
   select e.area_id into area from public.v2_employees e where e.restaurant_id=p_restaurant and e.id=target_emp and e.active;
   if not found then raise exception 'Empleado de destino no disponible.'; end if;
   select s.* into src from public.v2_schedules s where s.restaurant_id=p_restaurant and s.employee_id=emp and s.work_date=dt for update;
   old:=case when src.id is null then 'null'::jsonb else jsonb_build_object('id',src.id,'employee_id',emp,'work_date',dt,
      'area_id',src.area_id,'shift_id',src.shift_id,'entry_type',src.entry_type,'color',src.color,'notes',src.notes,
      'break_start',src.break_start,'break_end',src.break_end) end;
   if old is distinct from c->'expected' then raise exception 'SCHEDULE_CHANGED' using errcode='40001'; end if;
   if p_mode='move' then
     if src.id is null or (emp,dt)=(target_emp,target_day) then raise exception 'Movimiento inválido.'; end if;
     if exists(select from public.v2_schedules s where s.restaurant_id=p_restaurant and s.employee_id=target_emp and s.work_date=target_day)
     then raise exception 'SCHEDULE_OCCUPIED' using errcode='23505'; end if;
     update public.v2_schedules set employee_id=target_emp,work_date=target_day,area_id=case when emp=target_emp then src.area_id else area end
     where restaurant_id=p_restaurant and id=src.id;
   else
     if (emp,dt)<>(target_emp,target_day) then raise exception 'Destino inválido.'; end if;
     typ:=coalesce(p_patch->>'entry_type',src.entry_type);
     if typ is null or typ not in ('work','rest','permission','vacation') then raise exception 'Seleccione una asignación para las casillas vacías.'; end if;
     shift:=case when typ<>'work' then null when p_patch?'shift_id' then (p_patch->>'shift_id')::uuid else src.shift_id end;
     if typ='work' and (shift is null or (p_patch?'shift_id' and not exists(select from public.v2_shifts s where s.restaurant_id=p_restaurant and s.id=shift and s.active)))
     then raise exception 'Seleccione un turno disponible.'; end if;
     meal_start:=case when typ<>'work' then null when p_patch?'break_start' then (p_patch->>'break_start')::time else src.break_start end;
     meal_end:=case when typ<>'work' then null when p_patch?'break_end' then (p_patch->>'break_end')::time else src.break_end end;
     tint:=case when p_patch?'color' then p_patch->>'color' else src.color end;
     if p_patch?'color' and tint is not null and tint !~ '^#[a-fA-F0-9]{6}$' then raise exception 'Color inválido.'; end if;
     note:=case when p_patch?'notes' then coalesce(p_patch->>'notes','') when src.id is null then '' else src.notes end;
     if src.id is null then
       insert into public.v2_schedules(restaurant_id,employee_id,work_date,area_id,shift_id,entry_type,color,break_start,break_end,notes)
       values(p_restaurant,emp,dt,area,shift,typ,tint,meal_start,meal_end,note);
     else
       update public.v2_schedules set shift_id=shift,entry_type=typ,color=tint,break_start=meal_start,break_end=meal_end,notes=note where id=src.id and restaurant_id=p_restaurant;
     end if;
   end if;
   if not found then raise exception 'SCHEDULE_CHANGED' using errcode='40001'; end if;
   n:=n+1;
 end loop;
 return n;
end; $$;
revoke all on function public.v2_schedule_cells(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.v2_schedule_cells(uuid,text,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
