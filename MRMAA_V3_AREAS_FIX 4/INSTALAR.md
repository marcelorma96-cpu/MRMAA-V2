# Actualización sobre MRMAA V3 existente

1. Si ya ejecutó SUPABASE_AREAS_AVISOS.sql, NO lo repita. Si todavía no lo ejecutó, ejecútelo primero.
2. Ejecute completo SUPABASE_AREAS_INDEPENDIENTES.sql en el SQL Editor de Supabase.
3. Suba esta carpeta descomprimida a GitHub. En Vercel use Root Directory MRMAA_V3_AREAS_FIX y despliegue ese commit.
4. En Configuración → Reservaciones cree sus áreas. El catálogo empieza vacío; Horarios conserva las suyas. Use Editar para cambiar nombres.

Los textos de áreas de reservas y cotizaciones anteriores se conservan. Al agregar un área, los históricos que coinciden por nombre se vinculan al catálogo nuevo. Los nombres no reconocidos requieren seleccionar un área del listado al editar. El aviso conserva el intervalo de hasta tres horas, mismo día y área.

El buscador muestra sugerencias mientras escribe. Al elegir una sugerencia se actualiza el listado; al elegir en el listado, el buscador muestra el nombre completo. Escribir un nombre exacto también selecciona esa área. Solo se aceptan áreas configuradas. Las cotizaciones pueden permanecer sin área hasta que se conviertan en reservación.
La papelera permite buscar por cliente, número de cotización, fecha o tipo entre los registros cargados.
Este ZIP contiene la aplicación, configuración e instrucciones necesarias para esta actualización; no es un instalador de una base vacía.
