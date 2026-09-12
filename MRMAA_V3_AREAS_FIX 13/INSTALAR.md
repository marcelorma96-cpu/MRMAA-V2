# Actualización MRMAA — 12 de septiembre de 2026

## Botón Imprimir en cotizaciones

Esta actualización agrega Imprimir junto a PDF en la vista previa, también cuando se abre desde Reservaciones. Utiliza las mismas imágenes, tamaños, márgenes y divisiones de página del PDF. Espera a que carguen todas las imágenes, excluye los botones del documento y registra la solicitud de impresión en el historial.

Para este cambio no necesita SQL nuevo si ya aplicó los del ZIP anterior. Actualice los archivos de la carpeta existente y despliegue el nuevo commit. Las indicaciones siguientes corresponden a los cambios anteriores, solo si aún no los instaló.

En el diálogo de impresión elija papel A4, escala 100 % y desactive los encabezados/pies del navegador si aparecen. Imprimir no cambia la sección abierta ni el estado de la cotización.

Compilación correcta y 200 pruebas automáticas aprobadas. Se comprobó la espera de imágenes, las dimensiones y el número de páginas, los permisos y la limpieza del documento de impresión. El navegador de pruebas no pudo abrir la vista local; falta comprobar el diálogo de impresión en sus equipos Windows y Mac.

## Actualización V3 anterior pendiente

Para actualizar la versión V3 existente:

1. En Supabase → SQL Editor → New query, pegue TODO el contenido de `SUPABASE_AREAS_ROLES.sql` y pulse Run. Ejecútelo completo. Habilita agregar, editar y retirar áreas para Gerente y Operador; mantiene el aislamiento entre restaurantes y el acceso de Solo lectura.
2. Si aún no aplicó `SUPABASE_AVISOS_IMPORTACION.sql` del ZIP anterior, ejecútelo completo también. Si ya lo aplicó, no necesita repetirlo.
3. Descomprima este ZIP y actualice los archivos de la carpeta existente `MRMAA_V3_AREAS_FIX` en GitHub.
4. Mantenga esa carpeta como Root Directory en Vercel y despliegue el commit que contiene esta actualización.

Los demás SQL se conservan por continuidad con las actualizaciones anteriores. No es necesario repetirlos si ya los aplicó. Los scripts antiguos de áreas deben ejecutarse antes de `SUPABASE_AVISOS_IMPORTACION.sql` y `SUPABASE_AREAS_ROLES.sql`, nunca después, porque reemplazan funciones y permisos.

## Cambios de esta actualización

- Administrador, Gerente y Operador pueden agregar, editar y eliminar áreas desde Configuración → Reservaciones. Eliminar retira el área del listado y conserva las reservas y cotizaciones anteriores. Volver a agregar un área retirada recupera su identidad e historial.
- Las demás preferencias de reservaciones siguen disponibles únicamente para el Administrador. Se conserva la gestión de productos para Gerente y Operador y el acceso de consulta de Solo lectura.
- El aviso para cambiar la altura del cuadro de empleados y turnos aparece abajo, junto a la esquina de redimensionado en computadora. Se retiró el aviso superior; se mantiene el botón Minimizar.
- Tutorial e Instructivo actualizados con las áreas, permisos y controles actuales.
- Revisión de textos en inglés: títulos, buscadores, ayudas, tutorial, instructivo, confirmaciones, mensajes y etiquetas de accesibilidad. Los atributos actualizados al interactuar también se traducen.
- Incluye las funciones anteriores: Excel por rango en Horarios, avisos de reservas importadas hasta tres horas, fechas locales y carga diferida de módulos.

## Validación

Compilación de producción correcta y 200 pruebas automáticas aprobadas, incluidas permisos reales en PostgreSQL de prueba, aislamiento entre restaurantes, exportaciones, invitaciones y cobertura de textos estáticos. No se ejecutó SQL ni se modificó el sitio en producción. Falta la comprobación visual en sus dispositivos.

Se conserva la arquitectura existente. Esta actualización no certifica capacidad para 50,000 restaurantes ni millones de registros por restaurante.

No contiene dependencias instaladas, compilaciones, credenciales ni archivos de prueba.
