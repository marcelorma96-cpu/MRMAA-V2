# Vinculación y datos del evento

## Instalación

Ejecute solo `60_VINCULAR_RESERVAS_COTIZACIONES.sql` si tiene instaladas las
actualizaciones anteriores. Depende del plano 43–47. Después publique el proyecto
completo en el Vercel y Supabase actuales, conservando variables y conexiones.
No se ha ejecutado en producción desde esta entrega.

SQL 60 añade funciones de búsqueda/vinculación y una función privada para copiar
datos. Actualiza `v2_floor_save_quote` conservando los escritores de cotizaciones
instalados, numeración, partidas, deduplicación de solicitudes y comprobaciones
del plano. No altera tablas, políticas, permisos de negocio, suscripciones,
exenciones ni filas al instalar. Puede repetirse sin modificar datos guardados.

## Uso

En Cotizaciones elija **Vincular a reservación**. Aparecen las reservas de esta
sucursal sin cotización y fuera de papelera, incluidas canceladas y fechas pasadas,
con cualquier cantidad de invitados. Busque por cliente/teléfono/área o elija una
fecha opcional. Hay 50 por página; Siguiente recorre el resto.

En Reservaciones, listado del plano y agenda, **Vincular a cotización** aparece
cuando la reserva no tiene una. El selector muestra 25 cotizaciones por página,
de cualquier estado, excluyendo las que ya tienen relación con una reserva.

Revise el evento y pulse **Vincular y confirmar reserva**. La cotización pasa a
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

Las mesas y duración propuestas en la cotización reemplazan la asignación previa
de la reserva. Una selección vacía elimina sus mesas anteriores; si queda solo
un área, el plano la muestra como Área completa mediante la proyección existente.
Sin área ni mesas queda sin asignación. La propuesta se comprueba con el plano
actual y la fecha/hora/personas de la cotización. Cruces y asientos adicionales
requieren la confirmación existente; un error revierte toda la operación.

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
