# UnoMesa — Horarios, reservaciones y cotizaciones

## Instalación

1. En el proyecto Supabase que ya utiliza, ejecutar completo **39_VACACIONES_HORARIOS.sql** antes de desplegar este ZIP. Es incremental y reejecutable. No repetir la instalación base ni los SQL anteriores por esta entrega.
2. Descomprimir y actualizar el código en el proyecto Vercel existente, conservando las variables de entorno y el directorio raíz **MRMAA_PRUEBAS 26**.
3. Comprobar una asignación de Vacaciones, una copia por fechas y el listado de cotizaciones.

El nuevo SQL habilita `vacation` como tipo de horario y exige que no tenga turno ni horas de comida vinculados. No borra ni actualiza los datos existentes, no cambia políticas RLS y no modifica autenticación, pagos o exenciones. Si falta la instalación de Horarios, detiene la transacción sin aplicar cambios. Los otros ajustes de esta entrega no requieren SQL adicional.

## Áreas y cotizaciones

- Reservaciones utiliza el mismo selector de áreas de Cotizaciones: escribir para filtrar y botón Todas/All para abrir el catálogo completo con desplazamiento. Se guardan los mismos identificadores de áreas; no se crean áreas mediante texto libre.
- Cotizaciones abre por fecha de creación, más recientes primero. Los controles permiten elegir otro criterio y dirección.
- El contador discreto, a la derecha, indica todas las cotizaciones guardadas del restaurante, incluidas las convertidas. Excluye la papelera y no cambia con la búsqueda ni la página. Se actualiza al refrescar o guardar cambios. Si no puede consultarse muestra No disponible/Unavailable, no un cero inventado.

## Vacaciones

- En Horarios → Tipo de asignación, elegir Vacaciones/Vacation. Puede aplicarse a uno o varios empleados, una fecha o un rango.
- No requiere turno ni comida y no suma horas de trabajo programadas. No es una función de nómina ni un cálculo de saldo de vacaciones.
- Calendario: VAC, color lavanda automático o el color elegido. La descripción completa aparece en la casilla y en los archivos de horarios PDF, impresión y Excel.
- Se pueden editar las fechas desde las casillas existentes, conservando notas y colores.
- Generar automáticamente no repite vacaciones. Copiar mes anterior omite vacaciones de origen y conserva las vacaciones ya asignadas en destino.

## Copiar por fechas

- Botón junto a Copiar mes anterior. Elegir origen desde/hasta y destino desde; el fin del destino se calcula con la misma cantidad de días.
- Elegir empleados individualmente, buscar por nombre/ID/área o filtrar un área y pulsar Seleccionar visibles. Cambiar el área limpia la selección; la búsqueda conserva las selecciones y el contador permite revisarlas.
- Revisar copia muestra cuántas asignaciones se crearán, cuántas fechas ocupadas se conservarán y cuántos días de vacaciones se omitirán. Confirmar copia realiza la operación.
- Cada empleado conserva su propio horario de origen: turno, área de la asignación, notas, comidas y color. No transfiere el horario de un empleado a otro.
- Las fechas sin asignación de origen quedan vacías. Las fechas de destino ya ocupadas se conservan, incluso si otro usuario las guarda después de la vista previa. Volver a copiar el mismo rango no duplica asignaciones.
- Se admiten períodos de hasta 366 días, con un máximo de 5000 días de empleado por operación. Solo los roles con permiso para modificar Horarios pueden copiar.

## Copiar mes anterior

Antes de copiar, el aviso muestra mes de origen, mes de destino seleccionado y que afecta a TODOS los empleados activos con horarios en el mes anterior. Puede reemplazar asignaciones existentes en fechas coincidentes, excepto vacaciones. Omite los días que no existen en el mes de destino. Cancelar no guarda cambios.

La nueva copia por fechas es distinta: conserva todas las fechas ocupadas.

## Generar automáticamente

Busca la primera fecha del mes seleccionado que tenga una asignación pendiente para algún empleado activo. Usa los **15 días calendario inmediatamente anteriores** como patrón y completa las fechas vacías desde ese día hasta fin del mismo mes, repitiendo en orden el patrón propio de cada empleado. Una fecha vacía no se interpreta como descanso: los descansos y permisos deben estar asignados explícitamente.

- Mes de octubre vacío: origen del **16 al 30 de septiembre**, destino del **1 al 31 de octubre**.
- Septiembre completo hasta el día 27: origen del **13 al 27 de septiembre**, destino del **28 al 30 de septiembre**.
- Febrero y los cambios de año se calculan según el calendario, incluidos años bisiestos.
- La búsqueda del calendario y la selección del formulario no limitan esta acción. Se revisan todos los empleados activos; los que ya tienen el mes completo no necesitan un patrón ni reciben cambios.
- Si a un empleado con fechas pendientes le falta algún día del patrón, indica el período y los empleados que deben completarlo. No genera parcialmente ni inventa turnos.

Antes de guardar, pide confirmación con las fechas exactas de origen y destino, el número de empleados con fechas pendientes y el total por crear. Cancelar no guarda cambios. Las fechas ya asignadas se conservan, incluso si otro usuario las guarda después de abrir el aviso. No repite vacaciones. El resultado cuenta únicamente las asignaciones realmente creadas. El aviso está disponible en español e inglés.

Este ajuste no necesita SQL adicional; si ya aplicó **39_VACACIONES_HORARIOS.sql**, no necesita ejecutarlo otra vez.

## Empleados activos e inactivos

En Configuración → Horarios → Empleados, pulse Editar, elija **Activo / Inactivo** y guarde los cambios. El listado muestra el estado y permite filtrar todos, activos o inactivos. Puede reactivar al mismo empleado desde ahí.

- Inactivo queda fuera del calendario de programación, la selección de empleados, Generar automáticamente y las copias de horarios. Copiar mes anterior también respeta el estado activo.
- Cambia únicamente la ficha existente del empleado; conserva su identificador y todos los horarios guardados. No elimina fechas anteriores ni asignaciones futuras ya guardadas.
- Reportes conserva al empleado y calcula sus horarios según el rango elegido, incluyendo el historial de inactivos. No se cambian los cálculos de horas ni los turnos con texto.
- La opción usa la columna `v2_employees.active` que ya existe. No necesita SQL adicional ni modifica cuentas de acceso o invitaciones.

## Alcance y comprobaciones

Se conservan los archivos previos de autenticación, CAPTCHA, facturación, analíticas, precios y datos de negocio. El ZIP no ejecuta SQL ni publica cambios automáticamente.

Verificación local: compilación de producción y TypeScript; selector de áreas en móvil/escritorio, español/inglés, claro/oscuro; orden y contador de cotizaciones con paginación, filtros, errores y cambio de restaurante; SQL incremental en PostgreSQL embebido con registros previos, restricciones y RLS; asignaciones, copias, confirmación, exclusión de vacaciones y exportaciones de horarios con respuestas de prueba. La instalación y las operaciones reales de producción quedan por comprobar tras el despliegue.

Comprobaciones de esta ampliación: generación con patrón móvil de 15 días, meses completos y últimos tres días, febrero bisiesto y cambios de año; confirmación/cancelación en español e inglés; activación/desactivación y filtros; conservación del historial en la definición SQL anterior de reportes. Se probaron con datos locales de ejemplo.
