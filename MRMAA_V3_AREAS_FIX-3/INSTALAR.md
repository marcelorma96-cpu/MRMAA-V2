# Productos para Gerente y Operación

- Gerente y Operación pueden agregar y editar el nombre, la descripción y el precio de menús y productos.
- Solo el Administrador puede eliminarlos.
- Esta corrección funciona mediante validación segura del servidor y no requiere ejecutar un SQL adicional.

# Invitaciones de un solo uso

1. Antes de desplegar, ejecute una sola vez `SUPABASE_INVITACIONES_UN_SOLO_USO.sql` completo en Supabase → SQL Editor.
2. Después ejecute una sola vez `SUPABASE_BLOQUEAR_ALTA_AUTOMATICA.sql` completo.
3. Despliegue esta versión manteniendo **Root Directory** en `MRMAA_V3_AREAS_FIX`.
4. Las invitaciones pendientes anteriores quedan invalidadas. Desde Configuración → Usuarios, use **Reenviar invitación** para entregarles un enlace nuevo.
5. Cada enlace nuevo funciona una sola vez: queda invalidado al crear la contraseña, al reenviarlo o al eliminar al usuario.
6. Una cuenta eliminada o sin membresía activa ya no puede crear un restaurante ni entrar al sistema.

# Compatibilidad PDF Windows y acceso a productos por rol

1. Ejecute una sola vez `SUPABASE_PRODUCTOS_ROLES.sql` completo en Supabase → SQL Editor.
2. Después despliegue esta versión. En Vercel mantenga **Root Directory** en `MRMAA_V3_AREAS_FIX`.
3. El SQL permite a Gerente y Operación agregar o modificar menús y productos; eliminar continúa reservado al administrador.
4. La generación del PDF ahora utiliza medidas fijas e independientes del sistema operativo, zoom y tamaño de la ventana.

# Historial de exportaciones e impresiones

1. Ejecute una sola vez `SUPABASE_HISTORIAL_EXPORTACIONES.sql` completo en Supabase → SQL Editor.
2. Después despliegue esta versión. En Vercel mantenga **Root Directory** en `MRMAA_V3_AREAS_FIX`.
3. Desde ese momento, el Historial de cambios registrará las descargas de Excel y las impresiones con usuario, rol, sección, fecha y hora.

# Corrección de PDF y mensajes de error

- Si ya ejecutó `SUPABASE_CONVERSION_RESERVAS.sql` de la entrega anterior, esta actualización no requiere ejecutar SQL adicional.
- Esta entrega corrige la paginación de las cotizaciones y evita mostrar errores técnicos de Supabase o PostgreSQL al usuario.
- En Vercel mantenga **Root Directory** en `MRMAA_V3_AREAS_FIX`.

# Actualización sobre MRMAA V3 existente

1. Si ya ejecutó SUPABASE_AREAS_AVISOS.sql, NO lo repita. Si todavía no lo ejecutó, ejecútelo primero.
2. Ejecute completo SUPABASE_AREAS_INDEPENDIENTES.sql en el SQL Editor de Supabase.
3. Suba esta carpeta descomprimida a GitHub. En Vercel use Root Directory MRMAA_V3_AREAS_FIX y despliegue ese commit.
4. En Configuración → Reservaciones cree sus áreas. El catálogo empieza vacío; Horarios conserva las suyas. Use Editar para cambiar nombres.

Los textos de áreas de reservas y cotizaciones anteriores se conservan. Al agregar un área, los históricos que coinciden por nombre se vinculan al catálogo nuevo. Los nombres no reconocidos requieren seleccionar un área del listado al editar. El aviso conserva el intervalo de hasta tres horas, mismo día y área.

El buscador de áreas solo filtra, no crea nombres nuevos. Las cotizaciones pueden permanecer sin área hasta que se conviertan en reservación.
La papelera permite buscar por cliente, número de cotización, fecha o tipo entre los registros cargados.
Este ZIP contiene la aplicación, configuración e instrucciones necesarias para esta actualización; no es un instalador de una base vacía.
