-- MRMAA V2: ejecutar una sola vez en Supabase > SQL Editor.
-- Normaliza estados existentes y el valor inicial de nuevas cotizaciones.

alter table public.v2_quotes alter column status set default 'pendiente';
update public.v2_quotes
set status = 'pendiente'
where status is null or status = 'borrador';

-- Columnas requeridas por usuarios y anticipos (seguro al repetir).
alter table public.v2_members add column if not exists name text not null default '';
alter table public.v2_members add column if not exists email text not null default '';
alter table public.v2_members add column if not exists status text not null default 'activo';
alter table public.v2_members add column if not exists invited_at timestamptz;
alter table public.v2_members add column if not exists last_invited_at timestamptz;
alter table public.v2_quotes add column if not exists payment_method text not null default '';
alter table public.v2_reservations add column if not exists payment_method text not null default '';

-- Activa el registro de anticipos en instalaciones anteriores. Luego puede
-- volver a ocultarlo manualmente desde Configuración si lo desea.
update public.v2_restaurants
set settings = coalesce(settings, '{}'::jsonb) || '{"deposits": true}'::jsonb;

notify pgrst, 'reload schema';
