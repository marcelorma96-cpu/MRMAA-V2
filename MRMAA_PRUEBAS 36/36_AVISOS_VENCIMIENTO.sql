-- MRMAA: recordatorios de suscripciones canceladas, 7, 3 y 1 dia antes.
-- Solo agrega una tabla privada y funciones de avisos. No cambia datos de negocio.
begin;
create table if not exists public.v2_expiry_notices (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null,
 paid_until timestamptz not null,
 days_before integer not null check(days_before in (7,3,1)),
 owner_id uuid not null,
 attempted_at timestamptz not null default now(),
 status text not null default 'sending' check(status in ('sending','sent','failed','skipped')),
 finished_at timestamptz,
 unique(restaurant_id,paid_until,days_before)
);
alter table public.v2_expiry_notices enable row level security;
revoke all on public.v2_expiry_notices from public,anon,authenticated;
grant select,update on public.v2_expiry_notices to service_role;
create or replace function public.v2_claim_expiry_notice()
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; notice uuid;
begin
 for r in
  select x.id,x.owner_id,x.name,x.language,x.billing_current_period_end as paid_until,
    u.email,
    case when x.billing_current_period_end<=now()+interval '1 day' then 1
         when x.billing_current_period_end<=now()+interval '3 days' then 3 else 7 end as days_before
  from public.v2_restaurants x join auth.users u on u.id=x.owner_id
  where x.billing_cancel_at_period_end is true
    and x.billing_current_period_end>now()
    and x.billing_current_period_end<=now()+interval '7 days'
    and (x.billing_current_period_end<=now()+interval '1 day'
      or x.billing_current_period_end>now()+interval '2 days' and x.billing_current_period_end<=now()+interval '3 days'
      or x.billing_current_period_end>now()+interval '6 days')
    and x.access_status not in ('deleted','suspended')
    and not public.v2_billing_exempt(x.id)
    and u.email is not null and u.email_confirmed_at is not null
    and not exists (select 1 from public.v2_expiry_notices n where n.restaurant_id=x.id
      and n.paid_until=x.billing_current_period_end
      and n.days_before=case when x.billing_current_period_end<=now()+interval '1 day' then 1
         when x.billing_current_period_end<=now()+interval '3 days' then 3 else 7 end)
  order by x.billing_current_period_end limit 1 for update of x skip locked
 loop
  insert into public.v2_expiry_notices(restaurant_id,paid_until,days_before,owner_id)
    values(r.id,r.paid_until,r.days_before,r.owner_id) on conflict do nothing returning id into notice;
  if notice is not null then
    return jsonb_build_object('id',notice,'restaurant_id',r.id,'owner_id',r.owner_id,'name',r.name,
     'language',r.language,'email',r.email,'paid_until',r.paid_until,'days_before',r.days_before);
  end if;
 end loop;
 return null;
end $$;
revoke all on function public.v2_claim_expiry_notice() from public,anon,authenticated;
grant execute on function public.v2_claim_expiry_notice() to service_role;
create or replace function public.v2_expiry_notice_valid(p_notice uuid)
returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.v2_expiry_notices n join public.v2_restaurants r on r.id=n.restaurant_id
 where n.id=p_notice and n.status='sending' and r.owner_id=n.owner_id
 and r.billing_cancel_at_period_end is true and r.billing_current_period_end=n.paid_until
 and n.paid_until>now() and r.access_status not in ('deleted','suspended')
 and not public.v2_billing_exempt(r.id));
$$;
revoke all on function public.v2_expiry_notice_valid(uuid) from public,anon,authenticated;
grant execute on function public.v2_expiry_notice_valid(uuid) to service_role;
commit;
