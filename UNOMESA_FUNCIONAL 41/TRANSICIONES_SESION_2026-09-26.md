# Corrección de la transición al cerrar sesión

Se corrigió una carrera entre el cierre de sesión y las comprobaciones de seguridad en curso. Antes, una respuesta tardía de la comprobación MFA podía mostrar momentáneamente la pantalla de verificación mientras la sesión ya se estaba cerrando.

## Comportamiento

- Al iniciar el cierre, se muestra «Cerrando sesión…» y se invalidan las comprobaciones anteriores.
- Las respuestas tardías, los eventos de foco, las comprobaciones periódicas y los refrescos del token no reabren el desafío durante el cierre.
- Se conserva la secuencia existente: revocar la sesión de la aplicación, cerrar Auth y usar el cierre local como respaldo si la red falla.
- El destino de salida se fija en `/?login=1`, incluso si la pantalla privada se desmonta antes de recibir el evento `SIGNED_OUT`.
- La verificación en dos pasos sigue siendo obligatoria cuando el servidor la requiere. Los errores de comprobación siguen bloqueando el acceso.

## Validación

Las pruebas reproducen el destello con el código anterior y verifican que ya no aparece con la corrección. Se ejecuta el código real de la compuerta de acceso, el cierre de sesión y la lectura de MFA con hooks y respuestas de Supabase simulados. No se usan cuentas ni datos reales.

Se cubren respuestas tardías de rechazo/error, cierre repetido, ingreso que requiere MFA, aprobación posterior, cierre desde el desafío, sesión revocada, recuperación de contraseña, acceso anónimo y respaldo local ante un error de Auth.

Los cambios de aplicación están limitados a `lib/supabase.ts` y `components/mfa-settings.tsx`. La integración de Google Ads y el resto de los archivos existentes se conservan. No se modifica SQL, la base de datos, los planes, los cobros ni las exenciones del piloto.

## Aplicar

Despliegue este ZIP en el mismo proyecto, conservando las variables actuales. No ejecute SQL para este ajuste. Después, pruebe cerrar sesión e iniciar nuevamente; si tiene verificación en dos pasos activada, esta debe aparecer al ingresar cuando corresponda, no al salir.
