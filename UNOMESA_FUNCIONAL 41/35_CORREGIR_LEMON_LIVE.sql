-- MRMAA: habilitar recibos Lemon Squeezy live y test.
-- Ejecutar completo en Supabase > SQL Editor.
-- Solo modifica la validacion del formato del recibo de v2_lemon_apply.
-- Conserva permisos, propietario y las demas validaciones de la funcion instalada.
-- No actualiza ni elimina registros. No cambia exenciones del piloto.
-- Despues, reenviar el webhook fallido desde Lemon Squeezy.
begin;
set local lock_timeout = '10s';
do $patch$
declare
  target regprocedure;
  definition text;
  old_pattern constant text := $pattern$'^lemon_test_[a-f0-9]{64}$'$pattern$;
  new_pattern constant text := $pattern$'^lemon_(test|live)_[a-f0-9]{64}$'$pattern$;
begin
  target := to_regprocedure('public.v2_lemon_apply(text,timestamp with time zone,uuid,uuid,text,text,text,text,text,text,timestamp with time zone,boolean,timestamp with time zone)');
  if target is null then
    raise exception 'No existe la funcion esperada. No se aplico la correccion.';
  end if;
  definition := pg_get_functiondef(target);
  if position(new_pattern in definition) > 0 and position(old_pattern in definition) = 0 then
    raise notice 'La correccion ya esta instalada.';
    return;
  end if;
  if (length(definition)-length(replace(definition,old_pattern,''))) / length(old_pattern) <> 1 then
    raise exception 'La validacion instalada es diferente. No se aplico la correccion.';
  end if;
  execute replace(definition,old_pattern,new_pattern);
end
$patch$;
commit;

select 'Correccion instalada: recibos live y test admitidos; resto de validaciones conservadas.' as resultado;
