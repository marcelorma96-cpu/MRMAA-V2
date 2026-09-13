# Actualización del piloto: reservaciones y resumen estable

## Cambios

- Los cuadros de Reservaciones, Total de personas y Total de anticipos mantienen su posición al cargar otras consultas. El aviso de actualización tiene un espacio fijo debajo de los cuadros. Se conservan los valores anteriores hasta recibir los nuevos resultados; los avisos de error tampoco empujan los cuadros.
- Los controles de selección mantienen su espacio al pasar entre resultados vacíos y listas con reservaciones. Sin registros seleccionados, la eliminación múltiple queda deshabilitada.

- Las reservaciones canceladas muestran una etiqueta roja, tanto en tema claro como oscuro. También reconoce estados importados como «cancelled» o «canceled». La etiqueta cambia a inglés al seleccionar ese idioma.
- Gerente y Administrador pueden enviar reservaciones a la papelera, individualmente o mediante selección múltiple, con confirmación previa.
- Solo el Administrador conserva la restauración y eliminación definitiva. El permiso del Gerente se limita a las reservaciones de su restaurante y requiere una membresía activa. No habilita eliminar clientes ni cotizaciones.
- La eliminación conserva el historial de cambios. Cuando hay una cotización vinculada, pasa nuevamente a pendiente y puede convertirse otra vez.
- Tutorial e Instructivo actualizados en español e inglés.

## 1. Aplicar el nuevo SQL

**Esta actualización SÍ necesita un SQL nuevo.** En el proyecto Supabase del piloto, abra SQL Editor → New query, copie TODO el contenido de `SUPABASE_GERENTE_RESERVACIONES.sql` y pulse Run una vez. No lo ejecute sentencia por sentencia. Puede repetirse sin modificar los registros existentes.

Este archivo actualiza el permiso para enviar reservaciones a la papelera. Conserva las políticas de acceso y los triggers de auditoría, conversión de cotizaciones y sincronización.

No necesita repetir los SQL antiguos. Los archivos `SUPABASE_SINCRONIZACION.sql` y `SUPABASE_PERMISOS_EXCEL.sql` se conservan para quien aún no los haya aplicado; si ya funcionan las actualizaciones del equipo y el permiso de Excel, no los repita.

## 2. Subir y desplegar el código

Descomprima el ZIP y sustituya el contenido de la carpeta `MRMAA_V3_AREAS_FIX` en GitHub por esta versión. No suba el archivo ZIP al repositorio ni mezcle las carpetas de distintas versiones.

En Vercel, Root Directory sigue siendo `MRMAA_V3_AREAS_FIX` si esa carpeta está en la raíz del repositorio. Debe apuntar a la carpeta que contiene `package.json`. Despliegue el commit que acaba de subir; Redeploy de un commit anterior utiliza el código anterior.

Conserve las credenciales y demás variables actuales. Mantenga `NEXT_PUBLIC_MRMAA_REALTIME=true` para las actualizaciones entre usuarios. No hay variables nuevas para esta entrega. Al finalizar el despliegue, recargue la aplicación para usar la versión nueva.

## Verificación

Se aprobaron las pruebas locales de permisos, aislamiento por restaurante, revocación de permisos, auditoría, conversión, interfaz, traducciones y consultas agrupadas. Las pruebas de base de datos usan PostgreSQL local mediante PGlite. La compilación de producción terminó correctamente.

Después de desplegar, con una reservación de prueba: cambie su estado a Cancelada y compruebe la etiqueta roja. Entre como Gerente, envíela a la papelera y compruebe con el Administrador que puede restaurarla. Si está vinculada a una cotización, verifique que esta vuelve a pendiente.

Se conservan las mejoras anteriores de carga de clientes, reservaciones y cotizaciones, las invitaciones y las actualizaciones del equipo. La etiqueta y los ajustes de estabilidad visual no agregan consultas ni esperas al servidor. No se modificó la arquitectura, la paginación ni los índices.

La preparación y las pruebas fueron locales. No se ejecutó SQL ni se desplegó código en MRMAA.com desde aquí.
