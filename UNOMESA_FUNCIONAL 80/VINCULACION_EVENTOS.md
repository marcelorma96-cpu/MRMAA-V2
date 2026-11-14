# Vinculación y datos del evento

## Instalación

Con los SQL anteriores hasta el 61 instalados, ejecute `66_VINCULACION_REVISADA.sql` en el mismo proyecto Supabase y después publique esta versión web en Vercel. El SQL solo instala funciones y permisos; es repetible y no modifica datos al instalarse. Si una pestaña estaba abierta con la versión anterior, actualícela antes de vincular.

## Uso

En Cotizaciones elija **Vincular a reservación**. Aparecen las reservas de esta
sucursal sin cotización y fuera de papelera, incluidas canceladas y fechas pasadas,
con cualquier cantidad de invitados. Busque por cliente/teléfono/área o elija una
fecha opcional. Hay 50 por página; Siguiente recorre el resto.

En Reservaciones, listado del plano y agenda, **Vincular a cotización** aparece
cuando la reserva no tiene una. El selector muestra 25 cotizaciones por página,
de cualquier estado, excluyendo las que ya tienen relación con una reserva.

Pulse **Revisar vínculo** para comparar **Actual / Al vincular**. Puede volver, elegir otro documento o cancelar sin guardar. **Confirmar vínculo** guarda ambas partes en una sola operación. Si los datos cambiaron en otra computadora después de la revisión, se pedirá otra comparación. La cotización pasa a
Convertida y la reserva a Confirmada, incluso si estaba cancelada. Conserva el
ID de esa reserva, sin crear una segunda. Los vínculos existentes, también los
que están en papelera, no se pueden tomar para otro evento. Solo se permiten
registros de la misma sucursal y usuarios con permiso de operación.

## La cotización actualiza la reserva

Se copian cliente registrado, nombre, teléfono, fecha, hora, área, invitados,
menú resumido con cantidades, subtotal, descuento, propina, total, anticipo,
método de pago, saldo y notas internas. El correo permanece en cliente/cotización.
Los documentos conservan sus identificadores. Los campos exclusivos de una
cotización (por ejemplo, nota para el cliente y campos personalizados) permanecen
en ese documento: no se crean columnas nuevas en reservas.

Una cotización con ubicación especificada aporta su ubicación y duración. Una cotización sin área ni mesas conserva la asignación y duración de la reserva; el área se refleja también en la cotización. Si no especifica hora, se conserva la hora de la reserva. Las áreas de catálogo pueden estar sin mesas dibujadas. Al vincular, los cruces de horario y asientos adicionales mantienen sus confirmaciones. Un error revierte toda la operación.

Guardar después una cotización vinculada vuelve a actualizar los datos y mesas
de su reserva. No reactiva por sí solo una reserva cancelada. La edición de una
reserva conserva las reglas previas de campos compartidos hacia la cotización;
sus importes/notas propios no cambian los de la cotización. Un guardado posterior
de la cotización vuelve a copiar sus valores a la reserva.

La interfaz actualiza reservas, cotizaciones y plano con el mecanismo de
sincronización existente. El instructivo, tutorial y referencia que recupera
UnoMesa Asistente incluyen estas reglas. No se requiere recompilar iOS/Android
actuales; sí publicar la web y reabrir la app.

## Comprobaciones

Pruebas automatizadas con PostgreSQL embebido y contratos de las funciones base:
instalación repetida sin cambios a filas, permisos, sucursales separadas, vínculos
duplicados, paginación completa, copia de datos al vincular y editar, mesas,
conflictos, capacidad y reversión completa ante error. Las funciones base
instaladas en producción no están todas incluidas en este proyecto; las pruebas
usan sus contratos modelados y no sustituyen una comprobación de la base real.
No se ha desplegado ni probado en un iPhone/Android físico desde aquí.
