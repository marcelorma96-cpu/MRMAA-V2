# MRMAA · Avisos de vencimiento · PRUEBAS 26

## Instalar
1. En Supabase → SQL Editor ejecute completo `36_AVISOS_VENCIMIENTO.sql`.
2. El SQL 35 de pagos Live también está incluido; si ya lo aplicó no necesita repetirlo.
3. Suba la carpeta completa `MRMAA_PRUEBAS 26` mediante GitHub Desktop (Commit y Push).
4. Configure el Root Directory de Vercel como `MRMAA_PRUEBAS 26` y despliegue.
5. En Production conserve `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` (https://mrmaa.com), las variables de Supabase y el SMTP existente: `MRMAA_SMTP_HOST`, `MRMAA_SMTP_PORT` (465 o 587), `MRMAA_SMTP_USER`, `MRMAA_SMTP_PASSWORD`, `MRMAA_SMTP_FROM`. No comparta contraseñas. La configuración SMTP en Supabase Authentication por sí sola no configura estos correos de la aplicación.
6. Compruebe en Vercel que la tarea `/api/billing/reminders` esté programada cada 5 minutos. Esta frecuencia requiere un plan de Vercel que permita cron frecuente. Se conserva la tarea de mantenimiento anterior sin cambios.

## Comportamiento
- Dashboard: aviso persistente durante los últimos 7 días del período pagado si la renovación está cancelada; mayor énfasis en los últimos 3 días. Fecha/hora según el dispositivo. El administrador principal puede abrir Gestionar suscripción; los invitados ven que deben contactar al administrador.
- Correos al administrador principal con email confirmado, en el idioma ES/EN del restaurante. Se intentan cuando quedan entre 6 y 7 días, entre 2 y 3 días, y durante el último día; la hora exacta depende de la tarea programada. No se acumulan avisos atrasados fuera de esas ventanas.
- El correo incluye la fecha exacta en UTC y un enlace a MRMAA que requiere iniciar sesión; desde allí se abre Gestionar suscripción. Nunca incluye tokens de acceso ni enlaces privados del proveedor.
- Se comprueba nuevamente la cancelación, fecha, propietario y exención justo antes del envío. No se envían recordatorios a cuentas exentas, suspendidas o eliminadas, ni después del vencimiento. Una reactivación concurrente durante el envío todavía puede cruzarse con un aviso; el texto indica revisar el estado actual.
- Un registro único por restaurante, fecha de vencimiento y aviso evita duplicados entre ejecuciones simultáneas. SMTP no ofrece entrega exactamente una vez: una interrupción después de reservar el aviso puede dejarlo sin entregar. Para evitar duplicados, los estados failed/sending no se reenvían automáticamente. El aviso del dashboard sigue disponible.
- La tarea procesa hasta 20 correos por ejecución dentro de su presupuesto de tiempo. Responde 503 y registra un error sin datos personales si falla. Un éxito de SMTP no garantiza recepción en la bandeja de entrada.

## Verificación y diagnóstico
Vercel → Logs → `/api/billing/reminders`: la respuesta muestra sent, failed y skipped. Si aparece REMINDER_CONFIG_MISSING revise variables; si aparece REMINDER_FAILED revise que SQL 36 esté instalado y el SMTP sea accesible.

Consulta de solo lectura para detectar avisos con entrega pendiente de revisión:
```sql
select restaurant_id, paid_until, days_before, status, attempted_at, finished_at
from public.v2_expiry_notices
where status='failed' or (status='sending' and attempted_at<now()-interval '15 minutes')
order by attempted_at desc;
```
Antes de cualquier reenvío manual debe confirmarse en el proveedor SMTP si se aceptó el mensaje. No borre registros para forzar reenvíos indiscriminados.

No se modificaron los registros de reservas, clientes, cotizaciones, usuarios ni las exenciones del piloto. No se altera la lógica de cobros o bloqueo por vencimiento. SQL 36 agrega únicamente el registro privado y las funciones de avisos. Probado localmente con PostgreSQL embebido y SMTP simulado; falta verificar la ejecución y entrega en su producción después del despliegue.
