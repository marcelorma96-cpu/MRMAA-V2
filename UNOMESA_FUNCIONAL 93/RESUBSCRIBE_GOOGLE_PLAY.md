# UnoMesa: recontratación desde Google Play

La corrección de Resubscribe del 26 de octubre de 2026 sigue incluida. Esta entrega del 27/10 añade además `multiple_locations`: requiere actualizar el servidor y Android a 1.0.7 (versionCode 8). iOS no necesita cambios nativos. No requiere SQL nuevo. Consulte `GOOGLE_MULTIPLE_LOCATIONS.md`; la validación en dispositivo sigue pendiente.

## Comportamiento

- Una suscripción vencida que se recompra desde Google Play recupera su restaurante mediante la identidad de la compra anterior o mediante su token privado ya registrado. Nunca toma la identidad de un parámetro enviado por el cliente.
- Los tokens de compras vencidas hace más de 60 días se usan para consultar la vinculación guardada, sin depender de que la API de Google todavía permita consultarlos.
- La compra nueva se guarda y la capacidad del paquete se sincroniza antes de confirmarla a Google. La confirmación incluye el identificador opaco del restaurante para conservar la vinculación después de desaparecer el contexto de recompra.
- Si se pierde la respuesta de confirmación o Google omite temporalmente el identificador, la compra ya verificada en la base permite recuperar la vinculación. Las notificaciones repetidas no crean otra suscripción ni reinician el período de prueba.
- Una notificación antigua no sustituye una suscripción vigente más reciente. Tampoco se permite trasladar compras a otro restaurante, entorno o proveedor.
- Se mantiene el catálogo existente: Basic, Intermediate y Advanced mensual/anual; Advanced multisucursal mensual. La capacidad proviene del producto y plan base verificados por Google; los paquetes de 2–5 usan `multiple_locations` / `N-branches`.
- No se agregan ni modifican SQL, reservas, cotizaciones, clientes, horarios ni configuraciones del restaurante. El cambio usa las tablas y funciones de facturación existentes. La instalación de archivos no ejecuta cambios en producción.

## Instalación

1. La entrega `UNOMESA_FUNCIONAL.zip` ya incluye la corrección. Actualizar el contenido del proyecto web conectado a Vercel desde la carpeta que contiene `package.json`, conservando sus variables de entorno. No aplicar nuevamente el parche suelto de Resubscribe.
2. Esta entrega también incluye la eliminación del botón «Generar automáticamente» de Horarios. No aplicar nuevamente `Horarios_pendiente.patch`. Se conservan las demás funciones de Horarios y los registros guardados.
3. Ejecutar las pruebas indicadas abajo y desplegar el servidor con las variables de facturación y RTDN configuradas. Para pruebas usar `GOOGLE_PLAY_BILLING_MODE=test` y un restaurante incluido en `STORE_TEST_RESTAURANT_IDS`.
4. Verificar una notificación RTDN autenticada hacia `https://www.unomesa.com/api/billing/google-play`. El código por sí solo no configura Google Cloud, los permisos, el perfil de pagos ni las notificaciones.
5. Probar el flujo desde Google Play con un tester de licencias y una app instalada desde la pista de pruebas. Un tester de pista sin licencia de prueba podría recibir cargos reales; comprobar que la hoja de pago indique prueba.
6. Tras validar el flujo, elegir `Resubscribe: Allow` en cada plan base y guardar. Activar o modificar planes base no equivale a publicar una versión de la app.

Los testers de licencias pueden ver Resubscribe aunque esté desactivado en Console. No hace falta habilitar compras reales para ejecutar esta validación.

## Validación en dispositivo pendiente

Usar un restaurante de pruebas sin información real ni exención. Mantener los mismos identificadores y verificar:

1. Contratar un plan de prueba, cancelar su renovación y esperar su vencimiento en el entorno de pruebas.
2. Cerrar UnoMesa y recontratar desde el centro de suscripciones de Google Play.
3. Confirmar que RTDN activa el mismo restaurante sin abrir la app y que la compra queda reconocida por Google.
4. Abrir la app, comprobar plan y fecha de renovación y ejecutar Restaurar compras. El resultado debe ser el mismo y no debe repetirse el cobro.
5. Repetir para un plan anual y un paquete multisucursal. Confirmar la capacidad y la conservación de la sucursal principal y de las existentes.
6. Verificar fallo de pago, gracia, suspensión, recuperación y vencimiento usando las herramientas de prueba de Play. Durante la suspensión deben retirarse los beneficios pagados.

## Pruebas automatizadas

```sh
node --test tests/multiple-locations.test.cjs tests/subscription-management.test.cjs tests/google-resubscribe.test.cjs tests/store-verification.test.cjs tests/store-reconciliation.test.cjs tests/store-billing-sql.test.cjs tests/branches-sql.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

Las pruebas nuevas ejecutan los módulos reales de verificación, catálogo, webhook y conciliación con transporte Google y almacenamiento simulados. Las pruebas SQL existentes ejecutan las funciones de facturación y multisucursal en PostgreSQL embebido. Ninguna prueba usa una cuenta de pagos ni una base de producción.

Referencias oficiales consultadas:

- https://developer.android.com/google/play/billing/lifecycle/subscriptions#resubscribe
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2#OutOfAppPurchaseContext
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge
