# Actualizar el piloto MRMAA

Este paquete incorpora la corrección del fallo de carga y la sincronización entre usuarios. Se instala en el piloto actual. El proyecto separado vendrá después.

## 1. Supabase: ejecutar el SQL nuevo

En el proyecto que utiliza MRMAA.com, abra SQL Editor → New query. Copie TODO el contenido de `SUPABASE_SINCRONIZACION.sql` y pulse Run una sola vez. Es una transacción completa y puede repetirse.

Este SQL agrega los avisos privados por restaurante. No elimina datos ni reemplaza los permisos de las tablas del negocio. No necesita activar Postgres Changes ni agregar las tablas a una publicación: utiliza Broadcast privado.

`SUPABASE_PERMISOS_EXCEL.sql` corresponde al permiso de Excel de la versión anterior. Ejecútelo únicamente si todavía no lo había aplicado. No repita los SQL antiguos.

## 2. Vercel: habilitar la sincronización

En el mismo proyecto de Vercel del piloto, vaya a Settings → Environment Variables y agregue:

- Nombre: `NEXT_PUBLIC_MRMAA_REALTIME`
- Valor: `true`
- Entorno: `Production` (también Preview si desea probar un despliegue de vista previa que use este mismo Supabase).

Conserve las credenciales actuales de Supabase y las demás variables. Esta variable pública es un interruptor, no una contraseña.

## 3. Subir y desplegar

Descomprima el ZIP y sustituya el contenido de `MRMAA_V3_AREAS_FIX` por esta versión en GitHub. No suba el ZIP como un archivo dentro del repositorio ni mezcle los archivos con versiones anteriores.

Root Directory debe apuntar a la carpeta que contiene `package.json`: `MRMAA_V3_AREAS_FIX`, si mantiene esa carpeta en la raíz del repositorio. Despliegue el commit que acaba de subir; hacer Redeploy de un commit anterior vuelve a utilizar el código anterior.

La variable requiere un nuevo build. Tras terminar el despliegue, abra nuevamente la aplicación para cargar esta versión.

## Comprobación con dos sesiones

Abra el mismo restaurante con dos usuarios en navegadores o perfiles separados. Cree o edite una reservación en uno y compruebe el cambio en el otro sin recargar. Repita con clientes, cotizaciones, productos y horarios. Mantenga un formulario con texto sin guardar en la segunda sesión: ese texto debe conservarse.

Las actualizaciones respetan el filtro, la página y el periodo visibles. La sesión conserva su última información válida ante un fallo temporal; reintenta la sincronización al recuperar la conexión. Si la configuración cambia mientras hay un borrador, aparece una opción para revisar la versión actual antes de guardarla.

La sincronización no es un editor colaborativo campo por campo. Para editar simultáneamente un mismo registro, atienda el aviso de cambios recientes y revise la versión guardada antes de continuar.

La generación de PDF e impresión usa una versión fija del documento mientras se prepara; los cambios pendientes se consultan después.

## Alcance de la entrega

Conserva la paginación, la carga por módulo y los permisos de la versión anterior. Los avisos contienen solo restaurante y tabla, no registros de clientes. Las consultas posteriores verifican los permisos existentes. Las importaciones agrupan avisos por tabla, restaurante y transacción.

Build y pruebas automáticas realizados localmente. Comparación local de una importación de 1,000 clientes con auditoría y RLS: mediana aproximada de 119 ms sin avisos y 122 ms con avisos, con un único aviso. Estas cifras no son una prueba de latencia de Internet ni certifican una capacidad de 50,000 restaurantes.

La comprobación de extremo a extremo con el Supabase publicado y dos navegadores reales debe hacerse después de activar los pasos anteriores. No se desplegó ni se ejecutó SQL en su proyecto durante esta preparación.

Para desactivar únicamente las actualizaciones automáticas, cambie `NEXT_PUBLIC_MRMAA_REALTIME` a `false` y haga un nuevo despliegue. La corrección de sesión y las funciones habituales permanecen.
