# Planes visibles para todas las cuentas

Esta actualización permite consultar los planes de Apple y Google en la sección
Suscripción de las apps, sin registrar el UUID de cada restaurante ni configurar
credenciales de servidor para consultar precios. La app consulta directamente la
tienda y muestra únicamente los productos y precios que esta devuelve.

También pueden consultarlos las cuentas con acceso ilimitado, los miembros del
equipo y los clientes que pagaron en otra plataforma. Contratar o cambiar un plan
sigue reservado al propietario; las cuentas exentas conservan su acceso y los
clientes con suscripción existente la gestionan en su proveedor original.

Se agrega «Volver a cargar planes» cuando la tienda no responde o no devuelve
productos. No hace falta restaurar compras ni cerrar la app para reintentar.

## Instalar

1. Actualizar el proyecto web de Vercel con este ZIP y desplegarlo, conservando
   las variables existentes.
2. Cerrar y abrir UnoMesa en TestFlight o Android para cargar la web actualizada.
   Las apps que ya incluyen la integración de compras son compatibles: este
   cambio no requiere generar otro build nativo.
3. Entrar en Configuración → Suscripción. Si la tienda no devuelve productos,
   revisar sus IDs, precios y disponibilidad; el ZIP no activa productos en
   App Store Connect ni Google Play Console.

No hay SQL nuevo. No es necesario volver a ejecutar ninguna migración para este
cambio. Consultar el catálogo no actualiza planes, vencimientos, reservas,
cotizaciones, clientes ni sucursales.

## Compras y pruebas

Ver planes y comprar son operaciones independientes. Las variables de credenciales
y `APPLE_BILLING_ENABLED` / `GOOGLE_PLAY_BILLING_ENABLED` siguen siendo necesarias
para verificar compras. Los precios y la confirmación de compra proceden de la
tienda; esta actualización no habilita cobros por sí sola.

En modo `live`, cualquier propietario elegible puede contratar sin una lista de
UUID. Se conservan las protecciones de titularidad, exenciones y proveedor previo.

TestFlight usa compras sandbox. Con `APPLE_BILLING_MODE=test`, todos pueden ver
planes, pero solo los restaurantes de prueba autorizados en
`STORE_TEST_RESTAURANT_IDS` pueden completar operaciones que actualicen su plan.
Esta lista NO crea una copia de los datos. Nunca incluir el restaurante de uso
real para probar pagos. El mismo límite se mantiene para compras Google de prueba.

Por tanto, puede dejarse la lista vacía para consultar planes y obtener capturas
sin compras. Para probar la compra completa se necesita un restaurante ficticio
separado. Cambiar a `live` no convierte las transacciones de TestFlight en reales.

No se han desplegado estos archivos en Vercel ni se ha accedido o modificado la
base de datos de producción al preparar esta entrega.

## Validación de la entrega

83 pruebas automatizadas de catálogo, restricciones de compra, gestión por
proveedor, verificación de recibos, restauración y paquetes multisucursal pasan.
También pasan TypeScript y la compilación web de producción. Las pruebas de
catálogo simulan las respuestas de las tiendas: la disponibilidad efectiva de
los productos debe comprobarse en el dispositivo. No se realizó ninguna compra
en Apple o Google durante esta validación.
