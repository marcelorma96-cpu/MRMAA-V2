-- Function from the installed metadata diagnostic; realtime transport is stubbed in tests.
CREATE OR REPLACE FUNCTION public.v2_emit_sync_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ids uuid[];
  rid uuid;
  projection text;
  source_rows text;
  cache_key text;
begin
  if tg_table_name = 'v2_audit_log' and pg_trigger_depth() > 1 then return null; end if;
  source_rows := case tg_op
    when 'INSERT' then 'select * from new_rows'
    when 'DELETE' then 'select * from old_rows'
    else 'select * from new_rows union all select * from old_rows' end;
  if tg_table_name = 'v2_quote_items' then
    projection := 'select distinct q.restaurant_id as rid from (' || source_rows || ') x join public.v2_quotes q on q.id=x.quote_id';
  elsif tg_table_name = 'v2_restaurants' then
    projection := 'select distinct x.id as rid from (' || source_rows || ') x';
  else
    projection := 'select distinct x.restaurant_id as rid from (' || source_rows || ') x';
  end if;
  execute 'select array_agg(rid) from (' || projection || ') tenants' into ids;
  foreach rid in array coalesce(ids, array[]::uuid[]) loop
    if rid is null then continue; end if;
    cache_key := 'mrmaa_sync.k' || md5(rid::text || tg_table_name);
    if current_setting(cache_key, true) = 'sent' then continue; end if;
    begin
      perform realtime.send(jsonb_build_object('v',1,'restaurant_id',rid,'table',tg_table_name),
        'changed', 'mrmaa:' || rid::text, true);
      perform set_config(cache_key, 'sent', true);
    exception when others then
      raise warning 'MRMAA: notificaci√≥n temporalmente no disponible (%)', sqlstate;
    end;
  end loop;
  return null;
end;
$function$;
