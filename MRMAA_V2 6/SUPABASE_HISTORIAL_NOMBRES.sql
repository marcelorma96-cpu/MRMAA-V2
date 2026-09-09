-- MRMAA: mostrar el nombre de la persona en el historial.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.v2_audit_log add column if not exists actor_name text;

update public.v2_audit_log audit
set actor_name = coalesce(nullif(member.name, ''), nullif(member.email, ''), 'Usuario anterior')
from public.v2_members member
where audit.restaurant_id = member.restaurant_id
  and audit.changed_by = member.user_id
  and audit.actor_name is null;

create or replace function public.v2_write_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  before_row jsonb := case when tg_op='INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op='DELETE' then null else to_jsonb(new) end;
  rid uuid := coalesce((after_row->>'restaurant_id')::uuid,(before_row->>'restaurant_id')::uuid);
  rec_id uuid;
  rid_action text;
  current_actor_name text;
begin
  if tg_op='INSERT' then rid_action := 'creado'; rec_id := new.id;
  elsif tg_op='DELETE' then rid_action := 'eliminado_definitivamente'; rec_id := old.id;
  elsif old.deleted_at is null and new.deleted_at is not null then rid_action := 'enviado_papelera';
  elsif old.deleted_at is not null and new.deleted_at is null then rid_action := 'restaurado';
  else rid_action := 'modificado';
  end if;
  if tg_op='UPDATE' then rec_id := new.id; end if;

  select coalesce(nullif(name,''),nullif(email,''),'Usuario') into current_actor_name
  from public.v2_members
  where restaurant_id=rid and user_id=auth.uid()
  limit 1;

  insert into public.v2_audit_log(
    restaurant_id,table_name,record_id,action,old_data,new_data,changed_by,actor_name
  ) values (
    rid,tg_table_name,rec_id,rid_action,before_row,after_row,auth.uid(),coalesce(current_actor_name,'Sistema')
  );
  return case when tg_op='DELETE' then old else new end;
end $$;

notify pgrst, 'reload schema';
