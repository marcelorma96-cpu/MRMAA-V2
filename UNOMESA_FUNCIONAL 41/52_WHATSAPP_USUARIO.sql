-- UnoMesa · SQL 52 · Enlaces de WhatsApp con nombre de usuario
-- Requiere SQL 50 y 51. Si ambos están instalados, ejecute solo este archivo.
-- Solo actualiza la función de validación. No cambia tablas ni filas existentes.
-- No modifica clientes, cotizaciones, reservas, planos, suscripciones ni exenciones.
-- La web normaliza http:// a https:// antes de guardar. No prueba que la cuenta exista.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regprocedure('public.v2_public_whatsapp_link_valid(text)') is null then
  raise exception 'Instale primero 51_WHATSAPP_ENLACE_DIRECTO.sql (después de SQL 50)';
 end if;
end$$;

create or replace function public.v2_public_whatsapp_link_valid(p_url text)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(
  length(p_url) between 1 and 2048
  and p_url !~ '[[:space:]<>#[:cntrl:]]'
  and (
   p_url ~ '^https://wa\.me/([1-9][0-9]{7,14}|message/[A-Za-z0-9_-]{4,128})/?(\?[^#[:space:]<>]*)?$'
   or (p_url ~ '^https://wa\.me/[A-Za-z0-9_][A-Za-z0-9._-]{0,127}/?(\?[^#[:space:]<>]*)?$'
       and substring(p_url from '^https://wa\.me/([^/?]+)') ~ '[A-Za-z_]')
   or p_url ~ '^https://api\.whatsapp\.com/message/[A-Za-z0-9_-]{4,128}/?(\?[^#[:space:]<>]*)?$'
   or (p_url ~ '^https://api\.whatsapp\.com/send/?\?[^#[:space:]<>]*$'
       and substring(p_url from '[?&]phone=([^&]*)') ~ '^(%2[Bb])?[1-9][0-9]{7,14}$')
  ),false)
$$;
revoke all on function public.v2_public_whatsapp_link_valid(text) from public,anon,authenticated;

commit;
