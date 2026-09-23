import { PLANS } from "./plans";

export const TUTORIAL_GUIDE = [
  {
    tab: "quotes",
    title: "Nombre y buscador de clientes en una sola casilla",
    titleEn: "Customer name and search in one field",
    text: "En los formularios de Cotizaciones y Reservaciones, Nombre del cliente también busca clientes guardados.",
    textEn: "In Quote and Reservation forms, Customer name also searches saved customers.",
    details: [
      "Escriba al menos dos caracteres del nombre, teléfono o correo. Las sugerencias aparecen debajo de la misma casilla y muestran nombre y datos de contacto para distinguir personas con nombres iguales. Se buscan clientes activos del restaurante actual; los clientes en papelera no aparecen.",
      "Pulse una sugerencia o use las flechas del teclado y Enter. La casilla queda con el nombre del cliente y la reservación completa su teléfono; la cotización completa teléfono y correo. Revise esos datos antes de guardar. Enter sin una sugerencia resaltada no selecciona automáticamente a otra persona.",
      "Para un cliente nuevo, escriba su nombre y complete sus datos de contacto sin seleccionar una sugerencia. Se usa la comprobación de duplicados al guardar; escribir o buscar no crea registros. Si buscó por teléfono o correo y no eligió una coincidencia, sustituya ese texto por el nombre de la persona antes de guardar.",
      "Si cambia el nombre después de elegir un cliente guardado, se quita esa selección y se vacían los contactos de la persona anterior en el borrador. Elija otra sugerencia o complete los datos del nuevo cliente. Los demás datos del evento se conservan. Para corregir la ficha del cliente, use Clientes → Editar; el buscador no modifica esa ficha.",
      "La lista muestra hasta 20 coincidencias con desplazamiento. Siga escribiendo para precisar la búsqueda. Si falla la consulta, pulse Reintentar; el borrador se conserva. Esc o salir de la casilla cierra las sugerencias. Cancelar el formulario no guarda cambios."
    ],
    detailsEn: [
      "Type at least two characters of a name, phone or email. Suggestions appear below the same field and show names and contact details to distinguish people with the same name. Search includes active customers in the current restaurant; customers in trash do not appear.",
      "Click a suggestion or use the arrow keys and Enter. The field shows the customer's name; reservations fill in their phone, and quotes fill in phone and email. Review these details before saving. Enter without a highlighted suggestion does not automatically select another person.",
      "For a new customer, enter their name and contact details without choosing a suggestion. The existing duplicate check runs when saving; typing or searching creates no records. If you searched by phone or email without choosing a match, replace that search text with the person's name before saving.",
      "Editing the name after selecting a saved customer clears that selection and the previous person's contact details in the draft. Choose another suggestion or enter the new customer's details. Other event details stay unchanged. To correct a customer's saved profile, use Customers → Edit; the search field does not modify that profile.",
      "The list shows up to 20 matches and scrolls. Keep typing to narrow the search. If the search fails, select Retry; your draft is preserved. Esc or leaving the field closes suggestions. Canceling the form saves no changes."
    ],
    adminOnly: false
  },
  {
    tab: "quotes",
    title: "Vincular una cotización a una reservación existente",
    titleEn: "Link a quote to an existing reservation",
    text: "En Cotizaciones, use Vincular a reservación junto a una cotización guardada sin vínculo.",
    textEn: "In Quotes, select Link to existing reservation beside a saved, unlinked quote.",
    details: [
      "Busque la reserva por cliente, teléfono o área. Puede filtrar también por fecha del evento. El listado tiene desplazamiento y páginas de hasta 50 resultados; no está limitado a las reservas de hoy.",
      "Solo aparecen reservaciones del restaurante actual que no tengan cotización vinculada, no estén canceladas y estén fuera de la papelera. Si una reserva está cancelada, reactívela primero desde Reservaciones.",
      "Seleccione la reserva y compare cliente, fecha, hora, área, invitados y anticipo. Pulse Vincular y confirmar reserva para guardar. Cancelar cierra sin cambios; elegir una fila todavía no guarda el vínculo.",
      "La reserva queda Confirmada y la cotización Convertida. Se conservan los demás datos de ambos registros y no se crea otra reserva. Si había diferencias entre ellos, revíselas manualmente. Las ediciones posteriores de campos compartidos se sincronizan según las reglas de cotizaciones y reservaciones vinculadas.",
      "Una cotización y una reserva solo admiten un vínculo activo. Si otra persona las vincula mientras el selector está abierto, el sistema rechaza el segundo vínculo. Administrador, Gerente y Operador pueden vincular; Solo lectura no. Desde Reservaciones también sigue disponible Vincular cotización."
    ],
    detailsEn: [
      "Search by customer, phone or area. You can also filter by event date. The list scrolls and has pages of up to 50 results; it is not limited to today's reservations.",
      "Only reservations in the current restaurant without a linked quote, outside the trash and not canceled appear. Reactivate a canceled reservation in Reservations first.",
      "Select the reservation and compare customer, date, time, area, guests and deposit. Select Link and confirm reservation to save. Cancel closes without changes; selecting a row alone does not save the link.",
      "The reservation becomes Confirmed and the quote Converted. Both keep their other details and no second reservation is created. Review existing differences manually. Later edits to shared fields synchronize according to the linked quote and reservation rules.",
      "A quote and reservation can each have only one active link. If someone else links either record while the selector is open, the second link is rejected. Administrator, Manager and Operator can link; Read-only cannot. Link quote remains available from Reservations too."
    ],
    adminOnly: false
  },
{"tab": "settings", "title": "Cambio seguro del correo de acceso", "titleEn": "Secure login email change", "text": "Configuración → Cuenta permite cambiar el correo mediante códigos en ambas direcciones.", "textEn": "Settings → Account lets you change your email using codes sent to both addresses.", "details": ["Escriba el correo nuevo dos veces y pulse Enviar códigos. Debe haber ingresado con contraseña y completado la verificación en dos pasos si la tiene activada.", "Recibirá un código en el correo actual para autorizar el cambio y otro en el nuevo para comprobar que también es suyo. Escriba ambos códigos dentro de la misma sesión de MRMAA que los solicitó. No hay enlaces para confirmar. Una persona que reciba por error el código del correo nuevo no puede completar el cambio por sí sola.", "Los códigos duran 10 minutos, tienen hasta cinco intentos y solo sirven para esa solicitud. Solicitar códigos nuevos invalida los anteriores; espere al menos un minuto entre envíos. Cancelar cambio conserva el correo actual. Si inició otra solicitud desde otra sesión, solo la más reciente es válida.", "Mientras está pendiente se mantiene el correo anterior. Actualizar estado recupera una solicitud pendiente de esta sesión o comprueba el resultado si perdió conexión. Después de confirmar se mantiene su usuario, sus permisos y los datos del restaurante, y se cierran sus demás sesiones. Use el correo nuevo en el próximo ingreso.", "Se intenta avisar al correo anterior cuando el cambio se completa; un fallo de ese aviso no revierte un cambio completado. Si no tiene acceso al correo anterior, contacte a support@mrmaa.com para verificar su identidad. Soporte temporal no puede cambiar el correo de otro usuario."], "detailsEn": ["Enter the new email twice and select Send codes. You must have signed in with a password and completed two-step verification if enabled.", "One code arrives at your current email to authorize the change, and another at your new email to prove that you control it too. Enter both codes in the same MRMAA session that requested them. There are no confirmation links. Someone who receives the new-email code by mistake cannot complete the change alone.", "Codes expire after 10 minutes, allow up to five attempts and work only for that request. Request new codes invalidates earlier codes; wait at least one minute between sends. Cancel change keeps your current email. If you start a new request in another session, only the latest request is valid.", "Your previous email stays active while the change is pending. Refresh status restores this session’s pending request or checks the result after a lost connection. Confirming preserves your user, permissions and restaurant data, and closes your other sessions. Use the new email for your next sign-in.", "An email notification is attempted to the previous address on completion; delivery failure does not undo a completed change. If you cannot access your previous email, contact support@mrmaa.com for identity verification. Temporary support cannot change another user’s email."], "adminOnly": false},
{"tab": "settings", "title": "Editar áreas y desplazar las listas", "titleEn": "Edit areas and scroll lists", "text": "Las áreas de Reservaciones y Horarios se administran por separado en Configuración.", "textEn": "Reservation and Schedule areas are managed separately in Settings.", "details": ["En Configuración → Reservaciones → Áreas para reservaciones, pulse Editar junto al área, cambie su nombre y pulse Guardar cambios. Cancelar descarta el cambio. Estas áreas también se usan en Cotizaciones.", "En Configuración → Horarios → Áreas, pulse Editar, cambie el nombre y pulse Guardar cambios. Se actualiza la misma área y se conservan sus asignaciones a empleados y horarios. No hace falta eliminarla y crearla de nuevo.", "Ambas listas muestran como máximo 10 filas a la vez y limitan su altura en pantallas pequeñas. Desplácese con mouse, trackpad, teclado o dedo para consultar más áreas; el formulario queda fuera de la lista. Turnos también tiene desplazamiento.", "Renombrar un área conserva su identificador. No reescribe los textos de área guardados en reservaciones o cotizaciones anteriores. Los permisos para administrar cada catálogo siguen siendo los de su cuenta."], "detailsEn": ["In Settings → Reservations → Reservation areas, select Edit beside the area, change its name and select Save changes. Cancel discards the change. These areas are also used in Quotes.", "In Settings → Schedules → Areas, select Edit, change the name and select Save changes. The same area is updated and its employee and schedule assignments stay linked. There is no need to delete and recreate it.", "Both lists show at most 10 rows at once and limit their height on small screens. Scroll with a mouse, trackpad, keyboard or finger to see more areas; the form stays outside the list. Shifts also scroll.", "Renaming an area preserves its identifier. It does not rewrite area text stored in previous reservations or quotes. Your account’s existing permissions still apply to each catalog."], "adminOnly": false},
{"tab": "settings", "title": "Editar turnos y desplazar la lista", "titleEn": "Edit shifts and scroll the list", "text": "Configuración → Horarios → Turnos permite editar y consultar los turnos en una lista compacta.", "textEn": "Settings → Schedules → Shifts lets you edit and browse shifts in a compact list.", "details": ["Pulse Editar junto al turno. Se carga el nombre, entrada y salida (Hora o Texto), incluidas las horas ocultas de cálculo. Use Guardar cambios o Cancelar.", "El turno conserva su identidad y sus asignaciones. Editarlo actualiza cómo se muestra y calcula en todos los horarios que lo utilizan, incluidos los anteriores. Si necesita una variante solo para fechas nuevas, cree otro turno.", "Se muestran como máximo 10 filas a la vez (menos en pantallas pequeñas); use la rueda del mouse, el trackpad, las flechas con la lista enfocada o deslice con el dedo para ver el resto. El formulario queda fuera de la lista desplazable."], "detailsEn": ["Select Edit beside the shift. Its name, start and end (Time or Text), including hidden calculation times, load into the form. Use Save changes or Cancel.", "The shift keeps its identity and assignments. Editing updates its display and calculation in all schedules using it, including previous dates. Create a separate shift for a variant that should only apply to new dates.", "At most 10 rows appear at once (fewer on small screens); use the mouse wheel, trackpad, arrow keys with the list focused, or swipe to see more. The form stays outside the scrollable list."], "adminOnly": false},
{"tab": "settings", "title": "Solicitudes de soporte resueltas", "titleEn": "Resolved support requests", "text": "Soporte puede marcar una solicitud como resuelta e indicar la solución.", "textEn": "Support can mark a request as resolved and describe the solution.", "details": ["La cuenta de soporte dispone de Marcar como resuelta en el listado y dentro del restaurante. Requiere permiso vigente y una nota de 5 a 2000 caracteres.", "Resolver termina inmediatamente el acceso temporal. El administrador ve Solicitud resuelta y la nota en Configuración → Soporte → Solicitudes e historial; pulse Actualizar para cargar cambios recientes.", "Se intenta enviar un correo al administrador principal actual. Si falla, la resolución se conserva y soporte puede reintentar el correo desde la solicitud resuelta. Para nuevas revisiones el administrador debe autorizar un nuevo acceso."], "detailsEn": ["The support account can select Mark as resolved in the list and inside the restaurant. It requires valid access and a note of 5 to 2000 characters.", "Resolving immediately ends temporary access. The administrator sees Request resolved and the note in Settings → Support → Requests and history; select Refresh to load recent changes.", "An email is attempted to the current primary administrator. If it fails, the resolution remains saved and support can retry email from the resolved request. A new review requires a new authorization."], "adminOnly": false},
{
  "tab": "schedules",
  "title": "Impresión corrida, áreas y escala",
  "titleEn": "Continuous printing, areas and scale",
  "text": "Horarios → Descargar o imprimir horarios permite elegir distribución y escala.",
  "textEn": "Schedules → Download or print schedules lets you choose layout and scale.",
  "details": [
    "Corrido coloca las áreas una debajo de otra con poca separación y aprovecha el espacio disponible. Página por área comienza cada área y bloque de fechas en otra hoja; si un área es grande, puede ocupar varias hojas.",
    "Escala de impresión ofrece 70%, 80%, 90%, 100%, 110% y 120%. Menor escala reduce letras, relleno y altura de filas; el documento vuelve a calcular saltos para mover el contenido hacia arriba. Elija una escala legible.",
    "Seleccione la distribución y escala antes de pulsar Imprimir o Descargar PDF. Ambos usan el mismo formato A4 horizontal. Cambiar el zoom del visor o la escala del diálogo después de generar un PDF solo reduce sus páginas; no reúne áreas. Para reorganizar, vuelva a MRMAA y genere nuevamente.",
    "Las fechas se repiten al continuar tablas, los colores cubren las casillas y las observaciones siguen al pie de cada hoja. Los intervalos largos conservan bloques de hasta 14 días. Solo cambia la presentación; no se modifican turnos ni registros guardados."
  ],
  "detailsEn": [
    "Continuous places areas below one another with a small gap and uses available page space. Page per area starts each area and date block on a fresh page; large areas may span multiple pages.",
    "Print scale offers 70%, 80%, 90%, 100%, 110% and 120%. Smaller scales reduce text, padding and row height; the document recalculates page breaks and moves content up. Choose a readable scale.",
    "Choose layout and scale before Print or Download PDF. Both use the same A4 landscape layout. Changing viewer zoom or print-dialog scale after a PDF is generated only shrinks its pages; it does not combine areas. Return to MRMAA and generate again to repaginate.",
    "Dates repeat when tables continue, colors fill cells and observations remain at the bottom of every page. Long ranges keep blocks of up to 14 days. Only presentation changes; saved shifts and records stay unchanged."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Sesiones activas y dispositivos del equipo",
  "titleEn": "Active sessions and team devices",
  "text": "Revise y cierre sesiones abiertas sin bloquear permanentemente un dispositivo.",
  "textEn": "Review and end open sessions without permanently blocking a device.",
  "details": [
    "El administrador principal entra a Configuración → Seguridad → Sesiones activas. Mis sesiones muestra sus accesos; Equipo del restaurante muestra los de los usuarios activos invitados. Cada invitado encuentra sus propias sesiones junto a Verificación en dos pasos, en Configuración.",
    "Se muestran usuario, correo, navegador, sistema operativo aproximado, última actividad registrada y Esta sesión. Buscar filtra nombre, correo o dispositivo. Hay 50 resultados por página. Actualizar vuelve a consultar la lista; una sesión abierta no garantiza que la persona esté conectada en ese instante. La actividad se registra aproximadamente cada cinco minutos con la página visible.",
    "Cerrar sesión requiere confirmación. Cerrar mis demás sesiones conserva la actual y solo afecta a las suyas. El administrador principal también puede cerrar una sesión de un invitado de su restaurante. La sesión se cierra para esa cuenta en ese navegador, incluso si la misma sesión accede a otro restaurante. No da acceso a los datos de esos otros restaurantes.",
    "Las nuevas consultas y cambios se rechazan en el servidor al revocar. La pantalla abierta detecta el cierre al volver a ella o en la siguiente comprobación, aproximadamente un minuto; no puede retirar información ya vista o descargada. Puede volver a ingresar con contraseña y, si corresponde, código por email. Un administrador que quiera retirar acceso permanente debe desactivar al invitado en Usuarios.",
    "Los dispositivos se identifican por la sesión del navegador, no por número de serie. Varias pestañas pueden compartir sesión. Nunca se muestran contraseñas ni tokens. Los invitados no pueden ver ni cerrar sesiones de otros usuarios; soporte temporal tampoco obtiene ese permiso."
  ],
  "detailsEn": [
    "The primary administrator opens Settings → Security → Active sessions. My sessions shows their own access; Restaurant team shows active invited users. Each invited user finds their own sessions alongside Two-step verification in Settings.",
    "The list shows user, email, approximate browser and operating system, last recorded activity and This session. Search filters name, email or device. Results use 50-row pages. Refresh reloads the list; an open session does not prove the user is online right now. Activity is recorded about every five minutes while the page is visible.",
    "End session requires confirmation. End my other sessions keeps the current session and affects only your own sessions. The primary administrator can also end a session of an invited restaurant user. This ends account access in that browser, including any other restaurant accessed through that same session. It does not expose those other restaurants’ data.",
    "After revocation, the server rejects new reads and changes. An open screen detects the closure when focused or on its next check, about one minute; information already viewed or downloaded cannot be recalled. Signing in again with a password and email code, when enabled, remains possible. To remove access permanently, deactivate the invited user in Users.",
    "Devices are identified by browser session, not hardware serial number. Tabs may share a session. Passwords and tokens are never displayed. Invited users cannot see or end other users’ sessions; temporary support does not receive that permission either."
  ],
  "adminOnly": false
},
{
  "tab": "quotes",
  "title": "Sincronización de cotizaciones y reservaciones vinculadas",
  "titleEn": "Linked quote and reservation synchronization",
  "text": "Al editar datos compartidos, el cambio se guarda en ambos registros vinculados.",
  "textEn": "Editing shared fields saves those changes to both linked records.",
  "details": [
    "Se sincronizan en ambas direcciones los campos que cambie: cliente registrado, nombre, teléfono, fecha del evento, hora, área e invitados. Por ejemplo, cambiar la fecha en la reservación también cambia la fecha de su cotización vinculada.",
    "Productos, descripción, precios, descuentos, propinas, totales, anticipo, método de pago y notas mantienen el valor propio de cada documento. Cambiar invitados no recalcula cantidades de productos. Revise importes y anticipos en cada registro.",
    "Instalar la actualización o vincular dos registros existentes no sobrescribe sus datos anteriores. Después de vincular, se propagan los campos compartidos que efectivamente cambie; los campos que no edite conservan su valor. Si había diferencias anteriores, revíselas manualmente.",
    "Desvincular detiene la sincronización sin borrar registros. Las eliminaciones y restauraciones no copian datos; los registros en papelera no se sincronizan. Cancelar la reservación conserva el vínculo y la cotización sigue Convertida. Cambiar el estado no copia un estado equivalente al otro documento.",
    "Los cambios se guardan juntos en la base de datos, incluso si la otra pantalla está cerrada. Si la operación falla, no se guarda parcialmente. Si otro usuario está editando el mismo evento, revise el aviso de cambios recientes antes de guardar su borrador."
  ],
  "detailsEn": [
    "The fields you change synchronize in both directions: registered customer, name, phone, event date, time, area and guests. For example, changing the reservation date also changes the linked quote date.",
    "Products, descriptions, prices, discounts, tips, totals, deposit, payment method and notes keep each document’s own value. Changing guests does not recalculate product quantities. Review amounts and deposits in each record.",
    "Installing the update or linking two existing records does not overwrite their previous data. After linking, only shared fields that actually change propagate; untouched fields keep their value. Review any earlier differences manually.",
    "Unlinking stops synchronization without deleting records. Deletion and restoration do not copy data; trashed records do not synchronize. Cancelling a reservation preserves its link and the quote remains Converted. A status change does not copy an equivalent status to the other document.",
    "Changes are saved together in the database, even if the other screen is closed. If the operation fails, it does not save partially. If someone else is editing the same event, review the recent-changes notice before saving your draft."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Autorizar acceso temporal a soporte",
  "titleEn": "Authorize temporary support access",
  "text": "Configuración → Soporte permite autorizar a support@mrmaa.com por 24 horas sin consumir usuarios del plan.",
  "textEn": "Settings → Support lets you authorize support@mrmaa.com for 24 hours without using a plan seat.",
  "details": [
    "Solo un administrador del restaurante puede autorizar o revocar. Describa el problema y elija Solo lectura o Ver y editar. Si ya existe una solicitud activa para este restaurante, revóquela primero. Puede haber solicitudes de distintos restaurantes al mismo tiempo.",
    "Solo lectura permite revisar los datos. Ver y editar permite corregir clientes, cotizaciones, reservaciones, horarios y configuración operativa. Soporte no administra usuarios, pagos, propiedad, eliminación de la cuenta ni vaciado de la papelera. Los permisos y módulos del plan siguen aplicando.",
    "El permiso vence automáticamente a las 24 horas. Revocar acceso bloquea nuevas consultas y cambios; una pantalla abierta se cierra al verificar de nuevo, como máximo cada 15 segundos mientras está activa. Los datos ya vistos o descargados no se pueden retirar.",
    "Se envía un correo de aviso a support@mrmaa.com con el restaurante, el problema, permiso, vencimiento y enlace. El enlace identifica la solicitud, pero requiere la cuenta de soporte autorizada y contraseña más código por email. Si el aviso falla, la autorización sigue visible y puede reintentar el correo.",
    "La cuenta de soporte entra a su listado de solicitudes. Un enlace abre la solicitud específica después de iniciar sesión. Dentro del restaurante aparece un aviso con su nombre y un botón Volver a solicitudes; guarde los cambios antes de cambiar.",
    "Las autorizaciones, revocaciones, entradas y cambios se registran en Configuración → Seguridad. El cliente puede consultar allí el historial. Nunca comparta contraseñas ni códigos con soporte."
  ],
  "detailsEn": [
    "Only a restaurant administrator can authorize or revoke access. Describe the issue and choose View only or View and edit. Revoke an existing active request for this restaurant first. Requests from different restaurants can coexist.",
    "View only allows reviewing data. View and edit allows corrections to customers, quotes, reservations, schedules and operational settings. Support cannot manage users, payments, ownership, account deletion or emptying the trash. Plan permissions and modules still apply.",
    "Permission expires automatically after 24 hours. Revocation blocks new queries and changes; an open screen closes when rechecked, at most every 15 seconds while active. Data already viewed or downloaded cannot be withdrawn.",
    "An email to support@mrmaa.com contains the restaurant, issue, permission, expiration and link. The link identifies the request but requires the authorized support account, password and email code. If notification fails, the authorization stays visible and you can retry sending the email.",
    "The support account opens its request list. A request link opens the specific request after sign-in. A visible banner identifies the restaurant and provides Back to requests; save changes before switching.",
    "Authorizations, revocations, entries and changes are recorded in Settings → Security. The customer can review history there. Never share passwords or security codes with support."
  ],
  "adminOnly": true
},
  {
    "tab": null,
    "title": "Buscar y navegar historiales grandes",
    "titleEn": "Search and browse large histories",
    "text": "Clientes, cotizaciones y reservaciones muestran hasta 50 registros por página.",
    "textEn": "Customers, quotes and reservations show up to 50 records per page.",
    "details": [
      "Use Anterior y Siguiente para recorrer los resultados. Cambiar búsqueda, fechas u orden vuelve a la primera página. Los listados no calculan un total de todo el historial en cada página, para responder más rápido. Seleccionar esta página solo selecciona sus registros visibles.",
      "En Reservaciones, Todas muestra totales de la página visible. Elija un día o un período para calcular personas, anticipos y reservaciones de ese filtro. La impresión y Excel siguen usando los filtros, dentro de sus límites de descarga.",
      "Los avisos de cotizaciones también tienen páginas. 50+ indica que hay más avisos; avance para consultarlos. Las opciones de ordenar por evento, número o creación se aplican antes de dividir las páginas.",
      "Si otros miembros cambian registros mientras navega, los resultados pueden variar. Vuelva a la primera página o cambie el filtro para actualizar el recorrido. Buscar o avanzar de página no cambia los datos guardados. Los catálogos incluyen registros más allá de los primeros 1,000; si una lectura supera 10,000 filas o 20 MB, aparece un error en vez de una lista incompleta."
    ],
    "detailsEn": [
      "Use Previous and Next to browse results. Changing search, dates or sorting returns to the first page. Lists do not recount the entire history on every page, which improves response times. Select this page selects only visible records.",
      "In Reservations, All shows totals for the visible page. Choose a day or date range to calculate people, deposits and reservations for that filter. Print and Excel still use the filters, within their download limits.",
      "Quote reminders also have pages. 50+ means more reminders are available; move to the next page to view them. Event date, number and creation-date sorting apply before dividing results into pages.",
      "Results can change if teammates edit records while you browse. Return to the first page or change the filter to refresh the sequence. Searching or moving between pages does not change saved data. Catalogs include records beyond the first 1,000; if a read exceeds 10,000 rows or 20 MB, an error appears instead of an incomplete list."
    ],
    "adminOnly": false
  },
  {
    "tab": null,
    "title": "Inicio rápido: su primer evento en unos 5 minutos",
    "titleEn": "Quick setup: your first event in about 5 minutes",
    "text": "El administrador puede abrir Ayuda → Inicio rápido para preparar lo esencial. Se ofrece automáticamente en restaurantes nuevos sin áreas ni productos.",
    "textEn": "Administrators can open Help → Quick setup to prepare the essentials. It is offered automatically for new restaurants with no areas or products.",
    "details": [
      "En Intermediate y Advanced, escriba un área de empleados, el nombre del primer empleado y un turno inicial con entrada y salida. Esta ficha de empleado no crea un usuario, no invita a nadie ni consume un cupo de acceso. Basic omite este paso porque no incluye horarios.",
      "Cree un área de eventos para cotizaciones y reservaciones: es distinta del área de empleados. Agregue el nombre de un producto del menú o servicio, descripción opcional y precio unitario en la moneda del restaurante.",
      "Continuar todavía no guarda. Revise y pulse Guardar y empezar: la configuración se guarda como una sola operación. Los registros activos con los mismos nombres se reutilizan sin sobrescribir sus datos. Si se pierde la conexión, reintentar no duplica la configuración ya completada.",
      "Al terminar, elija Crear cotización, Crear reservación o Asignar horario según su plan. Cotización precarga el área y el producto inicial; reservación precarga el área. Revise cantidades y precios y complete cliente, fecha y demás campos antes de guardar el evento. No se crean eventos ni asignaciones ficticias automáticamente.",
      "Después cierra el inicio rápido. Si escribió datos sin guardar se pide confirmar que desea descartarlos. Puede volver desde Ayuda → Inicio rápido. Una configuración ya completada muestra los accesos directos; para agregar o cambiar catálogos use Configuración.",
      "Los catálogos se guardan para todo el restaurante. La preferencia de posponer se conserva solo en ese navegador y usuario. No hay un límite de cinco minutos: es una guía breve para comenzar."
    ],
    "detailsEn": [
      "On Intermediate and Advanced, enter an employee area, the first employee’s name and an initial shift with start and end times. An employee record does not create a login, invite anyone or use a user seat. Basic skips this step because it does not include schedules.",
      "Create an event area for quotes and reservations, separate from the employee area. Add a menu item or service name, optional description and unit price in the restaurant currency.",
      "Next does not save yet. Review and select Save and start: setup is saved as one operation. Active records with matching names are reused without overwriting their data. Retrying after a connection loss does not duplicate completed setup.",
      "After saving, choose Create quote, Create reservation or Assign a schedule according to your plan. Quotes prefill the initial area and product; reservations prefill the area. Review quantities and prices and complete the customer, date and remaining fields before saving the event. No fictitious events or assignments are created automatically.",
      "Later closes quick setup. If you entered unsaved data, confirm whether to discard it. Return through Help → Quick setup. Completed setup shows the shortcuts; use Settings to add or change catalogs.",
      "Catalogs are saved for the entire restaurant. The postpone preference applies only to that browser and user. There is no five-minute time limit; this is a short guide to getting started."
    ],
    "adminOnly": true
  },
  {
    "tab": null,
    "title": "Ayuda: instructivo, tutorial y Asistente MRMAA",
    "titleEn": "Help: guide, tutorial and MRMAA Assistant",
    "text": "Abra Ayuda en el menú lateral cuando necesite orientación.",
    "textEn": "Open Help in the sidebar whenever you need guidance.",
    "details": [
      "Ayuda reúne Inicio rápido (administrador), Instructivo con buscador, Tutorial guiado, Asistente MRMAA, consejos, soporte y sugerencias. Abra o cierre esta sección para ahorrar espacio.",
      "El tutorial no se abre automáticamente. Seleccione Tutorial cuando quiera recorrer funciones, o Instructivo para consultar un tema específico. Cerrar la ayuda no cambia sus registros.",
      "El Asistente MRMAA explica las funciones disponibles según su plan y rol; no ve ni modifica los datos de su restaurante. El instructivo y tutorial no consumen consultas de IA."
    ],
    "detailsEn": [
      "Help groups Quick setup (administrator), the searchable Guide, guided Tutorial, MRMAA Assistant, tips, support and suggestions. Expand or collapse it to save space.",
      "The tutorial does not open automatically. Choose Tutorial for a guided tour or Guide to look up a specific topic. Closing help does not change your records.",
      "MRMAA Assistant explains features according to your plan and role; it cannot see or change restaurant data. Guide and tutorial use no AI questions."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Fechas, áreas y empleados fijos al desplazar horarios",
    "titleEn": "Frozen dates, areas and employees while scrolling schedules",
    "text": "Desplace la tabla de cada área para asignar horarios sin perder las referencias.",
    "textEn": "Scroll each area’s table to assign schedules without losing your place.",
    "details": [
      "Cada área tiene una tabla con desplazamiento horizontal y vertical. Al bajar dentro de ella permanecen visibles el nombre del área y las fechas; al moverla a los lados permanece visible la columna de empleados.",
      "En computadora use la barra de desplazamiento o el trackpad; en móviles deslice dentro de la tabla. Puede enfocar la tabla con el teclado y navegar sus controles. Los encabezados fijos no modifican las fechas ni los horarios guardados.",
      "PDF e impresión conservan su formato, colores claros y observaciones al pie de cada hoja."
    ],
    "detailsEn": [
      "Each area has a table that scrolls horizontally and vertically. The area name and dates stay visible while scrolling down inside it; the employee column stays visible while scrolling sideways.",
      "On a computer use the scrollbar or trackpad; on mobile swipe inside the table. You can focus the table with the keyboard and navigate its controls. Frozen headings do not change saved dates or assignments.",
      "PDF and print retain their layout, light colors and observations at the bottom of every page."
    ],
    "adminOnly": false
  },
  {
    "tab": "clients",
    "title": "Importar clientes desde Excel o CSV y descargar plantilla",
    "titleEn": "Import customers from Excel or CSV and download the template",
    "text": "En Clientes use Plantilla de clientes y luego Importar clientes. Revise las filas antes de confirmar.",
    "textEn": "In Customers use Customer template and then Import customers. Review the rows before confirming.",
    "details": [
      "Disponible para Administrador, Gerente y Operador en los planes que incluyen Clientes. Solo lectura no importa. Descargar la plantilla respeta el permiso de descargas Excel del equipo; el Administrador siempre puede descargarla.",
      "La primera hoja de la plantilla, Clientes, está vacía y tiene Nombre, Teléfono, Correo y Notas. Nombre es obligatorio, máximo 200 caracteres; los demás son opcionales. La segunda hoja contiene instrucciones y un ejemplo que no se importa. Se aceptan encabezados equivalentes en español o inglés.",
      "Mantenga los teléfonos como texto para conservar + y ceros iniciales; use el código de país de manera consistente. El sistema compara los dígitos del teléfono y el correo sin distinguir mayúsculas; no adivina códigos de país. Si no hay teléfono ni correo, compara el nombre. Un nombre igual con contactos diferentes puede representar otra persona.",
      "Seleccione un archivo XLSX, XLS o CSV, máximo 5 MB y 5,000 filas de datos. Solo se lee la primera hoja con encabezados en la fila 1. Se ignoran filas vacías. Use valores en lugar de fórmulas, correos válidos y notas de hasta 2,000 caracteres.",
      "La revisión muestra el número de fila, nombre, teléfono, correo, notas y resultado: Nuevo, Ya existe, En papelera, Repetido o Revisar. Use Mostrar para filtrar y avance entre páginas de 50 filas. Revisar explica el error que debe corregirse en el archivo. Cargar el archivo todavía no guarda clientes.",
      "Pulse Importar clientes nuevos para agregar únicamente las filas marcadas Nuevo. Se vuelve a comprobar si ya existen al guardar. Los duplicados del archivo o del restaurante se omiten y no se sobrescriben datos. Los clientes en papelera tampoco se restauran automáticamente: solicite al Administrador recuperarlos desde Seguridad.",
      "Al terminar verá Importado y los omitidos. Corrija errores en el archivo y vuelva a cargarlo. Si se interrumpe una importación, los lotes ya guardados se conservan y puede reintentar los pendientes; se revisan nuevamente para evitar duplicar los clientes ya importados. Mantenga abierta la pantalla durante el guardado.",
      "Importar solo crea fichas de clientes; no crea reservaciones, cotizaciones ni envía invitaciones o correos. Después puede buscar al cliente y seleccionarlo en los formularios habituales."
    ],
    "detailsEn": [
      "Available to Administrator, Manager and Operator on plans that include Customers. Read-only cannot import. Template downloads follow the team Excel download permission; Administrator can always download it.",
      "The first template sheet, Customers, is empty and includes Name, Phone, Email and Notes. Name is required, up to 200 characters; other fields are optional. The second sheet contains instructions and an example that is not imported. Equivalent Spanish or English headers are accepted.",
      "Keep phones as text to preserve + and leading zeroes; use the country code consistently. The system compares phone digits and case-insensitive email addresses; it does not infer country codes. With no phone or email, it compares the name. The same name with different contacts may represent another person.",
      "Choose XLSX, XLS or CSV, up to 5 MB and 5,000 data rows. Only the first sheet is read, with headers in row 1. Empty rows are ignored. Use values instead of formulas, valid emails and notes of up to 2,000 characters.",
      "The review shows the row number, name, phone, email, notes and result: New, Already exists, In trash, Duplicate or Review. Use Show to filter and navigate pages of 50 rows. Review explains what to fix in the file. Uploading the file does not save customers yet.",
      "Select Import new customers to add only New rows. Existing matches are checked again when saving. Duplicates in the file or restaurant are skipped and stored data is not overwritten. Customers in trash are not restored automatically: ask the Administrator to recover them from Security.",
      "After importing you will see Imported and skipped counts. Correct errors in the file and upload it again. If an import is interrupted, completed batches remain saved and you can retry pending rows; matches are checked again to avoid duplicating imported customers. Keep the screen open while saving.",
      "Import creates customer records only; it does not create reservations or quotes or send invitations or emails. Afterwards you can find and select the customer in the usual forms."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Observaciones al pie de cada hoja de horarios",
    "titleEn": "Observations at the bottom of every schedule page",
    "text": "Horarios → Descargar o imprimir horarios incluye Observaciones para impresión.",
    "textEn": "Schedules → Download or print schedules includes Print observations.",
    "details": [
      "Escriba indicaciones generales para el equipo antes de descargar el PDF o imprimir. Se repiten completas al pie de cada hoja, aunque se divida por áreas, rangos de fechas o cantidad de empleados.",
      "Las observaciones tienen espacio propio debajo de la tabla, separado del número de página. El documento sigue siendo A4 horizontal con colores claros de casilla y hasta 14 fechas por bloque. Las notas de cada empleado se mantienen en sus casillas.",
      "Se conservan como borrador de ese restaurante en la pestaña del navegador; no se comparten con otros usuarios ni se guardan como notas de empleados. Revise el borrador antes de cada impresión. Deje el campo vacío para imprimir sin observaciones; Excel no incluye este pie de página.",
      "Use hasta 1,000 caracteres y 12 líneas impresas. Si el texto excede el espacio permitido, MRMAA pide reducirlo; no lo corta silenciosamente."
    ],
    "detailsEn": [
      "Enter general team instructions before downloading the PDF or printing. They repeat in full at the bottom of every page, including separate areas, date ranges and employee overflow pages.",
      "Observations have reserved space below the table, separate from the page number. The document remains landscape A4 with light cell colors and up to 14 dates per block. Individual employee notes remain in their cells.",
      "They remain a draft for that restaurant in the current browser tab; they are not shared with other users or saved as employee notes. Review the draft before each print. Leave the field empty to omit observations; Excel does not include this footer.",
      "Use up to 1,000 characters and 12 printed lines. If the text exceeds the allowed space, MRMAA asks you to shorten it rather than silently cutting it off."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Formato de hora: AM/PM o 24 horas en reservas, cotizaciones y horarios",
    "titleEn": "Time format: AM/PM or 24-hour time in reservations, quotes and schedules",
    "text": "El administrador elige Formato de hora en Configuración → General o junto a Turnos en Configuración → Horarios, y pulsa Guardar configuración.",
    "textEn": "The administrator chooses Time format in Settings → General or beside Shifts in Settings → Schedules, then selects Save settings.",
    "details": [
      "Seleccione 12 horas (AM/PM) o 24 horas. Es una preferencia para todo el restaurante; los invitados usan la misma. Sin configurar se conserva el formato de 24 horas. Los demás roles pueden pedir el cambio al administrador.",
      "En los campos de hora de reservaciones, cotizaciones, turnos e inicio y fin de comida seleccione hora y minutos. Con 12 horas seleccione también AM o PM; con 24 horas elija de 00 a 23. Borrar hora deja el campo vacío. 12:00 AM es medianoche (00:00); 12:00 PM es mediodía (12:00). Los turnos requieren completar Entrada y Salida con hora o texto.",
      "El mismo formato se aplica a las listas, avisos de coincidencias, vista previa y PDF de cotizaciones, impresión y Excel de reservaciones, y al calendario, selector de turnos, comidas, PDF, impresión y Excel de horarios. El texto libre conserva exactamente lo escrito. La plantilla de importación de reservas muestra el formato elegido y la importación acepta ambos formatos.",
      "Cambiar el formato no cambia las horas guardadas ni la zona horaria: 19:00 y 07:00 PM representan la misma hora. General y Horarios muestran la misma preferencia para todo el restaurante. Pulse Guardar configuración para aplicarla al equipo; Agregar turno guarda el turno, no esa preferencia. Descartar cambios conserva el formato anterior."
    ],
    "detailsEn": [
      "Choose 12 hours (AM/PM) or 24 hours. This is a restaurant-wide preference shared by invited users. The default remains 24 hours. Other roles can ask the administrator to change it.",
      "In time fields for reservations, quotes, shifts and meal start and end, select hours and minutes. With 12-hour time also select AM or PM; with 24-hour time select 00 through 23. Clear time leaves the field empty. 12:00 AM is midnight (00:00); 12:00 PM is noon (12:00). Shifts require both Start and End to contain a time or text.",
      "The same format applies to lists, overlap alerts, quote previews and PDFs, reservation printing and Excel exports, and the schedule calendar, shift selector, meals, PDF, printing and Excel. Free text remains as entered. The reservation import template shows the chosen format and imports accept both formats.",
      "Changing the format does not change stored times or the time zone: 19:00 and 07:00 PM represent the same time. General and Schedules show the same restaurant-wide preference. Select Save settings to apply it to the team; Add shift saves the shift, not this preference. Discarding changes preserves the previous format."
    ],
    "adminOnly": false
  },
  {
    "tab": null,
    "title": "Comience aquí",
    "titleEn": "Start here",
    "text": "Conozca el flujo antes de cargar datos.",
    "textEn": "Understand the workflow before entering data.",
    "details": [
      "Configure áreas, productos y datos del negocio antes de preparar eventos.",
      "Registre al cliente, prepare su cotización y conviértala en reserva cuando confirme.",
      "Use el índice para consultar un tema. Cerrar el tutorial no guarda ni elimina sus formularios."
    ],
    "detailsEn": [
      "Set up areas, products and business details before preparing events.",
      "Add the customer, prepare a quote and convert it to a reservation when confirmed.",
      "Use the index to find a topic. Closing the tutorial does not save or delete your forms."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Áreas para eventos",
    "titleEn": "Event areas",
    "text": "Seleccione siempre un área configurada.",
    "textEn": "Always choose a configured area.",
    "details": [
      "Solicite al administrador, gerente u operador que agregue las áreas en Configuración → Reservaciones.",
      "Escriba en el buscador y seleccione la sugerencia. Las áreas de eventos son distintas de las áreas de empleados.",
      "El aviso de coincidencias compara área y horarios cercanos; revise la capacidad antes de confirmar."
    ],
    "detailsEn": [
      "Ask an administrator, manager or operator to add areas under Settings → Reservations.",
      "Type in the search field and select a suggestion. Event areas differ from employee areas.",
      "Overlap alerts compare areas and nearby times; review capacity before confirming."
    ],
    "adminOnly": false
  },
  {
    "tab": "clients",
    "title": "Clientes: registro y consulta",
    "titleEn": "Customers: registration and lookup",
    "text": "Evite volver a escribir los datos del cliente.",
    "textEn": "Avoid retyping customer details.",
    "details": [
      "Busque primero por nombre, teléfono o correo para identificar un registro existente.",
      "Use Nuevo para registrar un cliente y el lápiz para corregir una ficha existente.",
      "Use Importar clientes para cargar Excel o CSV y Plantilla de clientes para descargar el formato. Descargar Excel exporta los resultados existentes; son acciones distintas."
    ],
    "detailsEn": [
      "Search by name, phone or email first to find an existing record.",
      "Use New to register a customer and the pencil to correct an existing record.",
      "Use Import customers to upload Excel or CSV and Customer template to download the format. Download Excel exports existing results; these are separate actions."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Crear una cotización",
    "titleEn": "Create a quote",
    "text": "Prepare los datos del evento y el detalle comercial.",
    "textEn": "Prepare event details and the commercial proposal.",
    "details": [
      "En Nombre del cliente, escriba un nombre nuevo o busque y elija un cliente guardado en la misma casilla. Al elegirlo se completan teléfono y correo. Complete fecha del evento, hora, invitados y área.",
      "El área se elige de las sugerencias del buscador; debe estar configurada antes de guardar.",
      "La nota para el cliente y las observaciones internas tienen propósitos distintos. Revise la vista previa antes de compartir."
    ],
    "detailsEn": [
      "In Customer name, enter a new name or search and select a saved customer in the same field. Selecting a customer fills in phone and email. Enter the event date, time, guests and area.",
      "Choose the area from search suggestions; it must be configured before saving.",
      "The customer note and internal notes serve different purposes. Review the preview before sharing."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Productos y líneas",
    "titleEn": "Products and line items",
    "text": "Busque y ajuste productos dentro de la cotización.",
    "textEn": "Search and adjust products within the quote.",
    "details": [
      "Escriba en Producto para buscar el catálogo y seleccione una sugerencia, o escriba un concepto manual.",
      "Ajuste descripción, cantidad y precio de cada línea. Agregar línea crea otra fila editable.",
      "Puede eliminar cualquier fila, llena o vacía. Para guardar debe quedar al menos un concepto válido."
    ],
    "detailsEn": [
      "Type in Product to search the catalog and select a suggestion, or enter a manual item.",
      "Adjust each description, quantity and price. Add line creates another editable row.",
      "You can remove any row, filled or empty. Keep at least one valid item to save."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Totales y anticipos",
    "titleEn": "Totals and deposits",
    "text": "Revise los montos antes de guardar.",
    "textEn": "Check amounts before saving.",
    "details": [
      "Cantidad y precio determinan el importe de cada línea. Revise descuentos, ajustes y propina.",
      "Registre el anticipo y su método de pago; compruebe el saldo calculado.",
      "Verifique qué campos están visibles en el documento. Ocultar un anticipo no elimina el importe guardado."
    ],
    "detailsEn": [
      "Quantity and price determine each line amount. Review discounts, adjustments and tips.",
      "Enter the deposit and payment method, then check the calculated balance.",
      "Check which fields appear in the document. Hiding a deposit does not delete its saved amount."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Guardar, editar y PDF",
    "titleEn": "Save, edit and PDF",
    "text": "Compruebe el documento que recibirá el cliente.",
    "textEn": "Check the document your customer will receive.",
    "details": [
      "Guarde y espere la confirmación antes de volver a intentarlo. Use Editar para cambiar una cotización existente.",
      "Abra Ver para revisar el diseño, logo, textos y montos. Descargue PDF o use Imprimir.",
      "El PDF usa A4. En el teléfono puede guardarlo o compartirlo desde el visor del dispositivo."
    ],
    "detailsEn": [
      "Save and wait for confirmation before retrying. Use Edit to change an existing quote.",
      "Open View to check the layout, logo, wording and amounts. Download PDF or choose Print.",
      "The PDF uses A4. On your phone, save or share it from the device viewer."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Avisos y estados",
    "titleEn": "Reminders and statuses",
    "text": "Dé seguimiento desde cinco días antes del evento.",
    "textEn": "Follow up from five days before the event.",
    "details": [
      "Contactar aparece desde 5 días antes hasta el día del evento. El aviso incluye nombre, número y fecha.",
      "Quitar aviso lo oculta para el equipo y conserva la cotización. Ver avisos ocultos permite mostrarlo otra vez.",
      "Si cambia la fecha, el aviso se reactiva. Pasada la fecha sin confirmar se muestra No realizada; las confirmadas conservan su estado."
    ],
    "detailsEn": [
      "Contact appears from 5 days before through the event day. The reminder includes customer, number and date.",
      "Dismiss reminder hides it for the team and keeps the quote. View hidden reminders lets you restore it.",
      "Changing the date reactivates the reminder. After an unconfirmed event date, Not held appears; confirmed quotes keep their status."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Convertir en reserva",
    "titleEn": "Convert to a reservation",
    "text": "Conserve la relación entre cotización y evento.",
    "textEn": "Keep the quote and event linked.",
    "details": [
      "Abra la cotización y elija Convertir en reserva cuando el cliente confirme.",
      "Revise fecha, hora, área, invitados y anticipo en la reserva creada; queda confirmada.",
      "Al seleccionar para borrar una cotización vinculada aparece un aviso: primero elimine la reservación o desvincule la cotización. Desvincular requiere confirmación y conserva ambos registros; la cotización vuelve a Pendiente."
    ],
    "detailsEn": [
      "Open the quote and choose Convert to reservation when the customer confirms.",
      "Check the date, time, area, guests and deposit in the new confirmed reservation.",
      "Selecting a linked quote for deletion shows a warning: first delete the reservation or unlink the quote. Unlinking requires confirmation and keeps both records; the quote returns to Pending."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Gestionar reservaciones",
    "titleEn": "Manage reservations",
    "text": "Consulte el día correcto y mantenga los estados al día.",
    "textEn": "Check the right day and keep statuses current.",
    "details": [
      "Use Hoy, fecha única o rango y el buscador para encontrar el evento.",
      "Revise nombre, invitados, fecha, hora y área antes de guardar o confirmar.",
      "El teléfono guardado en la reservación aparece debajo del nombre del cliente en el listado, sin abrir el formulario. Si está vacío, verá Sin teléfono; puede agregarlo al editar la reservación.",
      "Puede consultar la cotización vinculada y registrar anticipos. Cancelar un evento es distinto de enviarlo a la papelera.",
      "En una reserva guardada sin cotización, Crear cotización abre un borrador con cliente, teléfono, fecha, hora, área, invitados, menú, anticipo y observaciones. Complete productos y precios; cancelar el borrador no crea una cotización.",
      "Vincular cotización permite buscar por número, cliente o teléfono y elegir una cotización existente sin reserva activa. Compare los datos del evento antes de confirmar. Al guardar o vincular, la reserva queda Confirmada y la cotización Convertida, sin crear otra reserva ni sobrescribir sus demás datos. Una reserva y una cotización solo pueden tener un vínculo activo; las reservas canceladas deben reactivarse primero. Administrador, gerente y operador pueden hacerlo; solo lectura no."
    ],
    "detailsEn": [
      "Use Today, a single date or a range and search to find the event.",
      "Check the name, guests, date, time and area before saving or confirming.",
      "The phone saved with the reservation appears below the customer name in the list, without opening the form. An empty number shows No phone; add it by editing the reservation.",
      "View the linked quote and record deposits. Canceling an event differs from moving it to trash.",
      "On a saved reservation without a quote, Create quote opens a draft with the customer, phone, date, time, area, guests, menu, deposit and notes. Complete products and prices; canceling the draft creates no quote.",
      "Link quote lets you search by number, customer or phone and select an existing quote without an active reservation. Compare event details before confirming. Saving or linking marks the reservation Confirmed and the quote Converted without creating another reservation or overwriting its other details. Only one active link is allowed; canceled reservations must be reactivated first. Administrators, managers and operators can do this; read-only users cannot."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Preparar empleados y turnos",
    "titleEn": "Set up employees and shifts",
    "text": "Organice los catálogos antes de asignar días.",
    "textEn": "Set up your catalogs before assigning days.",
    "details": [
      "En Configuración, registre áreas de empleados, empleados y turnos con entrada, salida y comida.",
      "Seleccione el mes y año que desea organizar. Busque los empleados por área.",
      "Intermediate y Advanced incluyen horarios. La cantidad de empleados no equivale a usuarios con acceso a MRMAA."
    ],
    "detailsEn": [
      "In Settings, add employee areas, employees and shifts with start, end and meal times.",
      "Select the month and year you want to organize. Find employees by area.",
      "Intermediate and Advanced include schedules. Employee records are different from users who can sign in to MRMAA."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Asignaciones y colores",
    "titleEn": "Assignments and colors",
    "text": "Haga legible el horario del equipo.",
    "textEn": "Make team schedules easy to read.",
    "details": [
      "Abra el panel de asignación: aparece al costado en pantallas grandes y se despliega en móviles. Busque y seleccione empleados y una fecha o rango.",
      "Seleccione un tono claro en Color de casilla. Auto usa el color del tipo de asignación.",
      "Complete comida y notas cuando corresponda y guarde. Para modificar una asignación, pulse su casilla."
    ],
    "detailsEn": [
      "Open the assignment panel: it sits beside the calendar on wide screens and expands on mobile. Search and select employees and a date or range.",
      "Choose a light shade under Cell color. Auto uses the assignment type color.",
      "Complete meal times and notes where relevant, then save. Click a cell to edit an assignment."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Copiar e imprimir horarios",
    "titleEn": "Copy and print schedules",
    "text": "Ahorre tiempo sin perder la revisión final.",
    "textEn": "Save time while keeping a final review.",
    "details": [
      "Para copiar sin arrastrar, toque una casilla, elija otros empleados o fechas y guarde. También puede copiar el mes anterior; generar por patrón requiere 14 días completos.",
      "Revise fechas y empleados antes de guardar cambios masivos o borrar un período.",
      "Seleccione rango y áreas; use Descargar PDF o Imprimir. Ambos usan el mismo PDF A4 horizontal y el color cubre la casilla completa."
    ],
    "detailsEn": [
      "To copy without dragging, tap a cell, choose other employees or dates and save. You can also copy the previous month; pattern generation requires 14 complete days.",
      "Review dates and employees before saving bulk changes or deleting a period.",
      "Choose range and areas, then Download PDF or Print. Both use the same landscape A4 PDF and color fills the entire cell."
    ],
    "adminOnly": false
  },
  {
    "tab": "reports",
    "title": "Reportes de Advanced",
    "titleEn": "Advanced reports",
    "text": "Analice resultados dentro del período seleccionado.",
    "textEn": "Analyze results within your chosen period.",
    "details": [
      "Seleccione el reporte, el rango de fechas y el filtro de búsqueda. Los reportes requieren Advanced y rol administrador.",
      "Revise cotizaciones aprobadas, conversión, anticipos, saldos, clientes frecuentes y horas programadas.",
      "El valor de cotizaciones aprobadas no equivale por sí solo a dinero cobrado. Compare anticipos y saldos para interpretar el resultado."
    ],
    "detailsEn": [
      "Choose the report, date range and search filter. Reports require Advanced and an administrator role.",
      "Review approved quotes, conversion, deposits, balances, frequent customers and scheduled hours.",
      "Approved quote value does not by itself equal money collected. Compare deposits and balances to interpret results."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Usuarios y permisos",
    "titleEn": "Users and permissions",
    "text": "Dé a cada persona el acceso que necesita.",
    "textEn": "Give each person the access they need.",
    "details": [
      "El administrador invita desde Configuración → Usuarios y asigna el rol. Los usuarios activos e invitados cuentan para el límite del plan.",
      "Basic admite 1 usuario; Intermediate 5; Advanced 15, incluido el administrador.",
      "Reenviar una invitación invalida el enlace anterior. El administrador también controla las descargas de Excel del equipo."
    ],
    "detailsEn": [
      "The administrator invites users under Settings → Users and assigns roles. Active and invited users count toward the plan limit.",
      "Basic allows 1 user, Intermediate 5 and Advanced 15, including the administrator.",
      "Resending an invitation invalidates the old link. The administrator also controls team Excel downloads."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Verificación en dos pasos",
    "titleEn": "Two-step verification",
    "text": "Proteja su cuenta de manera individual.",
    "textEn": "Protect your individual account.",
    "details": [
      "Abra Configuración → Verificación en dos pasos y elija Activar. Es opcional para cada usuario.",
      "Solicite el código enviado al correo de su cuenta e introduzca sus 6 dígitos para confirmar. Vence en 10 minutos.",
      "Conserve acceso a su correo. Cada código se usa una vez; para desactivar la protección debe confirmar otro código por email."
    ],
    "detailsEn": [
      "Open Settings → Two-step verification and choose Enable. It is optional for each user.",
      "Request the code sent to your account email and enter its 6 digits to confirm. It expires in 10 minutes.",
      "Keep access to your email. Each code is single-use; disabling protection requires another email code."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Planes y pagos",
    "titleEn": "Plans and billing",
    "text": "Elija el plan por funciones y tamaño de equipo.",
    "textEn": "Choose a plan by features and team size.",
    "details": [
      `Precios de catálogo en USD por restaurante: ${PLANS.map(plan => `${plan.name}: US$${plan.monthly} al mes o US$${plan.annual} al año`).join("; ")}. Antes de impuestos aplicables.`,
      "El pago anual se cobra en un solo pago y cubre 12 meses por el precio de 10 mensualidades. Una suscripción existente puede conservar una tarifa anterior; revise su importe real en Gestionar suscripción. Los cambios confirmados usan el precio vigente del plan elegido.",
      "La prueba dura 10 días sin tarjeta. Basic incluye clientes, cotizaciones y reservas; Intermediate añade empleados y horarios.",
      "Advanced añade reportes completos. Solo el propietario administra pagos y cambios de plan desde Suscripción.",
      "Antes de bajar de plan, ajuste los usuarios activos e invitados al nuevo límite. La cuenta del creador conserva su exención."
    ],
    "detailsEn": [
      `Catalog prices in USD per restaurant: ${PLANS.map(plan => `${plan.name}: US$${plan.monthly} per month or US$${plan.annual} per year`).join("; ")}. Before applicable taxes.`,
      "Annual billing is one payment covering 12 months for the price of 10 monthly payments. An existing subscription may retain an earlier price; check your actual amount under Manage subscription. Confirmed changes use the selected plan's current price.",
      "The trial lasts 10 days without a card. Basic includes customers, quotes and reservations; Intermediate adds employees and schedules.",
      "Advanced adds full reports. Only the owner manages billing and plan changes under Subscription.",
      "Before downgrading, bring active and invited users within the new limit. The creator account retains its exemption."
    ],
    "adminOnly": true
  },
  {
    "tab": null,
    "title": "Exportar y revisar",
    "titleEn": "Export and review",
    "text": "Compruebe el alcance antes de compartir.",
    "textEn": "Check the scope before sharing.",
    "details": [
      "Las exportaciones e impresiones utilizan los filtros o rangos indicados en cada módulo.",
      "PDF, impresión y Excel cumplen funciones distintas; revise el archivo antes de enviarlo al cliente.",
      "Si una descarga está bloqueada, consulte al administrador sobre su permiso de Excel.",
      "Las descargas de clientes, reservaciones, reportes y respaldos preparados en el navegador admiten hasta 10,000 registros y 20 MB de datos por operación. Las listas impresas de clientes, reservas y reportes admiten hasta 2,000 registros. Si supera el límite no se descarga una copia incompleta: reduzca las fechas o la búsqueda. Estos límites no restringen lo que guarda el restaurante.",
      "La lectura de horarios por rango admite hasta 10,000 asignaciones y 20 MB por operación. Divida rangos largos antes de descargar PDF, Excel o imprimir. Para respaldos completos que superen estos tamaños, contacte a soporte por email."
    ],
    "detailsEn": [
      "Exports and printouts use the filters or ranges shown in each module.",
      "PDF, printing and Excel serve different purposes; review the file before sending it to a customer.",
      "If a download is blocked, ask the administrator about your Excel permission.",
      "Customer, reservation, report and backup downloads prepared in the browser allow up to 10,000 records and 20 MB of data per operation. Printed customer, reservation and report lists allow up to 2,000 records. Exceeding a limit does not download an incomplete copy: narrow the dates or search. These limits do not restrict what your restaurant can store.",
      "Schedule date-range reads allow up to 10,000 assignments and 20 MB per operation. Split long ranges before downloading PDF or Excel or printing. For full backups exceeding these sizes, contact support by email."
    ],
    "adminOnly": false
  },
  {
    "tab": null,
    "title": "Ayuda y solución de dudas",
    "titleEn": "Help and troubleshooting",
    "text": "Sepa qué revisar cuando algo no sale como espera.",
    "textEn": "Know what to check when something is unexpected.",
    "details": [
      "Si falta una función, revise su plan, rol y permisos con el administrador.",
      "Si falla una operación, revise conexión, campos requeridos y mensajes antes de repetirla. Compruebe si ya quedó guardada.",
      "Puede reabrir este tutorial o consultar Instructivo. Para soporte, envíe por email el módulo, lo que intentó y una captura sin contraseñas ni códigos de seguridad."
    ],
    "detailsEn": [
      "If a feature is missing, check your plan, role and permissions with the administrator.",
      "If an action fails, check your connection, required fields and messages before retrying. Check whether it already saved.",
      "Reopen this tutorial or read the Guide. For support, email the module, what you tried and a screenshot without passwords or security codes."
    ],
    "adminOnly": false
  },
  {
    "tab": null,
    "title": "Asistente MRMAA",
    "titleEn": "MRMAA Assistant",
    "text": "Resuelva dudas de uso con el tutorial y la ayuda de IA.",
    "textEn": "Resolve usage questions with the tutorial and AI help.",
    "details": [
      "Abra Asistente MRMAA y escriba una pregunta concreta sobre el uso de la aplicación. El tutorial sigue disponible sin límite.",
      "Cada restaurante comparte 50 solicitudes al mes, renovadas el día 1 a las 00:00 UTC. Los intentos aceptados cuentan aunque no se obtenga respuesta.",
      "OpenAI procesa los mensajes del chat. No incluya información privada ni contraseñas. El asistente no lee sus registros ni guarda cambios y puede equivocarse."
    ],
    "detailsEn": [
      "Open MRMAA Assistant and ask a specific question about using the app. The tutorial remains unlimited.",
      "Each restaurant shares 50 requests per month, resetting on day 1 at 00:00 UTC. Accepted attempts count even if no answer is received.",
      "OpenAI processes chat messages. Do not include private information or passwords. The assistant does not read your records or save changes and may make mistakes."
    ],
    "adminOnly": false
  },
  {
    "tab": null,
    "title": "Botones, iconos y cambios sin guardar",
    "titleEn": "Buttons, icons and unsaved changes",
    "text": "Identifique las acciones comunes.",
    "textEn": "Identify common actions.",
    "details": [
      "Nuevo abre un formulario; el lápiz Editar abre un registro existente. Guardar confirma los cambios; cerrar puede pedir descartar el borrador.",
      "Ver abre el documento; Imprimir abre la salida de impresión. PDF descarga la cotización y Excel exporta datos cuando tiene permiso.",
      "La papelera pide confirmación. Seleccionar esta página marca solo los registros visibles; revise la selección antes de borrar.",
      "Un botón ausente o desactivado puede depender del rol, plan, estado del registro o una operación en curso. El asistente no conoce su pantalla exacta."
    ],
    "detailsEn": [
      "New opens a form; the Edit pencil opens an existing record. Save confirms changes; closing may ask you to discard a draft.",
      "View opens the document; Print opens printable output. PDF downloads a quote and Excel exports data when permitted.",
      "The trash action asks for confirmation. Select this page marks visible records only; review the selection before deleting.",
      "An absent or disabled button may depend on role, plan, record status or an operation in progress. The assistant cannot see your exact screen."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Nombre, dirección, teléfono y correo del negocio",
    "titleEn": "Business name, address, phone and email",
    "text": "Configuración → General reúne la identidad del restaurante.",
    "textEn": "Settings → General contains restaurant identity.",
    "details": [
      "Edite nombre, teléfono, país, dirección y correo del negocio; guarde esta sección para aplicar los cambios.",
      "La dirección y el correo del negocio aparecen en la cotización. Este correo de presentación no cambia su correo de acceso ni configura el envío SMTP.",
      "Para cambiar su correo de inicio de sesión use Configuración → Cuenta. Para el envío de códigos, la configuración técnica corresponde al responsable del servicio."
    ],
    "detailsEn": [
      "Edit name, phone, country, address and business email; save this section to apply changes.",
      "The business address and email appear on quotes. This display email does not change your login email or configure SMTP sending.",
      "To change your login email use Settings → Account. Security-code delivery is configured by the service administrator."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Logo del restaurante",
    "titleEn": "Restaurant logo",
    "text": "Configuración → General permite cargar el logo.",
    "textEn": "Settings → General lets you upload the logo.",
    "details": [
      "Use el control de carga para elegir una imagen y revise el resultado antes de guardar.",
      "El logo se utiliza en la interfaz y las cotizaciones. Prefiera una imagen legible y con fondo transparente si su diseño lo necesita.",
      "Si el logo no se ve en un documento, compruebe que guardó General y abra de nuevo la vista previa. No sustituya datos ni vuelva a crear la cotización para cambiar el logo."
    ],
    "detailsEn": [
      "Use the upload control to choose an image and review it before saving.",
      "The logo is used in the interface and quotes. Prefer a legible image with a transparent background when appropriate.",
      "If a document does not show it, confirm General was saved and reopen the preview. Do not recreate the quote just to change its logo."
    ],
    "adminOnly": true
  },
  {
    "tab": null,
    "title": "Idioma, moneda y modo oscuro",
    "titleEn": "Language, currency and dark mode",
    "text": "La aplicación admite español e inglés.",
    "textEn": "The application supports Spanish and English.",
    "details": [
      "Use el selector de idioma para cambiar la interfaz. La preferencia manual tiene prioridad sobre la detección inicial.",
      "El administrador cambia idioma y moneda del negocio en Configuración → General. Las monedas disponibles son GTQ, USD y MXN; seleccionar moneda no equivale a convertir importes mediante un tipo de cambio.",
      "El control de tema cambia entre claro y oscuro. El documento de cotización mantiene su presentación para imprimir, independiente del tema oscuro."
    ],
    "detailsEn": [
      "Use the language selector to change the interface. A manual preference takes priority over initial detection.",
      "The administrator changes the business language and currency in Settings → General. Available currencies are GTQ, USD and MXN; choosing one does not perform exchange-rate conversion.",
      "The theme control switches between light and dark. Quote documents keep their print presentation independently of dark mode."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Buscar fechas y navegar reservaciones",
    "titleEn": "Search dates and navigate reservations",
    "text": "Reservaciones permite consultar el calendario por fecha.",
    "textEn": "Reservations lets you browse the calendar by date.",
    "details": [
      "Hoy vuelve al día actual; Anterior y Siguiente recorren días. Una fecha consulta un día y De–a un período.",
      "Escriba cliente, área o menú en el buscador. Si no aparece una reserva, revise tanto la búsqueda como las fechas.",
      "La paginación muestra hasta 50 registros por página. Seleccionar esta página no selecciona todos los resultados de otras páginas."
    ],
    "detailsEn": [
      "Today returns to the current day; Previous and Next move between days. One date selects a day and From–to selects a period.",
      "Search by customer, area or menu. If a reservation is missing, check both the search and date filters.",
      "Pagination shows up to 50 records per page. Select this page does not select results on other pages."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Formulario de reservación: cliente y evento",
    "titleEn": "Reservation form: customer and event",
    "text": "Abra Reservaciones → Nuevo o el lápiz de una reserva.",
    "textEn": "Open Reservations → New or a reservation pencil.",
    "details": [
      "Nombre del cliente permite escribir un nombre nuevo o buscar por nombre, teléfono o correo en una sola casilla. Elija una sugerencia para vincular al cliente guardado y completar su teléfono. Revise fecha, hora, área e invitados antes de guardar.",
      "Escriba en Área y seleccione una sugerencia válida del catálogo. Escribir texto sin seleccionar no crea un área.",
      "Complete menú y observaciones según corresponda. Seleccione el estado y guarde; cerrar sin guardar no confirma la reserva."
    ],
    "detailsEn": [
      "Customer name lets you enter a new name or search by name, phone or email in one field. Choose a suggestion to link a saved customer and fill in their phone. Check date, time, area and guests before saving.",
      "Type in Area and choose a valid catalog suggestion. Typing alone does not create an area.",
      "Complete menu and observations as appropriate. Choose a status and save; closing without saving does not confirm the reservation."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Anticipos y métodos de pago de reservaciones",
    "titleEn": "Reservation deposits and payment methods",
    "text": "Registre el anticipo recibido en el formulario de reservación.",
    "textEn": "Record the received deposit in the reservation form.",
    "details": [
      "Anticipo es un importe monetario. Método de pago identifica cómo se recibió; no procesa un cobro bancario.",
      "Si no ve estos campos, el administrador debe revisar Configuración → Reservaciones → Mostrar anticipos en el formulario de reservación.",
      "El encabezado de totales y la lista tienen controles de visibilidad separados. Ocultar una columna no sustituye la edición de un importe."
    ],
    "detailsEn": [
      "Deposit is a monetary amount. Payment method records how it was received; it does not charge a bank card.",
      "If these fields are absent, the administrator should check Settings → Reservations → Show deposits in reservation form.",
      "Header totals and list columns have separate visibility controls. Hiding a column is not the same as editing an amount."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Estados y cruces de reservaciones",
    "titleEn": "Reservation statuses and overlaps",
    "text": "Pendiente, Confirmada y Cancelada distinguen el seguimiento.",
    "textEn": "Pending, Confirmed and Canceled distinguish follow-up states.",
    "details": [
      "Cambie el estado al editar y guarde. Cancelada se identifica en rojo; cancelar conserva el registro y no equivale a enviarlo a la papelera.",
      "El aviso de posibles cruces compara fecha y área con horarios próximos dentro de tres horas. Revise el evento existente antes de confirmar otro.",
      "Un aviso ayuda a revisar coincidencias; no representa disponibilidad de mesas calculada por un plano ni garantiza capacidad del área."
    ],
    "detailsEn": [
      "Edit the status and save. Canceled appears in red; cancellation keeps the record and is different from moving it to trash.",
      "Potential overlap warnings compare date and area with nearby times within three hours. Review the existing event before confirming another.",
      "A warning helps check overlaps; it is not table availability calculated from a floor plan and does not guarantee area capacity."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Imprimir reservas, resumen o ambos",
    "titleEn": "Print reservations, summary or both",
    "text": "Use los controles de impresión de Reservaciones.",
    "textEn": "Use Reservations print controls.",
    "details": [
      "Primero seleccione fechas y búsqueda. Puede elegir Imprimir reservas + resumen, Solo reservaciones o Solo resumen.",
      "Imprimir incluye los resultados del filtro; la paginación de pantalla no limita el reporte a la página visible.",
      "En el diálogo del navegador revise impresora, tamaño A4 y escala. Excel es una descarga separada, sujeta al permiso de exportación."
    ],
    "detailsEn": [
      "Choose dates and search first. Select Print reservations + summary, Reservations only or Summary only.",
      "Printing includes filtered results; screen pagination does not limit the report to the visible page.",
      "In the browser dialog check printer, A4 paper and scale. Excel is a separate download subject to export permission."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Importar reservaciones desde Excel",
    "titleEn": "Import reservations from Excel",
    "text": "Descargue Plantilla desde Reservaciones.",
    "textEn": "Download Template from Reservations.",
    "details": [
      "Respete los encabezados de la plantilla y complete fechas, horas, clientes y áreas con formatos consistentes. No use un archivo de columnas arbitrarias.",
      "Pulse Importar, elija el archivo y revise el resultado: registros aceptados, duplicados o errores. Corrija solo las filas rechazadas antes de reintentar.",
      "La importación revisa posibles cruces de áreas y horarios. Necesita permiso de operación; Solo lectura no puede importar."
    ],
    "detailsEn": [
      "Keep template headers and use consistent date, time, customer and area formats. Do not upload arbitrary columns.",
      "Click Import, choose the file and review accepted records, duplicates and errors. Correct rejected rows before retrying.",
      "Import checks potential area and time overlaps. It requires operational permission; Read-only cannot import."
    ],
    "adminOnly": false
  },
  {
    "tab": "clients",
    "title": "Crear, editar y buscar clientes",
    "titleEn": "Create, edit and search customers",
    "text": "Abra Clientes → Nuevo para registrar una persona.",
    "textEn": "Open Customers → New to register someone.",
    "details": [
      "Nombre identifica al cliente; Teléfono y Email permiten localizarlo después. Notas conserva información útil para el equipo.",
      "Guarde y use el lápiz para editar. Busque por nombre, teléfono o correo; revise otras páginas antes de crear un duplicado.",
      "En una reserva o cotización, Nombre del cliente también es un buscador. Elegir una sugerencia vincula al cliente existente y completa sus contactos. También puede escribir un cliente nuevo; revise los datos del evento antes de guardar."
    ],
    "detailsEn": [
      "Name identifies the customer; Phone and Email help find them later. Notes keeps useful information for the team.",
      "Save and use the pencil to edit. Search by name, phone or email; check other pages before creating a duplicate.",
      "In a reservation or quote, Customer name also works as a search field. Choosing a suggestion links an existing customer and fills in their contact details. You can also enter a new customer; review event details before saving."
    ],
    "adminOnly": false
  },
  {
    "tab": "clients",
    "title": "Excel de clientes y registros duplicados",
    "titleEn": "Customer Excel export and duplicate records",
    "text": "Clientes incluye importación con plantilla, exportación e impresión.",
    "textEn": "Customers includes import with a template, export and printing.",
    "details": [
      "Descargar Excel incluye todos los clientes que coinciden con el buscador, incluidas otras páginas. Importar clientes permite revisar un Excel o CSV antes de agregar fichas nuevas; Plantilla de clientes descarga un formato vacío con instrucciones.",
      "Antes de crear una ficha busque nombre, teléfono y correo. Para corregir una existente utilice Editar.",
      "Solo Administrador puede enviar clientes a la papelera y restaurarlos desde Seguridad. Revise vínculos antes de eliminar un posible duplicado."
    ],
    "detailsEn": [
      "Download Excel includes all customers matching the search, including other pages. Import customers lets you review Excel or CSV before adding new records; Customer template downloads a blank format with instructions.",
      "Before creating a record search name, phone and email. Use Edit to correct an existing one.",
      "Only Administrator can move customers to trash and restore them from Security. Review links before deleting a possible duplicate."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Buscar cotizaciones y acciones de cada fila",
    "titleEn": "Find quotes and row actions",
    "text": "Cotizaciones muestra número, cliente, fecha de creación, evento, importe y estado.",
    "textEn": "Quotes shows number, customer, creation date, event, amount and status.",
    "details": [
      "Busque por cotización, cliente, área o estado; cambie de página si corresponde.",
      "En Ordenar por elija Fecha del evento, Número de cotización o Fecha de creación. En Orden seleccione ascendente o descendente. Se aplica a todas las páginas y búsquedas; cambiar el orden vuelve a la primera página y limpia la selección de filas. Por defecto se usa la fecha del evento de menor a mayor, luego la hora. La fecha de creación aparece debajo del cliente según la zona horaria del dispositivo y se conserva al editar. Los avisos próximos mantienen su propio orden por evento.",
      "El lápiz edita; Ver abre la vista previa; Convertir en reservación crea el evento confirmado; la papelera elimina según permisos.",
      "Administrador y Gerente pueden eliminar cotizaciones sin reservación vigente vinculada. Seleccionar esta página incluye las convertidas y muestra el aviso si hay un vínculo; no se borra ninguna de las seleccionadas hasta resolverlo y confirmar la eliminación. Operación puede crear, editar y convertir; Solo lectura consulta."
    ],
    "detailsEn": [
      "Search by quote, customer, area or status; change pages where needed.",
      "In Sort by choose Event date, Quote number or Creation date. In Order choose ascending or descending. This applies across pages and searches; changing the order returns to the first page and clears selected rows. The default is earliest event date first, then time. Creation date appears below the customer in the device's time zone and is preserved when editing. Upcoming reminders keep their own event order.",
      "The pencil edits; View opens the preview; Convert to reservation creates the confirmed event; trash deletes subject to permission.",
      "Administrator and Manager can delete quotes without an existing linked reservation. Select this page includes converted quotes and shows a warning if linked; none of the selected quotes is deleted until the link is resolved and deletion is confirmed. Operations can create, edit and convert; Read-only can view."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Buscar productos dentro de una línea",
    "titleEn": "Search products inside a line",
    "text": "En Cotizaciones → Nuevo, use Producto o servicio como buscador.",
    "textEn": "In Quotes → New, use Product or service as the search box.",
    "details": [
      "Pulse Agregar línea y escriba parte del nombre. Seleccione una sugerencia para traer nombre, descripción y precio del catálogo.",
      "También puede escribir un producto o servicio manual para esa cotización. Revise cantidad y precio unitario después de elegirlo.",
      "Para mantener el catálogo use Configuración → Cotizaciones → Menús y productos. Escribir una línea manual no registra automáticamente un nuevo producto en ese catálogo."
    ],
    "detailsEn": [
      "Click Add line and type part of the name. Choose a suggestion to bring in catalog name, description and price.",
      "You can also enter a manual product or service for that quote. Check quantity and unit price after selection.",
      "Maintain the catalog in Settings → Quotes → Menus and products. A manual quote line does not automatically create a catalog product."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Eliminar filas vacías o llenas de productos",
    "titleEn": "Remove empty or filled product rows",
    "text": "Cada línea de cotización se puede quitar.",
    "textEn": "Every quote line can be removed.",
    "details": [
      "Use el botón de eliminar de la línea para retirar producto, descripción, cantidad y precio juntos, tenga datos o esté vacía.",
      "Esto modifica el formulario; no elimina el producto del catálogo. Los totales se recalculan según las líneas restantes.",
      "Puede quitar todas las líneas mientras prepara el borrador. Para guardar una cotización válida agregue una línea de producto o servicio y complete los campos requeridos."
    ],
    "detailsEn": [
      "Use the line delete button to remove product, description, quantity and price together, whether filled or empty.",
      "This changes the form; it does not delete the catalog product. Totals recalculate from the remaining lines.",
      "You can remove all lines while preparing a draft. To save a valid quote, add a product or service line and complete required fields."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Descripción, cantidad y precio unitario",
    "titleEn": "Description, quantity and unit price",
    "text": "Cada fila calcula cantidad × precio unitario.",
    "textEn": "Each row calculates quantity × unit price.",
    "details": [
      "Producto o servicio es el nombre de la línea. Descripción permite varias líneas para detallar lo incluido.",
      "Cantidad indica unidades o personas a cobrar en esa fila. Precio es por unidad, no el total de toda la fila.",
      "Invitados describe el evento y no sustituye la cantidad de cada producto. Si son 20 menús, revise que la cantidad de esa línea sea 20."
    ],
    "detailsEn": [
      "Product or service is the line name. Description supports multiple lines to explain what is included.",
      "Quantity is the units or people charged on that row. Price is per unit, not the entire row total.",
      "Guests describes the event and does not replace product quantities. For 20 menus, check that the line quantity is 20."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Cómo se calculan subtotal, descuento y propina",
    "titleEn": "How subtotal, discount and tip are calculated",
    "text": "Los totales se recalculan desde las líneas.",
    "textEn": "Totals recalculate from line items.",
    "details": [
      "Subtotal suma cantidad × precio de cada producto. El descuento principal es un porcentaje del subtotal.",
      "La propina se calcula sobre subtotal menos descuento principal. Por ejemplo, subtotal 100, descuento 10% y propina 10% producen 10 de descuento, 9 de propina y total 99 antes de ajustes adicionales.",
      "Los cobros y descuentos adicionales se suman o restan después. Anticipo reduce el saldo, no el precio total del evento."
    ],
    "detailsEn": [
      "Subtotal sums quantity × price for each product. The main discount is a percentage of subtotal.",
      "Tip is calculated on subtotal minus the main discount. For example, subtotal 100, discount 10% and tip 10% give discount 10, tip 9 and total 99 before extra adjustments.",
      "Additional charges and discounts are then added or subtracted. A deposit reduces the balance, not the event total."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Cobros y descuentos adicionales: monto o porcentaje",
    "titleEn": "Additional charges and discounts: amount or percentage",
    "text": "El administrador define conceptos en Configuración → Cotizaciones.",
    "textEn": "Administrators define items in Settings → Quotes.",
    "details": [
      "En Cobros y descuentos adicionales escriba nombre, elija Cobro o Descuento y Monto fijo o Porcentaje. Configure el valor y si se usa.",
      "Al preparar la cotización revise los conceptos aplicados. Un monto fijo utiliza el importe escrito; un porcentaje se calcula sobre el subtotal de productos.",
      "Estos ajustes no cambian la base de la propina principal. No registre el mismo anticipo como descuento y como anticipo recibido si no desea descontarlo dos veces."
    ],
    "detailsEn": [
      "Under Additional charges and discounts enter a name, choose Charge or Discount and Fixed amount or Percentage. Set the value and whether it is used.",
      "Review applied items in the quote. A fixed amount uses the entered amount; a percentage is calculated on the product subtotal.",
      "These adjustments do not change the main tip calculation base. Do not record the same deposit both as a discount and a received deposit unless that double reduction is intended."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Anticipo, saldo y visibilidad en PDF",
    "titleEn": "Deposit, balance and PDF visibility",
    "text": "Anticipo registra un pago recibido del cliente.",
    "textEn": "Deposit records a received customer payment.",
    "details": [
      "Saldo pendiente es total menos anticipo aplicado. El cálculo limita el anticipo aplicado al total para evitar un saldo negativo.",
      "Método de pago registra la forma de ese anticipo; no envía enlaces ni cobra tarjetas por sí mismo.",
      "En Configuración → Cotizaciones hay controles separados para mostrar anticipo en formulario y en vista previa, PDF e impresión. Ocultarlo conserva el importe y el cálculo del saldo."
    ],
    "detailsEn": [
      "Outstanding balance is total minus applied deposit. The calculation caps applied deposit at total to avoid a negative balance.",
      "Payment method records how that deposit was received; it does not send payment links or charge cards itself.",
      "Settings → Quotes has separate controls for deposit visibility in the form and in preview, PDF and print. Hiding it preserves the amount and balance calculation."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Nota al cliente y observaciones internas",
    "titleEn": "Customer note and internal observations",
    "text": "El formulario separa información para el cliente y para el equipo.",
    "textEn": "The form separates customer-facing and internal information.",
    "details": [
      "Nota para el cliente contiene condiciones que pueden aparecer en el documento, según visibilidad configurada.",
      "Observaciones internas sirven al equipo; no las use como sustituto de condiciones que el cliente debe leer.",
      "El administrador puede definir Mensaje fijo para cliente en Configuración → Cotizaciones. Revise la nota efectiva y la vista previa de cada cotización antes de compartirla."
    ],
    "detailsEn": [
      "Customer note holds terms that may appear in the document, depending on visibility settings.",
      "Internal observations are for the team; they do not replace terms that customers should read.",
      "Administrators can define Fixed customer message in Settings → Quotes. Review the actual note and preview for each quote before sharing."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Contactar, No realizada y avisos ocultos",
    "titleEn": "Contact, Not held and hidden reminders",
    "text": "Las cotizaciones pendientes próximas a su fecha muestran seguimiento.",
    "textEn": "Pending quotes near their event date show follow-up status.",
    "details": [
      "Desde cinco días antes hasta el día del evento aparece Contactar en amarillo. El aviso identifica las cotizaciones por cliente, número y fecha.",
      "Quitar aviso oculta esa alerta individual para el restaurante; no elimina la cotización. La vista de avisos ocultos permite volver a mostrarla.",
      "Después de la fecha, una pendiente se presenta como No realizada en gris. Confirmadas o convertidas no se tratan como pendientes. Cambiar la fecha reactiva un aviso oculto."
    ],
    "detailsEn": [
      "From five days before through event day, Contact appears in yellow. The alert identifies quotes by customer, number and date.",
      "Dismiss hides that individual alert for the restaurant; it does not delete the quote. Hidden reminders can be shown again.",
      "After the event date, a pending quote displays Not held in gray. Confirmed or converted quotes are not treated as pending. Changing the event date reactivates a dismissed reminder."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "Convertir una cotización y abrir el vínculo",
    "titleEn": "Convert a quote and open its link",
    "text": "Use Convertir en reservación cuando el cliente confirme.",
    "textEn": "Use Convert to reservation when the customer confirms.",
    "details": [
      "Revise datos, fecha, hora, invitados, área, anticipo y método de pago antes de convertir.",
      "La conversión crea una reservación confirmada con la información del evento y vincula ambos registros. En Reservaciones, Ver cotización abre el documento relacionado.",
      "En la lista, Convertida y Confirmada aparecen como etiquetas separadas y alineadas. Confirmada usa verde suave. Esto solo cambia la presentación, no los datos ni el estado guardado.",
      "Una cotización convertida no se puede borrar mientras tenga una reservación vinculada fuera de la papelera. Al seleccionarla para borrar o pulsar su papelera, Administrador o Gerente ve un aviso con el cliente y la fecha. Ir a reservaciones abre directamente esa reservación y la muestra resaltada, aunque su fecha sea anterior o futura; no necesita buscarla ni cambiar de página. Si el aviso contiene varias, use Ver reservación junto al cliente que desea abrir.",
      "La vista de reservación vinculada muestra únicamente ese registro, sus datos y acciones disponibles. Ver todas las reservaciones vuelve al listado completo. Abrirla no cambia ni elimina información; Editar y Enviar a la papelera conservan sus permisos y confirmaciones. Si ya se eliminó o no tiene acceso, se muestra un aviso en vez de abrir otra reservación.",
      "En el aviso, Desvincular cotización pide confirmación y conserva ambos registros. La reservación mantiene fecha, estado, anticipo y demás datos; la cotización vuelve a Pendiente. Nada se borra automáticamente: si todavía desea eliminar la cotización, vuelva a pulsar la papelera y confirme. Cancelar una reservación no la desvincula."
    ],
    "detailsEn": [
      "Check details, date, time, guests, area, deposit and payment method before converting.",
      "Conversion creates a confirmed reservation with event information and links both records. In Reservations, View quote opens the related document.",
      "In the list, Converted and Confirmed appear as separate, aligned badges. Confirmed uses soft green. This only changes presentation, not saved data or status.",
      "A converted quote cannot be deleted while it has a linked reservation outside the trash. Selecting it for deletion or pressing its trash button shows an Administrator or Manager a warning with the customer and date. Go to reservations opens that exact reservation and highlights it, even for past or future dates; no search or page change is needed. If the warning contains several, use View reservation beside the customer you want to open.",
      "The linked reservation view shows only that record, its details and available actions. View all reservations returns to the full list. Opening it does not change or delete information; Edit and Move to trash retain their permissions and confirmations. If it was deleted or you no longer have access, a notice appears instead of opening another reservation.",
      "In the warning, Unlink quote asks for confirmation and keeps both records. The reservation keeps its date, status, deposit and other data; the quote returns to Pending. Nothing is deleted automatically: if you still want to delete the quote, press trash again and confirm. Canceling a reservation does not unlink it."
    ],
    "adminOnly": false
  },
  {
    "tab": "quotes",
    "title": "PDF, vista previa e impresión en A4",
    "titleEn": "PDF, preview and A4 printing",
    "text": "Abra Ver en una cotización guardada.",
    "textEn": "Open View on a saved quote.",
    "details": [
      "PDF descarga el documento completo, incluidas varias páginas cuando hace falta. Imprimir abre el PDF para conservar su distribución.",
      "En iPhone o iPad el PDF puede abrirse en un visor; use las opciones del dispositivo para guardarlo o imprimirlo.",
      "Si no abre una ventana, use el enlace de documento que ofrece la aplicación. Revise A4 y Ajustar al área imprimible en el visor o impresora; no elija papel de recibos."
    ],
    "detailsEn": [
      "PDF downloads the complete document, including multiple pages when needed. Print opens the PDF to preserve its layout.",
      "On iPhone or iPad the PDF may open in a viewer; use device options to save or print it.",
      "If a window does not open, use the document link provided by the app. Check A4 and Fit to printable area in the viewer or printer; do not choose receipt paper."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Estilo, tipografía y colores de cotización",
    "titleEn": "Quote style, font and colors",
    "text": "Abra Configuración → Cotizaciones → Estilo de cotización.",
    "textEn": "Open Settings → Quotes → Quote style.",
    "details": [
      "Elija Moderna, Clásica o Básica. Tipografía ofrece Georgia, Arial, Helvetica y Times New Roman.",
      "Color de la letra cambia el texto; Color del encabezado cambia la cabecera; Color del encabezado de productos cambia la franja de la tabla; Color de acento aplica el detalle de diseño.",
      "Guarde la configuración y abra una vista previa para comprobar el resultado. Estos colores son distintos del tema oscuro de la aplicación y de los colores de Horarios."
    ],
    "detailsEn": [
      "Choose Modern, Classic or Basic. Font offers Georgia, Arial, Helvetica and Times New Roman.",
      "Text color changes lettering; Header color changes the header; Product header color changes the table band; Accent color applies the design accent.",
      "Save settings and open a preview to check the result. These colors are separate from the application dark theme and Schedule colors."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Numeración inicial de cotizaciones",
    "titleEn": "Starting quote number",
    "text": "El administrador configura Numeración inicial en Configuración → Cotizaciones.",
    "textEn": "Administrators set Starting number in Settings → Quotes.",
    "details": [
      "Use el número desde el que necesita iniciar la secuencia y guarde.",
      "No use este control para editar el número de una cotización ya guardada. La asignación al guardar respeta la secuencia y los números existentes.",
      "Si busca una cotización anterior, use su número en el buscador. Cambiar el número inicial no equivale a borrar o reiniciar registros."
    ],
    "detailsEn": [
      "Enter the number from which the sequence should start and save.",
      "Do not use this control to edit a saved quote number. Saving assigns numbers while respecting the sequence and existing numbers.",
      "To find an older quote, search its number. Changing the starting number does not delete or reset records."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Ocultar y restaurar campos del documento",
    "titleEn": "Hide and restore document fields",
    "text": "Abra Configuración → Cotizaciones → Campos visibles en la cotización.",
    "textEn": "Open Settings → Quotes → Visible quote fields.",
    "details": [
      "Puede quitar nombre, teléfono o correo del cliente, fecha, hora, área, invitados o nota para el cliente de la presentación.",
      "El botón Quitar campo oculta ese campo en vista previa y PDF. En Restaurar use el botón del campo para volver a mostrarlo; luego guarde.",
      "Esto controla presentación, no elimina los datos del registro ni convierte campos obligatorios del formulario en opcionales."
    ],
    "detailsEn": [
      "You can hide customer name, phone or email, event date, time, area, guests or customer note from presentation.",
      "Remove field hides it in preview and PDF. Under Restore click the field button to show it again, then save.",
      "This controls presentation; it does not delete record data or make required form fields optional."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Campos adicionales: NIT, empresa y dirección",
    "titleEn": "Additional fields: tax ID, company and address",
    "text": "Abra Configuración → Cotizaciones → Campos adicionales del cliente.",
    "textEn": "Open Settings → Quotes → Additional customer fields.",
    "details": [
      "Escriba el nombre, por ejemplo NIT o Empresa, y elija Texto corto, Notas, Número o Fecha.",
      "Agregue el campo y use Mostrar para controlar su visibilidad. Guarde y compruebe el formulario y la vista previa.",
      "Estos campos permiten registrar información; no verifican automáticamente un NIT ni generan una factura fiscal."
    ],
    "detailsEn": [
      "Enter a name, such as Tax ID or Company, and choose Short text, Notes, Number or Date.",
      "Add the field and use Show to control visibility. Save and check the form and preview.",
      "These fields store information; they do not automatically validate a tax ID or generate a tax invoice."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Catálogo de menús y productos: crear, editar y borrar",
    "titleEn": "Menus and products catalog: create, edit and delete",
    "text": "Abra Configuración → Cotizaciones → Menús y productos.",
    "textEn": "Open Settings → Quotes → Menus and products.",
    "details": [
      "Ingrese nombre, descripción y precio. La descripción admite varias líneas. Guarde el producto para encontrarlo en el buscador de una línea de cotización.",
      "El lápiz permite editar un producto existente. Administrador, Gerente y Operación pueden mantener nombre, descripción y precio.",
      "Solo Administrador puede eliminar productos del catálogo. Quitar una línea de una cotización es una acción diferente y no borra el producto."
    ],
    "detailsEn": [
      "Enter name, description and price. Description accepts multiple lines. Save the product to find it in a quote line search.",
      "The pencil edits an existing product. Administrator, Manager and Operations can maintain name, description and price.",
      "Only Administrator can delete catalog products. Removing a quote line is a different action and does not delete the product."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Áreas de eventos y áreas de empleados",
    "titleEn": "Event areas and employee areas",
    "text": "Existen dos catálogos de áreas independientes.",
    "textEn": "There are two separate area catalogs.",
    "details": [
      "Configuración → Reservaciones → Áreas para reservaciones organiza espacios de eventos; se usa también en cotizaciones.",
      "Administrador, Gerente y Operación pueden agregar, editar y eliminar áreas de eventos. Seleccione una sugerencia del catálogo en el formulario.",
      "Configuración → Horarios → Áreas organiza empleados y la impresión del horario. Crear un área allí no crea un espacio para reservaciones."
    ],
    "detailsEn": [
      "Settings → Reservations → Reservation areas organizes event spaces; it is also used by quotes.",
      "Administrator, Manager and Operations can add, edit and delete event areas. Select a catalog suggestion in the form.",
      "Settings → Schedules → Areas groups employees and schedule printing. Creating an area there does not create a reservation space."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Controles de totales y anticipos de reservaciones",
    "titleEn": "Reservation totals and deposit controls",
    "text": "El administrador configura cuatro controles en Configuración → Reservaciones.",
    "textEn": "Administrators configure four controls in Settings → Reservations.",
    "details": [
      "Mostrar total de personas controla el resumen de invitados. Mostrar total de anticipos en el encabezado controla el importe resumido.",
      "Mostrar anticipo y método de pago en la lista controla esas columnas. Mostrar anticipos en el formulario controla la entrada de esos datos.",
      "Guarde la sección y compruebe Reservaciones. La visibilidad de anticipos de Cotizaciones se configura aparte."
    ],
    "detailsEn": [
      "Show total people controls the guest summary. Show total deposits in the header controls the summarized amount.",
      "Show deposit and payment method in the list controls those columns. Show deposits in the form controls data entry visibility.",
      "Save the section and check Reservations. Quote deposit visibility is configured separately."
    ],
    "adminOnly": true
  },
  {
    "tab": "schedules",
    "title": "Empleados: nombre, ID, teléfono y área",
    "titleEn": "Employees: name, ID, phone and area",
    "text": "Configure el catálogo en Configuración → Horarios → Empleados.",
    "textEn": "Set up the catalog in Settings → Schedules → Employees.",
    "details": [
      "Complete nombre, ID opcional, teléfono y área. Guarde para incluir al empleado en la selección de Horarios.",
      "La lista de Configuración muestra hasta 10 empleados a la vez; en pantallas pequeñas puede mostrar menos. Desplace dentro de ella con la rueda del mouse, el trackpad, la barra lateral o el dedo para ver los demás. También puede enfocarla con Tab y desplazarse con el teclado; no hay un límite de 10 empleados guardados.",
      "Buscar empleados filtra por nombre, ID, teléfono o área mientras escribe, sin distinguir mayúsculas ni tildes. El contador indica coincidencias y total; Limpiar vuelve a mostrar la lista. Al cambiar la búsqueda, la lista vuelve al inicio. Buscar no modifica empleados ni descarta un formulario de edición abierto.",
      "El lápiz carga sus datos para editar; Guardar cambios confirma y Cancelar abandona la edición. El botón de papelera elimina según la confirmación mostrada.",
      "Empleado es una persona programada en el horario; Usuario es una cuenta con acceso a MRMAA. Crear un empleado no envía una invitación de acceso."
    ],
    "detailsEn": [
      "Enter name, optional ID, phone and area. Save to include the employee in Schedule selection.",
      "The Settings list shows up to 10 employees at a time; smaller screens may show fewer. Scroll inside it with the mouse wheel, trackpad, scrollbar or finger to see the rest. You can also focus it with Tab and scroll with the keyboard; this is not a limit of 10 saved employees.",
      "Search employees filters by name, ID, phone or area as you type, ignoring case and accents. The counter shows matches and total; Clear restores the list. Changing the search returns the list to the top. Searching does not modify employees or discard an open edit form.",
      "The pencil loads details for editing; Save changes confirms and Cancel abandons editing. The trash button deletes according to the displayed confirmation.",
      "An employee is a person being scheduled; a user is an account with MRMAA access. Creating an employee does not send a login invitation."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Definir turnos y áreas del personal",
    "titleEn": "Define shifts and staff areas",
    "text": "Configuración → Horarios contiene Áreas y Turnos. Cada Entrada y Salida permite elegir Hora o Texto.",
    "textEn": "Settings → Schedules contains Areas and Shifts. Each Start and End field lets you choose Time or Text.",
    "details": [
      "Cree áreas para agrupar al personal. En Turnos escriba un Nombre del turno, por ejemplo Mañana. Junto a Entrada y a Salida elija Hora o Texto de forma independiente. Hora muestra hora, minutos y AM/PM según el formato; Texto permite hasta 40 caracteres, incluyendo letras y números.",
      "Ejemplo: Entrada en Hora con 09:00 AM y Salida en Texto con CIERRE. Para mostrar exactamente 9:00 M - CIERRE, elija Texto en ambos campos y escriba 9:00 M en Entrada y CIERRE en Salida. Puede usar dos horas, dos textos o una combinación. No hace falta un selector adicional para mostrarlo.",
      "Pulse Agregar turno para guardarlo. El calendario muestra Entrada - Salida; el selector, PDF e impresión incluyen también el nombre. Excel conserva entrada y salida en sus columnas. El texto escrito no se traduce ni se convierte a otro formato de hora automáticamente.",
      "El botón Editar carga el turno para editar y lleva al formulario. Cambiar entre Hora y Texto conserva ambos borradores mientras edita, pero se guarda únicamente la opción activa de cada campo. Guarde los cambios o use Cancelar; editar un turno actualiza sus horarios vinculados. Los nombres y horas de turnos anteriores se conservan.",
      "Con Texto puede activar Agregar hora para cálculo en cada extremo y seleccionar una hora numérica (AM/PM o 24 horas). Por ejemplo, Entrada 09:00 y Salida CIERRE con hora de cálculo 17:00 suman 8 horas antes del descanso configurado. Se mantiene CIERRE en calendario, PDF, impresión y Excel de horarios; la hora auxiliar solo sirve para el cálculo. Complete ambos extremos para contabilizar: si falta alguno, Reportes → Empleados, días y horas programadas (Advanced) lo cuenta en Días sin cálculo. Un fin anterior al inicio se considera del día siguiente; esto calcula horas programadas, no asistencia real.",
      "Los catálogos de personal se administran desde Configuración. Si su rol no permite cambiarlos, solicite al administrador el alta o modificación. Después abra Horarios y seleccione empleados y fechas para asignar el turno."
    ],
    "detailsEn": [
      "Create areas to group staff. In Shifts enter a Shift name, such as Morning. Beside Start and End choose Time or Text independently. Time shows hours, minutes and AM/PM according to the format; Text accepts up to 40 characters, including letters and numbers.",
      "Example: Start in Time mode with 09:00 AM and End in Text mode with CLOSING. To display exactly 9:00 M - CIERRE, choose Text in both fields and enter 9:00 M in Start and CIERRE in End. Use two times, two texts or a combination. No additional display selector is needed.",
      "Select Add shift to save it. The calendar shows Start - End; the selector, PDF and printing also include the name. Excel keeps start and end in their columns. Entered text is not translated or converted to a different time format automatically.",
      "The Edit button loads the shift for editing and moves to its form. Switching between Time and Text preserves both drafts while editing, but only the active option for each field is saved. Save changes or use Cancel; editing a shift updates its linked schedules. Previous shift names and times are preserved.",
      "With Text, optionally enable Add time for calculation for each endpoint and select a numeric time (AM/PM or 24-hour). For example, Start 09:00 and End CLOSING with calculation time 17:00 count as 8 hours before the configured break. CLOSING remains visible in the calendar, PDF, print and schedule Excel; the auxiliary time is only for calculation. Both endpoints need numeric times; otherwise Reports → Employees, scheduled days and hours (Advanced) counts the shift under Days without calculation. An end before the start is treated as the following day. These are scheduled hours, not actual attendance.",
      "Staff catalogs are managed in Settings. If your role cannot change them, ask the administrator to add or edit them. Then open Schedules and choose employees and dates to assign the shift."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Panel lateral y selección múltiple de empleados",
    "titleEn": "Side panel and multiple employee selection",
    "text": "Horarios coloca el panel junto al calendario en pantallas grandes.",
    "textEn": "Schedules places the panel beside the calendar on wide screens.",
    "details": [
      "En móviles use Abrir para desplegarlo; Minimizar libera espacio. Tocar una casilla abre el panel con ese empleado y fecha.",
      "Busque por nombre, área o ID y marque las casillas. Todos visibles agrega los empleados que coinciden con la búsqueda a la selección; Limpiar quita la selección.",
      "El contador indica cuántos empleados están seleccionados. Cambiar la búsqueda no elimina selecciones anteriores; revise el contador antes de guardar o borrar."
    ],
    "detailsEn": [
      "On mobile use Open to expand it; Minimize frees space. Tapping a cell opens the panel with that employee and date.",
      "Search by name, area or ID and check boxes. All visible adds employees matching the search to the selection; Clear removes the selection.",
      "The counter shows selected employees. Changing the search does not remove prior selections; check the counter before saving or deleting."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Asignar una fecha o rango, comida y notas",
    "titleEn": "Assign one date or a range, meals and notes",
    "text": "Seleccione primero los empleados en Horarios.",
    "textEn": "Select employees in Schedules first.",
    "details": [
      "Una fecha asigna un día; Rango muestra Desde y Hasta. La fecha final no puede ser anterior a la inicial.",
      "Elija Turno, Descanso o Permiso. Para Turno seleccione el horario y, si aplica, Inicio comida y Fin comida. Ambos campos de comida aparecen uno debajo del otro, con hora y minutos completos y AM/PM cuando corresponda. La X borra únicamente la hora de ese campo. Notas o motivo agrega información de la asignación.",
      "Guardar o modificar aplica a todas las personas y fechas seleccionadas. Puede reemplazar asignaciones existentes; revise el alcance antes de confirmar."
    ],
    "detailsEn": [
      "One date assigns a day; Range shows From and To. The end date cannot precede the start.",
      "Choose Work, Day off or Leave. For Work select the shift and, when applicable, Meal start and Meal end. The two meal fields are stacked vertically, showing full hours and minutes, plus AM/PM when selected. The X clears only that field's time. Notes or reason adds assignment information.",
      "Save or modify applies to all selected people and dates. It may replace existing assignments; review the scope before confirming."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Colores de Turno, Descanso y Permiso",
    "titleEn": "Colors for Work, Day off and Leave",
    "text": "Use Color de casilla en el panel de Horarios.",
    "textEn": "Use Cell color in the Schedule panel.",
    "details": [
      "Auto usa verde para trabajo, gris para descanso y tono durazno para permiso. Puede elegir otro tono claro de la paleta.",
      "El color elegido se aplica a las personas y fechas seleccionadas cuando guarda; no cambia todas las asignaciones de ese tipo automáticamente.",
      "En PDF e impresión el fondo cubre toda la casilla con texto oscuro. Para imprimir colores, seleccione una impresora y un modo de impresión a color."
    ],
    "detailsEn": [
      "Auto uses green for work, gray for day off and peach for leave. You can choose another light palette shade.",
      "The chosen color applies to selected people and dates when saved; it does not automatically recolor every assignment of that type.",
      "PDF and print fill the entire cell with a light background and dark text. To print in color, select a color printer and color printing mode."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Copiar, generar y borrar horarios",
    "titleEn": "Copy, generate and delete schedules",
    "text": "Horarios ofrece varias formas de reutilizar asignaciones.",
    "textEn": "Schedules offers several ways to reuse assignments.",
    "details": [
      "Para copiar con pantalla táctil, toque una casilla existente, cambie personas o fechas en el panel y guarde. En computadora también puede arrastrar una asignación a otra casilla.",
      "Copiar mes anterior reutiliza el mes precedente. Generar automáticamente utiliza un patrón de los primeros 14 días completos; revise excepciones antes de guardar cambios posteriores.",
      "Borrar fecha o Borrar rango afecta la selección y pide confirmación. Borrar este día corresponde a la asignación cargada. Borrar un horario no elimina al empleado."
    ],
    "detailsEn": [
      "To copy on a touch screen, tap an existing cell, change people or dates in the panel and save. On a computer you can also drag an assignment to another cell.",
      "Copy previous month reuses the preceding month. Generate automatically uses a pattern from the first 14 complete days; review exceptions afterward.",
      "Delete date or Delete range affects the selection and asks for confirmation. Delete this day refers to the loaded assignment. Deleting a schedule does not delete an employee."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Imprimir horarios por rango y áreas",
    "titleEn": "Print schedules by range and areas",
    "text": "Use Descargar o imprimir horarios debajo de los controles.",
    "textEn": "Use Download or print schedules below the controls.",
    "details": [
      "Seleccione fechas inicial y final; pueden ser distintas al mes visible del calendario.",
      "En Áreas para PDF e impresión marque una o varias áreas; Todas y Ninguna facilitan la selección. Ese filtro se aplica tanto a Descargar PDF como a Imprimir.",
      "Descargar PDF y Imprimir usan el mismo documento A4 horizontal, con fechas en bloques de hasta 14 días, encabezados repetidos y colores de casilla. Excel descarga el rango según su permiso; el filtro de áreas de PDF e impresión no cambia Excel."
    ],
    "detailsEn": [
      "Choose start and end dates; they can differ from the visible calendar month.",
      "Under Areas for PDF and print check one or more areas; All and None simplify selection. This filter applies to both Download PDF and Print.",
      "Download PDF and Print use the same landscape A4 document, with dates in blocks of up to 14 days, repeated headers and cell colors. Excel downloads the range subject to permission; the PDF/print area filter does not change Excel."
    ],
    "adminOnly": false
  },
  {
    "tab": "reports",
    "title": "Tipos de reportes: clientes, cotizaciones y anticipos",
    "titleEn": "Report types: customers, quotes and deposits",
    "text": "Reportes requiere Advanced y rol Administrador.",
    "textEn": "Reports requires Advanced and Administrator role.",
    "details": [
      "Todas las cotizaciones lista documentos; Cotizaciones pendientes muestra seguimiento; Cotizaciones aprobadas y valor de venta analiza las aprobadas.",
      "Clientes más frecuentes y Clientes que han reservado ayudan a consultar actividad del cliente. Anticipos pagados por cliente organiza los anticipos registrados.",
      "Elija tipo, fechas y búsqueda. La pantalla pagina resultados; Imprimir y Excel incluyen todos los resultados filtrados."
    ],
    "detailsEn": [
      "All quotes lists documents; Pending quotes shows follow-up; Approved quotes and sales value analyzes approved quotes.",
      "Most frequent customers and Customers with reservations help review customer activity. Deposits paid by customer organizes recorded deposits.",
      "Choose type, dates and search. The screen paginates results; Print and Excel include all filtered results."
    ],
    "adminOnly": true
  },
  {
    "tab": "reports",
    "title": "Reportes operativos: conversión, cancelación y demanda",
    "titleEn": "Operational reports: conversion, cancellation and demand",
    "text": "Abra Reportes y seleccione el análisis operativo.",
    "textEn": "Open Reports and select an operational analysis.",
    "details": [
      "Conversión de cotizaciones muestra la relación entre cotizaciones y su conversión. Cancelaciones de reservaciones analiza los estados cancelados.",
      "Demanda por día y hora agrupa actividad para identificar concentración. Cambie el rango para comparar períodos de interés.",
      "Los reportes utilizan registros existentes; no son predicciones de ventas ni contabilidad fiscal. Revise filtros antes de interpretar un resultado vacío."
    ],
    "detailsEn": [
      "Quote conversion shows quotes and conversion. Reservation cancellations analyzes canceled statuses.",
      "Demand by day and hour groups activity to identify busy periods. Change the range to inspect relevant periods.",
      "Reports use existing records; they are not sales forecasts or tax accounting. Check filters before interpreting an empty result."
    ],
    "adminOnly": true
  },
  {
    "tab": "reports",
    "title": "Saldos, anticipación y comparación de períodos",
    "titleEn": "Balances, lead time and period comparisons",
    "text": "Reportes incluye análisis de seguimiento.",
    "textEn": "Reports includes follow-up analysis.",
    "details": [
      "Saldos de eventos próximos muestra saldos asociados a eventos; revise anticipos e importes de origen si un saldo parece incorrecto.",
      "Anticipación de reservaciones analiza con cuánta anticipación se registran. Comparación con el período anterior contrasta el rango elegido con el anterior.",
      "Estos reportes consideran la zona horaria del dispositivo. Seleccione fechas y búsqueda antes de imprimir o exportar."
    ],
    "detailsEn": [
      "Upcoming event balances shows event balances; review source deposits and amounts if a balance appears incorrect.",
      "Reservation lead time analyzes how far ahead reservations are entered. Comparison with previous period contrasts the chosen range with the prior one.",
      "These reports consider device time zone. Select dates and search before printing or exporting."
    ],
    "adminOnly": true
  },
  {
    "tab": "reports",
    "title": "Reporte de horas programadas y comidas",
    "titleEn": "Scheduled hours and meal report",
    "text": "Elija Empleados, días y horas programadas en Reportes.",
    "textEn": "Choose Employees, days and scheduled hours in Reports.",
    "details": [
      "Seleccione el período y busque el empleado. Consulte nombre, código, área, días y horas programadas, comidas, descansos y permisos.",
      "Las horas netas se calculan solo cuando el turno tiene entrada y salida numéricas, descontando los minutos de comida del turno. Días sin cálculo cuenta las asignaciones con texto, como CIERRE; esas duraciones no se suman ni se suponen como cero horas trabajadas. Un total de cero con Días sin cálculo mayor que cero significa que faltan horas para calcular.",
      "Es un reporte de programación: no registra automáticamente marcajes de entrada, salarios ni nómina. Para corregirlo revise Horarios y los turnos de origen."
    ],
    "detailsEn": [
      "Select the period and search for an employee. Review name, code, area, scheduled days and hours, meals, days off and leave.",
      "Net hours are calculated only when the shift has numeric start and end times, subtracting the shift meal minutes. Days without calculation counts assignments containing text, such as CLOSING; their durations are neither added nor assumed to be zero hours worked. A zero total with Days without calculation greater than zero means that times are missing for calculation.",
      "This is a scheduling report: it does not automatically record clock-ins, wages or payroll. Correct source Schedules and shifts when needed."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Invitar usuarios y elegir idioma del correo",
    "titleEn": "Invite users and choose email language",
    "text": "Abra Configuración → Usuarios como Administrador.",
    "textEn": "Open Settings → Users as Administrator.",
    "details": [
      "Ingrese nombre, correo, rol e Idioma del correo; envíe la invitación. Revise que la dirección esté escrita correctamente.",
      "El invitado debe abrir el enlace y completar su acceso. El estado Invitado es distinto de Activo.",
      "Reenviar genera un nuevo enlace e invalida el anterior. Cancelar retira una invitación. Respete el límite de usuarios del plan."
    ],
    "detailsEn": [
      "Enter name, email, role and Email language, then send the invitation. Check the address carefully.",
      "The invitee must open the link and complete access. Invited differs from Active status.",
      "Resend creates a new link and invalidates the previous one. Cancel withdraws an invitation. Respect the plan user limit."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Editar roles, desactivar y eliminar acceso",
    "titleEn": "Edit roles, deactivate and delete access",
    "text": "En Usuarios, busque la persona y use Editar.",
    "textEn": "In Users, search for the person and click Edit.",
    "details": [
      "Puede cambiar nombre y rol según permisos. El administrador principal no cambia de rol desde ese editor: use Cuenta → Transferir administración.",
      "Desactivar impide el acceso y Activar lo restablece. Eliminar acceso retira al usuario; una invitación anterior no debe reutilizarse.",
      "Los invitados comparten el plan del restaurante pero conservan sus roles. Advanced no convierte automáticamente a todos en administradores."
    ],
    "detailsEn": [
      "Change name and role as permitted. The main administrator cannot change role from this editor: use Account → Transfer administration.",
      "Deactivate prevents access and Activate restores it. Delete access removes the user; an old invitation should not be reused.",
      "Invitees share the restaurant plan but retain their roles. Advanced does not automatically make everyone an administrator."
    ],
    "adminOnly": true
  },
  {
    "tab": null,
    "title": "Qué permite cada rol",
    "titleEn": "What each role allows",
    "text": "El rol determina acciones dentro del plan contratado.",
    "textEn": "Role determines actions within the subscribed plan.",
    "details": [
      "Administrador gestiona usuarios y configuración; Reportes además requiere Advanced. Solo el propietario administra pagos y transferencia.",
      "Gerente crea y modifica clientes, reservaciones y cotizaciones, elimina reservaciones y cotizaciones no convertidas y gestiona horarios cuando el plan los incluye.",
      "Operación crea y modifica clientes, reservaciones, cotizaciones, productos y áreas de eventos; no elimina cotizaciones o reservaciones ni modifica horarios. Solo lectura consulta e imprime; Excel depende del permiso del administrador."
    ],
    "detailsEn": [
      "Administrator manages users and settings; Reports also requires Advanced. Only the owner manages billing and ownership transfer.",
      "Manager creates and edits customers, reservations and quotes, deletes reservations and unconverted quotes, and manages schedules when the plan includes them.",
      "Operations creates and edits customers, reservations, quotes, products and event areas; it cannot delete quotes/reservations or edit schedules. Read-only views and prints; Excel depends on administrator permission."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Permitir o bloquear descargas Excel",
    "titleEn": "Allow or block Excel downloads",
    "text": "El administrador controla la exportación del equipo en Configuración → Usuarios.",
    "textEn": "The administrator controls team exports in Settings → Users.",
    "details": [
      "El permiso afecta descargas de Gerente, Operación y Solo lectura. El Administrador conserva su capacidad de exportación.",
      "Si Excel o Plantilla aparece desactivado con un aviso de permiso, consulte al administrador. Tener acceso a ver datos no garantiza poder descargarlos.",
      "Imprimir e Importar conservan sus permisos propios; permitir Excel no concede capacidad para crear, editar ni borrar."
    ],
    "detailsEn": [
      "The permission affects Manager, Operations and Read-only downloads. Administrator retains export access.",
      "If Excel or Template is disabled with a permission notice, ask the administrator. Viewing data does not guarantee download permission.",
      "Print and Import retain their own permissions; allowing Excel does not grant create, edit or delete access."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Cambiar correo de acceso y transferir administración",
    "titleEn": "Change login email and transfer administration",
    "text": "Abra Configuración → Cuenta.",
    "textEn": "Open Settings → Account.",
    "details": [
      "Para cambiar el correo de acceso escríbalo dos veces, solicite los códigos al correo actual y al nuevo e introduzca ambos dentro de la misma sesión en Configuración → Cuenta. Puede cancelar mientras esté pendiente. Esto es distinto del correo comercial mostrado en cotizaciones.",
      "Transferir administración permite elegir otro usuario activo como administrador principal. La cuenta que transfiere pasa a Gerente.",
      "Eliminar mi cuenta exige que exista otro administrador activo y escribir el texto de confirmación. Elimina el acceso personal, no los datos del restaurante.",
      "La transferencia se guarda completa en una sola operación. Si falla, se conserva el propietario y los roles anteriores. No se puede eliminar una cuenta que todavía sea propietaria de un restaurante; primero transfiera su administración."
    ],
    "detailsEn": [
      "To change your login email, enter it twice, request codes to the current and new addresses and enter both within the same session in Settings → Account. You can cancel a pending change. This differs from the business email displayed on quotes.",
      "Transfer administration lets you choose another active user as main administrator. The transferring account becomes Manager.",
      "Delete my account requires another active administrator and the confirmation text. It deletes personal access, not restaurant data.",
      "Ownership transfer is saved in one complete operation. If it fails, the previous owner and roles remain. An account that still owns a restaurant cannot be deleted; transfer ownership first."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Códigos por email: activar, reenviar y desactivar",
    "titleEn": "Email codes: enable, resend and disable",
    "text": "Verificación en dos pasos es opcional y personal.",
    "textEn": "Two-step verification is optional and personal.",
    "details": [
      "Ingrese con contraseña. En Configuración → Verificación en dos pasos pulse Activar con código por email e ingrese los seis dígitos enviados al correo de su cuenta.",
      "Cada código vence en diez minutos y se utiliza una vez. Espere 60 segundos para reenviar; hay cinco intentos por código y límites adicionales de envío.",
      "Desactivar también pide un código. Si no llega, revise spam y la dirección de su cuenta; si indica que el envío no está configurado, contacte al responsable de MRMAA. No se usa QR."
    ],
    "detailsEn": [
      "Sign in with your password. In Settings → Two-step verification click Enable with email code and enter the six digits sent to your account email.",
      "Each code expires in ten minutes and is single-use. Wait 60 seconds to resend; there are five attempts per code and additional sending limits.",
      "Disabling also requires a code. If it does not arrive, check spam and your account address; if sending is not configured, contact MRMAA support. No QR is used."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Papelera: buscar, restaurar y eliminar definitivamente",
    "titleEn": "Trash: search, restore and permanently delete",
    "text": "El administrador accede desde Configuración → Seguridad.",
    "textEn": "Administrators access this in Settings → Security.",
    "details": [
      "Busque por cliente, número, fecha o tipo. La búsqueda recorre los registros del restaurante en el servidor y muestra páginas de 50, también si tiene más de 1,000 registros en papelera.",
      "Restaurar recupera un registro mientras esté dentro del plazo disponible de 365 días. Revise sus relaciones y posibles coincidencias.",
      "Eliminar definitivamente pide confirmación y no equivale a Restaurar. No lo use para ocultar temporalmente un registro ni prometa recuperación después de esa acción."
    ],
    "detailsEn": [
      "Search by customer, number, date or type. The server searches your restaurant records and returns pages of 50, including when there are more than 1,000 trash records.",
      "Restore recovers a record within the available 365-day window. Review its relationships and possible matches.",
      "Permanent deletion asks for confirmation and is not Restore. Do not use it for temporary hiding or promise recovery afterward."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Respaldo Excel, JSON e historial reciente",
    "titleEn": "Excel backup, JSON and recent history",
    "text": "Configuración → Seguridad ofrece respaldos e historial.",
    "textEn": "Settings → Security offers backups and history.",
    "details": [
      "Descargar respaldo Excel genera una copia de datos; Respaldo técnico JSON ofrece una salida técnica. Guarde estos archivos en un lugar privado.",
      "Descargar no programa respaldos automáticos ni vuelve a importar todo el archivo. La interfaz no ofrece una restauración completa de JSON con un clic.",
      "Historial reciente permite revisar acciones registradas, como modificaciones, exportaciones e impresiones, con usuario, rol, fecha y sección.",
      "El respaldo del navegador tiene un límite conjunto de 10,000 registros y 20 MB. Si se supera, la operación se detiene antes de descargar; solicite a soporte un respaldo mayor. No es un respaldo transaccional de Supabase, ni incluye contraseñas o archivos del almacenamiento. Evite editar datos mientras se prepara."
    ],
    "detailsEn": [
      "Download Excel backup creates a data copy; Technical JSON backup provides technical output. Keep these files private.",
      "Downloading does not schedule automatic backups or reimport the whole file. The interface does not provide one-click full JSON restoration.",
      "Recent history helps review recorded actions such as changes, exports and printing, with user, role, date and section.",
      "The browser backup has a combined limit of 10,000 records and 20 MB. Exceeding it stops the operation before downloading; request a larger backup from support. This is not a transactional Supabase backup and does not include passwords or storage files. Avoid editing records while it is being prepared."
    ],
    "adminOnly": true
  },
  {
    "tab": "settings",
    "title": "Planes Basic, Intermediate y Advanced",
    "titleEn": "Basic, Intermediate and Advanced plans",
    "text": "Los planes se comparten por restaurante, no por cada invitado.",
    "textEn": "Plans are shared per restaurant, not purchased separately by each invitee.",
    "details": [
      "Basic incluye clientes, reservaciones y cotizaciones, con un usuario. Intermediate agrega horarios y permite cinco usuarios.",
      "Advanced permite quince usuarios e incluye reportes; solo Administrador puede abrir Reportes. Subir de plan no cambia automáticamente los roles.",
      "Todos incluyen el asistente con 50 solicitudes compartidas al mes. Crear empleados del horario y crear usuarios de acceso son acciones distintas."
    ],
    "detailsEn": [
      "Basic includes customers, reservations and quotes with one user. Intermediate adds schedules and allows five users.",
      "Advanced allows fifteen users and includes reports; only Administrator can open Reports. Upgrading does not automatically change roles.",
      "All include the assistant with 50 shared requests per month. Creating scheduled employees differs from creating login users."
    ],
    "adminOnly": false
  },
  {
    "tab": "settings",
    "title": "Cambiar plan, confirmar y gestionar suscripción",
    "titleEn": "Change plans, confirm and manage subscription",
    "text": "El propietario usa Configuración → Suscripción.",
    "textEn": "The owner uses Settings → Subscription.",
    "details": [
      "Revise el plan actual y el período pagado. Elija Mensual o Anual y el plan deseado. En una suscripción activa se abre Confirmar cambio de suscripción, con el plan actual y el nuevo y sus precios de catálogo vigentes. La tarifa real de una suscripción anterior se consulta en Gestionar suscripción. El aviso destaca que, al completarse el cambio, no podrá volver a cambiar de plan ni de periodicidad durante 24 horas (un minuto en modo de prueba). Cancelar o Escape cierra sin solicitar el cambio. Solo Confirmar cambio lo envía.",
      "Puede solicitar anual a mensual, mensual a anual o cambiar de plan manteniendo la periodicidad. La disponibilidad depende de tener las variantes y precios correctos en el proveedor. El proveedor calcula ajustes proporcionales y puede cobrar inmediatamente o modificar la renovación al cambiar de período. Un crédito no equivale a un reembolso automático a la tarjeta. La ventana muestra precios recurrentes antes de impuestos, no el importe exacto del ajuste de hoy.",
      "MRMAA permite un cambio exitoso de plan o periodicidad por restaurante cada 24 horas en pagos reales. En pagos de prueba se espera un minuto. Próximo cambio disponible muestra la fecha y hora. El límite se comprueba en servidor y no se reinicia al cerrar sesión o cambiar de dispositivo. Los intentos rechazados no consumen ese plazo; el control de intentos rápidos es independiente.",
      "Actualizar estado consulta la suscripción. Si se pierde una respuesta, el cambio puede seguir pendiente de verificación: no repita el pago. Espere la sincronización y, si persiste, contacte a soporte con la referencia del error. No se anuncia como fallido un cobro incierto ni se repite automáticamente. Algunos métodos, como PayPal, requieren confirmar también en el portal; si abandona esa aprobación y queda pendiente, contacte a soporte.",
      "Gestionar suscripción abre el portal del proveedor para pagos y cancelación. El límite de MRMAA no controla cambios que el proveedor permita hacer directamente en su portal; su disponibilidad se administra en ese proveedor. Cancelar la renovación mantiene el acceso hasta el fin del período pagado. Este límite no bloquea gestionar o cancelar la suscripción.",
      "Para bajar de plan, los usuarios activos y las invitaciones pendientes deben caber en el límite nuevo. Resuelva pagos pendientes antes de cambiar. El asistente explica el proceso, pero no ejecuta ni confirma cobros. La cuenta creadora y sus invitados conservan Advanced sin pagos; no necesitan cambiar de plan."
    ],
    "detailsEn": [
      "Review your current plan and paid period. Choose Monthly or Annual and a plan. For an active subscription, Confirm subscription change opens with the current and new plan and their current catalog prices. Check an earlier subscription’s actual rate under Manage subscription. A prominent notice states that, after a successful change, you cannot change plans or billing cycles again for 24 hours (one minute in test mode). Cancel or Escape closes it without requesting a change. Only Confirm change submits it.",
      "You can request annual to monthly, monthly to annual or change plans while keeping the billing cycle. Availability requires the correct provider variants and prices. The provider calculates prorated adjustments and may charge immediately or reset renewal when changing cycles. A credit is not an automatic card refund. The dialog shows recurring prices before taxes, not the exact adjustment charged today.",
      "MRMAA allows one successful plan or billing-cycle change per restaurant every 24 hours for live payments. Test payments have a one-minute wait. Next change available shows the date and time. The server enforces the limit across sessions and devices. Rejected attempts do not consume it; rapid-attempt protection is separate.",
      "Refresh status checks the subscription. A lost response may leave a change awaiting verification: do not repeat payment. Wait for synchronization, then contact support with the error reference if it persists. An uncertain charge is never automatically repeated. Some methods, such as PayPal, require approval in the portal too; if you abandon approval and it remains pending, contact support.",
      "Manage subscription opens the provider portal for payments and cancellation. MRMAA’s limit does not control changes allowed directly in the provider portal; configure their availability with that provider. Canceling renewal keeps access through the paid period. The change limit does not block managing or canceling your subscription.",
      "Downgrades require active users and pending invitations to fit the new limit. Resolve pending payments first. The assistant explains the process but cannot execute or confirm charges. The creator account and invited users keep Advanced at no charge and do not need to change plans."
    ],
    "adminOnly": true
  },
  {
    "tab": null,
    "title": "Prueba, acceso restringido y recuperación de conexión",
    "titleEn": "Trial, restricted access and reconnecting",
    "text": "La prueba del proyecto nuevo dura diez días sin tarjeta.",
    "textEn": "The new-project trial lasts ten days without a card.",
    "details": [
      "Al vencer los 10 días sin pago confirmado se bloquea el acceso a los módulos y datos, también para los invitados. El propietario puede escoger y pagar un plan desde la pantalla de bloqueo; los invitados deben contactar al propietario. Guarde respaldos antes de que termine la prueba. El bloqueo no borra datos en ese momento; sigue vigente la política de conservación y se muestra la fecha de eliminación programada cuando corresponda.",
      "El contador muestra días, horas y minutos restantes, con Elegir plan y, durante las últimas 48 horas, Activar plan. No se cobra automáticamente al terminar una prueba sin tarjeta. Solo el propietario administra pagos; la cuenta exenta del creador y sus invitados conservan Advanced sin pagos y sus permisos.",
      "Un error de conexión no demuestra que se borraron datos. Revise conexión y filtros; compruebe si una operación ya se guardó antes de repetirla.",
      "Cuando las actualizaciones en tiempo real están habilitadas, los cambios del equipo se sincronizan. Si aparece un aviso de cambios recientes, revise el registro antes de guardar un borrador."
    ],
    "detailsEn": [
      "When the 10-day trial expires without confirmed payment, modules and data are locked for the owner and invited users. The owner can choose and pay for a plan on the locked screen; invited users must contact the owner. Save backups before the trial ends. Locking does not delete data at that moment; the retention policy still applies and the scheduled deletion date is displayed when applicable.",
      "The timer shows days, hours and minutes left, with Choose a plan and, during the final 48 hours, Activate a plan. A no-card trial does not automatically charge when it ends. Only the owner manages payments; the exempt creator account and invited users keep Advanced at no charge with their assigned permissions.",
      "A connection error does not prove data was deleted. Check connection and filters; check whether an operation already saved before repeating it.",
      "When real-time updates are enabled, team changes synchronize. If a recent-changes warning appears, review the record before saving a draft."
    ],
    "adminOnly": false
  },
  {
    "tab": null,
    "title": "Alcance del asistente y funciones no disponibles",
    "titleEn": "Assistant scope and unavailable features",
    "text": "El asistente explica controles y procedimientos de MRMAA.",
    "textEn": "The assistant explains MRMAA controls and procedures.",
    "details": [
      "Puede explicar campos, cálculos, permisos, estados, catálogos, reportes y pasos de configuración documentados. No ve sus registros ni su pantalla.",
      "No puede guardar, borrar, enviar mensajes, cobrar, cambiar planes ni obtener una lista real de sus clientes. Haga esas acciones en sus módulos con sus permisos.",
      "La navegación actual contiene Reservaciones, Clientes, Cotizaciones, Horarios, Reportes y Configuración. No prometa POS, inventario, contabilidad, nómina, plano de mesas o campañas automáticas como módulos disponibles."
    ],
    "detailsEn": [
      "It can explain documented fields, calculations, permissions, statuses, catalogs, reports and configuration steps. It cannot see your records or screen.",
      "It cannot save, delete, send messages, charge, change plans or retrieve your actual customer list. Perform actions in their modules with your permissions.",
      "Current navigation contains Reservations, Customers, Quotes, Schedules, Reports and Settings. Do not promise POS, inventory, accounting, payroll, table floor plans or automatic campaigns as available modules."
    ],
    "adminOnly": false
  }
];
