## Conversión a reservación y controles del plano

La conversión abre Reservaciones en Listado, en la fecha del evento, con la nueva reserva resaltada y los filtros visibles. La reserva aparece primero aunque su hora corresponda a otra página. Fecha, hora y duración quedan arriba del mapa; zoom y movimiento, abajo. Aplica al mapa completo y al área individual. No requiere SQL ni modifica datos existentes.

## Descripción del menú en reservaciones — 3 de octubre de 2026

Se corrige al mostrar la descripción el símbolo de cantidad dañado y se eliminan decimales finales innecesarios: «El Chapín × 30». Se aplica al listado, detalles del plano y exportaciones de reservaciones. No modifica el texto almacenado, productos, precios ni cantidades. No requiere SQL.

## Registro repetido y conservación de suscripciones — 3 de octubre de 2026

El servidor comprueba el historial por usuario y correo antes de registrar. Google reutiliza las cuentas existentes y no inicia otra prueba. El registro con contraseña devuelve un aviso para iniciar sesión cuando el correo ya pertenece a un miembro. Los conflictos de identidad o accesos desactivados no crean restaurantes nuevos. Las consultas fallidas no se consideran cuentas nuevas.

Las cuentas existentes cargan directamente su restaurante y facturación sin ejecutar funciones de creación. No se cambian fechas, planes, pagos ni exenciones. No requiere SQL. No elimina ni fusiona posibles duplicados creados anteriormente: esos casos requieren diagnóstico individual.

## Todas las mesas seleccionadas — 3 de octubre de 2026

Si una selección contiene todas las mesas de un mismo salón, su etiqueta muestra «Salón completo» (o «Entire room» en inglés). Se aplica a cotizaciones, vista previa, PDF, impresión y los demás lugares que comparten la etiqueta de ubicación. Las selecciones parciales siguen mostrando las mesas. No se modifica la selección guardada ni se requiere SQL.

## Corrección de consulta de mesas en cotizaciones — 3 de octubre de 2026

Se corrige la lectura de cotizaciones antiguas cuya selección del plano contiene únicamente metadatos de revisión y no una lista de mesas. El listado conserva las etiquetas de mesas individuales, salón completo y sin área. Los errores reales de consulta se siguen mostrando, ahora como alerta de error.

Esta actualización no agrega ni modifica SQL y no cambia datos almacenados. Se despliega el ZIP en el mismo proyecto Vercel, conservando sus variables de entorno.

# Reservas anteriores sincronizadas como salón completo

Una reservación que tiene área guardada y todavía no tiene asignación individual en el plano se muestra automáticamente como **salón completo ocupado**, desde su hora de inicio durante la duración predeterminada del restaurante (180 minutos si no la cambió). Aplica incluso si el área aún no tiene mesas; al agregarlas, quedan cubiertas por esa reserva. Las reservas con mesas ya asignadas mantienen exactamente esas mesas y su duración. Canceladas no bloquean disponibilidad y una reserva sin hora no se interpreta como ocupada todo el día. Sin mesa ni área continúa disponible como opción inicial de los formularios.

Esta sincronización es de consulta: no migra ni reescribe registros existentes. También se refleja en agendas, listados, formularios al editar y PDF/impresión. Al guardar una reserva con área y sin mesas individuales se interpreta como salón completo; para dejarla sin ubicación use Sin mesa ni área. Esta indicación actualiza la explicación histórica anterior que decía que las reservas de área no ocupaban el salón.

---

# Guía práctica para armar el plano

Al entrar por primera vez a Editar plano, se abre una guía de cinco pasos: área, nivel, mesas, mapa completo y guardar. Siguiente paso abre la vista correspondiente. Se puede cerrar con Seguir sin guía y recuperar con Guía paso a paso. La preferencia se recuerda en este navegador. Los cambios solo se guardan al confirmar Guardar plano; abrir o recorrer la guía no modifica datos. Disponible en español e inglés, escritorio, tablet y móvil. Instructivo y asistente incluyen los mismos pasos.

---

# Contorno ajustado y cambio de nivel del área · 2 de octubre de 2026

En Mesas por área, el contorno se ajusta automáticamente al conjunto de mesas, incluyendo su tamaño, giro y un margen para sillas. Conserva sus posiciones y capacidades; se refleja también en el formulario y en la exportación de esa vista del plano.

En Editar plano → Mesas por área, elija el área y cambie **Nivel del área**. Pulse Guardar plano para confirmar. El área se traslada con sus mesas y conserva los vínculos de reservas y cotizaciones. Puede hacerlo también desde Mapa completo, donde se agregan y nombran los niveles. Estos ajustes no requieren otro SQL.

---

# Formularios sin área y permiso de edición del plano · 2 de octubre de 2026

Reservaciones y cotizaciones nuevas empiezan en **Sin mesa ni área**. Puede guardar así o elegir ubicación. Esa opción limpia área y mesas del borrador; editar un registro conserva su asignación hasta guardar el cambio. Se mantienen cliente, fechas, importes y demás información del evento.

**Editar plano es únicamente para Administrador y Gerente**, desde Reservaciones o Configuración. Operador conserva la operación de reservas y sus mesas; Solo lectura consulta. Soporte temporal tampoco puede cambiar el diseño. Aplique **47_PERMISOS_EDITAR_PLANO.sql** para hacer cumplir esta regla también al guardar en Supabase. Si ya tiene 43–46, aplique solo 47. El SQL 47 ajusta únicamente una función de autorización del plano; no cambia tablas, columnas, registros, pagos ni exenciones. Los SQL anteriores permanecen intactos.

También incluye Teléfono separado en PDF/impresión y fecha siempre visible arriba de Anterior/Siguiente. Esos dos ajustes y la opción Sin mesa ni área no requieren SQL adicional.

---

# Reservaciones: teléfono en documentos y fecha visible · 2 de octubre de 2026

PDF e impresión incluyen Teléfono/Phone como columna independiente en los listados de reservaciones y los documentos del plano que incluyen reservas. Conserva el número guardado y su código de país; un guion indica que no hay teléfono. La fecha del listado está siempre visible arriba de Hoy, Anterior y Siguiente, y puede cambiarse directamente. El instructivo y asistente se actualizaron.

Esta corrección no requiere SQL nuevo ni modifica registros. Si el plano aún no está instalado en el proyecto activo, sigue aplicando la activación 43–46 descrita abajo; no repita lo ya instalado.

---

# UnoMesa funcional — plano de mesas integrado · 2 de octubre de 2026

Esta entrega incorpora al proyecto funcional las mejoras aprobadas del plano, formularios, Configuración, menú ocultable, PDF/impresión y landing. Incluye las mesas reservadas en azul intenso con texto blanco. Disponible en Basic, Intermediate y Advanced con los permisos existentes.

**Lea ACTIVAR_PLANO_MESAS.txt para esta actualización.** Si el Supabase del proyecto activo todavía no tiene las ampliaciones del plano, aplique únicamente los archivos pendientes de **43 → 44 → 45 → 46**, en ese orden. No vuelva a ejecutar los SQL antiguos de instalación, Google o pagos. Si los cuatro ya están instalados en ese mismo proyecto, no los repita; aplique solo el nuevo 47 para el permiso de edición descrito arriba.

Las áreas activas de Configuración → Reservaciones aparecen automáticamente en el plano sin duplicarse y sin crear mesas. Las reservas anteriores mantienen sus datos y su área; ahora el mapa interpreta las que no tienen mesas individuales como salón completo durante su horario, sin escribirles asignaciones. Agregue mesas desde Editar plano cuando corresponda.

Los SQL incluidos conservan exactamente su contenido anterior. El comentario histórico de exclusividad de prueba en 43/44 corresponde a la evaluación anterior; Marcelo autorizó incorporar el plano al funcional el 2 de octubre. La ampliación usa objetos v2_floor_* separados; no sustituye la estructura existente. No cambia planes, exenciones, pagos, acceso Google, Pixel ni Vercel Analytics.

Actualice el **mismo proyecto Vercel**, con las mismas variables y la misma conexión Supabase. La carpeta interna sigue siendo MRMAA_PRUEBAS 26 para conservar la ruta existente; copie su contenido dentro de la carpeta que ya usa Vercel, sin anidarla otra vez. Este ZIP no publica el sitio ni ejecuta SQL automáticamente.

Las secciones siguientes son el historial de entregas anteriores. Sus frases «sin SQL nuevo» corresponden a esas entregas, no a la primera activación del plano.

---

# Crear o cambiar contraseña desde Cuenta · 30 de septiembre de 2026

En **Configuración > Cuenta** se puede crear una contraseña de UnoMesa para una cuenta de Google, o cambiar una contraseña existente. El formulario pide la contraseña nueva dos veces y no permite guardar si no coinciden o no cumple los requisitos. Tras crearla, se muestra Cambiar contraseña. El acceso con Google continúa disponible y su contraseña de Google no cambia.

Cada usuario gestiona únicamente su propia contraseña. Los colaboradores también tienen Cuenta con esta opción personal, sin recibir permisos para administrar usuarios, cambiar el correo del administrador, transferir ni eliminar la cuenta. Se mantienen la sesión vigente, la verificación en dos pasos y las reglas de seguridad de Supabase; si el servicio exige contraseña actual o un código reciente por correo, se solicita en el mismo formulario. La confirmación de guardado aparece arriba y los campos se vacían al completar o cancelar.

**No requiere ejecutar SQL ni cambiar la estructura existente.** Actualice la misma aplicación de Vercel con las mismas variables. No cambia clientes, cotizaciones, restaurantes, planes ni exenciones del piloto. El cambio de contraseña lo realiza Supabase Auth sobre la cuenta autenticada, sin restablecimientos administrativos. Se conserva la recuperación de contraseña desde el ingreso.

Verificación local: pruebas de autorización, confirmación, rechazo de solicitudes para otras cuentas, sesiones revocadas, MFA, límites de intentos y restricciones del proveedor; pantallas en español/escritorio e inglés/móvil oscuro; cuentas de Google, correo, gerente y solo lectura; compilación de producción. Las pruebas usan servicios simulados; no se cambió ninguna contraseña real ni se enviaron correos a clientes.

---

# Logo opcional · 30 de septiembre de 2026

En Configuración > General, **Quitar imagen** vacía el logo del negocio. Pulse **Guardar cambios** o **Guardar configuración** para conservarlo así al recargar. Puede subir otra imagen cuando quiera. No requiere SQL ni cambios en la estructura de la base de datos.

---

# Actualización corregida: avisos sin cambios de estructura · 30 de septiembre de 2026

1. **Esta corrección no requiere ejecutar ningún SQL.** Se retiró el SQL 42 de la entrega anterior y se eliminó su dependencia. No ejecutar ese archivo descargado anteriormente. Si Google ya funciona, no repetir su configuración ni los SQL 40/41.
2. Actualizar la misma aplicación de Vercel, conservando sus variables y su conexión con el mismo proyecto Supabase.
3. Abrir Cotizaciones. Los avisos activos aparecen abiertos, con Revisar y Quitar. Para volver a mostrar avisos ya quitados, pulsar **Recuperar avisos quitados**. La opción aparece cuando existen cotizaciones pendientes con un aviso quitado y evento hoy o en los próximos cinco días. Si hay más de 50, se recuperan hasta 50 por clic.

Se usa únicamente `reminder_dismissed`, que ya existe en la estructura exportada. No se añaden columnas, tablas, funciones, reglas ni políticas. Abrir la pantalla, recargar y Revisar no modifican cotizaciones. Quitar pone la marca en verdadero y Recuperar la pone en falso; ambas acciones conservan cliente, importes, fecha de creación, estado y demás contenido de la cotización. Los permisos existentes se mantienen. Los avisos quitados permanecen quitados al recargar o abrir otra computadora hasta que alguien con permiso los recupere.

La etiqueta **Creada** muestra fecha y hora del mismo registro, con el formato 12/24 horas configurado. Actualmente ambas se presentan en la zona horaria del dispositivo; el país del restaurante no configura una zona horaria. Las horas de eventos y turnos conservan el valor introducido. No se cambia la fecha de creación almacenada.

Las confirmaciones de guardado aparecen flotando arriba durante cinco segundos, con cierre manual. Se mantienen mientras el cursor o el foco estén sobre el aviso. Incluye configuración, menús, empleados, turnos, horarios, clientes, cotizaciones y reservas. Los errores e instrucciones que requieren acción permanecen en su sección.

Se conserva el acceso con Google, Inicio rápido, menús con buscador y scroll, vista previa y navegación a la reserva convertida. Verificación local: lectura, recuperación y descarte probados contra las 30 columnas y tipos de la exportación, sin migraciones; comprobación de que solo cambia la marca, aislamiento entre restaurantes, exclusión de papelera/convertidas/fechas fuera del rango y lotes de 50. Flujos con servicios simulados en navegador para español/escritorio e inglés/móvil oscuro y compilación de producción verificados. Este ZIP no publica el sitio ni ejecuta modificaciones en Supabase.

---

# Actualización anterior: Google directo al dashboard · 30 de septiembre de 2026

**Para activar Google, siga `ACTIVAR_GOOGLE_UNOMESA.md`.** Esta entrega requiere el SQL 40 (si no está aplicado) y después **41_GOOGLE_ACCESO_DIRECTO.sql**. El apartado anterior sobre “no requiere SQL” más abajo se refiere únicamente al cambio de marca.

Las cuentas nuevas de Google reciben 10 días de Advanced y entran directamente al dashboard, con Inicio rápido visible. Los datos del restaurante se completan después en Configuración. Se conservan los cambios de menús (buscador, cinco filas con scroll y guardar arriba/abajo), vista previa de cotizaciones, avisos abiertos y navegación a la reserva recién creada.

El ZIP no publica el sitio ni ejecuta cambios en Supabase. No aplicar todos los SQL incluidos indiscriminadamente.

---

# UnoMesa — cambio de marca preparado para el 25 de septiembre de 2026

## Revisión de inglés — 26 de septiembre de 2026

El registro muestra «Start your free trial.» al elegir inglés y conserva el idioma elegido al crear la cuenta. Se revisaron acceso, recuperación, confirmación de contraseña, avisos de suscripción y mensajes de operación; se completaron traducciones faltantes, incluidas referencias de error y títulos de cotizaciones. Español es el idioma automático de los países hispanohablantes (incluido Puerto Rico); el resto usa inglés. Si no se puede detectar el país, se usa inglés. La elección manual o preferencia guardada de la cuenta tiene prioridad. Se mantiene la versión en español. Esta revisión no requiere ejecutar SQL. Conserva las rutas de autenticación, CAPTCHA, cobros, analíticas y registros existentes.


Base: última versión disponible de MRMAA_NUEVO_REVISADO.zip (versión 66). Este paquete prepara el cambio; no modifica por sí solo Vercel, DNS, Supabase, Lemon Squeezy ni los buzones de correo.

## Qué contiene

- Logo aprobado de UnoMesa en landing, registro, ingreso, recuperación/activación de acceso, panel, soporte y páginas legales. Letras claras sobre fondos oscuros.
- Favicon, icono de aplicación y Apple icon con solo la mesa y el número 1.
- Video y portada con la marca nueva; mismos ejemplos y funciones.
- Marca visible actualizada en ayuda, tutorial, asistente, avisos, documentos y exportaciones. Los logos de los restaurantes y sus cotizaciones se conservan.
- Contacto: support@unomesa.com. Sugerencias: suggestions@unomesa.com. Remitente configurable para códigos: passcode@unomesa.com.
- Correos generados por la aplicación con encabezado UnoMesa y alternativa de texto plano. Los códigos, vencimientos, destinatarios de seguridad y enlaces conservan su lógica.
- Se admiten los dominios exactos unomesa.com y www.unomesa.com para la analítica pública, y pay.unomesa.com para enlaces devueltos por Lemon Squeezy. Se conserva compatibilidad con mrmaa.com y pay.mrmaa.com.

## Lo que se conserva

Mismos planes, precios, prueba de 10 días, doble contraseña, CAPTCHA, recuperación de acceso, invitaciones, 2FA, sesiones, permisos, reservas, cotizaciones, horarios, reportes, cancelación/reactivación de suscripciones, webhooks, avisos de vencimiento y analítica de Meta/Vercel. No se cambia el identificador del Pixel.

No se modifica ningún SQL ni se cambia de proyecto Supabase. No se borran ni migran usuarios, datos, restaurantes, archivos, pagos o suscripciones. La exención del piloto sigue dependiendo de los mismos registros. Los identificadores internos MRMAA (variables existentes, almacenamiento, RPC, metadatos de checkout y formato de respaldo) permanecen para conservar compatibilidad.

**No hace falta ejecutar SQL nuevo por este cambio de marca.** Los SQL ya incluidos son de actualizaciones anteriores; este ZIP no sustituye la instalación de base de datos de un proyecto nuevo.

## Antes del despliegue de esta noche

1. Crear y comprobar la recepción en **support@unomesa.com**, **suggestions@unomesa.com** y **passcode@unomesa.com**. Verificar los remitentes/dominio en el proveedor de correo y completar sus registros DNS requeridos. Comprar el dominio no crea buzones ni autoriza SMTP automáticamente.
2. Añadir unomesa.com y www.unomesa.com al **mismo proyecto Vercel**. Usar los registros DNS que indique Vercel y esperar a que HTTPS esté válido. Conservar mrmaa.com funcionando durante la transición.
3. Añadir el nuevo dominio a los hostnames permitidos del widget Turnstile actual. Conservar las claves existentes y los hostnames anteriores.
4. En Supabase → Authentication → URL Configuration, añadir las versiones nuevas de las Redirect URLs actuales, manteniendo exactamente sus rutas y parámetros. Esta app genera callbacks en la raíz con parámetros como `?reset=1`; copiar la configuración vigente sustituyendo solo el host evita perder esos destinos. Conservar las URLs anteriores mientras existan enlaces pendientes.
5. Mantener el mismo proyecto, claves y datos de Supabase, y la misma tienda/variantes/suscripciones de Lemon Squeezy. No crear productos ni usuarios nuevos para el cambio de marca.

## Variables del despliegue final

Elegir un origen canónico (este ejemplo usa https://unomesa.com) y usarlo de manera consistente.

| Variable | Valor para la nueva marca | Cuándo activarla |
|---|---|---|
| NEXT_PUBLIC_SITE_URL | https://unomesa.com | Cuando el nuevo dominio tenga HTTPS y Auth/CAPTCHA admitan el dominio |
| UNOMESA_PASSCODE_FROM | UnoMesa <passcode@unomesa.com> | Cuando el proveedor SMTP autorice este remitente |
| UNOMESA_SUPPORT_FROM | UnoMesa <support@unomesa.com> | Cuando el proveedor SMTP autorice este remitente |

Los remitentes son exclusivamente passcode@unomesa.com y support@unomesa.com, con esos valores por defecto. Ya no se usa MRMAA_SMTP_FROM como alternativa. Debe autorizar ambos remitentes en su proveedor SMTP antes de desplegar.

Se conservan **MRMAA_SMTP_HOST**, **MRMAA_SMTP_PORT**, **MRMAA_SMTP_USER**, **MRMAA_SMTP_PASSWORD** y las demás variables existentes. Las nuevas direcciones deben estar autorizadas con esas mismas credenciales. Si se cambia de proveedor, actualizar las credenciales solamente cuando se haya comprobado que envían desde ambos remitentes. No poner contraseñas ni claves en el ZIP o en GitHub.

UNOMESA_PASSCODE_FROM se utiliza para códigos de 2FA y cambio de correo. UNOMESA_SUPPORT_FROM se utiliza para notificaciones de soporte y avisos de vencimiento. suggestions@unomesa.com es una dirección de recepción mediante el enlace de ayuda, no necesita una tercera credencial SMTP de la app.

Un cambio en las variables de Vercel necesita un nuevo despliegue para aplicarse.

## Correos de Supabase y cuenta interna de soporte

Los mensajes de confirmación de registro, recuperación e invitación enviados por **Supabase Auth** se configuran por separado. Cambiar allí el nombre a UnoMesa y el remitente a passcode@unomesa.com una vez autorizado. Actualizar el logo y los textos de las plantillas conservando exactamente las expresiones, enlaces y tokens actuales de cada plantilla. No sustituir su flujo de confirmación.

Logo para el encabezado, una vez publicado: https://unomesa.com/brand/unomesa-logo.png. Usar fondo claro, ancho aproximado de 240 px y texto alternativo UnoMesa.

Para trasladar el acceso interno ejecute 37_ACTIVAR_SOPORTE_UNOMESA.sql y siga 38_SOPORTE_UNOMESA_LEER.md. El agente anterior queda deshabilitado y únicamente la cuenta nueva queda autorizada. Las cuentas de Authentication y el historial se conservan.

## Lemon Squeezy

- Cambiar nombre/logo/contacto de la tienda cuando se haga pública la marca. Los IDs de tienda, productos, variantes y suscripciones deben seguir iguales.
- Se puede conservar pay.mrmaa.com durante la transición. El código también acepta pay.unomesa.com cuando se configure correctamente en Lemon Squeezy; no basta con crear un DNS hacia Vercel.
- Mantener el webhook actual operativo mientras se verifica el nuevo dominio. Cuando se cambie, usar la URL HTTPS final **https://unomesa.com/api/billing/webhook**, sin depender de redirecciones. Mantener secreto y eventos del webhook correctos para el mismo entorno (live o test).
- Conservar exactamente las variables LEMON_SQUEEZY_* actuales. Este ZIP no cambia de test a live ni altera precios.
- Comprobar una entrega de webhook aceptada y que la aplicación muestre el plan existente y el botón de gestión. Reenviar un evento previo de la misma suscripción sirve para verificar su procesamiento; no hace falta realizar otro cobro.

## Cómo subir este paquete

La carpeta interna sigue llamándose **MRMAA_PRUEBAS 26** para evitar un cambio innecesario en Root Directory. Se publica UnoMesa aunque el nombre técnico de la carpeta sea el anterior.

Actualizar los archivos dentro de la carpeta que ya utiliza Vercel. No anidar otra copia de todo el proyecto. Si actualmente Root Directory apunta a otra carpeta (por ejemplo PRUEBAS 23), actualizar su contenido con el de este paquete y conservar esa ruta, o modificar Root Directory conscientemente antes de desplegar.

GitHub Desktop: revisar Changes, hacer commit y Push origin. Si la rama está conectada a producción, el push puede iniciar el despliegue; esperar a la ventana de cambio prevista. No subir node_modules, archivos de claves ni salidas de compilación.

## Comprobación al publicar

- Confirmar, desde el dominio nuevo, registro con dos contraseñas, CAPTCHA, email y acceso; verificar también recuperación e invitación.
- Comprobar llegada de códigos desde passcode@unomesa.com y recepción de soporte/sugerencias en sus buzones.
- Abrir una cuenta existente: mismos datos, logo del restaurante, sesiones, permisos y plan pagado; probar abrir la gestión de suscripción sin hacer otro pago.
- Verificar una entrega de webhook y el estado de la suscripción, sin duplicar el cobro.
- Verificar Meta/Vercel en la landing y registro. El código conserva la exclusión de callbacks, tokens y pantallas privadas. Revisar el dominio nuevo en la configuración externa de Meta si hay restricciones de tráfico.
- Revisar logo/favicon y botones en modo claro y oscuro en móvil y computadora.

Al cambiar de dominio, los usuarios pueden necesitar iniciar sesión otra vez: las cookies y el almacenamiento del navegador no se comparten entre mrmaa.com y unomesa.com. Esto no borra sus cuentas ni sus registros.

No redirigir todo mrmaa.com hasta verificar callbacks, correos y webhook. El ZIP no añade una redirección global. Conservar los servicios antiguos durante la transición permite recuperar enlaces ya enviados.

## Alcance de las verificaciones locales

Compilación de producción Next.js completada. 28 pruebas automatizadas aprobadas. Comprobadas las pruebas automatizadas de analítica, dominios de pago, remitentes y formato seguro de correo; compilación TypeScript; registro y contraste de botones con servicios simulados en móvil/computadora. Las integraciones reales de SMTP, DNS, Auth, CAPTCHA y cobro necesitan la comprobación en tu proyecto después de configurar el nuevo dominio.

Referencias oficiales:
- https://vercel.com/docs/environment-variables/managing-environment-variables
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp
- https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
- https://docs.lemonsqueezy.com/help/webhooks/webhook-requests

El ajuste de contorno también se aplica a Mapa completo y sus PDF por nivel: reduce los márgenes vacíos alrededor de las mesas sin moverlas ni guardar cambios al abrir. El arrastre y la esquina de tamaño siguen el cuadro visible. Las áreas que realmente se superponen conservan su posición hasta que usted las reubique y guarde.


## Ajuste de movimiento, zoom táctil y fechas — 3 de octubre de 2026

- En Mapa completo, el límite de movimiento sigue el contorno visible del área. Se puede llevar ese contorno hasta los bordes del plano sin cambiar el tamaño al arrastrar.
- Cambiar tamaño del área activa la esquina de ajuste. Al soltarla se vuelve al modo mover.
- En Mapa completo y Mesas por área, dos dedos permiten acercar, alejar y recorrer el plano. Este gesto cancela cualquier arrastre iniciado de un área o mesa. El zoom no se guarda como cambio de distribución.
- En el listado, la fecha está encima de Hoy / Anterior / Siguiente. De–a conserva la primera fecha como Desde y agrega solo Hasta a su lado.
- Esta actualización no necesita SQL nuevo. Conserva los SQL incluidos, la estructura existente y los datos; la distribución se guarda únicamente con Guardar plano.


## Controles de disponibilidad junto al plano — 3 de octubre de 2026

Fecha, Hora y Duración se encuentran justo debajo del dibujo, tanto en Mapa completo como en Mesas por área. Las flechas del día y los campos tienen tamaño táctil. Los valores se conservan al cambiar de vista y la duración predeterminada mantiene su guardado habitual. La fecha sigue accesible mientras se actualizan las reservas. Las agendas permanecen al lado cuando hay espacio y debajo en pantallas estrechas. No requiere SQL nuevo.


## Nombres de áreas discretos — 3 de octubre de 2026

En Mapa completo, los nombres se muestran en una sola línea, con tamaño discreto y cerca de los bordes, evitando las mesas y otras etiquetas. Si no queda espacio libre, se usan los márgenes exteriores. Los nombres completos y el estado siguen disponibles al consultar el área. Nombres permite ocultar o mostrar las etiquetas; recuerda la preferencia en este navegador sin guardar cambios en el restaurante. No modifica ubicaciones ni registros, y no necesita SQL nuevo. Los PDF por nivel conservan las etiquetas compactas; exportar la vista actual respeta su visibilidad.


## Eliminar reservación desde el plano

Administrador y Gerente disponen de Eliminar reserva en las tarjetas del mapa completo y en las agendas por mesa/área. Abre la misma confirmación y usa v2_soft_delete, igual que el listado. No se crea un borrado definitivo ni otro flujo SQL. Después de una respuesta correcta se actualizan reservas y cotizaciones, y se libera la disponibilidad correspondiente. Un error conserva la reserva visible para reintentar; Cancelar no modifica datos. La cotización vinculada mantiene el comportamiento existente de la papelera (vuelve a Pendiente). Operador, Solo lectura y soporte no reciben permiso de eliminación.


### Todas las reservaciones y sincronización

- Debajo del mapa, Ver todas las reservaciones muestra en cada mesa todas las horas y personas del día seleccionado. Incluye las reservas que continúan del día anterior. Cambiar la hora vuelve al filtro por horario. Las canceladas permanecen en la agenda, pero no ocupan mesas.
- Todas las reservaciones en el panel de detalle también activa esta vista. Se mantiene al cambiar entre mapa completo y mesas por área. No modifica los datos, horarios ni duración de reservas guardadas.
- El PDF y la impresión conservan la vista diaria elegida, incluidos todos los niveles.
- Los cambios, vinculaciones, desvinculaciones y eliminaciones actualizan sus vistas relacionadas. La selección de un formulario sin guardar se conserva; las comprobaciones existentes evitan sobrescribir cambios concurrentes.
- Al renombrar un área vinculada, el plano conserva sus nombres previos como referencia para reconocer reservas antiguas de salón completo. Los registros históricos conservan su texto original. Eliminar un área del catálogo conserva su historial y su distribución guardada; no elimina reservas, cotizaciones ni mesas.
- Esta entrega no agrega ni modifica SQL.
