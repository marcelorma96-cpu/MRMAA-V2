# MRMAA — lista de seguridad para producción

## Acción obligatoria en Supabase

1. Abra **SQL Editor** y ejecute una sola vez `SUPABASE_PROTECCION_PRODUCCION.sql`.
2. En **Authentication > Sign In / Providers**, desactive **Allow new users to sign up**. Las invitaciones administrativas continuarán funcionando.
3. Mantenga **Confirm email** activado.
4. En **Authentication > URL Configuration**, use:
   - Site URL: `https://mrmaa.com`
   - Redirect URL: `https://mrmaa.com/**`
5. Configure SMTP propio para que invitaciones y recuperaciones no dependan del correo compartido de prueba.
6. Revise **Authentication > Rate Limits** y active CAPTCHA (Cloudflare Turnstile) en las operaciones públicas de autenticación.
7. Active MFA en las cuentas propietarias de Supabase, Vercel, GitHub, Cloudflare y correo.
8. En Supabase Pro, confirme respaldos diarios y, si requiere recuperación a una hora exacta, active PITR.

## Vercel y secretos

- `SUPABASE_SERVICE_ROLE_KEY` debe existir únicamente como variable privada de Vercel; nunca debe comenzar con `NEXT_PUBLIC_` ni almacenarse en GitHub.
- Mantenga solo las variables necesarias en Production y rote cualquier clave que haya sido publicada o compartida accidentalmente.
- Conserve `https://mrmaa.com` como dominio de producción principal.

## Cloudflare

- Mantenga HTTPS estricto y el proxy activo.
- Active reglas administradas del WAF, protección contra bots y límites de solicitudes para `/api/*` y rutas de autenticación.
- Empiece en modo de registro cuando una regla nueva pueda bloquear usuarios legítimos y luego cambie a bloqueo.

## Operación

- Revise periódicamente el Security Advisor y los registros de autenticación de Supabase.
- Pruebe restauraciones de respaldo; un respaldo no probado no garantiza recuperación.
- Dé a cada colaborador el rol mínimo necesario y desactive su acceso al salir de la empresa.
- No envíe contraseñas por WhatsApp o correo. Cada usuario debe crear la suya mediante su invitación.

## Legal

Las páginas incluidas son una base operativa para MYM S.A. y MRMAA en Guatemala, México y Estados Unidos. Antes de iniciar cobros públicos, deben ser revisadas por abogados de las jurisdicciones donde se venderá el servicio. La seguridad técnica reduce riesgos, pero ningún sistema puede prometer protección absoluta contra ataques.
