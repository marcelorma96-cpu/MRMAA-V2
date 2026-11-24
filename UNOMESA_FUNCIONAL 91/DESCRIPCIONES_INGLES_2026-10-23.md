# Descripciones en inglés de la página pública

Actualice el proyecto web en Vercel con este archivo. No requiere ejecutar SQL nuevo.

1. Abra **Configuración → Página pública → Contenido**.
2. Debajo de la descripción del restaurante, abra **Descripción en inglés**.
3. Escriba la versión en inglés o pulse **Generar traducción** y revise el resultado.
4. Repita en los detalles de los menús y salones que tengan descripción.
5. Pulse **Guardar cambios**. En la vista previa o en su enlace público, **English** mostrará esas versiones; **Español** mostrará las descripciones originales.

Las traducciones se guardan por separado. Una descripción sin versión en inglés sigue mostrando el original, sin dejar espacios vacíos. Los nombres propios, precios, capacidades, PDFs y valores de las solicitudes conservan su comportamiento actual. Si cambia una descripción original, revise también su versión en inglés.

La generación usa la configuración de OpenAI y el límite mensual de 50 consultas por restaurante que ya utiliza el asistente. Requiere acceso de administrador a la página pública. Cada intento aceptado consume una consulta; reintentar una solicitud pendiente consulta el mismo intento. Si el asistente no está habilitado o no quedan consultas, puede escribir las traducciones manualmente. Los visitantes no generan llamadas de IA al cambiar de idioma.

Generar prepara un texto para revisar; no publica ni guarda automáticamente la página. Solo envía la descripción seleccionada al proveedor de IA, sin clientes, reservas ni cotizaciones. Una respuesta fallida o demasiado larga no reemplaza el texto original ni se recorta silenciosamente.

No se modifican registros comerciales ni se ejecutan migraciones. El cambio aún necesita desplegarse y las traducciones deben guardarse desde Configuración para aparecer en la página publicada.
