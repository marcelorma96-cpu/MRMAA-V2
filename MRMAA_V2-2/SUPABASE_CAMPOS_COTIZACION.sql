-- MRMAA V2: campos personalizados y cobros/descuentos configurables.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.v2_quotes
  add column if not exists payment_method text not null default '';

alter table public.v2_reservations
  add column if not exists payment_method text not null default '';

alter table public.v2_quotes
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table public.v2_quotes
  add column if not exists adjustments jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
