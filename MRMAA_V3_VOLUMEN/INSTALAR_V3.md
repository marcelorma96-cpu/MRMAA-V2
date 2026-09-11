# MRMAA V3: mejoras para volumen elevado

Objetivo: 50,000 restaurantes × 2,000,000 elementos = 100,000,000,000
elementos de negocio, más filas dependientes. Esta entrega NO certifica esa
capacidad ni implementa distribución automática entre bases.

## Actualizar la versión que ya funciona

1. En un entorno de prueba con el esquema actual, ejecutar SUPABASE_VOLUMEN_V3.sql.
   Requiere que las dos migraciones anteriores de escalabilidad/SaaS ya estén aplicadas.
   No es necesario volver a ejecutar esas migraciones en producción.
2. Ejecutar cada CREATE INDEX de SUPABASE_INDICES_V3.sql por separado, fuera de
   una transacción. Revisar índices existentes y espacio disponible primero.
   Si se interrumpe la construcción, revisar pg_index.indisvalid: IF NOT EXISTS
   no repara un índice inválido. No eliminar un índice usado sin diagnóstico.
3. Validar login, roles, reservas, clientes, cotizaciones, horarios y reportes.
4. Aplicar los mismos cambios SQL al proyecto operativo en una ventana supervisada.
5. Subir el contenido de este ZIP a la carpeta del proyecto que Vercel utiliza.
   Root Directory debe ser esa carpeta que contiene package.json, no el ZIP.
   Mantener las variables existentes, incluido CRON_SECRET como secreto.
6. Desplegar el commit nuevo. El cron permanece diario, compatible con Hobby.

## Cambios funcionales de infraestructura

- Índices que coinciden con el orden de clientes, cotizaciones y reservaciones.
- Limpieza de tablas internas limitada a 1,000 filas por tabla/ejecución;
  conserva retención y nunca elimina clientes, reservas ni cotizaciones.
- Recuento de uso de un restaurante por llamada HTTP, sin barrido global al
  aplicar la migración SaaS. Selección indexada por antigüedad y exclusión de
  ejecuciones simultáneas del recuento. La función admite como máximo cinco.
- El uso es una fotografía periódica, NO un contador actualizado para facturar
  o bloquear clientes. Con cron diario y 50,000 restaurantes, actualizar cada
  restaurante tardaría demasiado. Antes de escalar, usar contadores incrementales
  o agregados por lotes, trabajadores continuos y alertas de retraso.

## Pruebas reproducibles

Instalar con npm ci. Ejecutar npm test y npm run build.
Prueba local concentrada:

    MRMAA_BENCH_DENSE=1 npm run test:scale-data

Genera 50,000 identidades, con 2 millones de reservas simplificadas en UN
restaurante y el resto vacío. No es una prueba integral ni mide concurrencia.
No se debe extrapolar su tiempo a Supabase. Las pruebas de permisos usan el
esquema de MRMAA en PGlite; índices concurrentes se verifican allí sin CONCURRENTLY.
Su construcción online debe validarse en PostgreSQL/Supabase de prueba.

Validación de esta entrega: 155 pruebas aprobadas, cero fallos; build de
producción completado. Prueba densa: 2,000,000 filas en restaurante 1,
50 filas obtenidas en 9.95 ms en una consulta local (muestra única, no SLO).
Los otros dos restaurantes consultados devolvieron cero filas, como corresponde.
Los SQL históricos incluidos son dependencias de las pruebas; NO ejecutarlos
nuevamente para instalar V3. Seguir únicamente los pasos de actualización arriba.

## Trabajo pendiente antes de la escala objetivo

La aplicación todavía conecta a un solo proyecto Supabase. v2_tenant_locations
es un catálogo, no un router operativo. Para distribuir datos se requiere un
router autenticado del servidor, migrar todos los accesos directos del navegador,
mantener identidad/roles entre proyectos, mover archivos y verificar integridad
antes del cambio de ubicación. No cambiar cluster_key esperando que mueva datos.

Validar particiones por tabla, consultas por cursor para navegación profunda,
reportes agregados y exportaciones mediante trabajadores reales (tener tablas de
cola no significa que todos los módulos las utilicen). Definir SLO de respuesta,
concurrencia, tamaño por restaurante y recuperación de respaldos. Ensayar un
restaurante de 2 millones de elementos con el esquema completo, permisos y mezcla
real de operaciones antes de aumentar clientes por grupo de bases de datos.

Referencias: https://supabase.com/docs/guides/database/postgres/indexes
y https://www.postgresql.org/docs/current/sql-createindex.html
