# Reservaciones, pantalla móvil e inicio — 23 de octubre de 2026

## Cambios
- En el listado: Imprimir y Más opciones → Descargar PDF / Descargar Excel abren opciones de horario y «Excluir reservaciones canceladas». La casilla viene desmarcada para conservar la inclusión anterior del listado. Puede activarla antes de generar el documento.
- En el plano: la misma casilla reemplaza «Incluir canceladas»; viene marcada, conservando la exclusión que ya tenía el plano. Aplica a su listado de reservaciones.
- El filtro solo cambia el archivo o la impresión. No cancela, elimina ni modifica registros. Se recorren todas las páginas del filtro actual, incluso cuando una página completa contiene canceladas. El resumen del documento se calcula con las filas exportadas.
- Botones de acciones con espacio y ajuste de línea; controles de impresión y encabezados adaptados a pantallas estrechas.
- Las etiquetas de mesas permanecen visibles mientras se actualizan. Nunca se reutilizan entre sucursales o idiomas distintos, ni para una reservación cuya área o fecha cambió.
- Los formularios y confirmaciones bloquean el desplazamiento de fondo y conservan el espacio de la barra de scroll. Se eliminó el desplazamiento decorativo al pasar sobre botones.
- Inicio web de la app: logo circular y desvanecimiento suave, sin rebote ni giro. Los proyectos nativos también requieren actualización para corregir su primera pantalla.

## Instalación
1. Actualizar el proyecto web en Vercel con este paquete completo, conservando sus variables de entorno.
2. Android: utilizar UNOMESA_Android.zip, versión 1.0.5 / versionCode 6. Compilar con Android Studio usando la configuración de firma de su app actual y distribuir la nueva compilación.
3. iOS: utilizar UNOMESA_iOS.zip, versión 1.0 / Build 20. Abrir el proyecto actualizado en Xcode, conservar su equipo de firma y compilar/instalar la nueva versión.
4. Publicar únicamente la web no sustituye la primera pantalla nativa de las apps instaladas.

No requiere ejecutar SQL nuevo. No se modificó ningún archivo SQL ni se ejecutaron migraciones o cambios contra la base de datos real. Los cambios anteriores del proyecto, incluidas las descripciones en inglés, están conservados.

## Verificación realizada
- TypeScript sin errores y compilación de producción Next.js correcta (48 páginas).
- 11 pruebas automatizadas: paginación y estados cancelados, límites, fallos de lectura, horario, impresión del plano y datos de reportes.
- Navegador Chromium con datos ficticios: tamaños de 320, 390, 430, 768 y 1280 px; impresión excluye canceladas; Excel excluye canceladas; PDF permite incluirlas.
- Edición, eliminación y actualización de la lista sin perder la posición; cierre de formularios y bloqueo del desplazamiento de fondo; no reapareció la cubierta de carga.
- Separación de etiquetas entre sucursales durante una actualización lenta.
- XML, plist y catálogos de recursos nativos validados; recurso circular iOS renderizado e inspeccionado.
- No se compiló ni ejecutó el código nativo en dispositivos: este entorno no dispone de Xcode ni Android SDK. Probar apertura en frío, regreso del segundo plano, modo oscuro y conexión lenta al instalar las nuevas compilaciones.
