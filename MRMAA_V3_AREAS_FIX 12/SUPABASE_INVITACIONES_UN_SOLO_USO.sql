-- MRMAA - enlaces de invitación de un solo uso.
-- Ejecutar una sola vez en Supabase > SQL Editor antes de desplegar esta versión.

alter table public.v2_members
  add column if not exists invite_token_hash text;

-- Las invitaciones antiguas no tienen el nuevo código seguro y quedan
-- invalidadas. El administrador puede enviar un enlace nuevo desde Usuarios.
update public.v2_members
set invite_token_hash=null
where status='invitado';

notify pgrst, 'reload schema';
