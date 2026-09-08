-- MRMAA v2 — Horarios, Comunicación, Reportes y Configuración.
-- Ejecute una sola vez. No borra datos ni tablas existentes.

alter table public.v2_restaurants add column if not exists quote_number_start integer not null default 2000;
alter table public.v2_restaurants add column if not exists settings jsonb not null default '{"discounts":true,"tips":true,"deposits":true}'::jsonb;

create table if not exists public.v2_areas (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null, color text not null default '#ea580c', active boolean not null default true,
 created_at timestamptz not null default now(), unique(restaurant_id,name)
);
create table if not exists public.v2_employees (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null, employee_code text not null default '', phone text not null default '', area_id uuid references public.v2_areas(id) on delete set null,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.v2_shifts (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null, start_time time not null, end_time time not null, break_minutes integer not null default 0 check(break_minutes>=0),
 active boolean not null default true, created_at timestamptz not null default now(), unique(restaurant_id,name)
);
create table if not exists public.v2_schedules (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 employee_id uuid not null references public.v2_employees(id) on delete cascade, area_id uuid references public.v2_areas(id) on delete set null,
 shift_id uuid references public.v2_shifts(id) on delete set null, work_date date not null, notes text not null default '', created_at timestamptz not null default now(),
 unique(restaurant_id,employee_id,work_date)
);
create table if not exists public.v2_message_templates (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null, category text not null default 'confirmacion', body text not null, active boolean not null default true,
 created_at timestamptz not null default now(), unique(restaurant_id,name)
);

alter table public.v2_areas enable row level security;
alter table public.v2_employees enable row level security;
alter table public.v2_shifts enable row level security;
alter table public.v2_schedules enable row level security;
alter table public.v2_message_templates enable row level security;

drop policy if exists v2_areas_member on public.v2_areas;
create policy v2_areas_member on public.v2_areas for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_areas.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_areas.restaurant_id and m.user_id=auth.uid()));
drop policy if exists v2_employees_member on public.v2_employees;
create policy v2_employees_member on public.v2_employees for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_employees.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_employees.restaurant_id and m.user_id=auth.uid()));
drop policy if exists v2_shifts_member on public.v2_shifts;
create policy v2_shifts_member on public.v2_shifts for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_shifts.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_shifts.restaurant_id and m.user_id=auth.uid()));
drop policy if exists v2_schedules_member on public.v2_schedules;
create policy v2_schedules_member on public.v2_schedules for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_schedules.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_schedules.restaurant_id and m.user_id=auth.uid()));
drop policy if exists v2_templates_member on public.v2_message_templates;
create policy v2_templates_member on public.v2_message_templates for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_message_templates.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_message_templates.restaurant_id and m.user_id=auth.uid()));

insert into public.v2_areas(restaurant_id,name,color)
select r.id,x.name,x.color from public.v2_restaurants r cross join (values ('Bar','#2563eb'),('Cocina','#ea580c'),('Parrilla','#dc2626'),('Dish','#0891b2'),('Meseros','#16a34a'),('Caja','#9333ea'),('Oficina','#475569'),('Garrotero','#ca8a04'),('Parqueo','#64748b')) x(name,color)
on conflict(restaurant_id,name) do nothing;
insert into public.v2_shifts(restaurant_id,name,start_time,end_time,break_minutes)
select r.id,x.name,x.start_time::time,x.end_time::time,x.break_minutes from public.v2_restaurants r cross join (values ('Apertura','07:00','16:00',60),('Completo','10:00','22:00',180),('Intermedio','10:00','20:00',60),('Cierre','12:00','22:00',60)) x(name,start_time,end_time,break_minutes)
on conflict(restaurant_id,name) do nothing;
insert into public.v2_message_templates(restaurant_id,name,category,body)
select r.id,x.name,x.category,x.body from public.v2_restaurants r cross join (values
('Confirmación de reservación','confirmacion','Hola {cliente}, confirmamos su reservación para el {fecha} a las {hora}. ¡Le esperamos!'),
('Recordatorio de evento','recordatorio','Hola {cliente}, le recordamos su reservación para el {fecha} a las {hora}. Por favor confirme su asistencia.'),
('Cotización enviada','cotizacion','Hola {cliente}, le compartimos la cotización solicitada. Quedamos atentos a sus comentarios.'),
('Agradecimiento','agradecimiento','Hola {cliente}, gracias por visitarnos. Fue un gusto atenderle.')) x(name,category,body)
on conflict(restaurant_id,name) do nothing;

create index if not exists v2_employees_restaurant on public.v2_employees(restaurant_id,name);
create index if not exists v2_schedules_week on public.v2_schedules(restaurant_id,work_date);
notify pgrst,'reload schema';
