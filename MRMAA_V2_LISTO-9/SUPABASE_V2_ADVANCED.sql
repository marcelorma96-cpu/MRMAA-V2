-- MRMAA v2 — actualización avanzada (reservaciones, horarios, comunicación y cotizaciones).
-- Ejecute una sola vez en Supabase > SQL Editor. No elimina información existente.

alter table public.v2_schedules add column if not exists entry_type text not null default 'work';
alter table public.v2_schedules add column if not exists break_start time;
alter table public.v2_schedules add column if not exists break_end time;
alter table public.v2_members add column if not exists name text not null default '';
alter table public.v2_members add column if not exists email text not null default '';
alter table public.v2_members add column if not exists status text not null default 'activo';
update public.v2_members m set name=coalesce(nullif(u.raw_user_meta_data->>'full_name',''),m.name),email=coalesce(u.email,m.email) from auth.users u where u.id=m.user_id and (m.name='' or m.email='');
alter table public.v2_schedules drop constraint if exists v2_schedules_entry_type_check;
alter table public.v2_schedules add constraint v2_schedules_entry_type_check check (entry_type in ('work','rest','permission'));

create table if not exists public.v2_quote_products (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null,
 description text not null default '',
 price numeric(12,2) not null default 0 check(price >= 0),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(restaurant_id,name)
);

create table if not exists public.v2_communication_settings (
 restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
 channel text not null default 'whatsapp' check(channel in ('whatsapp','sms')),
 provider text not null default 'wati',
 connection_status text not null default 'disconnected' check(connection_status in ('disconnected','connected')),
 reservation_confirmed boolean not null default true,
 reservation_tomorrow boolean not null default true,
 pending_quote boolean not null default true,
 updated_at timestamptz not null default now()
);

alter table public.v2_quote_products enable row level security;
alter table public.v2_communication_settings enable row level security;

drop policy if exists v2_quote_products_member on public.v2_quote_products;
create policy v2_quote_products_member on public.v2_quote_products for all to authenticated
 using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_quote_products.restaurant_id and m.user_id=auth.uid()))
 with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_quote_products.restaurant_id and m.user_id=auth.uid()));

drop policy if exists v2_communication_settings_member on public.v2_communication_settings;
create policy v2_communication_settings_member on public.v2_communication_settings for all to authenticated
 using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_communication_settings.restaurant_id and m.user_id=auth.uid()))
 with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_communication_settings.restaurant_id and m.user_id=auth.uid()));

create index if not exists v2_quote_products_restaurant on public.v2_quote_products(restaurant_id,name);

-- Retira únicamente los catálogos que fueron creados automáticamente por versiones anteriores.
delete from public.v2_areas where name in ('Bar','Cocina','Parrilla','Dish','Meseros','Caja','Oficina','Garrotero','Parqueo');
delete from public.v2_shifts where name in ('Apertura','Completo','Intermedio','Cierre');
notify pgrst,'reload schema';
