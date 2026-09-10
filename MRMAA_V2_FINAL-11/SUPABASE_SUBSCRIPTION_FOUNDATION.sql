-- MRMAA: estructura previa a Stripe y panel global.
-- No activa bloqueos por sí sola. Ejecute una vez en Supabase > SQL Editor.

alter table public.v2_restaurants add column if not exists access_status text not null default 'trialing';
alter table public.v2_restaurants add column if not exists billing_enforcement_enabled boolean not null default false;
alter table public.v2_restaurants add column if not exists grace_ends_at timestamptz;
alter table public.v2_restaurants add column if not exists restricted_at timestamptz;
alter table public.v2_restaurants add column if not exists cancelled_at timestamptz;
alter table public.v2_restaurants add column if not exists export_until timestamptz;
alter table public.v2_restaurants add column if not exists deletion_scheduled_at timestamptz;
alter table public.v2_restaurants add column if not exists stripe_customer_id text;
alter table public.v2_restaurants add column if not exists stripe_subscription_id text;

do $$ begin
  alter table public.v2_restaurants add constraint v2_restaurants_access_status_check
    check (access_status in ('trialing','active','past_due','restricted','cancelled','suspended','deleted'));
exception when duplicate_object then null; end $$;

create table if not exists public.v2_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.v2_platform_admins enable row level security;

create or replace function public.v2_is_platform_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.v2_platform_admins where user_id=auth.uid()) $$;
grant execute on function public.v2_is_platform_admin() to authenticated;

create or replace function public.v2_platform_set_business_status(
  target_restaurant uuid, new_status text, grace_days integer default 5, export_days integer default 30
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.v2_is_platform_admin() then raise exception 'Acceso denegado'; end if;
  if new_status not in ('trialing','active','past_due','restricted','cancelled','suspended') then raise exception 'Estado inválido'; end if;
  update public.v2_restaurants set
    access_status=new_status,
    subscription_status=case when new_status in ('trialing','active','past_due','cancelled') then new_status else subscription_status end,
    grace_ends_at=case when new_status='past_due' then now()+make_interval(days=>grace_days) else grace_ends_at end,
    restricted_at=case when new_status='restricted' then now() else restricted_at end,
    cancelled_at=case when new_status='cancelled' then now() else cancelled_at end,
    export_until=case when new_status in ('restricted','cancelled','suspended') then now()+make_interval(days=>export_days) else null end
  where id=target_restaurant;
end $$;
grant execute on function public.v2_platform_set_business_status(uuid,text,integer,integer) to authenticated;

create or replace function public.v2_platform_schedule_business_deletion(target_restaurant uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.v2_is_platform_admin() then raise exception 'Acceso denegado'; end if;
  update public.v2_restaurants set access_status='deleted', deletion_scheduled_at=now()+interval '30 days',
    export_until=now()+interval '30 days' where id=target_restaurant;
end $$;
grant execute on function public.v2_platform_schedule_business_deletion(uuid) to authenticated;

-- Ejecute manualmente, sustituyendo el correo, para nombrar al primer dueño de plataforma:
-- insert into public.v2_platform_admins(user_id)
-- select id from auth.users where lower(email)=lower('SU_CORREO') on conflict do nothing;

notify pgrst, 'reload schema';
