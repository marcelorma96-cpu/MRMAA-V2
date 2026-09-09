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
7. En Vercel conserve o agregue estas variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (privada; necesaria para invitar usuarios)
8. En Supabase abra **Authentication > URL Configuration** y coloque como **Site URL** el dominio temporal de Vercel.
9. Para entrar automáticamente después del registro, abra **Authentication > Sign In / Providers > Email** y desactive **Confirm email**.
10. Suba el contenido de esta carpeta al repositorio `MRMAA-V2`.
11. Vuelva a desplegar el proyecto en Vercel y pruebe el registro completo.

Si ya ejecutó la versión anterior de `SUPABASE_V2_MODULES.sql`, sus áreas y turnos existentes no se eliminan. Ahora puede borrarlos desde **Configuración > Horarios** y crear los suyos.

## Importante

- No ejecute `DROP TABLE` ni borre tablas antiguas.
- Las tablas nuevas comienzan con `v2_`.
- Los datos anteriores no se copian automáticamente. La migración se debe hacer después de aprobar la nueva versión.
- Descargue un respaldo desde **Configuración > Seguridad** antes de ejecutar futuras migraciones SQL.
- Active MFA en Supabase, GitHub y Vercel y no comparta `SUPABASE_SERVICE_ROLE_KEY`.
