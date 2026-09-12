# Actualización MRMAA — Permisos de Excel

## Instalar esta actualización

1. En Supabase → SQL Editor → New query, pegue TODO el contenido de `SUPABASE_PERMISOS_EXCEL.sql` y pulse Run. Ejecútelo completo, una vez, antes de desplegar.
2. Descomprima el ZIP y actualice los archivos de la carpeta existente `MRMAA_V3_AREAS_FIX` en GitHub. No suba el ZIP sin descomprimir.
3. En Vercel conserve `MRMAA_V3_AREAS_FIX` como Root Directory y despliegue el commit que contiene estos archivos.
4. Ingrese como Administrador a Configuración → Usuarios. Encima del formulario de invitaciones encontrará **Permitir descargas de Excel al equipo**. Cambie el interruptor y pulse **Guardar permiso**.

La opción empieza activada para mantener el comportamiento anterior. Al desactivarla, se bloquean las descargas Excel del equipo (Gerente, Operador y Solo lectura). Todos los administradores activos conservan sus descargas. Solo los administradores activos del mismo restaurante pueden modificar la preferencia; las políticas existentes de acceso por restaurante se conservan.

Se comprueba el permiso antes de recopilar los datos y nuevamente antes de descargar. Esto también se aplica si el usuario tenía la página abierta antes del cambio. Las pantallas actualizan el estado de los botones al abrirse o al volver a enfocar la ventana. El permiso controla las descargas de la aplicación; no cambia los datos que cada rol puede consultar.

Aplica a los botones Excel de Clientes, Reservaciones, Horarios y Reportes, y a la descarga de la plantilla Excel de importación. El respaldo completo sigue siendo exclusivo del Administrador. Imprimir, PDF e Importar conservan sus permisos anteriores.

Si intenta salir sin guardar este permiso, se muestra el aviso de cambios pendientes. El cambio queda registrado en el historial. Tutorial, Instructivo y mensajes están actualizados en español e inglés.

## Versiones anteriores

Esta entrega conserva las correcciones de impresión y PDF, invitaciones de un solo uso, áreas independientes, acceso de Gerente y Operador a productos y áreas, Excel por rango de fechas en Horarios, avisos de reservas cercanas e importadas, fechas locales y carga diferida de módulos.

Los otros SQL se incluyen por continuidad. Si ya los aplicó, no necesita repetirlos. Si tiene pendiente la actualización de áreas, ejecute los scripts antiguos antes de `SUPABASE_AVISOS_IMPORTACION.sql` y `SUPABASE_AREAS_ROLES.sql`, nunca después: reemplazan funciones y permisos. Para una instalación desde cero utilice primero el esquema y las migraciones de su instalación V3; este ZIP es una actualización de esa instalación.

La impresión de cotizaciones abre el mismo documento PDF en otra pestaña. Use el botón del visor si el diálogo no abre automáticamente y seleccione Ajustar al área imprimible para A4 o Carta.

## Validación

Compilación de producción correcta y 209 pruebas automáticas aprobadas. Se verificaron permisos con PostgreSQL de prueba, aislamiento entre restaurantes, intentos de cambiar la preferencia desde otros roles, bloqueo del equipo, continuidad del acceso del administrador, errores de verificación y cobertura de textos en inglés.

No se ejecutó SQL ni se modificó producción. Se conserva la arquitectura existente; esta actualización no certifica capacidad para 50,000 restaurantes. No incluye dependencias instaladas, compilaciones, credenciales ni archivos de prueba.
