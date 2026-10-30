# Diagnóstico de compras — 28 de octubre de 2026

Esta actualización identifica la configuración que falta en el servidor antes de abrir una compra. El mensaje anterior era idéntico para todas las variables ausentes. No se ha confirmado cuál falta en el despliegue real de UnoMesa; este ajuste permite comprobarlo.

## Aplicar

1. Publicar el código de este ZIP en el mismo proyecto Vercel que sirve `www.unomesa.com`, conservando las variables y la conexión existente a Supabase. Repetir Redeploy de un despliegue anterior no incorpora este código nuevo: primero actualizar los archivos del proyecto.
2. Esperar a que la nueva versión termine en Ready y sea el despliegue de Production activo.
3. Cerrar completamente la app y abrirla de nuevo. No hace falta una compilación nueva de iOS/TestFlight o Android para este ajuste web.
4. Desde el restaurante ficticio autorizado, intentar suscribirse. Si falta una variable, el aviso incluirá un código de soporte `UM-Sxx`. Ese código basta para identificar la variable sin compartir claves.

## Códigos

| Código | Configuración que debe comprobarse en el despliegue activo |
| --- | --- |
| UM-S01 | `APPLE_BILLING_MODE`: falta, está vacía o no contiene exactamente `test` o `live`. Se toleran espacios exteriores. |
| UM-S02 | `STORE_TEST_RESTAURANT_IDS`: falta o está vacía. Un UUID presente pero no autorizado produce un aviso diferente. |
| UM-S03 | `APPLE_PRIVATE_KEY`: falta o está vacía. |
| UM-S04 | `APPLE_KEY_ID`: falta o está vacía. |
| UM-S05 | `APPLE_ISSUER_ID`: falta o está vacía. |
| UM-S06 | `APPLE_APP_ID`: falta o no es un entero positivo; solo se exige en modo live. Es el Apple ID numérico de la app, no el de un producto. |
| UM-S07 | `GOOGLE_PLAY_BILLING_MODE`: falta, está vacía o tiene un modo inválido. |
| UM-S08 | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: falta o está vacía. |
| UM-S09 | `GOOGLE_PLAY_PUSH_AUDIENCE`: falta o está vacía al validar notificaciones. |
| UM-S10 | `GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT`: falta o está vacía al validar notificaciones. |

En Vercel Logs, buscar `[UnoMesa store configuration]`. La entrada identifica el nombre de la variable y si falta o es inválida. No registra sus valores, claves, UUID de restaurantes, tokens de compra ni encabezados de autenticación. Las notificaciones conservan su respuesta genérica; sus códigos se consultan en el log.

Si todavía se ve el aviso anterior **sin código**, el endpoint no está usando este código nuevo. Comprobar los archivos del despliegue activo y el dominio cargado por la app. No cambiar a live para intentar resolver este mensaje.

## Alcance y límites

- Se mantiene el catálogo visible sin credenciales. Los controles de propietario, exención, proveedor original y autorización de restaurantes de prueba siguen vigentes.
- Se comprueba la presencia de las credenciales antes de preparar una compra. Esto no certifica que la clave sea válida, que corresponda a la cuenta de Apple ni que los productos estén aprobados.
- No se incluye ni modifica SQL. No ejecutar migraciones para este ajuste. La actualización no migra, elimina ni modifica por sí misma registros existentes.
- Una compra de prueba sí puede actualizar el plan del restaurante autorizado, como antes: usar una cuenta/restaurante ficticio, sin datos de operación real.
- No se ha accedido al despliegue de producción, ejecutado compras ni validado una transacción real en un dispositivo.

## Validación local

- 94 pruebas aprobadas: configuración, catálogo, verificación, conciliación, gestión de suscripciones, múltiples sucursales y resuscripción de Google.
- TypeScript sin errores.
- Compilación de producción Next.js con webpack completada correctamente.
- Comparación del ZIP: solo se cambian dos módulos de servidor, las instrucciones y las pruebas; todos los archivos SQL permanecen idénticos.
