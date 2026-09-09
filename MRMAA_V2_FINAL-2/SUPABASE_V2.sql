-- MRMAA v2 — instalación no destructiva.
-- Este archivo NO borra ni modifica las tablas de la versión anterior.

create extension if not exists pgcrypto;

create table if not exists public.v2_restaurants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null default 'Mi restaurante', created_at timestamptz not null default now(), unique(owner_id)
);
alter table public.v2_restaurants add column if not exists owner_name text not null default '';
alter table public.v2_restaurants add column if not exists phone text not null default '';
alter table public.v2_restaurants add column if not exists country text not null default 'Guatemala';
alter table public.v2_restaurants add column if not exists language text not null default 'es';
alter table public.v2_restaurants add column if not exists currency text not null default 'GTQ';
alter table public.v2_restaurants add column if not exists plan_code text not null default 'intermediate' check (plan_code in ('basic','intermediate','advanced'));
alter table public.v2_restaurants add column if not exists trial_started_at timestamptz not null default now();
alter table public.v2_restaurants add column if not exists trial_ends_at timestamptz not null default (now() + interval '10 days');
alter table public.v2_restaurants add column if not exists subscription_status text not null default 'trialing' check (subscription_status in ('trialing','active','past_due','cancelled'));
create table if not exists public.v2_members (
 restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'administrador',
 primary key(restaurant_id,user_id)
);
create table if not exists public.v2_clients (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 name text not null, phone text, email text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.v2_quotes (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 client_id uuid references public.v2_clients(id) on delete set null, quote_number integer not null,
 client_name text not null, client_phone text not null default '', client_email text not null default '',
 event_date date not null, event_time time, area text not null default '', guests integer not null default 0 check(guests>=0),
 discount_pct numeric(5,2) not null default 0 check(discount_pct between 0 and 100), tip_pct numeric(5,2) not null default 10 check(tip_pct>=0),
 subtotal numeric(12,2) not null default 0, total numeric(12,2) not null default 0, deposit numeric(12,2) not null default 0,
 payment_method text not null default '', balance numeric(12,2) not null default 0,
 customer_note text not null default '', internal_notes text not null default '',
 custom_fields jsonb not null default '{}'::jsonb, adjustments jsonb not null default '[]'::jsonb,
 status text not null default 'borrador',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(restaurant_id,quote_number)
);
create table if not exists public.v2_quote_items (
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.v2_quotes(id) on delete cascade,
 position integer not null default 0, name text not null, description text, quantity numeric(12,2) not null check(quantity>=0),
 unit_price numeric(12,2) not null check(unit_price>=0), line_total numeric(12,2) not null check(line_total>=0)
);
create table if not exists public.v2_reservations (
 id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.v2_restaurants(id) on delete cascade,
 quote_id uuid unique references public.v2_quotes(id) on delete set null, client_id uuid references public.v2_clients(id) on delete set null,
 client_name text not null, phone text not null default '', event_date date not null, event_time time, area text not null default '', guests integer not null default 0,
 menu text not null default '', subtotal numeric(12,2) not null default 0, discount_pct numeric(5,2) not null default 0, tip_pct numeric(5,2) not null default 0,
 total numeric(12,2) not null default 0, deposit numeric(12,2) not null default 0,
 payment_method text not null default '', balance numeric(12,2) not null default 0,
 notes text not null default '', status text not null default 'pendiente', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.v2_ensure_restaurant() returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; metadata jsonb;
begin
 if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
 select raw_user_meta_data into metadata from auth.users where id=auth.uid();
 select restaurant_id into rid from public.v2_members where user_id=auth.uid() limit 1;
 if rid is null then
   select id into rid from public.v2_restaurants where owner_id=auth.uid();
   if rid is null then
     insert into public.v2_restaurants(owner_id,name,owner_name,phone,country,language,currency,plan_code)
     values(auth.uid(),coalesce(nullif(metadata->>'restaurant_name',''),'Mi restaurante'),coalesce(metadata->>'full_name',''),coalesce(metadata->>'phone',''),coalesce(nullif(metadata->>'country',''),'Guatemala'),coalesce(nullif(metadata->>'language',''),'es'),coalesce(nullif(metadata->>'currency',''),'GTQ'),case when metadata->>'plan_code' in ('basic','intermediate','advanced') then metadata->>'plan_code' else 'intermediate' end)
     returning id into rid;
   end if;
   insert into public.v2_members(restaurant_id,user_id) values(rid,auth.uid()) on conflict do nothing;
 end if;
 return rid;
end $$;
grant execute on function public.v2_ensure_restaurant() to authenticated;

alter table public.v2_restaurants enable row level security; alter table public.v2_members enable row level security;
alter table public.v2_clients enable row level security; alter table public.v2_quotes enable row level security;
alter table public.v2_quote_items enable row level security; alter table public.v2_reservations enable row level security;

drop policy if exists v2_restaurants_member on public.v2_restaurants;
create policy v2_restaurants_member on public.v2_restaurants for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=id and m.user_id=auth.uid())) with check(owner_id=auth.uid());
drop policy if exists v2_members_self on public.v2_members;
create policy v2_members_self on public.v2_members for select to authenticated using(user_id=auth.uid());
drop policy if exists v2_clients_member on public.v2_clients;
create policy v2_clients_member on public.v2_clients for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_clients.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_clients.restaurant_id and m.user_id=auth.uid()));
drop policy if exists v2_quotes_member on public.v2_quotes;
create policy v2_quotes_member on public.v2_quotes for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_quotes.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_quotes.restaurant_id and m.user_id=auth.uid()));
drop policy if exists v2_quote_items_member on public.v2_quote_items;
create policy v2_quote_items_member on public.v2_quote_items for all to authenticated using(exists(select 1 from public.v2_quotes q join public.v2_members m on m.restaurant_id=q.restaurant_id where q.id=v2_quote_items.quote_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_quotes q join public.v2_members m on m.restaurant_id=q.restaurant_id where q.id=v2_quote_items.quote_id and m.user_id=auth.uid()));
drop policy if exists v2_reservations_member on public.v2_reservations;
create policy v2_reservations_member on public.v2_reservations for all to authenticated using(exists(select 1 from public.v2_members m where m.restaurant_id=v2_reservations.restaurant_id and m.user_id=auth.uid())) with check(exists(select 1 from public.v2_members m where m.restaurant_id=v2_reservations.restaurant_id and m.user_id=auth.uid()));

create index if not exists v2_clients_restaurant_name on public.v2_clients(restaurant_id,name);
create index if not exists v2_quotes_restaurant_number on public.v2_quotes(restaurant_id,quote_number desc);
create index if not exists v2_reservations_restaurant_date on public.v2_reservations(restaurant_id,event_date,event_time);
notify pgrst,'reload schema';
