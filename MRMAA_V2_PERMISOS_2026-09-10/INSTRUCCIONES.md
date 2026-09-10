# MRMAA v2

## Corrección vigente: permisos de los cuatro roles — 10 de septiembre de 2026

**Esta actualización sí requiere ejecutar `SUPABASE_PERMISOS_ROLES.sql` en
Supabase → SQL Editor y publicar el nuevo ZIP en Vercel.** Son dos pasos
necesarios. Para su instalación existente ejecute únicamente ese nuevo SQL.
Los apartados de actualizaciones anteriores que dicen “no requiere SQL” se
refieren solamente a sus cambios históricos.

Lea `PERMISOS_ROLES.md` para ver la tabla de permisos, los pasos de aplicación
y el alcance de las pruebas. Administrador tiene acceso completo a su negocio;
Gerente administra operación y asignaciones de horarios; Operador administra
clientes, reservas y cotizaciones; Solo lectura consulta, imprime y exporta.


## Corrección del listado móvil de cotizaciones — 10 de septiembre de 2026

Se corrigió la distribución de las cotizaciones guardadas en pantallas de hasta
850 px. El nombre y el total ocupan el ancho completo; fecha, hora y área tienen
etiquetas propias. Los botones Editar, Ver y Papelera quedan en una fila, y
Convertir en reserva dispone de una fila completa.

El problema anterior asignaba también los datos a una columna de 30 px diseñada
para la casilla de selección. Ahora cada campo tiene un área explícita.

Publique este ZIP completo en el proyecto y espere el despliegue de Vercel.
Después recargue MRMAA en el teléfono. La actualización conserva el trabajo de
correos en varios idiomas incluido abajo. No requiere SQL adicional.

Se verificaron la estructura y la compilación de producción. El navegador de
revisión bloqueó la vista local; no se realizó una comprobación visual en Safari.

## Actualización de correos en varios idiomas — 10 de septiembre de 2026

Para actualizar su instalación actual, publique el contenido de este ZIP y siga
**CORREOS_MULTILINGUES.md** para guardar las plantillas en Supabase. Incluye
idioma personal del correo, idioma al invitar y asuntos y mensajes traducidos.
Esta actualización no requiere volver a ejecutar los archivos SQL históricos.
El registro público y la configuración opcional de CAPTCHA se mantienen como
estaban: la activación de correos en varios idiomas no exige cambiar esas opciones.

## Corrección de CAPTCHA — CSP, 10 de septiembre de 2026

Para actualizar una instalación que ya usa el ZIP de producción corregido:

1. Extraiga este ZIP y reemplace los archivos del proyecto, incluido `next.config.mjs`.
2. Conserve las claves de Vercel, Cloudflare y Supabase que ya configuró.
3. Despliegue nuevamente en Vercel. Este ajuste no necesita ejecutar SQL adicional.

La política CSP anterior impedía cargar el script y el iframe de Turnstile.
Se permite únicamente `https://challenges.cloudflare.com` para estos recursos.
También se renueva la verificación después de cada intento de acceso o recuperación,
y se muestra un mensaje con botón de reintento si el proveedor no carga.
Las indicaciones de contraseña se muestran al crear una contraseña; el inicio de
sesión conserva el formulario sin esas indicaciones.

Verificación: build de producción, seis pruebas automatizadas (incluidas CSP,
reintentos y carga de Turnstile) y comprobación HTTP de las cabeceras servidas.
El navegador de pruebas de esta sesión no pudo acceder al servidor local; no se
validó un inicio de sesión real con las claves y credenciales de producción.
No se incluyen claves de prueba ni archivos de compilación dentro de este ZIP.

Referencia técnica: https://developers.cloudflare.com/turnstile/reference/content-security-policy/

Esta versión es independiente y no borra información de MRMAA anterior.

## Instalación

1. En Supabase abra **SQL Editor**.
2. Si es una instalación nueva, copie todo `SUPABASE_V2.sql` y presione **Run**.
3. Si ya había instalado la primera versión v2, ejecute solamente `SUPABASE_V2_ONBOARDING.sql`.
4. Para habilitar Horarios, Comunicación, Reportes y Configuración, ejecute una vez `SUPABASE_V2_MODULES.sql`.
5. Ejecute una vez `SUPABASE_V2_ADVANCED.sql` para habilitar horarios mensuales, menús/productos y preferencias de WhatsApp/SMS.
6. **Antes de publicar esta versión**, ejecute una vez `SUPABASE_SEGURIDAD.sql`. Este archivo activa papelera, restauración, auditoría y permisos administrativos sin borrar información existente.
7. Ejecute una vez `SUPABASE_CAMPOS_COTIZACION.sql` para guardar campos personalizados y cobros o descuentos adicionales en cada cotización.
8. En Vercel conserve o agregue estas variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SECRET_KEY` (privada; necesaria para invitar usuarios)
9. En Supabase abra **Authentication > URL Configuration**. Use el dominio público de MRMAA como **Site URL** y agréguelo también en **Redirect URLs**, por ejemplo `https://mrmaa.com/**` y su dominio vigente de Vercel.
10. Conserve la confirmación de correo en **Authentication > Sign In / Providers > Email**. El registro público está deshabilitado para las pruebas internas; agregue colaboradores mediante invitaciones desde MRMAA.
11. Suba el contenido de esta carpeta al repositorio `MRMAA-V2`.
12. Al terminar todos los scripts de instalación, ejecute `SUPABASE_PROTECCION_PRODUCCION.sql` y luego `SUPABASE_PERMISOS_ROLES.sql`.
13. Vuelva a desplegar el proyecto en Vercel y pruebe las cuentas invitadas con cada rol.

Si ya ejecutó la versión anterior de `SUPABASE_V2_MODULES.sql`, sus áreas y turnos existentes no se eliminan. Ahora puede borrarlos desde **Configuración > Horarios** y crear los suyos.

## Importante

- No ejecute `DROP TABLE` ni borre tablas antiguas.
- Las tablas nuevas comienzan con `v2_`.
- Los datos anteriores no se copian automáticamente. La migración se debe hacer después de aprobar la nueva versión.
- Descargue un respaldo desde **Configuración > Seguridad** antes de ejecutar futuras migraciones SQL.
- Active MFA en Supabase, GitHub y Vercel y no comparta `SUPABASE_SERVICE_ROLE_KEY`.
# Actualización de producción 2026-09-10

- Ejecute nuevamente `SUPABASE_PROTECCION_PRODUCCION.sql` para activar la protección del administrador principal.
- Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel y habilite Cloudflare Turnstile en Supabase Authentication para activar CAPTCHA.
- Las contraseñas nuevas requieren 8 caracteres, mayúscula, minúscula, número y carácter especial.
- El reporte de empleados calcula horas programadas, no marcaciones reales de entrada y salida.
