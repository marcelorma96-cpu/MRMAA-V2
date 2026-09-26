# Landing y registro — 24 septiembre 2026

- Mensaje centrado en reservas y cotizaciones; CTA naranja, sin tarjeta junto al botón.
- Demostración de 18 segundos, con pantallas reales y datos de ejemplo, sin audio. Carga solo al solicitar reproducción.
- Seis campos principales: nombre, restaurante, teléfono, email, contraseña y confirmación de contraseña.
- País, idioma y moneda desplegables con sus valores previos; no se eliminan del envío.
- Se conserva la segunda escritura de contraseña, se bloquea el envío si no coincide y cada campo permite mostrar u ocultar su contenido. Se mantiene la política de fortaleza.
- Nuevos registros públicos siempre reciben Advanced, 10 días, sin tarjeta. También se aplica en el servidor para peticiones de formularios anteriores.
- Las tarjetas mantienen precios y funciones. Sus botones dicen Probar Advanced gratis y abren esa prueba, no un cobro.
- Contratación y cambios de plan siguen en el flujo existente de pagos. Los límites de usuarios del plan elegido siguen aplicando.

## Conservación
No hay SQL nuevo ni cambios en los SQL existentes. No se ejecutó ninguna migración ni escritura a Supabase. Rutas de pagos, webhooks, cuentas, exenciones piloto, datos operativos y archivos de medición permanecen idénticos al ZIP de entrada (versión 62).

## Verificación
Compilación Next y TypeScript correctas. Las 20 pruebas existentes de Meta Pixel y Vercel Analytics pasaron. Comparación: 5 archivos existentes modificados, 118 idénticos. Se agregan este documento y dos archivos de video/portada.
El navegador de revisión no tuvo acceso al servidor local; falta comprobación visual en móvil y prueba integral de un nuevo registro en un despliegue de vista previa.

## Aplicación
Actualizar el proyecto existente conservando sus variables de entorno. No recrear la base de datos ni ejecutar SQL. Antes de producción, revisar en un despliegue de vista previa: CTA, reproducción, formulario móvil, registro/confirmación por email y asignación Advanced; verificar también inicio de sesión existente. Esta entrega no se ha desplegado automáticamente.

## Revisión de contraseña y contraste
- Se restaura Confirmar contraseña con validación previa al envío y aviso accesible de discrepancia.
- Colores de fondo y texto coordinados en modo oscuro para resumen de prueba, landing, controles de semana y ayuda, requisitos de contraseña y etiquetas de botones deshabilitados.
- TypeScript y las 20 pruebas existentes de Pixel/Analytics pasaron. Prueba de navegador del formulario a 1365 y 390 píxeles: discrepancia bloquea la solicitud, coincidencia envía una vez, visibilidad independiente y sin desbordamiento horizontal. Solicitudes de registro simuladas, sin crear cuentas reales.
- Contraste calculado en Chromium para botones del landing y formulario, y controles compartidos normales, seleccionados, hover y deshabilitados: mínimo 4.5:1 en las muestras revisadas. No constituye una prueba de todos los estados de cuentas en producción.
- Se conserva la carpeta MRMAA_PRUEBAS 26. Solo se modifican app/page.tsx, app/globals.css y este documento respecto del ZIP recibido. Pixel, Analytics, API de registro, pagos, SQL y demás archivos se conservan byte por byte. No requiere SQL adicional.

## Sección destacada de horarios
Se agrega una sección pública en español e inglés sobre horarios del personal, con turnos, descansos, permisos, calendario mensual, PDF y Excel. El cuadro ilustrativo usa datos ficticios. Disponible en Intermediate y Advanced e incluido en la prueba Advanced. El botón utiliza la misma entrada a la prueba existente.
Comparación contra el ZIP anterior: todo el código fuera de Landing permanece idéntico, incluidas confirmación de correo, CAPTCHA, registro y doble contraseña. Sin cambios en APIs, pagos, SQL, Analytics ni Pixel. TypeScript y pruebas del formulario/contraste en navegador a 1365 y 390 px pasaron con solicitudes simuladas. No se ha desplegado ni probado una confirmación real por email.
