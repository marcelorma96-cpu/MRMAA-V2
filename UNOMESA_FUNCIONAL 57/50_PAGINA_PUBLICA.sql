-- UnoMesa: página pública opcional y solicitudes de cotización.
-- SOLO ejecutar este archivo nuevo. No modifica registros ni funciones existentes.
-- Desactivado por defecto; sin cobros ni reservas automáticas. Reejecutable.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.v2_public_pages (
 restaurant_id uuid primary key references public.v2_restaurants(id) on delete cascade,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 64),
 published boolean not null default false, content jsonb not null default '{}',revision integer not null default 1,updated_at timestamptz not null default now(),check(octet_length(content::text)<=150000)
);
create table if not exists public.v2_public_aliases(slug text primary key,restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade);
create table if not exists public.v2_public_assets(id uuid primary key,restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,path text not null unique,name text not null,size integer not null check(size between 1 and 3145728),ready boolean not null default false,created_at timestamptz not null default now());
create index if not exists v2_public_assets_restaurant on public.v2_public_assets(restaurant_id);
create table if not exists public.v2_public_requests (
 id uuid primary key,restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 created_at timestamptz not null default now(),name text not null check(length(name) between 1 and 160),phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),email text not null check(length(email) between 5 and 254),
 event_date date not null,event_time time not null,guests integer not null check(guests between 1 and 100000),menu text not null check(length(menu) between 1 and 160),area text not null default '' check(length(area)<=160),notes text not null default '' check(length(notes)<=2000),preference text not null check(preference in ('whatsapp','email','phone')),
 status text not null default 'new' check(status in ('new','contacted','quoted','archived')),quote_id uuid references public.v2_quotes(id) on delete set null,revision integer not null default 1
);
create index if not exists v2_public_requests_page on public.v2_public_requests(restaurant_id,created_at desc,id desc);
create index if not exists v2_public_requests_status on public.v2_public_requests(restaurant_id,status,created_at desc,id desc);
alter table public.v2_public_pages enable row level security;
alter table public.v2_public_aliases enable row level security;
alter table public.v2_public_assets enable row level security;
alter table public.v2_public_requests enable row level security;
revoke all on public.v2_public_pages,public.v2_public_aliases,public.v2_public_assets,public.v2_public_requests from public,anon,authenticated;
grant all on public.v2_public_pages,public.v2_public_aliases,public.v2_public_assets,public.v2_public_requests to service_role;

create or replace function public.v2_public_authorize(p_restaurant uuid,p_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare m jsonb;r text;b jsonb;
begin
 if auth.uid() is null or not coalesce(public.v2_session_alive(),false) or not coalesce(public.v2_can_read(p_restaurant),false) then raise exception 'PUBLIC_ACCESS';end if;
 m:=to_jsonb(public.v2_effective_membership(p_restaurant));r:=m->>'role';
 if m->>'status' is distinct from 'activo' or r is null or r not in ('administrador','admin','gerente','operacion','lectura','soporte_editor','soporte_lectura') then raise exception 'PUBLIC_ACCESS';end if;
 if p_mode='manage' and r not in ('administrador','admin') then raise exception 'PUBLIC_ACCESS';end if;
 if p_mode='write' and r not in ('administrador','admin','gerente','operacion','soporte_editor') then raise exception 'PUBLIC_ACCESS';end if;
 if p_mode<>'read' then b:=to_jsonb(public.v2_account_billing(p_restaurant));if not coalesce((b->>'can_write')::boolean,false) then raise exception 'PUBLIC_ACCESS';end if;end if;
end $$;
create or replace function public.v2_public_settings(p_restaurant uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;a jsonb;
begin
 perform public.v2_public_authorize(p_restaurant,'manage');
 select to_jsonb(x) into p from public.v2_public_pages x where restaurant_id=p_restaurant;
 select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into a from public.v2_public_assets x where restaurant_id=p_restaurant;
 return jsonb_build_object('page',p,'assets',a);
end $$;
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
  if c not in ('whatsapp','phone','email') or (c in ('whatsapp','phone') and coalesce(p_content->>c,'') !~ '^[1-9][0-9]{7,14}$') or (c='email' and coalesce(p_content->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'PUBLIC_INPUT';end if;
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
-- Only curated content is returned. Never joins internal customers, reservations or prices.
create or replace function public.v2_public_page(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('slug',p.slug,'content',p.content) from public.v2_public_aliases a join public.v2_public_pages p using(restaurant_id)
 where a.slug=p_slug and p.published=true
$$;
create or replace function public.v2_public_asset_reserve(p_restaurant uuid,p_id uuid,p_extension text,p_name text,p_size integer)
returns text language plpgsql security definer set search_path='' as $$
declare f text;
begin
 perform public.v2_public_authorize(p_restaurant,'manage');
 if p_id is null or p_extension not in ('pdf','jpg','png','webp') or p_size not between 1 and 3145728 or p_size is null or length(p_name) not between 1 and 100 then raise exception 'PUBLIC_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('public-page:'||p_restaurant::text,0));
 if (select count(*)>=30 or coalesce(sum(size),0)+p_size>20971520 from public.v2_public_assets where restaurant_id=p_restaurant) then raise exception 'PUBLIC_QUOTA';end if;
 f:=p_restaurant::text||'/'||p_id::text||'.'||p_extension;
 insert into public.v2_public_assets(id,restaurant_id,path,name,size) values(p_id,p_restaurant,f,p_name,p_size);
 return f;
end $$;
create or replace function public.v2_public_asset_detach(p_restaurant uuid,p_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare f text;
begin
 perform public.v2_public_authorize(p_restaurant,'manage');
 perform pg_advisory_xact_lock(hashtextextended('public-page:'||p_restaurant::text,0));
 select path into f from public.v2_public_assets where restaurant_id=p_restaurant and id=p_id for update;
 if f is null or exists(select 1 from public.v2_public_pages where restaurant_id=p_restaurant and strpos(content::text,f)>0) then raise exception 'PUBLIC_IN_USE';end if;
 update public.v2_public_assets set ready=false where id=p_id;return f;
end $$;
revoke all on function public.v2_public_asset_detach(uuid,uuid) from public,anon,authenticated;
grant execute on function public.v2_public_asset_detach(uuid,uuid) to authenticated;
-- Service-only intake after HTTP validation, distributed rate limiting and optional Turnstile.
create or replace function public.v2_public_submit(p_slug text,p_id uuid,p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare p public.v2_public_pages;existing uuid;
begin
 select x.* into p from public.v2_public_pages x join public.v2_public_aliases a using(restaurant_id) where a.slug=p_slug and x.published for share of x;
 if p.restaurant_id is null or p.content->>'quotes' is distinct from 'true' then raise exception 'PUBLIC_NOT_FOUND';end if;
 if not coalesce((p.content->'channels') ? (p_data->>'preference'),false) then raise exception 'PUBLIC_INPUT';end if;
 select restaurant_id into existing from public.v2_public_requests where id=p_id;
 if found then if existing<>p.restaurant_id then raise exception 'PUBLIC_INPUT';end if;return;end if;
 if (p_data->>'event_date')::date < current_date-1 or (p_data->>'event_date')::date > current_date+1826 then raise exception 'PUBLIC_INPUT';end if;
 if p_data->>'menu' <> 'advice' and not exists(select 1 from jsonb_array_elements(p.content->'menus') x where x->>'name'=p_data->>'menu') then raise exception 'PUBLIC_INPUT';end if;
 if coalesce(p_data->>'area','')<>'' and not exists(select 1 from jsonb_array_elements(p.content->'areas') x where x->>'name'=p_data->>'area') then raise exception 'PUBLIC_INPUT';end if;
 insert into public.v2_public_requests(id,restaurant_id,name,phone,email,event_date,event_time,guests,menu,area,notes,preference)
 values(p_id,p.restaurant_id,p_data->>'name',p_data->>'phone',p_data->>'email',(p_data->>'event_date')::date,(p_data->>'event_time')::time,(p_data->>'guests')::integer,p_data->>'menu',coalesce(p_data->>'area',''),coalesce(p_data->>'notes',''),p_data->>'preference') on conflict(id) do nothing;
end $$;
create or replace function public.v2_public_inbox(p_restaurant uuid,p_status text default 'new',p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;
begin
 perform public.v2_public_authorize(p_restaurant,'read');
 if p_status not in ('new','contacted','quoted','archived','all') then raise exception 'PUBLIC_INPUT';end if;
 select coalesce(jsonb_agg(t order by t.created_at desc,t.id desc),'[]') into rows from (select r.* from public.v2_public_requests r where restaurant_id=p_restaurant and (p_status='all' or status=p_status) and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 26) t;
 return rows;
end $$;
create or replace function public.v2_public_unread(p_restaurant uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 perform public.v2_public_authorize(p_restaurant,'read');
 select count(*) into n from (select id from public.v2_public_requests where restaurant_id=p_restaurant and status='new' limit 99) x;return n;
end $$;
revoke all on function public.v2_public_unread(uuid) from public,anon,authenticated;
grant execute on function public.v2_public_unread(uuid) to authenticated;
create or replace function public.v2_public_request_update(p_restaurant uuid,p_id uuid,p_revision integer,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.v2_public_authorize(p_restaurant,'write');
 if p_status not in ('new','contacted','archived') then raise exception 'PUBLIC_INPUT';end if;
 update public.v2_public_requests set status=p_status,revision=revision+1 where restaurant_id=p_restaurant and id=p_id and revision=p_revision;
 if not found then raise exception 'PUBLIC_STALE';end if;
end $$;
-- Atomic conversion: rollback both quote and request on errors; retries return same quote.
create or replace function public.v2_public_quote(p_restaurant uuid,p_request uuid,p_payload jsonb,p_items jsonb,p_floor jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.v2_public_requests;q jsonb;
begin
 perform public.v2_public_authorize(p_restaurant,'write');
 select * into r from public.v2_public_requests where restaurant_id=p_restaurant and id=p_request for update;
 if not found then raise exception 'PUBLIC_NOT_FOUND';end if;
 if r.quote_id is not null then
  select jsonb_build_object('id',id,'quote_number',quote_number) into q from public.v2_quotes where id=r.quote_id and restaurant_id=p_restaurant and deleted_at is null;
  if q is null then raise exception 'PUBLIC_NOT_FOUND';end if;return q;
 end if;
 q:=public.v2_floor_save_quote(p_restaurant,null,p_request,p_payload,p_items,null,p_floor);
 update public.v2_public_requests set quote_id=(q->>'id')::uuid,status='quoted',revision=revision+1 where id=p_request;
 return q;
end $$;
revoke all on function public.v2_public_authorize(uuid,text),public.v2_public_settings(uuid),public.v2_public_save(uuid,text,jsonb,boolean,integer),public.v2_public_page(text),public.v2_public_asset_reserve(uuid,uuid,text,text,integer),public.v2_public_submit(text,uuid,jsonb),public.v2_public_inbox(uuid,text,timestamptz,uuid),public.v2_public_request_update(uuid,uuid,integer,text),public.v2_public_quote(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.v2_public_settings(uuid),public.v2_public_save(uuid,text,jsonb,boolean,integer),public.v2_public_asset_reserve(uuid,uuid,text,text,integer),public.v2_public_inbox(uuid,text,timestamptz,uuid),public.v2_public_request_update(uuid,uuid,integer,text),public.v2_public_quote(uuid,uuid,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.v2_public_page(text) to anon,authenticated,service_role;
grant execute on function public.v2_public_submit(text,uuid,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('unomesa-public','unomesa-public',true,3145728,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Recordatorios vigentes: lectura nueva, sin borrar ni cerrar pendientes históricos.
-- Usa la fecha local del dispositivo, igual que los listados actuales.
create or replace function public.v2_event_inbox_current(p_restaurant_id uuid,p_today date,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.v2_event_authorize(p_restaurant_id,false);
  if p_today is null or p_today not between date '2000-01-01' and date '2100-12-31' then raise exception 'EVENT_INPUT'; end if;
  if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'EVENT_INPUT'; end if;
  with pending as (
    select t.id,t.title,t.status,t.assignee,t.due_date,t.updated_at,
      case when t.quote_id is not null then 'quote' else 'reservation' end as kind,
      coalesce(t.quote_id,t.reservation_id) as event_id,coalesce(q.client_name,r.client_name) as client_name,
      coalesce(q.event_date,r.event_date) as event_date,coalesce(q.event_time,r.event_time) as event_time
    from public.v2_event_tasks t
    left join public.v2_quotes q on q.id=t.quote_id and q.restaurant_id=p_restaurant_id and q.deleted_at is null
    left join public.v2_reservations r on r.id=t.reservation_id and r.restaurant_id=p_restaurant_id and r.deleted_at is null
    where t.restaurant_id=p_restaurant_id and t.status in ('pending','waiting') and (q.id is not null or r.id is not null)
      and (coalesce(q.event_date,r.event_date) is null or coalesce(q.event_date,r.event_date)>=p_today)
  ) select jsonb_build_object('total',(select count(*) from pending),'rows',coalesce((select jsonb_agg(x) from (
    select * from pending order by due_date nulls last,event_date nulls last,event_time nulls last,id offset p_offset limit 50) x),'[]'::jsonb)) into result;
  return result;
end $$;

revoke all on function public.v2_event_inbox_current(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.v2_event_inbox_current(uuid,date,integer) to authenticated;
notify pgrst,'reload schema';
commit;
