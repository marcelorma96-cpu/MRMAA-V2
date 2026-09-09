-- MRMAA v2 — landing, registro, planes y prueba de 10 días.
-- Ejecute este archivo una vez si ya instaló SUPABASE_V2.sql anteriormente.
-- No borra datos ni tablas.

alter table public.v2_restaurants add column if not exists owner_name text not null default '';
alter table public.v2_restaurants add column if not exists phone text not null default '';
alter table public.v2_restaurants add column if not exists country text not null default 'Guatemala';
alter table public.v2_restaurants add column if not exists language text not null default 'es';
alter table public.v2_restaurants add column if not exists currency text not null default 'GTQ';
alter table public.v2_restaurants add column if not exists plan_code text not null default 'intermediate' check (plan_code in ('basic','intermediate','advanced'));
alter table public.v2_restaurants add column if not exists trial_started_at timestamptz not null default now();
alter table public.v2_restaurants add column if not exists trial_ends_at timestamptz not null default (now() + interval '10 days');
alter table public.v2_restaurants add column if not exists subscription_status text not null default 'trialing' check (subscription_status in ('trialing','active','past_due','cancelled'));

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
notify pgrst,'reload schema';
