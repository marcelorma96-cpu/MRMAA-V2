begin;
-- Only active reservations occupy a quote's conversion slot.
alter table public.v2_reservations drop constraint if exists v2_reservations_quote_id_key;
create unique index if not exists v2_reservations_active_quote_key
on public.v2_reservations(quote_id) where quote_id is not null and deleted_at is null;

create or replace function public.v2_lock_quote_conversion()
returns trigger language plpgsql security invoker set search_path=public as $$
declare qid uuid; rid uuid;
begin
  if TG_OP='DELETE' then qid:=old.quote_id; rid:=old.restaurant_id;
  else qid:=new.quote_id; rid:=new.restaurant_id; end if;
  if qid is not null then
    perform 1 from public.v2_quotes where id=qid and restaurant_id=rid for update;
    if not found and TG_OP<>'DELETE' then
      raise exception 'La cotización no está disponible para este restaurante.';
    end if;
    if TG_OP<>'DELETE' and new.deleted_at is null then
      if exists(select 1 from public.v2_quotes where id=qid and deleted_at is not null) then
        raise exception 'Restaure la cotización antes de crear o restaurar su reserva.';
      end if;
    end if;
    if TG_OP='UPDATE' and new.deleted_at is null and old.deleted_at is not null then
      if exists(select 1 from public.v2_reservations where quote_id=qid and deleted_at is null and id<>new.id) then
        raise exception 'Esta cotización ya tiene otra reserva activa. Elimine esa reserva antes de restaurar la anterior.';
      end if;
    end if;
    if TG_OP='INSERT' then
      if new.deleted_at is null then new.status:='confirmada'; end if;
    elsif TG_OP='UPDATE' then
      if new.deleted_at is null and (old.deleted_at is not null or old.quote_id is distinct from new.quote_id) then
        new.status:='confirmada';
      end if;
    end if;
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.v2_sync_quote_conversion()
returns trigger language plpgsql security invoker set search_path=public as $$
declare qid uuid; rid uuid; old_qid uuid; old_rid uuid;
begin
  if TG_OP<>'INSERT' then old_qid:=old.quote_id; old_rid:=old.restaurant_id; end if;
  if TG_OP<>'DELETE' then qid:=new.quote_id; rid:=new.restaurant_id; end if;
  update public.v2_quotes q set status=case
    when exists(select 1 from public.v2_reservations r where r.quote_id=q.id and r.restaurant_id=q.restaurant_id and r.deleted_at is null)
      then 'convertida' else 'pendiente' end
  where ((q.id=qid and q.restaurant_id=rid) or (q.id=old_qid and q.restaurant_id=old_rid))
    and (q.status='convertida' or exists(select 1 from public.v2_reservations r where r.quote_id=q.id and r.restaurant_id=q.restaurant_id and r.deleted_at is null));
  return null;
end $$;

drop trigger if exists v2_lock_quote_conversion on public.v2_reservations;
create trigger v2_lock_quote_conversion before insert or update or delete on public.v2_reservations
for each row execute function public.v2_lock_quote_conversion();
drop trigger if exists v2_sync_quote_conversion on public.v2_reservations;
create trigger v2_sync_quote_conversion after insert or update or delete on public.v2_reservations
for each row execute function public.v2_sync_quote_conversion();
revoke all on function public.v2_lock_quote_conversion(), public.v2_sync_quote_conversion() from public;
-- Quote state is derived on every write, including stale browser edits.
create or replace function public.v2_guard_linked_quote()
returns trigger language plpgsql security invoker set search_path=public as $$
declare linked boolean;
begin
  select exists(select 1 from public.v2_reservations r
    where r.quote_id=old.id and r.restaurant_id=old.restaurant_id and r.deleted_at is null) into linked;
  if linked then
    if TG_OP='DELETE' then
      raise exception 'Primero elimine la reserva vinculada para poder eliminar la cotización.';
    elsif old.deleted_at is null and new.deleted_at is not null then
      raise exception 'Primero elimine la reserva vinculada para poder eliminar la cotización.';
    end if;
    new.status:='convertida';
  elsif TG_OP='UPDATE' and new.status='convertida' then
    new.status:='pendiente';
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists v2_guard_linked_quote on public.v2_quotes;
create trigger v2_guard_linked_quote before update or delete on public.v2_quotes
for each row execute function public.v2_guard_linked_quote();
revoke all on function public.v2_guard_linked_quote() from public;

-- Repair previous conversions whose reservation was already sent to trash.
update public.v2_quotes q set status='pendiente'
where q.status='convertida' and not exists(select 1 from public.v2_reservations r where r.quote_id=q.id and r.restaurant_id=q.restaurant_id and r.deleted_at is null);
update public.v2_quotes q set status='convertida'
where q.status is distinct from 'convertida' and exists(select 1 from public.v2_reservations r where r.quote_id=q.id and r.restaurant_id=q.restaurant_id and r.deleted_at is null);
commit;
