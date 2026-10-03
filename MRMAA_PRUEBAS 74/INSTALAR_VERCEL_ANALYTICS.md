# Vercel Web Analytics para MRMAA

## Aplicar
1. Actualice el código del mismo proyecto conectado a mrmaa.com con este ZIP.
2. Conserve sus variables de entorno, dominio y conexión a Supabase actuales.
3. En Vercel, compruebe que Web Analytics esté habilitado para ese proyecto.
4. Despliegue a producción. La dependencia @vercel/analytics 2.0.1 ya está incluida en package.json y package-lock.json; Vercel la instala durante el build.
5. Abra https://www.mrmaa.com/ en una ventana sin sesión iniciada. Si está probando, desactive el bloqueador de anuncios para ese sitio. Vuelva a Analytics y actualice el panel tras un breve intervalo.

No requiere ejecutar SQL, cambiar la base de datos ni activar una integración automática con Vercel Agent. No se ha desplegado desde este trabajo.

## Alcance
- Cuenta páginas vistas de la landing pública de mrmaa.com y www.mrmaa.com después de que termine la comprobación existente de sesión.
- El componente se monta únicamente en Landing. Las vistas internas, registro e inicio de sesión quedan fuera de la medición de páginas vistas.
- Las URLs de autenticación/recuperación y parámetros no reconocidos se excluyen; las URLs enviadas se limpian de query y fragmentos.
- No añade eventos con nombres, correos, reservaciones, clientes, cotizaciones, horarios ni datos de pagos.
- El país aproximado, dispositivo, navegador y procedencia disponibles se consultan en el panel de Vercel. No identifica individualmente a los visitantes ni recupera visitas anteriores a la instalación.
- Las visitas propias a la landing sin sesión pueden contarse. Los bloqueadores y las distintas reglas de atribución pueden producir diferencias con Meta.
- No incorpora medición de registros completados, pruebas iniciadas ni compras.
- El píxel Meta 1105508185670938 permanece sin cambios.
- Los endpoints de Analytics se sirven desde el mismo origen; no se ampliaron los permisos CSP.

Para desactivar esta integración, establezca NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=false y vuelva a desplegar. No es necesario añadir esta variable para activarla.

## Validación realizada
- Build de producción Next.js y TypeScript correctos.
- 15 pruebas correctas (10 existentes del píxel Meta y 5 sobre los filtros de Vercel Analytics).
- Dependencias anteriores conservadas; se añade solamente @vercel/analytics 2.0.1.
- Verificación de archivos contra el ZIP de origen, sin cambios en APIs, SQL, autenticación, cobros, módulos operativos o configuración de negocio.

La recepción de visitas en la cuenta de Vercel debe confirmarse después del despliegue.
