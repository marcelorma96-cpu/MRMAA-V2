# Total de personas en reservaciones

1. Ejecute completo MRMAA_RESERVAS_TOTAL_PERSONAS.sql en Supabase (es idéntico a 34_RESERVAS_TOTAL_PERSONAS.sql incluido aquí; use solo uno).
2. Despliegue este ZIP en el mismo proyecto Vercel y recargue MRMAA.

Esta entrega conserva la actualización anterior de sesiones. Si ya aplicó su SQL, no lo repita. Si todavía no lo aplicó, ejecute también 33_SESIONES_VIGENTES.sql una vez antes del despliegue; consulte ACTUALIZAR_SESIONES.md.

Una reserva cancelada permanece visible y conserva sus invitados guardados, pero sus invitados no se suman al total de personas. Al reactivarla, vuelven a sumarse. El mismo criterio se aplica al resumen del período, al resumen de la página, a una reserva individual y al resumen impreso.

Ejemplo: 65 personas, de las cuales 25 corresponden a una reserva cancelada, muestra 40 personas. La cantidad de reservaciones y los anticipos mantienen su cálculo anterior.

El SQL no elimina ni actualiza registros del negocio. Conserva permisos, filtros, exenciones del piloto y todas las actualizaciones anteriores. No repita los SQL base.
