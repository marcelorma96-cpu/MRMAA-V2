# Activar los correos de MRMAA en español, inglés y francés

Esta actualización prepara MRMAA y las plantillas. Para que los correos cambien
de idioma en la página publicada, complete los dos pasos siguientes: actualizar
la aplicación y guardar las plantillas en Supabase.

## 1. Actualizar MRMAA

Extraiga el ZIP, reemplace los archivos del proyecto en GitHub y espere a que
Vercel termine el despliegue. Mantenga las variables de entorno que ya utiliza.
Esta actualización no requiere SQL adicional ni nuevas claves.

El envío seguirá utilizando el SMTP de Google que configuró con
`support@mrmaa.com` y el nombre de remitente `MRMAA Autorización`.

## 2. Guardar las plantillas en Supabase

Abra su proyecto → **Authentication → Emails**. Para cada fila de esta tabla:

1. Abra la plantilla indicada en la primera columna.
2. En **Subject**, pegue todo el contenido del archivo `.subject.txt`.
3. En **Body → Source**, pegue todo el contenido del archivo `.html`.
4. Guarde los cambios antes de pasar a la siguiente plantilla.

Los archivos están dentro de la carpeta `supabase-email-templates` del ZIP.
Copie también las expresiones entre `{{` y `}}`: permiten elegir el idioma y
mantener el enlace de acceso generado por Supabase.

| Plantilla en Supabase | Archivo para Subject | Archivo para Body / Source |
| --- | --- | --- |
| Invite user | invite.subject.txt | invite.html |
| Reset password | recovery.subject.txt | recovery.html |
| Confirm sign up | confirmation.subject.txt | confirmation.html |
| Change email address | email_change.subject.txt | email_change.html |

También se incluyen estas plantillas para las funciones que utilice su proyecto:

| Plantilla en Supabase | Archivo para Subject | Archivo para Body / Source |
| --- | --- | --- |
| Magic link | magic_link.subject.txt | magic_link.html |
| Reauthentication | reauthentication.subject.txt | reauthentication.html |
| Password changed | password_changed.subject.txt | password_changed.html |
| Email address changed | email_changed.subject.txt | email_changed.html |

Las notificaciones de contraseña cambiada y correo cambiado solo se envían si
están habilitadas en Supabase. Guardar las traducciones no las activa por sí solo.

## Elegir el idioma

- **Cada usuario:** en el menú de MRMAA, abra **Idioma de mis correos**, seleccione
  Español, English o Français y pulse **Guardar idioma**. Está disponible para
  todos los roles. Para administradores también aparece en **Configuración → Cuenta**.
- **Invitaciones nuevas:** en **Configuración → Usuarios**, elija **Idioma del
  correo** antes de pulsar **Invitar**. El valor inicial es el idioma guardado
  del restaurante.
- **Usuarios existentes e invitados pendientes:** el administrador puede
  ajustar el idioma desde **Editar usuario**. El administrador principal cambia
  su propia preferencia desde **Idioma de mis correos**; su rol permanece protegido.
- **Reenvíos y recuperación de contraseña:** usan la preferencia guardada del
  destinatario, aunque solicite el enlace desde otro navegador o computadora.
- **Sin preferencia guardada:** el correo se envía en español. Las cuentas
  antiguas pueden elegir su idioma desde el menú; no hace falta migrar datos.

El idioma del restaurante determina el valor inicial de las nuevas invitaciones.
Cambiarlo no reemplaza las preferencias personales de quienes ya tienen cuenta.
Esta actualización cambia el idioma de los correos, no traduce el resto del
dashboard. MRMAA no lee la configuración de idioma de Gmail.

## Comprobarlo después de publicar

1. Entre con una cuenta de prueba existente, guarde **English** como idioma de
   sus correos y cierre sesión.
2. Solicite un restablecimiento para esa cuenta. El asunto, el mensaje y el botón
   deben llegar en inglés desde `support@mrmaa.com`.
3. Cambie la preferencia a **Français**, guarde y repita. Luego pruebe **Español**.
4. Desde un administrador, invite una dirección de prueba nueva eligiendo un
   idioma distinto al del restaurante. Compruebe el idioma y el enlace de alta.
5. Para probar un reenvío, use una invitación aún pendiente y espere al menos
   60 segundos. El idioma del destinatario debe conservarse.

Si la vista previa de Supabase muestra español, puede estar utilizando datos de
muestra sin preferencia de idioma. El envío real toma el idioma del destinatario.
Si el correo real sigue en otro idioma, compruebe que guardó **Subject y Body**
en la plantilla correspondiente y que publicó esta versión de MRMAA.

## Detalles de la actualización

- La preferencia se guarda en `auth.users.user_metadata.language`: `es`, `en` o `fr`.
- La actualización personal solo envía el campo de idioma. Conserva el resto
  de los metadatos y no modifica los permisos del usuario.
- Las invitaciones incluyen el idioma antes de que Supabase envíe el mensaje.
- Los reenvíos usan la plantilla de recuperación con texto de invitación cuando
  el destino es `https://mrmaa.com/?invite=1`. El token y su verificación siguen
  siendo los de Supabase.
- La API valida los idiomas y limita la edición de otros usuarios a
  administradores activos del mismo restaurante. Protege el rol del propietario.
- Las plantillas conservan `{{ .ConfirmationURL }}` y el código `{{ .Token }}`
  en reautenticación. No se utiliza un servicio de correo nuevo ni un Auth Hook.

Validación local: pruebas de invitación, edición, reenvío, rechazo de cambios
no autorizados y selección de idioma; plantillas ejecutadas con el motor Go
`html/template` usado por Supabase, incluyendo perfiles sin idioma y datos
inválidos. La entrega real de correos se comprueba después de guardar las
plantillas en su proyecto; las pruebas locales no envían correos.

Para desarrollo: `npm test`; con Go instalado,
`go test tests/email_templates_test.go`. Para regenerar los archivos de correo:
`node scripts/generate-email-templates.mjs`.

Referencias oficiales:

- [Plantillas y variables de Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Guardar metadatos del usuario](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [Motor de plantillas de asuntos y cuerpos de Supabase](https://github.com/supabase/auth/blob/master/internal/mailer/templatemailer/template.go)
