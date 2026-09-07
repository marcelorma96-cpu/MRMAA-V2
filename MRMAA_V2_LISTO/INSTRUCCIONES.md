# MRMAA v2

Esta versión es independiente y no borra información de MRMAA anterior.

## Instalación

1. En Supabase abra **SQL Editor**.
2. Cree una consulta nueva, copie todo el contenido de `SUPABASE_V2.sql` y presione **Run**.
3. En Vercel conserve o agregue estas variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Suba el contenido de esta carpeta a un repositorio nuevo de GitHub, por ejemplo `mrmaa-v2`.
5. Cree un proyecto nuevo en Vercel conectado a ese repositorio. No reemplace todavía el proyecto actual.
6. Pruebe el dominio temporal que entrega Vercel. Cuando todo esté aprobado, el dominio `mrmaa.com` se puede mover al proyecto nuevo.

## Importante

- No ejecute `DROP TABLE` ni borre tablas antiguas.
- Las tablas nuevas comienzan con `v2_`.
- Los datos anteriores no se copian automáticamente. La migración se debe hacer después de aprobar la nueva versión.
