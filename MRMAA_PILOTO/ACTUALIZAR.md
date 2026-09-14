# Actualizar MRMAA piloto

Preparado el 14 de septiembre de 2026 a partir del esquema exportado en `Supabase Snippet Untitled query.csv` y la última versión del proyecto nuevo. Este paquete contiene 83 archivos, incluyendo esta guía y un único SQL de actualización.

## Qué conserva y qué incorpora

`ACTUALIZAR_PILOTO.sql` es una migración para la base existente. Conserva las filas y columnas originales de clientes, reservaciones, cotizaciones, partidas, importes, anticipos, numeración, horarios, empleados, áreas, menús, miembros y configuración. No modifica archivos de Storage, logos, contraseñas ni cuentas de Auth. No reinicia fechas de prueba ni cambia el plan almacenado de los restaurantes existentes.

Añade cuatro tablas de registro/facturación, ocho columnas a restaurantes, funciones para reportes y guardado de cotizaciones, índices y controles de acceso. Sustituye las funciones que requieren la actualización. Los valores predeterminados para futuras cuentas pasan a una prueba de cinco días y control de suscripción; las fechas y valores de las cuentas existentes se conservan.

El único cambio explícito sobre registros existentes es la excepción de cobro del restaurante cuyo propietario verificado es `marcelorma96@gmail.com`. Ese restaurante obtiene acceso funcional Advanced gratuito y sin vencimiento para sus miembros actuales y futuros. Los roles siguen determinando qué puede hacer cada persona. No hay que cambiar los correos ni convertir a todos en administradores. Las nuevas cuentas independientes mantienen sus planes habituales.

El código incorpora las últimas correcciones de ingreso, historial del navegador, vista previa móvil y PDF, los avisos de áreas obligatorias y menús opcionales, y las mejoras anteriores del proyecto nuevo. Conserva los permisos del piloto para que los gerentes agreguen áreas y menús.

Actualización de Horarios e impresión: la búsqueda principal encuentra empleados, códigos y áreas; una guía visual explica que los horarios asignados pueden arrastrarse a otro día o empleado para copiarlos. Al arrastrar se muestra cursor de agarre y se resalta el destino. Después de guardar un turno, descanso o permiso se limpia inmediatamente el estado de cambios pendientes, evitando un aviso incorrecto al cambiar de pestaña. La impresión conserva el documento mientras Windows mantiene abierto el diálogo, fuerza los colores y divide rangos largos en bloques de hasta 14 días para evitar cortes. Los PDF se descargan como `Cotizacion-NUMERO.pdf` en español y `Quote-NUMBER.pdf` en inglés. Estos cambios son únicamente de código y no requieren SQL adicional.

## Antes de aplicar

1. Guarda una copia recuperable de la base de datos actual, incluyendo los esquemas de la aplicación y Auth. Guarda también los archivos de Storage: una copia de la base no contiene necesariamente los archivos de los logos. Conserva el commit o ZIP actual de la aplicación.
2. Confirma que estás en el Supabase que utiliza el piloto, no en el proyecto de pruebas. Mantén las URL y claves del piloto en Vercel.
3. Coordina un momento sin ediciones y pide a los usuarios cerrar las pestañas durante la actualización. Esto evita que la versión anterior intente guardar mientras cambia la estructura.

No se ha realizado una copia de seguridad, una migración ni un despliegue en tus servicios desde esta revisión. El CSV contiene estructura, no una copia de los datos de tus clientes.

## Orden para actualizar

1. Descomprime este ZIP. Abre `ACTUALIZAR_PILOTO.sql` y copia su contenido completo en una consulta nueva del SQL Editor del Supabase del piloto. Ejecuta todo junto con el rol `postgres`.
2. El SQL debe terminar mostrando el restaurante, `acceso_habilitado = true` y `piloto_gratuito = true`. Si aparece un error, detente: no despliegues todavía. Si el editor conserva una transacción fallida, ejecuta `ROLLBACK;` antes de volver a intentar. Comparte el texto del error para revisarlo.
3. Sube el contenido de la carpeta `MRMAA_PILOTO` a la raíz del mismo repositorio que utiliza el piloto. En esa raíz deben quedar `package.json`, `app`, `components` y `lib`. No dejes todo dentro de una subcarpeta adicional si Vercel actualmente compila desde la raíz.
4. Conserva las variables de entorno existentes y despliega en el proyecto Vercel del piloto. Espera a que la compilación termine correctamente.
5. Abre una sesión nueva y comprueba los puntos de abajo antes de reanudar el trabajo del equipo.

Esta migración se puede repetir: las comprobaciones locales confirmaron que hacerlo no duplica los datos ni reinicia las fechas. No ejecutes los SQL de instalación completa del proyecto de pruebas en el piloto.

## Configuración de Vercel

Conserva `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` —o el nombre alternativo `SUPABASE_SECRET_KEY` si ya lo utilizas— del piloto. Este ZIP no incluye credenciales.

Configura `NEXT_PUBLIC_SITE_URL` con el dominio de este piloto, por ejemplo `https://mrmaa.com`, sin rutas ni parámetros. El dominio debe coincidir con las direcciones permitidas de autenticación en ese mismo Supabase, para que los enlaces de ingreso e invitación regresen al sitio correcto.

Mantén `NEXT_PUBLIC_MRMAA_PUBLIC_SIGNUP=false` mientras no quieras abrir el registro al público. En este paquete, la ausencia de esa variable también deja el registro público cerrado. Los usuarios existentes y las invitaciones del administrador conservan su flujo de acceso. Abrir el registro posteriormente requiere establecerla en `true` y volver a desplegar.

El acceso gratuito del piloto no requiere claves de Lemon Squeezy. Para probar compras de otras cuentas, conserva la configuración de pruebas del proveedor. La integración incluida sigue usando **modo de prueba**: este paquete no activa cobros reales ni certifica el lanzamiento comercial. Las claves del proyecto nuevo no deben reemplazar las de Supabase del piloto.

Si utilizas la tarea de mantenimiento incluida en `vercel.json`, conserva `CRON_SECRET`. Esa tarea llama a las funciones de mantenimiento existentes; esta migración no instala una tarea para eliminar clientes, reservaciones o cotizaciones.

## Comprobaciones después del despliegue

- Con el administrador, confirma que aparecen el restaurante correcto y su logo, y compara varias reservaciones y cotizaciones anteriores: números, clientes, anticipos, totales, saldos y partidas.
- Revisa las áreas, menús, horarios y miembros existentes. Prueba crear un registro de prueba y modificarlo.
- Con un gerente, verifica el ingreso, la creación de áreas y menús, y sus funciones habituales. Con una cuenta de lectura, confirma que sigue sin poder guardar cambios.
- En Plan y suscripción del piloto debe verse “Acceso gratuito del piloto”, sin contador de prueba ni solicitud de pago. Un invitado nuevo del mismo restaurante debe recibir el mismo acceso gratuito, con su rol asignado.
- Prueba una cotización nueva, los reportes, la vista previa en móvil, descargar un PDF y volver con Atrás del navegador. Para guardar cotizaciones se exige tener un área configurada y seleccionada; los menús son una sugerencia. Las cotizaciones anteriores no se alteran por la migración, pero al editarlas habrá que seleccionar un área válida si no la tenían.

## Validación realizada y recuperación

La aplicación completó la compilación de producción y la comprobación de tipos. La migración superó 19 comprobaciones en una base PostgreSQL local reconstruida con las 24 tablas del esquema recibido y datos ficticios. Se comprobó la conservación de todas las columnas originales, registros de Auth y objetos de logo de ejemplo; repetición de la migración; roles y aislamiento entre restaurantes; acceso gratuito de invitados; numeración y guardado de cotizaciones; siete modalidades de reportes; y rechazo del SQL si no encuentra el administrador esperado.

Estas pruebas no sustituyen una revisión de los datos reales ni una prueba en los teléfonos del equipo. La migración comprueba que las columnas originales coincidan con el esquema recibido y que exista exactamente un restaurante del propietario verificado; si no coincide, se detiene antes de actualizar.

El SQL utiliza una transacción: un error antes de `COMMIT` revierte los cambios de esa ejecución. Si necesitas volver al código anterior después de una migración correcta, conserva las adiciones de la base mientras se revisa el problema; no elimines tablas o columnas nuevas como método de recuperación. Para una restauración completa, utiliza la copia previa con el equipo sin escribir datos y revisa los cambios posteriores que tendrías que conservar.
