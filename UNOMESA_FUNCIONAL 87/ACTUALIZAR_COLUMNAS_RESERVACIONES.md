# Columnas de reservaciones al imprimir o descargar

## Uso

1. En **Reservaciones**, pulse **Imprimir**, **Descargar PDF** o **Descargar Excel**.
2. Abra **Columnas a incluir**.
3. Marque o desmarque los campos que necesita. Por ejemplo, desmarcar **Teléfono** elimina su encabezado y los números de las filas del documento.
4. Genere el documento. También puede usar **Marcar todas** o **Quitar todas**; para generar un listado debe quedar al menos una columna.

Cada impresión, PDF o Excel comienza con todas las columnas disponibles. Desmarcar una columna afecta únicamente al documento en curso, incluido el listado del plano de mesas. No modifica las reservaciones guardadas.

Las casillas corresponden a las columnas disponibles en el formato y contenido elegidos. Se conservan las opciones existentes de resumen, fechas, horas, canceladas y anticipos. **Solo resumen** y **Solo plano** no requieren seleccionar columnas de un listado.

## Publicación

Publicar el código actualizado mediante el proceso habitual del proyecto y recargar UnoMesa. Este cambio no requiere ejecutar SQL ni migrar datos. El ZIP contiene el cambio preparado, no una publicación automática de la web o de las tiendas.

## Validación

- 17 pruebas aprobadas: encabezados y filas, exclusión real de teléfono y observaciones en HTML/PDF/Excel, PDF de varias páginas, una sola columna, selección vacía, opciones en español e inglés, áreas múltiples, filtros de horario y canceladas.
- `tsc --noEmit --incremental false`: aprobado.
- Compilación completa: `npm run build -- --webpack`, aprobada. Se utilizó Webpack porque Turbopack no admite el enlace de dependencias que apunta fuera del proyecto en este entorno de trabajo.
- No se pudo ejecutar la comprobación visual con navegador: el entorno no permite iniciar Chromium. Pendiente de revisión visual en dispositivos reales al publicar.
