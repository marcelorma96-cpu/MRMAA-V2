# Actualizar anticipos y selector de sucursales web

## Cambios

- Reservaciones: el anticipo acepta enteros y centavos, por ejemplo `500`, `500.5` y `500.75`.
- Reservaciones y cotizaciones: teclado decimal en dispositivos compatibles. La cotización conserva su cálculo de anticipo y saldo.
- Suscripciones web: accesos rápidos a 1, 2, 3 y 4 sucursales, controles − / + y un campo que se puede borrar y reemplazar para escribir otra cantidad.
- La cantidad representa el total, incluida la sucursal principal. Se muestra la capacidad contratada al abrir el panel y el total mensual cambia con la selección.
- El mismo selector está en la estimación multisucursal de la página pública.
- Se mantienen los precios, la confirmación antes del cobro, las restricciones del proveedor y la protección contra reducir por debajo de las sucursales ocupadas. El límite web existente sigue siendo de 1 a 10,000 sucursales enteras.

## Publicación

Actualice el código y despliegue la web con el procedimiento habitual. Estos cambios no requieren un SQL nuevo ni modificar datos existentes. El ZIP contiene también las actualizaciones anteriores.

Este archivo es el código preparado para publicar; no implica que el sitio en producción ya se haya actualizado. Los paquetes de compra nativos de Apple y Google permanecen sin cambios.

## Verificación

- Comprobación de TypeScript y compilación de producción.
- Pruebas de selección, borrado y sustitución de cantidades, límites, total, confirmación y solicitud al proveedor usando respuestas simuladas, sin cobros reales.
- Pruebas existentes de conciliación y gestión de suscripciones.
- Guardado, lectura y edición de anticipos con centavos mediante la función SQL de reservaciones, en una base de prueba local.

Después del despliegue, comprobar con una cuenta de prueba: guardar un anticipo de `500.75`, volver a abrirlo, revisar el saldo de una cotización y elegir 1, 4 y 7 sucursales sin confirmar un cobro. No se realizaron pruebas físicas en teléfonos o tabletas.
