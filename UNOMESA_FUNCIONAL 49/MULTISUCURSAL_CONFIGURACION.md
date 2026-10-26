# UnoMesa · Multisucursal

Versión del 13 de octubre de 2026. Web + iOS Build 17 + Android versionCode 4 (1.0.3).

## Qué incluye

Una empresa conserva su restaurante actual como principal y crea sucursales dependientes. La suscripción y el propietario son de la empresa. Reservas, cotizaciones, clientes, salones, plano, solicitudes, configuración y permisos continúan separados por `restaurant_id`. Cada usuario ve solamente los locales donde tiene membresía activa; Advanced admite hasta 15 usuarios por local. No se incorporó un informe consolidado entre sucursales.

El selector superior permite buscar y cambiar de sucursal, con páginas de 25 resultados. La última selección se recuerda por usuario y dispositivo. Crear, copiar, editar nombre, archivar, reactivar, eliminar y recuperar corresponde al propietario principal. Los administradores de una sucursal mantienen sus funciones dentro de esa sucursal.

## Activación en orden

1. Conserve un respaldo recuperable de Supabase y pruebe el cambio en staging. Si ya tiene el SQL 55 instalado, aplique `56_MULTISUCURSAL.sql`, `57_SUCURSALES_PAPELERA.sql` y `58_USUARIOS_SUCURSALES.sql`, en ese orden. Si ya instaló 56, aplique 57 y después `58_USUARIOS_SUCURSALES.sql`. Si ya tiene 57, aplique **solo 58**. Si no lo tiene, instale primero los prerrequisitos de la guía de suscripciones mixtas. No vuelva a ejecutar SQL antiguos sobre este esquema.
2. El SQL 56 añade tablas, índices y funciones; permite `owner_id` vacío únicamente en sucursales dependientes y conserva la unicidad de los propietarios principales. **No actualiza ni elimina las filas comerciales existentes al instalarlo.** Mantiene pruebas, exenciones, períodos pagados y los IDs actuales. Tiene transacción y tiempo de espera limitado para bloqueos: si falla, investigue el error antes de reintentar.
3. En Lemon Squeezy prepare una variante NUEVA como se explica abajo. Conserve las variables existentes. Añada `LEMON_SQUEEZY_VARIANT_BRANCHES_MONTHLY` con el ID de esa variante. `CRON_SECRET` debe estar configurado en Vercel.
4. Despliegue este proyecto web completo. `vercel.json` añade `/api/branches/worker` cada minuto. Compruebe en Vercel que el cron responde correctamente y tiene capacidad de ejecución; sin él, las copias solo avanzan al abrir el selector y no se completan de forma desatendida.
5. Abra Configuración → Suscripción, verifique el proveedor y el paquete; abra el nombre del restaurante arriba → Nueva sucursal. La principal cuenta dentro del total: paquete de 2 = principal + 1 sucursal.
6. Para pagos móviles instale los nuevos builds, configure los productos/notificaciones y pruebe en Sandbox/TestFlight y Google Play Internal Testing. Compilar el proyecto no configura productos ni activa ventas reales.

No se ejecutó SQL en su base de producción, no se desplegó Vercel y no se cambió ni cobró ninguna suscripción real desde esta entrega.

## Precios y Lemon Squeezy

| Total de locales | Mensual web, USD antes de impuestos |
|---|---:|
| 1 | 55 |
| 2 | 90 |
| 5 | 225 |
| 10 | 450 |
| 85 | 3,825 |

Cree una variante de suscripción Advanced mensual en USD, cada 1 mes, sin cargo inicial, sin consumo medido, sin descuento ni prueba adicional, tamaño de paquete 1. Use **Volume pricing** (todos los locales al precio del tramo), no Graduated:

| `last_unit` | `unit_price` en centavos | `fixed_fee` |
|---|---:|---:|
| 1 | 5500 | 0 |
| `inf` | 4500 | 0 |

No modifique los seis productos/variantes de planes existentes. UnoMesa valida la configuración antes de abrir el cobro. Multisucursal anual no se habilitó porque no se ha acordado su precio.

Una cuenta Advanced mensual existente cambia al precio por volumen sin una segunda suscripción. La modificación de cantidad puede facturar un ajuste proporcional inmediatamente. La capacidad solo aumenta al corroborar la compra y una factura pagada reciente. Un resultado de red incierto conserva el cambio pendiente para impedir un cobro repetido; Actualizar estado vuelve a verificarlo, no cobra.

PayPal puede pedir aprobar primero el cambio de variante en su portal. Después regrese a UnoMesa y actualice el estado. Si continúa mostrando 1 sucursal, confirme nuevamente la cantidad deseada: el primer paso solo autorizó la modalidad por volumen. Si un cambio sigue pendiente sin constancia de aceptación/rechazo, revise suscripción, facturas y logs antes de cualquier reintento; no borre manualmente la intención para volver a cobrar.

Archivar una sucursal **no cambia el cobro automáticamente**. Primero archive los locales sobrantes y luego reduzca el paquete con su proveedor. Los registros se conservan. Las reducciones realizadas directamente desde una tienda pueden dejar locales excedentes en consulta hasta restaurar capacidad. No hay transferencia automática de suscripción entre proveedores ni un segundo cobro como respaldo.

## Apple y Google Play

`CATALOGO_MULTISUCURSAL.csv` especifica los productos de 2–95 locales y los precios web de referencia. Es una lista para configuración; no es una importación automática ni una afirmación de que esos importes estén disponibles en todas las tiendas/países.

- Apple: `com.unomesa.advanced.branchesN.month`. Use el mismo grupo de suscripciones que los seis productos actuales. 94 paquetes + 6 actuales = 100 productos. Más capacidad debe tener mayor nivel de servicio, de modo que ampliar sea upgrade y reducir sea downgrade. No cree suscripciones independientes por local. Solo publique paquetes cuyo precio y disponibilidad haya validado.
- Google: `unomesa_branches_N`, base plan `monthly`, autorrenovable. La app presenta el precio devuelto por Play. Ampliar utiliza el reemplazo con cobro completo y crédito de tiempo restante según Google; reducir usa reemplazo diferido. No confunda ese cobro con el prorrateo de Lemon.
- Apple decide cuándo aplica los cambios según el grupo/nivel. UnoMesa conserva el acceso que indique el período verificado. Para Google, un reemplazo diferido conserva la capacidad anterior hasta la renovación; un token nuevo por sí solo no activa el paquete futuro.
- **Importes grandes:** los límites y escalones de precios de las tiendas pueden impedir vender un paquete de 85 a US$3,825 desde una cuenta recién creada. Apple permite solicitar precios altos adicionales. Google exige elegibilidad para su límite ampliado, incluyendo más de US$1 millón de ingresos Play en los últimos 12 meses. No se presupone esa aprobación. La operación de 85 locales sí puede compartir un paquete contratado en la web e iniciar sesión en ambas apps; no se muestra un checkout externo alternativo dentro de las apps.
- Los paquetes no configurados no muestran botón de compra. No publique productos a un precio incorrecto solo para superar el límite. El precio final mostrado por la tienda, impuestos y disponibilidad local deben verificarse en sus consolas.

Fuentes oficiales consultadas el 13/10/2026:
- https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/
- https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/
- https://support.google.com/googleplay/android-developer/answer/16247119?hl=en
- https://developer.android.com/google/play/billing/subscriptions
- https://docs.lemonsqueezy.com/api/prices/the-price-object
- https://docs.lemonsqueezy.com/api/subscription-items/update-subscription-item

## Copiar una sucursal

Pulse Nueva sucursal, escriba su nombre y elija Empezar vacía o Copiar de otra sucursal. El origen y todas las opciones se eligen ANTES de crear. Busque el origen por nombre (25 por página). Editar nombre cambia el local existente; no crea un local adicional. Puede seleccionar configuración de formularios, productos/menús de cotización, salones, plano/mesas y clientes. Los IDs son nuevos y las copias se editan de forma independiente. El plano exige también copiar sus salones para mantener los vínculos.

Se copian ajustes de formularios, idioma y moneda; el logo se duplica si está en el almacenamiento de UnoMesa o es una imagen integrada compatible. Los logos externos no se importan. No se copian reservas, cotizaciones, cobros, empleados, turnos, usuarios, archivos PDF de la página pública ni sus enlaces. Configure datos de contacto, dirección y página pública en el nuevo local.

Las copias grandes se procesan de 100 registros en 100, con IDs deterministas por trabajo, reintentos y progreso. No se mantiene una transacción gigante ni es necesario dejar el teléfono abierto. Durante preparación el nuevo local no se utiliza para operar. La copia refleja los registros conforme se procesan: para una copia exactamente consistente, evite editar los catálogos de origen hasta que termine. Archivar pausa una copia; restaurar la reanuda.

## Seguridad y operación

- La base comprueba membresía, MFA y permisos; el selector no otorga acceso.
- Solo el servidor puede crear dependencias o conceder capacidad validada. El formulario no decide la capacidad pagada. La creación se serializa por empresa para impedir ocupar dos veces el último cupo.
- Crear una sucursal conserva las fechas de la principal: no genera otra prueba ni otra identidad de pago.
- Cambiar la propiedad se hace desde la principal y transfiere la administración de toda la empresa; los antiguos permisos del propietario en sucursales pasan a gerente. Revise también el traspaso del proveedor de pago por sus procedimientos habituales: esta operación no transfiere contratos externos.
- La principal con sucursales tiene protección referencial contra borrado automático. El cierre definitivo de todo un grupo necesita un procedimiento administrativo de exportación/retención y cierre, no eliminar la principal directamente. Archivar no borra registros.
- El código admite hasta 10,000 locales por empresa en la modalidad web; es un límite de aplicación, no una garantía de rendimiento ni una aprobación comercial del proveedor para cualquier cantidad/importes.

## Validación y capacidad real

Se verificaron migración repetible, conservación de datos anteriores, 85 sucursales, paginación, separación entre empresas, permisos por local, MFA, archivo/restauración, copia de 250 clientes con salones/menús/plano, cambio de propietario, conciliación de cobros y cambios diferidos. La web compila; Android compila y pasa pruebas/lint. La interfaz se comprobó a 390, 820 y 1280 píxeles.

El servidor tiene consultas por empresa, índices, copias por lotes y trabajos con reintento. Eso evita descargar toda la cadena para navegar. **No se ejecutó una prueba de miles de empresas simultáneas con registros y tráfico reales**, ni compras reales Apple/Google/Lemon, ni una compilación iOS firmada en Xcode en este entorno Linux. Antes de incorporar una cadena grande: haga un piloto, valide una compra/cambio/cancelación por proveedor, mida tiempos p95, conexiones y CPU de Supabase, duración/cola del worker, errores y consumo Vercel. Dimensione la infraestructura con esas medidas; los planes Pro por sí solos no garantizan capacidad ilimitada.


## Papelera de sucursales — SQL 57

1. Archive la sucursal. Se mantiene en consulta y libera su cupo operativo; no cambia el paquete contratado.
2. Marque Incluir archivadas. El botón Eliminar solo aparece en sucursales archivadas (nunca en la principal).
3. Confirme el aviso de 30 días. La sucursal sale del selector normal, sus módulos quedan bloqueados y su enlace público deja de aceptar solicitudes. Las filas y permisos se conservan sin cambios durante el plazo.
4. Sus sucursales → Papelera muestra la fecha/hora límite. Recuperar devuelve el mismo local, con sus mismos IDs y registros, a Archivadas. No necesita capacidad para recuperarlo; para Reactivar sí.
5. Transcurridos 30 días, `/api/branches/worker` elimina en lotes los registros de esa sucursal y después sus archivos propios en `mrmaa-branding` y `unomesa-public`. Mantiene una cola reintentable. No borra cuentas de Auth compartidas, datos de la principal ni otras sucursales. Las copias terminadas son independientes. Si hay una copia pendiente que usa la sucursal como origen, se pide terminarla antes de enviarla a Papelera.

La ejecución de SQL 57 por sí sola no archiva, elimina ni programa registros existentes. Agrega columnas vacías, una cola y funciones; las fechas empiezan únicamente con la acción explícita Eliminar. No se deben volver a ejecutar SQL 56 u otros anteriores después de 57, porque podrían restaurar funciones antiguas.

La limpieza usa el cron de sucursales ya instalado, con `CRON_SECRET`. No depende de `MRMAA_RETENTION_DELETE_ENABLED`, que corresponde a cuentas impagadas y es un proceso diferente. El día 30 vence la recuperación; la eliminación física se completa por lotes según tamaño y disponibilidad. Si una dependencia desconocida impide purgar, el worker conserva los datos restantes y devuelve error para reintentar; revise los logs. No se configuró ni ejecutó este cron contra producción durante la preparación de esta entrega.

## Equipo con varias sucursales · SQL 58

En Configuración → Usuarios, Invitar usuario y Editar muestran **Sucursales permitidas**. La actual viene marcada al invitar. El propietario principal selecciona los locales y un rol en cada uno. Un administrador local solo recibe la sucursal que administra. La búsqueda usa páginas de 25; los cambios no borran permisos en páginas que no se hayan editado. Una operación admite hasta 500 asignaciones/cambios, suficientes para el caso de 85 locales; se puede continuar en otra edición para empresas mayores.

El colaborador ve empresa, locales y roles al abrir el enlace, antes de crear su contraseña. Con varios accesos activos puede cambiar de local aunque su rol sea Gerente, Operación o Solo lectura. Con uno entra directamente. Un miembro activo de esta misma empresa conserva su cuenta y no necesita restablecer la contraseña para recibir nuevos locales. No se adjuntan cuentas ajenas por una búsqueda global de correo.

Desmarcar un local revoca solo ese acceso. Para retirar el último acceso a la empresa se cierra la edición y se usa Eliminar desde la lista; así se conserva el tratamiento existente de cuentas compartidas. Eliminar/Desactivar desde la lista sigue limitado al local actual. No elimina clientes, reservas, cotizaciones ni membresías de otros locales. Las sucursales archivadas no admiten nuevas asignaciones. Cada local conserva su límite de usuarios; todos los cambios de una solicitud se validan y guardan juntos. Si cambió un permiso desde otra pantalla, el editor pide abrir nuevamente antes de sobrescribirlo.

`58_USUARIOS_SUCURSALES.sql` agrega funciones privadas de consulta, validación y cambios de equipo. No ejecuta cambios sobre las filas existentes al instalar. Conserva los SQL previos sin modificarlos. Las invitaciones anteriores con token válido son compatibles; Reenviar renueva el enlace pendiente y su grupo de sucursales. Sesión y MFA se verifican en el servidor. La vista y los metadatos de correo no conceden permisos.

### Resumen también dentro del correo (opcional)

La pantalla que abre el enlace ya muestra los permisos al desplegar esta versión. Para mostrarlos además en el cuerpo del primer correo, inserte `CORREO_INVITACION_SUCURSALES.html` dentro de su plantilla actual en Supabase → Authentication → Email → Templates → Invite user, antes del botón existente. Conserve el botón y su `{{ .ConfirmationURL }}` tal como funcionan ahora. No reemplace su plantilla completa ni las de recuperación, Google o registro.

Es un bloque que usa empresa/sucursales/idioma enviados con la invitación. El ZIP no modifica plantillas alojadas en Supabase. Los reenvíos conservan el correo de recuperación existente y muestran el resumen actualizado al abrir el enlace. Si prefiere no tocar correos, el selector y la aceptación funcionan igualmente.

Referencia de variables de plantilla: https://supabase.com/docs/guides/auth/auth-email-templates (consultada 13/10/2026). Compruebe el envío con una invitación de prueba tras instalar; esta entrega no envió correos reales.
