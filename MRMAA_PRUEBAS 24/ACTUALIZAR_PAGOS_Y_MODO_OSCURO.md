# Actualización del 24 de septiembre de 2026

Incluye todas las funciones del ZIP anterior, SQL 33 y SQL 34.

## Qué cambia

- La pantalla de suscripción actualiza su estado al regresar tanto del pago como del recibo, al volver a la pestaña y con el botón «Actualizar estado».
- Consulta durante un plazo limitado si la confirmación tarda en llegar. El dashboard recibe los cambios verificados de plan, periodo y estado.
- Si el regreso del pago sigue pendiente, muestra una advertencia para evitar pagar otra vez. Una URL de éxito jamás activa una suscripción por sí sola.
- Presenta «Plan actual» cuando la cuenta tiene una suscripción activa.
- Corrige contraste de botones de filtros, fechas, paginación, periodicidad, calendario y acciones en modo oscuro, incluidos selección, foco y deshabilitado. Conserva los colores personalizados de turnos y los documentos de impresión/PDF.
- Registra referencias de diagnóstico del webhook sin guardar claves, correos ni datos de tarjeta en los logs.

## Despliegue

Descomprima el ZIP y suba la carpeta completa `MRMAA_PRUEBAS 24` por GitHub Desktop (Commit y Push). Use exactamente `MRMAA_PRUEBAS 24` como Root Directory en Vercel y despliegue esa versión.

Esta actualización NO necesita una migración SQL nueva. Si ya aplicó los SQL 33 y 34, no tiene que repetirlos. `DIAGNOSTICO_PAGO.sql` es una consulta opcional de solo lectura.

## Compra cobrada que todavía aparece en prueba

La revisión del código no permite confirmar lo ocurrido con una compra real sin su evento. Primero revise Lemon Squeezy → Settings → Webhooks, en el mismo modo en que se hizo el cobro (Live para pagos reales; Test para simulados).

- URL del receptor de MRMAA: `https://mrmaa.com/api/billing/webhook`.
- Signing secret: debe coincidir exactamente con `LEMON_SQUEEZY_WEBHOOK_SECRET` de Production en Vercel. No envíe la clave en capturas ni mensajes.
- Debe recibir `subscription_created`, `subscription_updated`, `subscription_payment_success` y los eventos del ciclo de vida configurados en la integración. El código también procesa cancelación, reanudación, expiración, pausa, reactivación, pago fallido, pago recuperado y reembolsos.
- Los webhooks de Test y Live son independientes. Que funcione el cobro Live no comprueba que exista el webhook Live.
- Abra la entrega `subscription_created` correspondiente a esa compra y revise su respuesta. Conserve el código HTTP y el mensaje de respuesta. Un 200 con `ignored: true` / `UNBOUND_EVENT` NO significa que se haya activado una cuenta.
- Tras corregir la configuración o desplegar una corrección comprobada, reenvíe el mismo evento con Resend. No haga otra compra para activar la que ya fue pagada.

Si aparece una referencia, búsquela en Vercel → Logs con `mrmaa.billing.webhook`. Comparta únicamente referencia, `code`, `stage`, `database_code` y `provider_status` si están disponibles.

Códigos de diagnóstico:

| Código o etapa | Qué revisar |
| --- | --- |
| WEBHOOK_SECRET_MISSING | Falta la variable secreta del webhook en el despliegue. |
| WEBHOOK_SIGNATURE_INVALID | El secreto de Lemon y el de Vercel no coinciden, o la firma no es válida. |
| WEBHOOK_MODE_MISMATCH | El evento pertenece a otro modo de pagos. |
| UNBOUND_EVENT | No se encontró el vínculo con un checkout de MRMAA; no se asigna por correo automáticamente. |
| checkout_binding / subscription_binding | Revisar el vínculo exacto con el checkout, restaurante y suscripción. |
| payment_resources / price / invoice / order | Revisar el estado verificado del proveedor y la referencia del error. |
| apply_subscription | Revisar el error de Supabase indicado en `database_code`. |

No cambie manualmente el plan a «activo» como solución: falta verificar la suscripción, el periodo pagado y su vínculo con el restaurante. Las cuentas del piloto conservan su exención.

Referencias: https://docs.lemonsqueezy.com/help/webhooks y https://docs.lemonsqueezy.com/help/webhooks/simulate-webhook-events
