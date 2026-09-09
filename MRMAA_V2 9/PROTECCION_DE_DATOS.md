# Protección de datos de MRMAA

## Protección incluida en la aplicación

- Papelera de 30 días para clientes, cotizaciones y reservaciones.
- Restauración exclusiva para administradores.
- Eliminación definitiva bloqueada durante los primeros 30 días.
- Historial de creación, modificación, papelera, restauración y eliminación definitiva.
- Exportación completa paginada en formato JSON con suma SHA-256 para comprobar integridad.
- Registros activos separados automáticamente de los registros eliminados.

## Rutina recomendada

1. Active Supabase Pro para obtener respaldos diarios administrados.
2. Descargue semanalmente **Configuración > Seguridad > Exportar respaldo completo**.
3. Guarde el archivo en dos lugares: una computadora autorizada y almacenamiento externo cifrado.
4. Conserve al menos 7 copias diarias, 4 semanales y 12 mensuales cuando se automatice el destino externo.
5. Pruebe una restauración en un proyecto Supabase separado cada tres meses.
6. Nunca pruebe migraciones en producción. Utilice un proyecto independiente para desarrollo.

## Pendiente para automatización externa

La automatización necesita un proveedor de destino y credenciales propias del negocio. Puede conectarse posteriormente a Google Drive, Dropbox o almacenamiento compatible con S3. No coloque esas credenciales en GitHub; deberán guardarse como secretos del entorno.
