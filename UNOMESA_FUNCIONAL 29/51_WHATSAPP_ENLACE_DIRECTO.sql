-- UnoMesa · SQL 51 · Enlace directo de WhatsApp
-- Requiere 50_PAGINA_PUBLICA.sql ya instalado. Se puede ejecutar de nuevo.
-- Solo define validación y actualiza v2_public_save; no ejecuta cambios en filas.
-- Conserva tablas, contenido publicado, clientes, reservas, cotizaciones y permisos.
-- El enlace se guarda dentro del JSON de la página únicamente cuando el usuario guarda.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regclass('public.v2_public_pages') is null then
  raise exception 'Instale primero 50_PAGINA_PUBLICA.sql';
 end if;
end$$;

create or replace function public.v2_public_whatsapp_link_valid(p_url text)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(
  length(p_url) between 1 and 2048
  and p_url !~ '[[:space:]<>#[:cntrl:]]'
  and (
   p_url ~ '^https://wa\.me/([1-9][0-9]{7,14}|message/[A-Za-z0-9_-]{4,128})/?(\?[^#[:space:]<>]*)?$'
   or p_url ~ '^https://api\.whatsapp\.com/message/[A-Za-z0-9_-]{4,128}/?(\?[^#[:space:]<>]*)?$'
   or (p_url ~ '^https://api\.whatsapp\.com/send/?\?[^#[:space:]<>]*$'
       and substring(p_url from '[?&]phone=([^&]*)') ~ '^(%2[Bb])?[1-9][0-9]{7,14}$')
  ),false)
$$;
revoke all on function public.v2_public_whatsapp_link_valid(text) from public,anon,authenticated;

create or replace function public.v2_public_save(p_restaurant uuid,p_slug text,p_content jsonb,p_published boolean,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.v2_public_pages;c text;f text;
begin
 perform public.v2_public_authorize(p_restaurant,'manage');
 perform pg_advisory_xact_lock(hashtextextended('public-page:'||p_restaurant::text,0));
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 3 and 64 or jsonb_typeof(p_content) is distinct from 'object' or octet_length(p_content::text)>150000 or p_published is null or p_revision is null then raise exception 'PUBLIC_INPUT';end if;
 if jsonb_typeof(p_content->'menus') is distinct from 'array' or jsonb_typeof(p_content->'areas') is distinct from 'array' or jsonb_typeof(p_content->'pdfs') is distinct from 'array' or jsonb_typeof(p_content->'channels') is distinct from 'array' then raise exception 'PUBLIC_INPUT';end if;
 if jsonb_array_length(p_content->'menus')>60 or jsonb_array_length(p_content->'areas')>60 or jsonb_array_length(p_content->'pdfs')>5 or jsonb_array_length(p_content->'channels')>3 then raise exception 'PUBLIC_INPUT';end if;
 if p_published and (length(btrim(coalesce(p_content->>'name',''))) not between 1 and 160 or (coalesce(p_content->>'quotes'='true' or p_content->>'reservations'='true' or p_content->>'consultations'='true',false) and jsonb_array_length(p_content->'channels')=0)) then raise exception 'PUBLIC_INPUT';end if;
 for c in select jsonb_array_elements_text(p_content->'channels') loop
  if c not in ('whatsapp','phone','email') or (c='phone' and coalesce(p_content->>'phone','') !~ '^[1-9][0-9]{7,14}$') or (c='email' and coalesce(p_content->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'PUBLIC_INPUT';end if;
  if c='whatsapp' then
   if coalesce(p_content->>'whatsapp_link','')<>'' then
    if not public.v2_public_whatsapp_link_valid(p_content->>'whatsapp_link') then raise exception 'PUBLIC_INPUT';end if;
   elsif coalesce(p_content->>'whatsapp','') !~ '^[1-9][0-9]{7,14}$' then raise exception 'PUBLIC_INPUT';
   end if;
  end if;
 end loop;
 for f in select p_content->>'logo' union all select p_content->>'cover' union all select x->>'image' from jsonb_array_elements(p_content->'menus') x union all select x->>'image' from jsonb_array_elements(p_content->'areas') x union all select x->>'path' from jsonb_array_elements(p_content->'pdfs') x loop
  if coalesce(f,'')<>'' and not exists(select 1 from public.v2_public_assets a where a.restaurant_id=p_restaurant and a.path=f and a.ready) then raise exception 'PUBLIC_INPUT';end if;
 end loop;
 select * into p from public.v2_public_pages where restaurant_id=p_restaurant for update;
 if coalesce(p.revision,0)<>p_revision then raise exception 'PUBLIC_STALE';end if;
 insert into public.v2_public_aliases(slug,restaurant_id) values(p_slug,p_restaurant) on conflict(slug) do nothing;
 if not exists(select 1 from public.v2_public_aliases where slug=p_slug and restaurant_id=p_restaurant) then raise exception 'PUBLIC_SLUG';end if;
 insert into public.v2_public_pages(restaurant_id,slug,content,published) values(p_restaurant,p_slug,p_content,p_published)
 on conflict(restaurant_id) do update set slug=excluded.slug,content=excluded.content,published=excluded.published,revision=v2_public_pages.revision+1,updated_at=now() returning * into p;
 return to_jsonb(p);
end $$;

-- CREATE OR REPLACE conserva los permisos existentes de v2_public_save.
commit;
