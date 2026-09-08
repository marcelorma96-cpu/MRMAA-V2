# MRMAA v2

Esta versión es independiente y no borra información de MRMAA anterior.

## Instalación

1. En Supabase abra **SQL Editor**.
2. Si es una instalación nueva, copie todo `SUPABASE_V2.sql` y presione **Run**.
3. Si ya había instalado la primera versión v2, ejecute solamente `SUPABASE_V2_ONBOARDING.sql`.
4. En Vercel conserve o agregue estas variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. En Supabase abra **Authentication > URL Configuration** y coloque como **Site URL** el dominio temporal de Vercel.
6. Para entrar automáticamente después del registro, abra **Authentication > Sign In / Providers > Email** y desactive **Confirm email**.
7. Suba el contenido de esta carpeta al repositorio `MRMAA-V2`.
8. Vuelva a desplegar el proyecto en Vercel y pruebe el registro completo.

## Importante

- No ejecute `DROP TABLE` ni borre tablas antiguas.
- Las tablas nuevas comienzan con `v2_`.
- Los datos anteriores no se copian automáticamente. La migración se debe hacer después de aprobar la nueva versión.
