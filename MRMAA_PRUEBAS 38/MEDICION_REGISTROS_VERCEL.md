# Medición de registros — 24 de septiembre de 2026

## Activación
1. Actualice el proyecto existente con este ZIP y despliegue en Vercel como de costumbre, conservando sus variables de entorno.
2. Web Analytics debe estar habilitado en el proyecto que sirve mrmaa.com; los eventos personalizados requieren Pro o Enterprise.
3. No requiere SQL, migraciones, nuevas dependencias ni nuevas variables. NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=false desactiva esta medición junto con la anterior.
4. En producción, abra https://www.mrmaa.com/ sin sesión, pulse Prueba gratis y vaya a Vercel → proyecto → Analytics → eventos personalizados. Los nombres aparecerán cuando Vercel reciba cada evento. Seleccione un periodo que incluya la prueba.

## Eventos
- Registro_abierto: cada apertura del formulario de creación de cuenta (también desde iniciar sesión). Cambiar de plan o escribir no añade aperturas.
- Registro_intento: cada envío, incluso si la validación nativa impide enviarlo. Un envío con varios campos inválidos cuenta como un intento.
- Registro_exitoso: /api/register devuelve respuesta HTTP exitosa con ok:true. Es una respuesta de registro aceptado; NO demuestra confirmación del correo, entrada a la app, inicio efectivo de prueba ni pago. Supabase Authentication sigue siendo la referencia para cuentas nuevas reales, particularmente ante reintentos o correos existentes.
- Registro_error: validación, rechazo del servidor o error de conexión/procesamiento. La propiedad reason contiene solo categorías fijas: browser_validation, configuration, closed, password_mismatch, password_policy, terms, captcha, pending, rate_limit, server o network.

Los números son eventos, no personas únicas. Un visitante puede intentar varias veces. Compare aperturas, intentos y éxitos del mismo periodo; no interprete su cociente automáticamente como conversión de usuarios únicos. No reconstruye actividad previa al despliegue ni atribuye por sí solo cada registro al anuncio. Las visitas propias/pruebas también cuentan. Los bloqueadores pueden impedir medición.

## Privacidad y alcance
Solo se instrumenta el formulario público sin sesión; no se instrumentan recuperación de contraseña, login, espacios privados ni datos de restaurantes. No se envían nombres, correos, teléfonos, contraseñas, contenido del formulario ni mensajes del servidor. Los parámetros y fragmentos se eliminan de la URL enviada. Se bloquean callbacks de autenticación, dominios de prueba y rutas privadas. La medición no bloquea el registro si falla.

Los cambios no alteran el píxel de Meta ni agregan conversiones de Meta. Su campaña no cambia de objetivo automáticamente.

## Verificación
Compilación de producción: aprobada. 20 pruebas automatizadas de píxel, vistas y eventos: aprobadas. No se han creado cuentas ni desplegado cambios en producción desde esta revisión. Tras desplegar, confirme Registro_abierto y Registro_intento con una prueba; para comprobar Registro_exitoso complete una cuenta de prueba con un correo nuevo y verifique también Supabase.

Solo se modificó app/page.tsx entre los archivos existentes. Se agregaron lib/registration-analytics.ts, tests/registration-analytics.test.cjs y este documento. API de registro, SQL, pagos, exenciones piloto, configuraciones y módulos operativos permanecen idénticos en el ZIP.
