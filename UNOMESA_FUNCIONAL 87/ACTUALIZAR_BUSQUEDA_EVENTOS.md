# Búsqueda de reservaciones y cotizaciones

## Uso

Junto al buscador aparece **Buscar en**. La opción inicial, **Todo**, busca entre los campos disponibles. Para encontrar un anticipo concreto, elegir **Anticipo** y escribir el monto.

| Campo | Ejemplo | Resultado |
| --- | --- | --- |
| Anticipo | `500.75` o `500,75` | Anticipo exactamente igual a 500.75 |
| Anticipo | `500` | Anticipo exactamente igual a 500.00 |
| Anticipo | `con anticipo` | Anticipos mayores que cero |
| Anticipo | `sin anticipo` o `0` | Anticipo cero o sin monto registrado |
| Total / Saldo | `1,250.50` o `1.250,50` | Monto exacto de 1250.50 en el campo elegido |
| Método de pago | `Transferencia` | Coincidencia parcial del método guardado |
| Invitados | `25` | Exactamente 25 invitados |
| Fecha del evento | `21/11/2026` o `2026-11-21` | Eventos de esa fecha |
| Hora | `19:30` o `7:30 pm` | Eventos a esa hora |

También se puede elegir Cliente, Teléfono, Área, Estado y Observaciones; Menú en reservaciones, y Correo o N.º de cotización en cotizaciones. Las cotizaciones conservan los estados calculados Contactar, Pendiente y No realizada. En inglés también funcionan `with deposit` y `without deposit`.

Los separadores agrupados de tres dígitos se interpretan como miles: `1.250` o `1,250` significan 1250. Para buscar centavos, escribir uno o dos dígitos decimales. No se redondean los términos de búsqueda.

La búsqueda se aplica antes de paginar. Los filtros de fecha y restaurante continúan activos; si se necesita revisar el historial de reservaciones, seleccionar **Todas las fechas**. La impresión, el PDF y el Excel de reservaciones usan el mismo filtro. El resumen diario o por rango coincide con los resultados; en Todas las fechas se mantiene el resumen de la página que ya ofrecía el sistema.

## Publicación

1. En el SQL Editor del proyecto Supabase correspondiente, ejecutar completo **63_BUSQUEDA_RESERVACIONES.sql**.
2. Actualizar el código del proyecto con este paquete y desplegar la web por el procedimiento habitual.
3. Comprobar una reservación y una cotización conocidas buscando su anticipo. Probar también `sin anticipo`, cambiar de página y limpiar la búsqueda.

El SQL agrega una función de resumen de solo lectura, conserva la función anterior y mantiene los permisos de acceso por restaurante. Es reejecutable y no modifica ni elimina registros. Debe ejecutarse antes del despliegue para que el nuevo resumen esté disponible. No es necesario repetir las migraciones anteriores si la instalación ya está actualizada.

Este paquete contiene el código preparado; no significa que el sitio en producción ya haya cambiado. Conserva las actualizaciones anteriores de anticipos con decimales, selector web de sucursales y columnas de exportación.

## Verificación realizada

- 18 pruebas aprobadas: montos y fechas, búsqueda de estados, paginación, exportación, resumen SQL, aislamiento por restaurante y regresiones de teléfonos y avisos de cotizaciones.
- SQL ejecutado dos veces sobre PostgreSQL local de prueba; se verificó que los registros permanecieran iguales y que los accesos no autorizados no pudieran obtener resúmenes.
- TypeScript y compilación de producción con `npm run build -- --webpack` aprobados.
- No se ejecutó SQL en producción ni se realizaron pruebas físicas en teléfonos o tabletas.
