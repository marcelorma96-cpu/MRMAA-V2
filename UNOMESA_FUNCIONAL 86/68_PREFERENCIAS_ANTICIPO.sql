-- UnoMesa: preferencias de anticipo por restaurante. Instala una función;
-- ejecutar este archivo no modifica cotizaciones, pagos ni preferencias existentes.
begin;
create or replace function public.v2_set_quote_deposit_preference(p_restaurant uuid, p_key text, p_value jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare membership jsonb;
begin
 if auth.uid() is null or not coalesce(public.v2_session_alive() and public.v2_can_read(p_restaurant),false) then
   raise exception 'Acceso denegado.' using errcode='42501';
 end if;
 membership:=to_jsonb(public.v2_effective_membership(p_restaurant));
 if membership->>'status' is distinct from 'activo' or coalesce(membership->>'role','') not in ('administrador','admin','soporte_editor')
    or not coalesce((to_jsonb(public.v2_account_billing(p_restaurant))->>'can_write')::boolean,false) then
   raise exception 'Acceso denegado.' using errcode='42501';
 end if;
 if not coalesce((p_key='quote_deposit_suggestion_basis' and p_value in ('"with_tip"'::jsonb,'"without_tip"'::jsonb))
    or (p_key='quote_show_deposit_due' and jsonb_typeof(p_value)='boolean'), false) then
   raise exception 'Preferencia de anticipo inválida.' using errcode='22023';
 end if;
 update public.v2_restaurants
 set settings=coalesce(nullif(settings,'null'::jsonb),'{}'::jsonb) || jsonb_build_object(p_key,p_value)
 where id=p_restaurant;
 if not found then raise exception 'Acceso denegado.' using errcode='42501'; end if;
end; $$;
revoke all on function public.v2_set_quote_deposit_preference(uuid,text,jsonb) from public,anon;
grant execute on function public.v2_set_quote_deposit_preference(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
