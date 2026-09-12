# Actualización MRMAA — 12 de septiembre de 2026

Este ZIP actualiza la versión V3 ya instalada. No crea una base de datos nueva.

## Antes de desplegar

1. En Supabase, abra SQL Editor → New query.
2. Abra `SUPABASE_AVISOS_IMPORTACION.sql`, copie TODO su contenido, péguelo en esa consulta y pulse Run. Ejecútelo completo, no sentencia por sentencia.
3. Al terminar sin errores, descomprima el ZIP. Actualice en GitHub los archivos de la carpeta `MRMAA_V3_AREAS_FIX` existente.
4. En Vercel mantenga Root Directory = `MRMAA_V3_AREAS_FIX`. Despliegue el commit de esta actualización, no un despliegue antiguo.
5. Recargue MRMAA y compruebe una exportación de Horarios y una importación pequeña de prueba.

El SQL nuevo agrega avisos y actualiza su comparación; no elimina ni modifica las reservas existentes. Mantiene los permisos y el aislamiento entre restaurantes. No hace falta repetir los SQL anteriores si ya los aplicó. Se conservan en el paquete para instalaciones V3 que aún no los hayan aplicado: no los ejecute después del SQL nuevo, ya que los scripts antiguos de áreas reemplazan la función de avisos.

## Cambios incluidos

- Horarios: botón Excel junto a Imprimir. Ambos consultan el rango de fechas seleccionado, incluso entre meses. La exportación consulta por páginas e incluye las referencias a empleados y turnos inactivos que aparecen en el periodo.
- El Excel incluye fecha, empleado, código, área, tipo de asignación, turno, entrada/salida programadas, comida y notas. No representa asistencia real. La descarga se registra en el historial.
- Aviso visible de que se puede minimizar el cuadro de selección de empleados y turnos.
- Importación de reservas: comprobación previa de coincidencias con reservas existentes y entre filas del archivo. Avisa en el mismo día y hasta tres horas antes o después. Puede cancelar para revisar o confirmar para importar.
- Áreas: los avisos reconocen diferencias de acentos, mayúsculas, puntuación y palabras completas adicionales, por ejemplo Terraza / Terraza exterior. Salón 1 y Salón 2 siguen siendo áreas distintas. No es un detector de todos los errores ortográficos ni garantiza disponibilidad. Las similitudes no renombran ni reasignan automáticamente las áreas importadas.
- Fechas operativas calculadas según la zona horaria del dispositivo: Hoy, nuevos formularios, Horarios y rangos iniciales de reportes. No cambia fechas históricas ni los timestamps UTC de seguridad y auditoría. Mantenga correcta la fecha y zona horaria del equipo.
- Ajustes visuales de tarjetas, navegación, campos y paneles, conservando identidad, logos y funciones.
- Carga diferida de módulos y agrupación de traducciones. El calendario busca las asignaciones mediante un índice en memoria, evitando recorrerlas para cada celda.
- Tutorial e Instructivo actualizados.

## Comprobaciones realizadas

- 191 pruebas automáticas: permisos, aislamiento, invitaciones, PDF, exportaciones, avisos y fechas locales.
- Exportación paginada verificada con 1,240 asignaciones y referencias inactivas.
- Zonas horarias comprobadas: Guatemala, Los Ángeles, Auckland y UTC.
- Compilación de producción correcta. JavaScript inicial: 283 kB (antes 296 kB).
- Prueba HTTP local de la página pública: 500 solicitudes, 25 concurrentes, sin fallos. No mide operaciones autenticadas, Supabase ni capacidad productiva.
- No fue posible abrir la vista local en el navegador de pruebas de esta sesión; falta comprobar visualmente los ajustes en sus dispositivos.

No se modificó producción ni se realizó una prueba integral de 50,000 restaurantes o millones de registros por restaurante. Se conserva la arquitectura existente; esas cifras requieren pruebas de carga en un entorno separado y dimensionamiento real de infraestructura.

No contiene dependencias instaladas, compilaciones, credenciales ni archivos de prueba.
