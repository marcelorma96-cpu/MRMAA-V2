# UnoMesa — cambio de marca preparado para el 25 de septiembre de 2026

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

Las dos variables UNOMESA_*_FROM son nuevas y opcionales. Si no están definidas, se mantiene el remitente **MRMAA_SMTP_FROM** ya configurado. La marca visible de los mensajes será UnoMesa, pero el remitente seguirá siendo el antiguo hasta activar los nuevos valores.

Se conservan **MRMAA_SMTP_HOST**, **MRMAA_SMTP_PORT**, **MRMAA_SMTP_USER**, **MRMAA_SMTP_PASSWORD** y las demás variables existentes. Las nuevas direcciones deben estar autorizadas con esas mismas credenciales. Si se cambia de proveedor, actualizar las credenciales solamente cuando se haya comprobado que envían desde ambos remitentes. No poner contraseñas ni claves en el ZIP o en GitHub.

UNOMESA_PASSCODE_FROM se utiliza para códigos de 2FA y cambio de correo. UNOMESA_SUPPORT_FROM se utiliza para notificaciones de soporte y avisos de vencimiento. suggestions@unomesa.com es una dirección de recepción mediante el enlace de ayuda, no necesita una tercera credencial SMTP de la app.

Un cambio en las variables de Vercel necesita un nuevo despliegue para aplicarse.

## Correos de Supabase y cuenta interna de soporte

Los mensajes de confirmación de registro, recuperación e invitación enviados por **Supabase Auth** se configuran por separado. Cambiar allí el nombre a UnoMesa y el remitente a passcode@unomesa.com una vez autorizado. Actualizar el logo y los textos de las plantillas conservando exactamente las expresiones, enlaces y tokens actuales de cada plantilla. No sustituir su flujo de confirmación.

Logo para el encabezado, una vez publicado: https://unomesa.com/brand/unomesa-logo.png. Usar fondo claro, ancho aproximado de 240 px y texto alternativo UnoMesa.

El nuevo correo público de soporte **no cambia ni otorga permisos a una cuenta de Authentication**. Conservar la cuenta de soporte actualmente autorizada y su acceso al buzón anterior hasta revisar su configuración en Supabase. Las solicitudes nuevas se notifican a support@unomesa.com; para abrirlas se debe usar la cuenta autorizada existente. No borrar/recrear esa cuenta por el cambio de nombre.

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
