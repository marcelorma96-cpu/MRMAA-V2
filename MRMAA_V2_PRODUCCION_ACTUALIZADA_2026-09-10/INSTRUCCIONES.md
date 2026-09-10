# MRMAA v2

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
10. Para entrar automáticamente después del registro, abra **Authentication > Sign In / Providers > Email** y desactive **Confirm email**.
11. Suba el contenido de esta carpeta al repositorio `MRMAA-V2`.
12. Vuelva a desplegar el proyecto en Vercel y pruebe el registro completo.

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
