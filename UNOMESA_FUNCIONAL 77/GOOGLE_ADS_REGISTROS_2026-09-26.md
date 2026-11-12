# Google Ads: registro completado

La etiqueta base y el evento están integrados en esta versión:

- Etiqueta: `AW-10836285487`.
- Destino de conversión: `AW-10836285487/Sf2SCLLI5oYdEK-wkq8o`.
- Conversión: UnoMesa – Registro completado (categoría Sign-up).
- La conversión se encola únicamente después de que `/api/register` responde correctamente con `ok: true`. Representa la creación de la cuenta; no certifica la posterior confirmación del correo, el uso del producto ni una compra.
- No se envía por abrir el formulario, intentar enviarlo, errores, recuperación de contraseña o inicio de sesión.
- El envío es asíncrono y tiene protección contra repeticiones en la misma carga de página. Si Google está bloqueado, el registro continúa funcionando; ese evento puede no medirse.
- No se pasan nombre, email, teléfono, contraseña, datos del restaurante ni registros operativos a Google. No se activan conversiones mejoradas ni personalización de anuncios desde esta integración.
- La carga se inicia solamente desde la landing pública o el formulario público de registro en `unomesa.com`, `www.unomesa.com`, `mrmaa.com` y `www.mrmaa.com`. Se excluyen localhost, previews y enlaces con tokens de autenticación. La etiqueta ya cargada puede permanecer en memoria al navegar dentro de la aplicación, pero esta integración no emite acciones del panel privado ni páginas vistas automáticas.
- Se admiten los parámetros publicitarios de Google para no bloquear la medición de las visitas provenientes de anuncios. La política CSP permite los servidores necesarios de Google Ads para Guatemala y México.

## Aplicar

1. Actualice el mismo proyecto que sirve UnoMesa, conservando sus variables de entorno y su conexión a Supabase, y despliegue en Vercel.
2. No necesita ejecutar SQL, importar una base de datos ni crear otro proyecto Supabase para este cambio.
3. No pegue además el fragmento de Google en el layout ni en otra herramienta: ya está integrado.
4. Si decide utilizar otra cuenta publicitaria, cambie ambos identificadores en `lib/google-ads.ts` por los de esa cuenta antes de desplegar.
5. Puede desactivar esta integración con `NEXT_PUBLIC_GOOGLE_ADS_ENABLED=false` y un nuevo despliegue. Por defecto está activa en producción, en los dominios indicados.

## Comprobar antes de activar anuncios

1. En Google Ads, abra la conversión y su opción de solucionar problemas con Tag Assistant. Conecte `https://www.unomesa.com/`.
2. Compruebe que se detecta `AW-10836285487` en la landing.
3. Abra el formulario e intente un envío inválido: no debe aparecer el evento de conversión.
4. Complete una cuenta de prueba nueva y confirme el mensaje de registro exitoso. Debe aparecer exactamente un evento `conversion` para `AW-10836285487/Sf2SCLLI5oYdEK-wkq8o`.
5. Iniciar sesión o recargar después no debe generar otro evento de registro.
6. Seleccione este objetivo para las campañas de UnoMesa. Mantenga los objetivos de otros negocios separados. Una prueba directa de Tag Assistant no equivale a una conversión atribuida a un anuncio.

La recepción real por Google debe verificarse después del despliegue. Los bloqueadores, la configuración de consentimiento y las limitaciones del navegador pueden reducir la medición.

## Alcance de los cambios

Solo se modifican `app/page.tsx`, `lib/meta-pixel.ts` (parámetros permitidos) y `next.config.mjs` (CSP), y se añaden `lib/google-ads.ts`, sus pruebas y esta guía. Se conserva el contenido de las demás entradas del ZIP, incluyendo SQL, autenticación, API de registro, pagos, exenciones del piloto y módulos operativos.
