# Actualización de sesiones — 23 septiembre 2026

Para el piloto que ya tiene aplicados los SQL 02, 03, 06 y 07 del paquete del piloto:

1. Ejecute completo **MRMAA_SESIONES_VIGENTES.sql** en el SQL Editor de su Supabase. Es idéntico a **33_SESIONES_VIGENTES.sql** incluido aquí. Ejecute solo uno de los dos.
2. Despliegue este ZIP actualizado en el mismo proyecto Vercel.
3. Recargue MRMAA en los navegadores que lo tengan abierto. Las sesiones antiguas vencidas pedirán iniciar sesión de nuevo.
4. En Configuración → Seguridad, compruebe Mis sesiones y Equipo del restaurante. Cierre una sesión e ingrese nuevamente: la cerrada no debe aparecer.

No vuelva a ejecutar las migraciones base. No necesita nuevas variables de entorno ni cambiar ajustes de Supabase Auth. Para una instalación nueva, aplique 33 después de las migraciones anteriores; requiere las funciones de sesiones de 29.

## Comportamiento

- La lista muestra sesiones con acceso vigente a MRMAA y se actualiza cada minuto o al volver a la pestaña.
- Una hora sin actividad en MRMAA vence la sesión también en el servidor. Las comprobaciones automáticas no cuentan como actividad del usuario.
- Cerrar sesión termina ese acceso; las otras sesiones vigentes permanecen. Cerrar mis demás sesiones mantiene su función separada.
- Al volver a ingresar se crea un acceso nuevo. La sesión cerrada o vencida no se acumula en la lista.
- Una pestaña cerrada sin pulsar Cerrar sesión puede seguir apareciendo hasta que venza su plazo, como máximo una hora desde la actividad comunicada al servidor. Si no hay conexión, el cierre local se completa y la caducidad del servidor limita el acceso pendiente.
- Dos sesiones que todavía tengan acceso se muestran por separado, aunque ambas digan Safari o Edge. El nombre del navegador no identifica una computadora de forma única.
- El administrador principal conserva acceso a las sesiones de sus invitados activos; los invitados solo ven y cierran las suyas.

El SQL no modifica ni elimina restaurantes, clientes, reservas, cotizaciones, miembros, pagos o exenciones del piloto. Añade un plazo a los registros técnicos de sesión y actualiza sus funciones. No borra usuarios de Authentication. Puede ejecutarse nuevamente sin reiniciar plazos ni reactivar sesiones cerradas.

La caducidad se aplica a los accesos de MRMAA. No intenta borrar información ya mostrada o descargada.

## Verificación local

Se probaron caducidad, reingreso, cierre manual, fallos de conexión, permisos del propietario/invitados, paginación y conservación de datos del piloto. La validación de TypeScript pasó. No se aplicó esta actualización al proyecto de producción desde esta entrega.
