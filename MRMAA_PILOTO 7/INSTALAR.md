# MRMAA · Buscadores y filas de cotizaciones · 14/09/2026

## Cómo reconocer esta actualización

En Nueva cotización y Editar cotización:

- Ya no aparece «Agregar desde menús y productos» ni un selector de menú separado.
- El campo «Producto o servicio» tiene una lupa. Al escribir filtra por nombre o descripción, sin distinguir mayúsculas ni acentos. Al seleccionar una sugerencia completa descripción y precio, conservando la cantidad. También admite productos escritos manualmente.
- Cada fila tiene un botón rojo con icono y texto «Eliminar». Retira la fila completa, llena o vacía, incluso la última. Los totales se recalculan al eliminar.
- Área tiene un solo buscador con sugerencias. Solo acepta áreas configuradas; quitar el selector no permite guardar áreas desconocidas.
- Las filas se reorganizan cuando el espacio es reducido para mantener accesible el botón Eliminar.

## Instalar esta corrección

Estos cambios del formulario son solo de código: **no requieren SQL nuevo y no borran datos**.

1. Descomprima este ZIP. Sustituya los archivos dentro de la carpeta que Vercel usa actualmente como Root Directory. Es la carpeta que contiene `package.json`, `app`, `components` y `lib`.
2. Incluya el archivo nuevo `components/quote-items-editor.tsx`. No anide otra carpeta del proyecto dentro de la existente ni cambie Root Directory por el nombre del ZIP.
3. Despliegue en Vercel el commit nuevo. Recargar o volver a desplegar un commit anterior conserva el formulario anterior.
4. Abra nuevamente MRMAA y compruebe la lupa en Producto y el texto «Eliminar» en cada fila. Si todavía aparece «Agregar desde menús y productos», esa página sigue mostrando una versión anterior.

Se conserva el permiso del gerente para enviar cotizaciones a la papelera. Si ya aplicó el `SUPABASE_GERENTE_RESERVACIONES.sql` de la entrega anterior, no lo repita. Las cotizaciones con reserva vigente siguen protegidas.

El riesgo de duplicación al guardar sigue pendiente de corrección, como se indicó en la revisión anterior; esta entrega cambia únicamente los campos del formulario.

## Verificación de esta corrección

La comprobación de componentes cubre quitar filas llenas y vacías, quitar la última y agregar otra, recalcular totales, buscar por nombre o descripción, completar precio y descripción, conservar cantidad y validar áreas configuradas. La compilación de producción y la comprobación de tipos se ejecutaron localmente. No se verificó visualmente en navegadores o dispositivos porque el navegador disponible no pudo acceder al servidor local. No se desplegó esta corrección en MRMAA.com.
