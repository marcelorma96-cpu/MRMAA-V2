-- UnoMesa: lectura agrupada de etiquetas de mesas para listados.
-- No modifica filas, tablas, políticas, funciones previas, planes o pagos.
-- Crea una RPC de solo lectura con los permisos de lectura del plano existentes.
-- Requiere los SQL de plano 43 y 44. Ejecutar en la misma base de UnoMesa.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

create or replace function public.v2_event_area_labels(p_restaurant uuid,p_kind text,p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare layout jsonb; rows jsonb;
begin
  perform public.v2_floor_authorize(p_restaurant,'read');
  if p_kind is null or p_kind not in ('quote','reservation') or p_ids is null or cardinality(p_ids)>50 then
    raise exception 'FLOOR_LABEL_INPUT' using errcode='22023';
  end if;
  if cardinality(p_ids)=0 then return jsonb_build_object('layout',jsonb_build_object('areas','[]'::jsonb,'tables','[]'::jsonb),'rows','[]'::jsonb);end if;
  select p.layout into layout from public.v2_floor_plans p where p.restaurant_id=p_restaurant;
  -- Nombres e identidades únicamente: no fotos/fondos, geometría o reservas del día.
  layout:=jsonb_build_object(
    'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a->>'id','name',a->>'name') order by n) from jsonb_array_elements(coalesce(layout->'areas','[]'::jsonb)) with ordinality x(a,n)),'[]'::jsonb),
    'tables',coalesce((select jsonb_agg(jsonb_build_object('id',t->>'id','areaId',t->>'areaId','name',t->>'name') order by n) from jsonb_array_elements(coalesce(layout->'tables','[]'::jsonb)) with ordinality x(t,n)),'[]'::jsonb)
  );
  if p_kind='quote' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'area',coalesce(r.area,q.area,''),'selection',
      case when r.id is not null then
        case when s.reservation_id is null then null else jsonb_build_object('table_ids',s.table_ids,'whole_area_id',s.whole_area_id) end
      when qp.quote_id is not null and (jsonb_typeof(qp.selection->'table_ids')='array' or nullif(qp.selection->>'whole_area_id','') is not null)
        then jsonb_build_object('table_ids',coalesce(qp.selection->'table_ids','[]'::jsonb),'whole_area_id',qp.selection->'whole_area_id')
      else null end
    )),'[]'::jsonb) into rows
    from public.v2_quotes q
    left join lateral (
      select rr.id,rr.area from public.v2_reservations rr
      where rr.quote_id=q.id and rr.restaurant_id=p_restaurant and rr.deleted_at is null
      order by rr.id limit 1
    ) r on true
    left join public.v2_floor_seatings s on s.reservation_id=r.id and s.restaurant_id=p_restaurant
    left join public.v2_floor_quote_plans qp on qp.quote_id=q.id and qp.restaurant_id=p_restaurant
    where q.restaurant_id=p_restaurant and q.id=any(p_ids) and q.deleted_at is null;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'area',coalesce(r.area,''),'selection',
      case when s.reservation_id is null then null else jsonb_build_object('table_ids',s.table_ids,'whole_area_id',s.whole_area_id) end
    )),'[]'::jsonb) into rows
    from public.v2_reservations r
    left join public.v2_floor_seatings s on s.reservation_id=r.id and s.restaurant_id=p_restaurant
    where r.restaurant_id=p_restaurant and r.id=any(p_ids) and r.deleted_at is null;
  end if;
  return jsonb_build_object('layout',layout,'rows',rows);
end $$;

revoke all on function public.v2_event_area_labels(uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.v2_event_area_labels(uuid,text,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
