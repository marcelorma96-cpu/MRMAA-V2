# Buscador de áreas en cotizaciones

Esta actualización parte del ZIP actualizado con demo y configuración por país.

- El campo Área permite escribir para filtrar las áreas configuradas; ignora tildes y mayúsculas.
- El botón Todas, a la par del campo, abre el listado completo aunque haya una búsqueda escrita.
- La lista tiene altura limitada y desplazamiento, marca la selección actual y completa el mismo campo al seleccionar.
- El nombre y el identificador del área se actualizan juntos. Una búsqueda que no corresponda a un área configurada no se guarda como área nueva.
- Admite teclado y selección táctil, español/inglés y temas claro/oscuro.

## Aplicación

Desplegar este ZIP en el mismo proyecto y con la misma configuración utilizada para la versión anterior. No requiere ejecutar SQL ni cambiar variables de entorno.

El cambio se limita al selector visual del formulario de cotizaciones y sus estilos. Conserva los procedimientos de guardado, las áreas existentes, las cotizaciones y las reservas vinculadas. El selector de reservaciones conserva su implementación anterior.

## Verificación

Compilación de producción y TypeScript correctos. Verificación del componente real dentro del formulario en navegador: ocho combinaciones de español/inglés, claro/oscuro y móvil/escritorio; búsqueda, listado completo, desplazamiento, teclado, selección táctil, validación y sincronización de nombre/ID. Sin operaciones en la base de datos de producción.
