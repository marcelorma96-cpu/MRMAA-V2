# Crear o cambiar contraseña desde Cuenta · 30 de septiembre de 2026

En **Configuración > Cuenta** se puede crear una contraseña de UnoMesa para una cuenta de Google, o cambiar una contraseña existente. El formulario pide la contraseña nueva dos veces y no permite guardar si no coinciden o no cumple los requisitos. Tras crearla, se muestra Cambiar contraseña. El acceso con Google continúa disponible y su contraseña de Google no cambia.

Cada usuario gestiona únicamente su propia contraseña. Los colaboradores también tienen Cuenta con esta opción personal, sin recibir permisos para administrar usuarios, cambiar el correo del administrador, transferir ni eliminar la cuenta. Se mantienen la sesión vigente, la verificación en dos pasos y las reglas de seguridad de Supabase; si el servicio exige contraseña actual o un código reciente por correo, se solicita en el mismo formulario. La confirmación de guardado aparece arriba y los campos se vacían al completar o cancelar.

**No requiere ejecutar SQL ni cambiar la estructura existente.** Actualice la misma aplicación de Vercel con las mismas variables. No cambia clientes, cotizaciones, restaurantes, planes ni exenciones del piloto. El cambio de contraseña lo realiza Supabase Auth sobre la cuenta autenticada, sin restablecimientos administrativos. Se conserva la recuperación de contraseña desde el ingreso.

Verificación local: pruebas de autorización, confirmación, rechazo de solicitudes para otras cuentas, sesiones revocadas, MFA, límites de intentos y restricciones del proveedor; pantallas en español/escritorio e inglés/móvil oscuro; cuentas de Google, correo, gerente y solo lectura; compilación de producción. Las pruebas usan servicios simulados; no se cambió ninguna contraseña real ni se enviaron correos a clientes.

---

# Logo opcional · 30 de septiembre de 2026

En Configuración > General, **Quitar imagen** vacía el logo del negocio. Pulse **Guardar cambios** o **Guardar configuración** para conservarlo así al recargar. Puede subir otra imagen cuando quiera. No requiere SQL ni cambios en la estructura de la base de datos.

---

# Actualización corregida: avisos sin cambios de estructura · 30 de septiembre de 2026

1. **Esta corrección no requiere ejecutar ningún SQL.** Se retiró el SQL 42 de la entrega anterior y se eliminó su dependencia. No ejecutar ese archivo descargado anteriormente. Si Google ya funciona, no repetir su configuración ni los SQL 40/41.
2. Actualizar la misma aplicación de Vercel, conservando sus variables y su conexión con el mismo proyecto Supabase.
3. Abrir Cotizaciones. Los avisos activos aparecen abiertos, con Revisar y Quitar. Para volver a mostrar avisos ya quitados, pulsar **Recuperar avisos quitados**. La opción aparece cuando existen cotizaciones pendientes con un aviso quitado y evento hoy o en los próximos cinco días. Si hay más de 50, se recuperan hasta 50 por clic.

Se usa únicamente `reminder_dismissed`, que ya existe en la estructura exportada. No se añaden columnas, tablas, funciones, reglas ni políticas. Abrir la pantalla, recargar y Revisar no modifican cotizaciones. Quitar pone la marca en verdadero y Recuperar la pone en falso; ambas acciones conservan cliente, importes, fecha de creación, estado y demás contenido de la cotización. Los permisos existentes se mantienen. Los avisos quitados permanecen quitados al recargar o abrir otra computadora hasta que alguien con permiso los recupere.

La etiqueta **Creada** muestra fecha y hora del mismo registro, con el formato 12/24 horas configurado. Actualmente ambas se presentan en la zona horaria del dispositivo; el país del restaurante no configura una zona horaria. Las horas de eventos y turnos conservan el valor introducido. No se cambia la fecha de creación almacenada.

Las confirmaciones de guardado aparecen flotando arriba durante cinco segundos, con cierre manual. Se mantienen mientras el cursor o el foco estén sobre el aviso. Incluye configuración, menús, empleados, turnos, horarios, clientes, cotizaciones y reservas. Los errores e instrucciones que requieren acción permanecen en su sección.

Se conserva el acceso con Google, Inicio rápido, menús con buscador y scroll, vista previa y navegación a la reserva convertida. Verificación local: lectura, recuperación y descarte probados contra las 30 columnas y tipos de la exportación, sin migraciones; comprobación de que solo cambia la marca, aislamiento entre restaurantes, exclusión de papelera/convertidas/fechas fuera del rango y lotes de 50. Flujos con servicios simulados en navegador para español/escritorio e inglés/móvil oscuro y compilación de producción verificados. Este ZIP no publica el sitio ni ejecuta modificaciones en Supabase.

---

# Actualización anterior: Google directo al dashboard · 30 de septiembre de 2026

**Para activar Google, siga `ACTIVAR_GOOGLE_UNOMESA.md`.** Esta entrega requiere el SQL 40 (si no está aplicado) y después **41_GOOGLE_ACCESO_DIRECTO.sql**. El apartado anterior sobre “no requiere SQL” más abajo se refiere únicamente al cambio de marca.

Las cuentas nuevas de Google reciben 10 días de Advanced y entran directamente al dashboard, con Inicio rápido visible. Los datos del restaurante se completan después en Configuración. Se conservan los cambios de menús (buscador, cinco filas con scroll y guardar arriba/abajo), vista previa de cotizaciones, avisos abiertos y navegación a la reserva recién creada.

El ZIP no publica el sitio ni ejecuta cambios en Supabase. No aplicar todos los SQL incluidos indiscriminadamente.

---

# UnoMesa — cambio de marca preparado para el 25 de septiembre de 2026

## Revisión de inglés — 26 de septiembre de 2026

El registro muestra «Start your free trial.» al elegir inglés y conserva el idioma elegido al crear la cuenta. Se revisaron acceso, recuperación, confirmación de contraseña, avisos de suscripción y mensajes de operación; se completaron traducciones faltantes, incluidas referencias de error y títulos de cotizaciones. Español es el idioma automático de los países hispanohablantes (incluido Puerto Rico); el resto usa inglés. Si no se puede detectar el país, se usa inglés. La elección manual o preferencia guardada de la cuenta tiene prioridad. Se mantiene la versión en español. Esta revisión no requiere ejecutar SQL. Conserva las rutas de autenticación, CAPTCHA, cobros, analíticas y registros existentes.


Base: última versión disponible de MRMAA_NUEVO_REVISADO.zip (versión 66). Este paquete prepara el cambio; no modifica por sí solo Vercel, DNS, Supabase, Lemon Squeezy ni los buzones de correo.

## Qué contiene

- Logo aprobado de UnoMesa en landing, registro, ingreso, recuperación/activación de acceso, panel, soporte y páginas legales. Letras claras sobre fondos oscuros.
- Favicon, icono de aplicación y Apple icon con solo la mesa y el número 1.
- Video y portada con la marca nueva; mismos ejemplos y funciones.
- Marca visible actualizada en ayuda, tutorial, asistente, avisos, documentos y exportaciones. Los logos de los restaurantes y sus cotizaciones se conservan.
- Contacto: support@unomesa.com. Sugerencias: suggestions@unomesa.com. Remitente configurable para códigos: passcode@unomesa.com.
- Correos generados por la aplicación con encabezado UnoMesa y alternativa de texto plano. Los códigos, vencimientos, destinatarios de seguridad y enlaces conservan su lógica.
- Se admiten los dominios exactos unomesa.com y www.unomesa.com para la analítica pública, y pay.unomesa.com para enlaces devueltos por Lemon Squeezy. Se conserva compatibilidad con mrmaa.com y pay.mrmaa.com.

## Lo que se conserva

Mismos planes, precios, prueba de 10 días, doble contraseña, CAPTCHA, recuperación de acceso, invitaciones, 2FA, sesiones, permisos, reservas, cotizaciones, horarios, reportes, cancelación/reactivación de suscripciones, webhooks, avisos de vencimiento y analítica de Meta/Vercel. No se cambia el identificador del Pixel.

No se modifica ningún SQL ni se cambia de proyecto Supabase. No se borran ni migran usuarios, datos, restaurantes, archivos, pagos o suscripciones. La exención del piloto sigue dependiendo de los mismos registros. Los identificadores internos MRMAA (variables existentes, almacenamiento, RPC, metadatos de checkout y formato de respaldo) permanecen para conservar compatibilidad.

**No hace falta ejecutar SQL nuevo por este cambio de marca.** Los SQL ya incluidos son de actualizaciones anteriores; este ZIP no sustituye la instalación de base de datos de un proyecto nuevo.

## Antes del despliegue de esta noche

1. Crear y comprobar la recepción en **support@unomesa.com**, **suggestions@unomesa.com** y **passcode@unomesa.com**. Verificar los remitentes/dominio en el proveedor de correo y completar sus registros DNS requeridos. Comprar el dominio no crea buzones ni autoriza SMTP automáticamente.
2. Añadir unomesa.com y www.unomesa.com al **mismo proyecto Vercel**. Usar los registros DNS que indique Vercel y esperar a que HTTPS esté válido. Conservar mrmaa.com funcionando durante la transición.
3. Añadir el nuevo dominio a los hostnames permitidos del widget Turnstile actual. Conservar las claves existentes y los hostnames anteriores.
4. En Supabase → Authentication → URL Configuration, añadir las versiones nuevas de las Redirect URLs actuales, manteniendo exactamente sus rutas y parámetros. Esta app genera callbacks en la raíz con parámetros como `?reset=1`; copiar la configuración vigente sustituyendo solo el host evita perder esos destinos. Conservar las URLs anteriores mientras existan enlaces pendientes.
5. Mantener el mismo proyecto, claves y datos de Supabase, y la misma tienda/variantes/suscripciones de Lemon Squeezy. No crear productos ni usuarios nuevos para el cambio de marca.

## Variables del despliegue final

Elegir un origen canónico (este ejemplo usa https://unomesa.com) y usarlo de manera consistente.

| Variable | Valor para la nueva marca | Cuándo activarla |
|---|---|---|
| NEXT_PUBLIC_SITE_URL | https://unomesa.com | Cuando el nuevo dominio tenga HTTPS y Auth/CAPTCHA admitan el dominio |
| UNOMESA_PASSCODE_FROM | UnoMesa <passcode@unomesa.com> | Cuando el proveedor SMTP autorice este remitente |
| UNOMESA_SUPPORT_FROM | UnoMesa <support@unomesa.com> | Cuando el proveedor SMTP autorice este remitente |

Los remitentes son exclusivamente passcode@unomesa.com y support@unomesa.com, con esos valores por defecto. Ya no se usa MRMAA_SMTP_FROM como alternativa. Debe autorizar ambos remitentes en su proveedor SMTP antes de desplegar.

Se conservan **MRMAA_SMTP_HOST**, **MRMAA_SMTP_PORT**, **MRMAA_SMTP_USER**, **MRMAA_SMTP_PASSWORD** y las demás variables existentes. Las nuevas direcciones deben estar autorizadas con esas mismas credenciales. Si se cambia de proveedor, actualizar las credenciales solamente cuando se haya comprobado que envían desde ambos remitentes. No poner contraseñas ni claves en el ZIP o en GitHub.

UNOMESA_PASSCODE_FROM se utiliza para códigos de 2FA y cambio de correo. UNOMESA_SUPPORT_FROM se utiliza para notificaciones de soporte y avisos de vencimiento. suggestions@unomesa.com es una dirección de recepción mediante el enlace de ayuda, no necesita una tercera credencial SMTP de la app.

Un cambio en las variables de Vercel necesita un nuevo despliegue para aplicarse.

## Correos de Supabase y cuenta interna de soporte

Los mensajes de confirmación de registro, recuperación e invitación enviados por **Supabase Auth** se configuran por separado. Cambiar allí el nombre a UnoMesa y el remitente a passcode@unomesa.com una vez autorizado. Actualizar el logo y los textos de las plantillas conservando exactamente las expresiones, enlaces y tokens actuales de cada plantilla. No sustituir su flujo de confirmación.

Logo para el encabezado, una vez publicado: https://unomesa.com/brand/unomesa-logo.png. Usar fondo claro, ancho aproximado de 240 px y texto alternativo UnoMesa.

Para trasladar el acceso interno ejecute 37_ACTIVAR_SOPORTE_UNOMESA.sql y siga 38_SOPORTE_UNOMESA_LEER.md. El agente anterior queda deshabilitado y únicamente la cuenta nueva queda autorizada. Las cuentas de Authentication y el historial se conservan.

## Lemon Squeezy

- Cambiar nombre/logo/contacto de la tienda cuando se haga pública la marca. Los IDs de tienda, productos, variantes y suscripciones deben seguir iguales.
- Se puede conservar pay.mrmaa.com durante la transición. El código también acepta pay.unomesa.com cuando se configure correctamente en Lemon Squeezy; no basta con crear un DNS hacia Vercel.
- Mantener el webhook actual operativo mientras se verifica el nuevo dominio. Cuando se cambie, usar la URL HTTPS final **https://unomesa.com/api/billing/webhook**, sin depender de redirecciones. Mantener secreto y eventos del webhook correctos para el mismo entorno (live o test).
- Conservar exactamente las variables LEMON_SQUEEZY_* actuales. Este ZIP no cambia de test a live ni altera precios.
- Comprobar una entrega de webhook aceptada y que la aplicación muestre el plan existente y el botón de gestión. Reenviar un evento previo de la misma suscripción sirve para verificar su procesamiento; no hace falta realizar otro cobro.

## Cómo subir este paquete

La carpeta interna sigue llamándose **MRMAA_PRUEBAS 26** para evitar un cambio innecesario en Root Directory. Se publica UnoMesa aunque el nombre técnico de la carpeta sea el anterior.

Actualizar los archivos dentro de la carpeta que ya utiliza Vercel. No anidar otra copia de todo el proyecto. Si actualmente Root Directory apunta a otra carpeta (por ejemplo PRUEBAS 23), actualizar su contenido con el de este paquete y conservar esa ruta, o modificar Root Directory conscientemente antes de desplegar.

GitHub Desktop: revisar Changes, hacer commit y Push origin. Si la rama está conectada a producción, el push puede iniciar el despliegue; esperar a la ventana de cambio prevista. No subir node_modules, archivos de claves ni salidas de compilación.

## Comprobación al publicar

- Confirmar, desde el dominio nuevo, registro con dos contraseñas, CAPTCHA, email y acceso; verificar también recuperación e invitación.
- Comprobar llegada de códigos desde passcode@unomesa.com y recepción de soporte/sugerencias en sus buzones.
- Abrir una cuenta existente: mismos datos, logo del restaurante, sesiones, permisos y plan pagado; probar abrir la gestión de suscripción sin hacer otro pago.
- Verificar una entrega de webhook y el estado de la suscripción, sin duplicar el cobro.
- Verificar Meta/Vercel en la landing y registro. El código conserva la exclusión de callbacks, tokens y pantallas privadas. Revisar el dominio nuevo en la configuración externa de Meta si hay restricciones de tráfico.
- Revisar logo/favicon y botones en modo claro y oscuro en móvil y computadora.

Al cambiar de dominio, los usuarios pueden necesitar iniciar sesión otra vez: las cookies y el almacenamiento del navegador no se comparten entre mrmaa.com y unomesa.com. Esto no borra sus cuentas ni sus registros.

No redirigir todo mrmaa.com hasta verificar callbacks, correos y webhook. El ZIP no añade una redirección global. Conservar los servicios antiguos durante la transición permite recuperar enlaces ya enviados.

## Alcance de las verificaciones locales

Compilación de producción Next.js completada. 28 pruebas automatizadas aprobadas. Comprobadas las pruebas automatizadas de analítica, dominios de pago, remitentes y formato seguro de correo; compilación TypeScript; registro y contraste de botones con servicios simulados en móvil/computadora. Las integraciones reales de SMTP, DNS, Auth, CAPTCHA y cobro necesitan la comprobación en tu proyecto después de configurar el nuevo dominio.

Referencias oficiales:
- https://vercel.com/docs/environment-variables/managing-environment-variables
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp
- https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
- https://docs.lemonsqueezy.com/help/webhooks/webhook-requests
