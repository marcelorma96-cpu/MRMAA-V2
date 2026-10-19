> Actualización: esta entrega incorpora SQL 56 y multisucursal. Lea primero MULTISUCURSAL_CONFIGURACION.md; los builds actuales son iOS 17 y Android 4. Los seis productos individuales de esta guía permanecen vigentes.

# UnoMesa · suscripciones en web, iOS y Android

Actualización: 13 de octubre de 2026. Web completa, iOS Build 16 y Android 1.0.2 / Build 3.

## Qué hace esta versión

La suscripción pertenece al restaurante de UnoMesa. Su propietario entra con la misma cuenta en web, iOS y Android; los empleados conservan sus permisos. La tienda verifica el pago y el servidor actualiza el plan compartido. No se crea una cuenta por cada tienda ni se reinicia la prueba de 10 días.

| Compra original | Uso permitido | Dónde gestionar |
|---|---|---|
| Web / Lemon Squeezy | Web, iOS, Android | Configuración → Suscripción en la web |
| Apple App Store | Web, iOS, Android | Apple / suscripciones del Apple Account |
| Google Play | Web, iOS, Android | Google Play / suscripciones |

Las apps muestran instrucciones para compras realizadas en otro proveedor y no ofrecen un segundo cobro. En web hay enlaces a la gestión de Apple y Google. Las cuentas exentas conservan su exención. Los precios de las compras nativas se consultan a cada tienda, no se copian del precio web.

## Orden de instalación

1. Haga un respaldo habitual de Supabase. Ejecute **55_SUSCRIPCIONES_APPLE_GOOGLE.sql** en SQL Editor. Es una ampliación: agrega dos tablas privadas, un índice y funciones; no borra ni recalcula los registros actuales. No necesita volver a ejecutar los SQL anteriores que ya instaló. La web nueva necesita el SQL 55.
2. Suba la versión web completa. Conserve todas las variables existentes de Supabase, Lemon Squeezy, Google OAuth, correo y Turnstile. Los nuevos cobros nativos están desactivados por defecto: no cambie `BILLING_PROVIDER`, debe continuar en `lemon_squeezy`.
3. Cree los productos y configure las credenciales y notificaciones descritas abajo. No comparta claves privadas en el chat ni las incluya en las apps o ZIP. Solo van en variables del servidor de Vercel, sin prefijo NEXT_PUBLIC.
4. Compile las apps nuevas. iOS se debe validar en Xcode y TestFlight. Para probar pagos Android, use una compilación **release** firmada, con `com.unomesa.android`, instalada desde una pista de pruebas de Google Play; la variante debug `.debug` no corresponde a esos productos.
5. Complete pruebas con un restaurante nuevo de pruebas y sin una suscripción/exención anterior. Mantenga producción nativa desactivada hasta verificar compra, renovación, cancelación, restauración y acceso desde la web. Luego cambie el modo y habilite ventas reales.

## Apple App Store Connect

La cuenta Developer debe estar activa y los acuerdos comerciales, datos fiscales y bancarios de App Store Connect deben estar completos. No se puede habilitar una venta real únicamente subiendo este ZIP.

- App: bundle ID **com.unomesa.app**. Conserve el identificador y equipo de firma existentes.
- Cree **un grupo de suscripciones** UnoMesa con estos seis productos de renovación automática. Configure los niveles del grupo: Advanced superior, Intermediate intermedio, Basic inferior; mensual/anual del mismo plan al mismo nivel. Desactive Family Sharing para estos productos de restaurante.
- Use los nombres y duraciones de la tabla. Defina precios y disponibilidad por país en App Store Connect. Los precios base sugeridos coinciden con la web, pero son decisiones comerciales que debe confirmar en la tienda.

| Producto Apple | Plan | Duración | Referencia web USD |
|---|---|---|---|
| com.unomesa.basic.month | Basic | 1 mes | 25 |
| com.unomesa.basic.year | Basic | 1 año | 250 |
| com.unomesa.intermediate.month | Intermediate | 1 mes | 45 |
| com.unomesa.intermediate.year | Intermediate | 1 año | 450 |
| com.unomesa.advanced.month | Advanced | 1 mes | 55 |
| com.unomesa.advanced.year | Advanced | 1 año | 550 |

No configure una prueba introductoria adicional para estos productos si desea conservar únicamente la prueba de UnoMesa. Los productos deben tener sus traducciones, información de revisión y precios, y estar disponibles para pruebas/venta según la etapa.

En Users and Access → Integrations → In-App Purchase cree una clave de App Store Server API. Guarde el .p8 de forma segura. Configure en Vercel:

```text
APPLE_BILLING_ENABLED=true
APPLE_BILLING_MODE=test
APPLE_ISSUER_ID=<issuer UUID>
APPLE_KEY_ID=<key ID>
APPLE_PRIVATE_KEY=<contenido completo del archivo .p8>
APPLE_APP_ID=<Apple ID numérico de la app, necesario en live>
STORE_TEST_RESTAURANT_IDS=<UUID del restaurante de pruebas, separados por comas si hay varios>
```

`APPLE_PRIVATE_KEY` admite saltos de línea reales o `\n`. No use el ID del equipo como Issuer ID ni el bundle ID como Apple ID numérico.

Configure App Store Server Notifications **Version 2** (sandbox y producción, según la etapa) hacia:

`https://www.unomesa.com/api/billing/apple`

Pruebe la notificación de Apple y una compra sandbox. El servidor valida la firma con los certificados oficiales de Apple incluidos y consulta el estado actual mediante App Store Server API. El UUID `appAccountToken` lo genera UnoMesa; no se escribe manualmente en App Store Connect.

En Xcode abra UnoMesa.xcodeproj, conserve su Team y pruebe Build 16. StoreKit 2 se importa desde el SDK; no hay que instalar CocoaPods. Para cobros reales cambie `APPLE_BILLING_MODE=live`, compruebe `APPLE_APP_ID` y redeploy. Un servidor en modo live rechaza compras sandbox: para revisión/sandbox mantenga un entorno de pruebas configurado o el modo test hasta terminar la revisión. Los modos no se mezclan en una misma vinculación de restaurante.

## Google Play Console

App/package: **com.unomesa.android**. Complete el perfil de pagos y los requisitos de publicación de su cuenta.

Cree tres suscripciones, cada una con dos planes base de renovación automática:

| ID de suscripción Google | Plan base mensual | Plan base anual | Plan UnoMesa |
|---|---|---|---|
| unomesa_basic | monthly | annual | Basic |
| unomesa_intermediate | monthly | annual | Intermediate |
| unomesa_advanced | monthly | annual | Advanced |

Active los planes base en los países deseados y confirme sus precios. `monthly` dura 1 mes y `annual` 1 año. Esta implementación usa el precio regular del plan base; no ofertas introductorias ni planes prepagados. No vuelva a crear una prueba adicional.

Habilite Google Play Android Developer API en Google Cloud. Cree una cuenta de servicio, agréguela en los permisos de Play Console para esta app y concédale acceso para consultar compras/suscripciones y gestionar pedidos/suscripciones. Guarde su clave JSON únicamente en Vercel:

```text
GOOGLE_PLAY_BILLING_ENABLED=true
GOOGLE_PLAY_BILLING_MODE=test
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<JSON completo de la cuenta de servicio>
STORE_TEST_RESTAURANT_IDS=<UUID del restaurante de pruebas>
```

Configure Real-time Developer Notifications (RTDN):

1. Cree un tema Pub/Sub y permita al servicio `google-play-developer-notifications@system.gserviceaccount.com` publicar en ese tema.
2. Configure el nombre completo del tema en Play Console para esta app y envíe su notificación de prueba.
3. Cree una suscripción Pub/Sub push al endpoint `https://www.unomesa.com/api/billing/google-play`, con autenticación OIDC mediante una cuenta de servicio de push dedicada. Configure su audiencia explícita y los permisos de emisión de tokens indicados por Pub/Sub.
4. Configure las dos variables siguientes. El email es el de la cuenta que firma el push, no necesariamente la cuenta usada para Android Publisher API.

```text
GOOGLE_PLAY_PUSH_AUDIENCE=https://www.unomesa.com/api/billing/google-play
GOOGLE_PLAY_PUSH_SERVICE_ACCOUNT=<cuenta-de-push@proyecto.iam.gserviceaccount.com>
```

Use un tester de licencias de Play y la pista interna. El servidor exige que Google marque la compra como `testPurchase` en modo test. Un tester de la pista sin configuración de licencia puede recibir un cobro real: verifique que la hoja de Google muestre una compra de prueba antes de aceptarla.

Suba el AAB release firmado, conserve su keystore y aumente el versionCode en futuros envíos. Al activar producción, cambie `GOOGLE_PLAY_BILLING_MODE=live`, redeploy y utilice cuentas/restaurantes de producción nuevos para compras reales.

## Sincronización y comprobación

Las notificaciones firmadas actualizan el mismo plan en Supabase. El botón Actualizar estado consulta al proveedor original. Google se reconoce en el servidor después de guardar el acceso; Apple finaliza la transacción en el dispositivo después de la verificación del servidor. No se almacenan tarjetas en UnoMesa.

`vercel.json` agrega `/api/billing/store-reconcile` cada 5 minutos. Reutiliza `CRON_SECRET`. Recupera por lotes hasta 100 compras con comprobación pendiente de más de 6 horas; las notificaciones son el mecanismo principal. No equivale a verificar todos los clientes cada 5 minutos. Revise el cron, las entregas fallidas de Pub/Sub/Apple y el volumen al crecer. Las referencias de compra permanecen privadas en tablas sin acceso de usuarios normales.

Pruebas obligatorias antes de habilitar ventas:

- Cuenta web ya pagada: abre iOS/Android con su plan y mensaje de gestión web, sin otro botón de compra.
- Compra Apple: se activa el plan en iOS y se ve al iniciar sesión en web/Android. En web aparece Gestionar con Apple.
- Compra Google: se activa en Android y se ve en web/iOS. En web aparece Gestionar con Google Play.
- Cerrar la app durante el pago: verificar notificación y luego Restaurar compras si el pago no apareció.
- Cancelar renovación: conserva acceso hasta el vencimiento. Renovar actualiza la fecha; expiración/revocación retira el acceso pagado según el estado verificado.
- Pagar con aprobación pendiente: no concede acceso por adelantado ni solicita pagar otra vez.
- Intentar restaurar la compra en otro restaurante: debe rechazar la vinculación.
- Exentos e invitados: conservan acceso/permisos; solo el propietario gestiona pagos.
- Comprobar webhooks, restauración y actualización de estado en inglés y español.

## Alcance y límites de esta entrega

No se ejecutó SQL ni se desplegó nada en su producción desde esta entrega. No se crearon productos en sus tiendas, claves privadas, acuerdos ni cuentas bancarias. No se hicieron cobros reales. Estos pasos necesitan sus cuentas de Apple/Google.

Se conserva el proveedor elegido; el código no traslada suscripciones entre proveedores ni restaurantes. Incluso una compra iniciada y luego cancelada deja una vinculación para evitar cobros cruzados. Una migración de proveedor requiere revisar y cerrar la suscripción previa antes de cambiar esa vinculación mediante soporte.

En Apple, los cambios de producto dentro del grupo se gestionan en la pantalla de suscripciones de Apple. En esta primera integración de Google, la gestión permite revisar/cancelar/reanudar según lo que ofrezca Play; **no se implementó un selector de cambio de plan Google con prorrateo dentro de UnoMesa**. Después de vencer una suscripción se puede volver a contratar desde la tienda original. Los cambios de plan de Lemon Squeezy siguen disponibles en la web.

Cada compra queda asociada a un restaurante. Una cuenta de tienda con una suscripción vigente debe restaurarla en ese restaurante, no comprar de nuevo para otro. Los reembolsos siguen el procedimiento de la tienda y sus reglas; el servidor aplica el estado de acceso que esta confirme.

Validación realizada: compilación web de producción, TypeScript, pruebas de facturación y migración en PostgreSQL embebido, compilación Android debug/JUnit/lint y escenarios visuales móviles. La firma release y los pagos de Play requieren su keystore/productos. **iOS no se pudo compilar en este entorno Linux: falta comprobar Build 16 en Xcode y dispositivo/TestFlight.** No considere las ventas de las tiendas activadas hasta completar estas pruebas.

Referencias oficiales:
- Apple Server Library: https://github.com/apple/app-store-server-library-node
- StoreKit: https://developer.apple.com/documentation/storekit
- App Store Notifications: https://developer.apple.com/documentation/appstoreservernotifications
- Google Play Billing: https://developer.android.com/google/play/billing/integrate
- Google Play backend: https://developer.android.com/google/play/billing/backend
- Google Pub/Sub autenticado: https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
