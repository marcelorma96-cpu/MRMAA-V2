# Corrección de permisos de MRMAA

Esta actualización incluye cambios de aplicación **y de Supabase**. Publicar el
ZIP solamente no instala las políticas de la base de datos.

## Aplicar a la instalación existente

1. Extraiga el ZIP. Abra `SUPABASE_PERMISOS_ROLES.sql` en un editor de texto.
2. En el proyecto de Supabase que usa MRMAA, abra **SQL Editor → New query**,
   pegue **todo** ese archivo y presione **Run**. Debe finalizar sin errores y
   mostrar `rls_activado = true` para las 14 tablas de la comprobación final.
3. Publique los archivos de este ZIP en el repositorio/proyecto habitual y espere
   que termine el despliegue de Vercel.
4. Recargue MRMAA en las cuentas de prueba. En Configuración → Usuarios, confirme
   con la cuenta administradora el rol asignado al invitado. Los permisos salen
   de esa membresía; cambiar metadatos personales no cambia el acceso.

Para esta corrección ejecute **solo `SUPABASE_PERMISOS_ROLES.sql`**. No vuelva a
ejecutar los instaladores históricos de módulos: algunos incluyen operaciones
de limpieza de catálogos y políticas antiguas.

El nuevo script se puede repetir. No modifica registros, roles, estados ni
contraseñas; reemplaza permisos y políticas en una transacción. Si falla una
instrucción, la transacción revierte todos sus cambios. La consulta final enumera
las tablas protegidas; no constituye por sí sola una auditoría de producción.

## Permisos

| Acción | Administrador | Gerente | Operador | Solo lectura |
|---|---|---|---|---|
| Consultar, buscar y filtrar clientes, reservas y cotizaciones | Sí | Sí | Sí | Sí |
| Imprimir, exportar y descargar los documentos disponibles | Sí | Sí | Sí | Sí |
| Crear/editar clientes, reservas y cotizaciones | Sí | Sí | Sí | No |
| Importar reservaciones y convertir cotizaciones en reservas | Sí | Sí | Sí | No |
| Consultar e imprimir horarios | Sí | Sí | Sí | Sí |
| Asignar, modificar, copiar, generar y borrar horarios | Sí | Sí | No | No |
| Configuración del negocio, catálogos, empleados, áreas y turnos base | Sí | No | No | No |
| Entrar a Reportes, Seguridad, auditoría y usuarios | Sí | No | No | No |
| Enviar clientes, reservas y cotizaciones a papelera o restaurarlos | Sí | No | No | No |
| Eliminación definitiva, respetando la retención de 365 días | Sí | No | No | No |

Todos los permisos se limitan al restaurante al que pertenece la persona.
Un usuario inactivo, pendiente de activar o con un rol desconocido no obtiene
acceso operativo. El identificador interno del rol Operador sigue siendo
`operacion` y el del Administrador también acepta el alias histórico `admin`.

El idioma personal de correos, el tema y la contraseña propia son preferencias
de cuenta; el rol Solo lectura no impide que la persona administre sus propios
datos de acceso. Ninguna de esas preferencias autoriza cambios del restaurante.

## Qué se corrigió

- El rol ya no se aplica solamente al botón Nuevo: incluye edición desde listas
  y vista previa, conversión, importación, eliminación individual y masiva.
- Operador y Solo lectura consultan Horarios sin editor, copiado, generación,
  arrastre ni borrado. Gerente conserva esas acciones de asignación.
- Se vuelve a consultar la membresía antes de guardar; los errores al verificar
  permisos bloquean la operación. Al refrescar permisos revocados, se cierran
  los formularios que ya no están autorizados.
- Las políticas RLS protegen cada tabla frente a solicitudes directas. Se quitan
  las políticas antiguas que permitían escritura a cualquier miembro.
- Los catálogos se limitan al administrador también en la base de datos.
- Se retiran privilegios de acceso anónimo y de TRUNCATE a los clientes.
- Las API de Usuarios y Cuenta verifican una membresía administradora activa.
- Se conserva la protección del administrador principal y el proceso de
  transferencia de administración.
- Se corrigió la repetición de `SUPABASE_PROTECCION_PRODUCCION.sql`, que podía
  fallar al intentar crear de nuevo una política de aceptación legal.

## Verificación

Las pruebas de permisos usan PostgreSQL en memoria (PGlite), los scripts reales
de MRMAA y datos ficticios. Reproducen primero la escritura con el rol Lectura
bajo las políticas antiguas y verifican su bloqueo después de la corrección.
También cubren INSERT, UPDATE y DELETE; consulta entre restaurantes; roles
inactivos/desconocidos; cambios de rol sin renovar el token; membresías; papelera;
activación de invitaciones y repetición de las migraciones.

Las pruebas de interfaz renderizan los componentes con cada rol y comprueban
los controles visibles. Las API se prueban con el SDK real y respuestas locales,
sin enviar correos. `npm test` ejecuta estas verificaciones y las existentes;
`npm run build` compila la aplicación.

No se accedió a la base de datos de producción ni se ejecutó allí el SQL desde
esta conversación. Después del despliegue, confirme en dos navegadores separados
que la cuenta administradora conserva acceso y que el invitado respeta su rol.

Referencias técnicas:
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL: políticas de seguridad por fila](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
