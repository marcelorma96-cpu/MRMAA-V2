# Actualización de áreas, consejos y aviso de tres horas

Sobre su instalación V3 actual:
Este paquete conserva la aplicación y la migración de esta actualización.
Omite pruebas, herramientas de desarrollo y SQL históricos ya aplicados;
no es un instalador para una base de datos vacía.

1. Con respaldo reciente, ejecutar completo SUPABASE_AREAS_AVISOS.sql en el
   SQL Editor del mismo proyecto Supabase que utiliza MRMAA. Primero probar
   en una copia si hay un histórico grande: la asociación inicial actualiza
   las filas que coinciden. No ejecutar nuevamente los SQL anteriores.
2. Subir los archivos de este ZIP descomprimidos a GitHub y desplegar el
   commit nuevo con la carpeta correcta en Root Directory de Vercel.
3. Revisar Configuración → Reservaciones → Áreas. Usa el catálogo existente
   de Horarios; no necesita duplicar las áreas ya creadas.
4. Probar dos reservas del mismo día y área a las 12:00 y 15:00. Debe avisar.
   A las 15:01 no debe avisar respecto de las 12:00. Cancelar con Revisar
   no guarda; Guardar de todos modos continúa. Una edición no se compara consigo misma.

Los nombres históricos se asocian solo cuando coinciden de forma inequívoca,
ignorando mayúsculas, espacios y acentos latinos comunes. Los nombres no
reconocidos se conservan; al editar, seleccionar un área válida. Antes de
operar revisar duplicados de áreas y nombres antiguos. No se fusionan ni
eliminan automáticamente. Las nuevas selecciones guardan el ID del área.

Al crear/editar una reserva se exige área, fecha y hora. La cotización puede
quedar sin área mientras se prepara; para convertirla es necesario seleccionarla
y tener fecha/hora. Se consulta el servidor, no solo la página visible.
El aviso excluye eliminadas y canceladas y muestra hasta diez coincidencias
con aviso si existen más. No calcula duración, aforo ni disponibilidad de mesas.
Es una advertencia previa, no un bloqueo transaccional: dos personas pueden
guardar simultáneamente tras revisar el mismo estado.

Excel mantiene la importación por lotes sin confirmaciones por fila. El SQL
asocia nombres reconocidos al catálogo; no pretende evaluar todos los cruces
de un archivo ni descarta nombres históricos no reconocidos.

Incluye Consejos debajo de Tutorial, selector de áreas con búsqueda para
reservas y cotizaciones y los cambios anteriores de contraseñas y sesión.
Validación: 158 pruebas aprobadas, incluidas consultas de aviso bajo RLS.
