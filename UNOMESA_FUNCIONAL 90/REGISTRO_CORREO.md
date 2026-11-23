# Registro y correo de confirmación

Ejecute `59_REGISTRO_REINTENTO_SEGURO.sql` y publique este proyecto completo en el Vercel habitual. Mantenga todas las variables y la conexión al mismo Supabase. No ejecute otra vez SQL antiguos ya instalados.

El SQL 59 crea una tabla pequeña para bloquear solicitudes simultáneas y dos funciones privadas para reintentar o reenviar. No actualiza ni elimina registros al instalarse. No cambia clientes, reservas, cotizaciones, roles, suscripciones, pruebas ni exenciones. Conserva los tokens de los registros pendientes y la función de activación instalada. Los archivos SQL 33–58 están intactos.

## Qué cambia

- Tras un registro aceptado aparece una pantalla dedicada: **Revisa tu correo**, dirección del destinatario y dos pasos de confirmación. La opción de volver al inicio de sesión queda debajo.
- **¿No recibiste el correo?** permite reenviar con verificación de seguridad y espera entre envíos.
- Un usuario pendiente de confirmar recibe un reenvío. No se cambia su contraseña ni se crea otra cuenta.
- Un intento fallido conserva su token y permite reintentar. No se borra una cuenta para desbloquearla.
- Los errores de CAPTCHA, límites de correo y fallos del servicio se distinguen. Un intento en proceso no afirma que se haya enviado correo.
- Las cuentas existentes, invitadas, inactivas o con historial no reciben otra prueba.
- Si el proyecto tiene la confirmación desactivada, el registro vuelve al inicio de sesión en vez de pedir un correo que no se envía. Esta actualización no desactiva la confirmación.

## Remitente actual: support@unomesa.com

La captura muestra SMTP personalizado activo, host `smtp.gmail.com` y puerto `587`. El ZIP no modifica esos ajustes.

En Supabase → Authentication → Emails → SMTP:

1. Sender email address: `support@unomesa.com`.
2. Sender name: puede usar `UnoMesa`.
3. Username: la dirección completa de la cuenta real de Google/Workspace que autentica el envío. Si support es un alias, use la cuenta propietaria del alias como usuario SMTP y autorice enviar como support en Google.
4. Password: contraseña de aplicación de esa misma cuenta de Google, no la contraseña de inicio de sesión. Una contraseña de aplicación de una cuenta anterior no autentica otra cuenta.
5. Guarde los cambios. El aviso amarillo sobre Gmail es una advertencia de entregabilidad; no identifica por sí solo el motivo del fallo.

Compruebe que `contact@unomesa.com`, usado como destinatario en la prueba, sea un buzón o alias que reciba mensajes. Recibir en contact y enviar desde support son configuraciones independientes.

No comparta contraseñas, secretos ni enlaces de confirmación. Para investigar basta el código de error de Authentication Logs y el nombre del usuario SMTP, sin contraseña.

## Si sigue sin llegar

En Supabase → Authentication → Logs/Audit Logs, busque la solicitud de signup o resend en la hora del intento. También puede usar Logs Explorer para los logs de Auth. Si muestra rechazo SMTP, autenticación fallida, remitente no permitido o límite, hay que corregir ese ajuste del proveedor: un despliegue web no lo cambia.

En Vercel → Logs filtre `[registration]`. El nuevo código registra solo referencia, etapa, código y estado HTTP; nunca contraseña, token ni correo. `stage: intent` con `PGRST202` normalmente indica que falta SQL 59 o actualizar la caché de funciones. Un `unexpected_failure` en signup/resend requiere revisar el detalle SMTP en Supabase, porque Auth puede devolver un error genérico.

Prueba real después del despliegue: registrar una dirección propia, recibir el mensaje, confirmar e iniciar sesión. Reintentar la misma dirección debe dar acceso a la cuenta existente, no crear otra prueba. Las pruebas de esta entrega simulan Auth; no comprueban las credenciales SMTP ni la bandeja de entrada real.

Fuentes oficiales de configuración:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/reference/javascript/auth-resend
- https://supabase.com/docs/guides/auth/debugging/error-codes
- https://support.google.com/mail/answer/22370
- https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app
