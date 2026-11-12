# UnoMesa · Google Play Multiple Locations

Entrega del 27 de octubre de 2026. Coincide con los identificadores mostrados en Play Console.

| Producto Google | Plan base | Renovación | Capacidad total |
|---|---|---|---:|
| `multiple_locations` | `2-branches` | Mensual automática | 2 locales |
| `multiple_locations` | `3-branches` | Mensual automática | 3 locales |
| `multiple_locations` | `4-branches` | Mensual automática | 4 locales |
| `multiple_locations` | `5-branches` | Mensual automática | 5 locales |

La principal está incluida: 2 locales = principal + 1 sucursal. Estos paquetes otorgan Advanced. No se agrega multisucursal anual. Basic, Intermediate y Advanced mantienen sus productos `unomesa_basic`, `unomesa_intermediate` y `unomesa_advanced`, cada uno con `monthly` y `anual`: 4 productos y 10 planes base activos en total en la configuración mostrada.

El ID anual confirmado en las capturas es `anual` (una sola n). El plan base extra `unomesa-intermediate` inactivo dentro de Basic no se ofrece ni se utiliza. Se admite `annual` únicamente como alias de verificación de compras anteriores, si existieran.

Los precios y países se administran en Play Console. La app muestra el precio que devuelve Google; esta entrega no modifica importes ni disponibilidad. No hace falta recrear los cuatro planes que ya aparecen activos. El CSV incluye paquetes de 6–95 como referencia futura con sus IDs anteriores; esta entrega no los crea ni activa en la tienda. Los recibos anteriores `unomesa_branches_2` a `unomesa_branches_5` con base `monthly` siguen siendo verificables, sin ofrecer productos duplicados a nuevas compras.

## Instalación

1. Actualice el proyecto web en Vercel con `UNOMESA_FUNCIONAL.zip`, conservando sus variables de entorno y configuración. Los cambios de Resubscribe y Horarios de la entrega anterior ya están integrados.
2. Abra `UnoMesa-Android` en Android Studio. Este proyecto es **1.0.7, versionCode 8** y agrega soporte nativo para `multiple_locations`. Genere un AAB release firmado con su keystore actual y súbalo primero a la pista de pruebas. Si su cuenta ya contiene un versionCode 8 o mayor, use un número superior. Conserve `com.unomesa.android`.
3. Instale esa actualización de Android desde Play. La versión anterior no reconoce el nuevo ID; actualizar solo Vercel no agrega ese soporte nativo.
4. iOS mantiene sus IDs Apple y su código nativo **1.0 (build 21)**. Se entrega el proyecto completo con instrucciones actualizadas; este ajuste de Google no requiere subir otro build iOS. Los cambios web se reciben desde `https://www.unomesa.com/mobile`.
5. Complete las credenciales de verificación y RTDN descritas en `SUSCRIPCIONES_MIXTAS_CONFIGURACION.md`. Antes de ofrecer compras reales, pruebe con un tester de licencias y confirme que la hoja de pago indique una compra de prueba.

**No requiere SQL nuevo. No vuelva a ejecutar migraciones antiguas por esta entrega.** No se ha desplegado ni accedido a su base de producción. Reservas, cotizaciones, clientes, horarios y sucursales guardados se conservan. Los SQL incluidos en el proyecto completo son los existentes, sin modificaciones.

## Ampliar y reducir el paquete

- Ampliar dentro de `multiple_locations`: Google cobra el nuevo paquete con `CHARGE_FULL_PRICE`, aplicando sus reglas para el tiempo restante. UnoMesa concede la capacidad después de verificar la compra.
- Reducir dentro del mismo producto: Google no admite `DEFERRED` entre sus planes base. Se usa `WITHOUT_PRORATION`: la nueva capacidad se aplica al confirmar y el precio menor se cobra en la siguiente renovación. UnoMesa muestra una confirmación antes de abrir el pago; primero debe archivar los locales sobrantes. Archivar conserva sus registros.
- Reducir hacia otro producto: se conserva el reemplazo diferido existente. La capacidad sigue la compra verificada por Google.
- Elegir exactamente el mismo plan, periodicidad y capacidad no abre otra compra.
- Restaurar y recontratar tras vencer usan el producto y plan base verificados por Google para recuperar el mismo restaurante y la capacidad correcta. No reinician la prueba ni toman la cantidad enviada por el teléfono como prueba de pago.

`Resubscribe: Allow` se configura por plan base; una lista de productos activos por sí sola no demuestra esa opción. El código conserva el soporte de recuperación de la entrega anterior. Consulte `RESUBSCRIBE_GOOGLE_PLAY.md` para la prueba completa.

## Validación de esta entrega

- 79 pruebas de catálogo, preparación de compra, verificación, resuscripción, conciliación, gestión de suscripciones y SQL de facturación/sucursales: aprobadas. El transporte de Google se simula; las pruebas SQL usan PostgreSQL embebido, sin conectar a producción.
- 138 comprobaciones Java de productos, planes base y modos de reemplazo: aprobadas con Java 17.
- Compilación de producción web y revisión TypeScript: aprobadas.
- La compilación Android completa requiere Android Studio/SDK; no se generó ni firmó un AAB en este entorno. No se compiló iOS en Xcode y no se efectuaron compras en dispositivos.

En la pista de pruebas compruebe 2 → 5, 5 → 2 (archivando antes), rechazo del paquete ya contratado, Restaurar compras y cancelación/vencimiento/recontratación. Verifique también que un plan mensual/anual estándar siga mostrando su precio y proveedor correctos.

Referencia técnica: https://developer.android.com/google/play/billing/subscriptions
