# Actualización MRMAA — 12 de septiembre de 2026

## Corrección de impresión de cotizaciones

Imprimir abre directamente un PDF con las mismas páginas, imágenes, importes y posiciones que la descarga. La impresión ya no reconstruye las hojas mediante HTML. Se corrigió el redondeo de las alturas de filas que podía provocar hojas casi vacías y se ajustan las columnas numéricas al ancho real de sus importes.

No requiere SQL nuevo si ya aplicó los de la versión anterior. Actualice los archivos de la carpeta existente `MRMAA_V3_AREAS_FIX` y despliegue el nuevo commit con el mismo Root Directory.

Al pulsar Imprimir se abre el PDF en otra pestaña. Si el navegador no abre automáticamente el diálogo, use el botón de impresión del visor del PDF. Seleccione Ajustar al área imprimible para su papel A4 o Carta. Si se bloquea la pestaña, la aplicación ofrece Abrir PDF para imprimir. La sección original y el estado de la cotización se conservan.

Validación: compilación de producción y 204 pruebas automáticas aprobadas. Una cotización sintética de 14 productos con descripciones en lista produjo dos páginas; se verificó visualmente y se compararon exactamente los contenidos, imágenes y tamaños de ambos PDF. También se comprobaron alturas fraccionarias de filas, ventanas bloqueadas y limpieza de los documentos temporales. No fue posible comprobar el diálogo nativo ni una impresora física en Windows o Mac en este entorno.

## Actualización V3 anterior pendiente

Para actualizar la versión V3 existente:

1. En Supabase → SQL Editor → New query, pegue TODO el contenido de `SUPABASE_AREAS_ROLES.sql` y pulse Run. Ejecútelo completo. Habilita agregar, editar y retirar áreas para Gerente y Operador; mantiene el aislamiento entre restaurantes y el acceso de Solo lectura.
2. Si aún no aplicó `SUPABASE_AVISOS_IMPORTACION.sql` del ZIP anterior, ejecútelo completo también. Si ya lo aplicó, no necesita repetirlo.
3. Descomprima este ZIP y actualice los archivos de la carpeta existente `MRMAA_V3_AREAS_FIX` en GitHub.
4. Mantenga esa carpeta como Root Directory en Vercel y despliegue el commit que contiene esta actualización.

Los demás SQL se conservan por continuidad con las actualizaciones anteriores. No es necesario repetirlos si ya los aplicó. Los scripts antiguos de áreas deben ejecutarse antes de `SUPABASE_AVISOS_IMPORTACION.sql` y `SUPABASE_AREAS_ROLES.sql`, nunca después, porque reemplazan funciones y permisos.

## Cambios incluidos de versiones anteriores

- Administrador, Gerente y Operador pueden agregar, editar y eliminar áreas desde Configuración → Reservaciones. Eliminar retira el área del listado y conserva las reservas y cotizaciones anteriores. Volver a agregar un área retirada recupera su identidad e historial.
- Las demás preferencias de reservaciones siguen disponibles únicamente para el Administrador. Se conserva la gestión de productos para Gerente y Operador y el acceso de consulta de Solo lectura.
- El aviso para cambiar la altura del cuadro de empleados y turnos aparece abajo, junto a la esquina de redimensionado en computadora. Se retiró el aviso superior; se mantiene el botón Minimizar.
- Tutorial e Instructivo actualizados con las áreas, permisos y controles actuales.
- Revisión de textos en inglés: títulos, buscadores, ayudas, tutorial, instructivo, confirmaciones, mensajes y etiquetas de accesibilidad. Los atributos actualizados al interactuar también se traducen.
- Incluye las funciones anteriores: Excel por rango en Horarios, avisos de reservas importadas hasta tres horas, fechas locales y carga diferida de módulos.

## Validación

Compilación de producción correcta y 204 pruebas automáticas aprobadas, incluidas permisos reales en PostgreSQL de prueba, aislamiento entre restaurantes, exportaciones, invitaciones y cobertura de textos estáticos. No se ejecutó SQL ni se modificó el sitio en producción. Falta la comprobación visual en sus dispositivos.

Se conserva la arquitectura existente. Esta actualización no certifica capacidad para 50,000 restaurantes ni millones de registros por restaurante.

No contiene dependencias instaladas, compilaciones, credenciales ni archivos de prueba.
