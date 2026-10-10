# MRMAA PRUEBAS 26 · Reactivar plan actual

Suba la carpeta completa MRMAA_PRUEBAS 26, haga Commit y Push y cambie Root Directory en Vercel a MRMAA_PRUEBAS 26. No requiere SQL adicional respecto de PRUEBAS 25. Si aún no instaló los avisos, aplique SQL 36 y conserve su configuración SMTP/cron; siga ACTUALIZAR_AVISOS.md usando ahora la carpeta 26.

En Plan y suscripción, una renovación cancelada con período pagado vigente muestra Reactivar plan actual. Requiere confirmación explícita de los próximos cobros automáticos. Conserva la suscripción, plan, precio y periodicidad existentes; la solicitud solo cambia cancelled a false en Lemon Squeezy. No crea un checkout ni solicita un cargo inmediato o cambio de fecha.

Solo el administrador principal autenticado y verificado puede hacerlo. Se verifican cuenta, propietario, cliente, tienda y modo de pago. Las cuentas exentas no muestran esta acción. Se respeta la exclusión mutua de operaciones y no se reactiva durante un cambio de plan pendiente. El plazo de espera entre cambios de plan no bloquea esta acción.

MRMAA espera hasta 30 segundos la confirmación por webhook; si tarda, muestra estado pendiente y permite Actualizar estado. Nunca activa acceso basándose solo en el botón. Una suscripción vencida requiere contratar un plan nuevamente. Si el proveedor no permite la operación (por ejemplo ciertos métodos de pago), se indica revisar Gestionar suscripción.

Pruebas locales: TypeScript; API simulada para reactivación, identidad/modo, vencimiento, confirmación obligatoria e idempotencia; navegador con el componente real, confirmación y actualización verificada. No se realizaron cobros ni reactivaciones reales. Verifique en producción con su cuenta cancelada.

Referencia técnica: https://docs.lemonsqueezy.com/api/subscriptions/update-subscription
