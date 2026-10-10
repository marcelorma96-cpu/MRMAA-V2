import { PLANS } from "./plans";

export const TUTORIAL_GUIDE = [
{
  "tab": "settings",
  "title": "Descripción y prueba de WhatsApp",
  "titleEn": "Description and WhatsApp test",
  "text": "Presente el restaurante y compruebe el número de contacto antes de publicar.",
  "textEn": "Introduce the restaurant and check the contact number before publishing.",
  "details": [
    "Escriba 2 o 3 frases sobre especialidad, ubicación y celebraciones que atiende. Ejemplo: Restaurante de carnes y mariscos en Ciudad de Guatemala. Conozca nuestros menús y salones y solicite una cotización para su próximo evento. Reemplace los datos por los de su restaurante.",
    "En Contacto, pegue su Enlace de WhatsApp: un enlace wa.me con número internacional, wa.me/message/ de WhatsApp Business o api.whatsapp.com/send con phone. Probar WhatsApp abre exactamente ese enlace, también en la vista previa; no envía mensajes ni comprueba si la cuenta existe.",
    "En la web se abre otra pestaña; en la app iOS el sistema maneja el enlace. Puede usar Copiar enlace para probarlo directamente en el navegador. Se conserva el mensaje incluido en el enlace. Los números configurados anteriormente siguen siendo compatibles; SQL 51 permite guardar un enlace sin exigir además un número."
  ],
  "detailsEn": [
    "Write 2 or 3 sentences about cuisine, location and occasions you host. Example: A steak and seafood restaurant in Guatemala City. Explore our menus and spaces and request a quote for your next event. Replace the details with your own restaurant information.",
    "Under Contact, paste your WhatsApp link: wa.me with an international number, a WhatsApp Business wa.me/message/ short link, or api.whatsapp.com/send with phone. Test WhatsApp opens that exact link, including in preview; it does not send a message or verify the account exists.",
    "The web opens a new tab; in the iOS app the system handles the link. Use Copy link to test it directly in your browser. Any message in the supplied link is preserved. Previously configured numbers remain compatible; SQL 51 allows saving a link without also requiring a phone number."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Página pública, menús y buzón",
  "titleEn": "Public page, menus and inbox",
  "text": "Publique un enlace de su restaurante para mostrar menús y recibir solicitudes de eventos.",
  "textEn": "Publish your restaurant’s link to show menus and receive event requests.",
  "details": [
    "Administrador: abra Configuración → Página pública. Complete los tres pasos: Contenido, Contacto y Publicar. En teléfono, abra Más para llegar a Configuración. La página es opcional y empieza desactivada.",
    "En Contenido, agregue nombre, descripción, dirección, logo y fotos. Puede copiar menús y salones de los catálogos o crear su carta digital por categorías. Revise la copia: sus precios públicos son independientes y no cambian cotizaciones guardadas ni precios internos.",
    "En Contacto, active WhatsApp pegando su enlace, correo o teléfono. Pruebe el enlace. El visitante elige entre los canales que habilitó; no necesita tener WhatsApp si ofrece correo o llamada.",
    "En Publicar, elija su enlace, revise la vista previa, active Habilitar página pública y guarde. Comparta el enlace o descargue el QR. Una solicitud de cotización llega al Buzón de solicitudes; no confirma una reserva ni cobra anticipos."
  ],
  "detailsEn": [
    "Administrator: open Settings → Public page. Complete the three steps: Content, Contact and Publish. On a phone, open More to reach Settings. The page is optional and starts disabled.",
    "Under Content, add a name, description, address, logo and photos. Copy selected menus and spaces from your catalogs or create a digital menu by category. Review the copy: public prices are independent and do not change saved quotes or internal prices.",
    "Under Contact, enable WhatsApp by pasting its link, email or phone. Test the link. Visitors choose among your enabled channels; they do not need WhatsApp if you offer email or phone.",
    "Under Publish, choose your link, preview the page, enable it and save. Share the link or download the QR. An event quote request goes to Request inbox; it does not confirm a booking or charge a deposit."
  ],
  "adminOnly": false
},
{
  "tab": "inbox",
  "title": "Buzón: atender solicitudes y crear cotizaciones",
  "titleEn": "Inbox: handle requests and create quotes",
  "text": "Revise cada solicitud y continúe la conversación por el medio preferido del cliente.",
  "textEn": "Review each request and continue through the customer’s preferred contact method.",
  "details": [
    "Abra Buzón de solicitudes en el menú; en teléfono, abra Más → Buzón de solicitudes. Consulte Nueva, En atención, Cotizada, Archivada o Todas. Se muestran 25 solicitudes por página. En la app, toque la tarjeta para ver datos y acciones.",
    "El formulario público de cotización solicita nombre, fecha, hora local del restaurante, personas, menú o asesoría, teléfono, correo y contacto preferido; salón y detalles son opcionales. El aviso de nuevas solicitudes permanece hasta marcarlas en atención, cotizadas o archivadas. Se revisa hasta cada minuto mientras la app está visible; no emite sonido ni notificaciones push.",
    "Si tiene permiso operativo, pulse Crear cotización. El formulario interno se completa con la solicitud; revise precios, cantidades, menú, fecha y área antes de guardar. Se usan los precios vigentes del catálogo interno cuando corresponde. Guardar vincula la cotización; un reintento no crea otra. La reserva se crea después mediante la conversión habitual, cuando usted la confirma.",
    "Abrir WhatsApp, Escribir correo o Llamar abre el programa correspondiente; usted envía el mensaje. Para enviar la propuesta, abra Ver cotización, descargue el PDF y adjúntelo en su conversación o correo. UnoMesa no registra conversaciones ni envía mensajes automáticamente. Solo lectura puede consultar, pero no cambiar estados ni crear cotizaciones.",
    "Ver menú abre directamente el PDF subido; si hay varios, muestra una lista para elegir. Si no hay PDF, muestra la carta digital publicada. Consultas y Solicitar reserva abren el canal habilitado o permiten elegirlo; no crean registros en el buzón. El restaurante acuerda los detalles con el cliente y registra la reserva manualmente. Solo el formulario de cotización entra al buzón."
  ],
  "detailsEn": [
    "Open Request inbox from the menu; on a phone, open More → Request inbox. Filter New, In progress, Quoted, Archived or All. Each page shows 25 requests. In the app, tap a card for details and actions.",
    "The public quote form asks for name, date, restaurant local time, guests, menu or advice, phone, email and preferred contact; space and details are optional. The new-request notice stays until requests are marked in progress, quoted or archived. It refreshes up to every minute while the app is visible; there are no sounds or push notifications.",
    "With operating permission, select Create quote. The request fills the internal form; review prices, quantities, menu, date and space before saving. Current internal catalog prices are used when applicable. Saving links the quote; retrying does not create another one. Create the booking later using the existing conversion flow after you confirm it.",
    "Open WhatsApp, Write email or Call opens the corresponding app; you send the message. To send the proposal, open View quote, download its PDF and attach it to your conversation or email. UnoMesa does not record conversations or send automatically. Read-only users can view but cannot change states or create quotes.",
    "View menu opens the uploaded PDF directly; if there are several, it shows a list to choose from. Without a PDF it shows the published digital menu. Questions and reservation requests open an enabled contact channel or let the visitor choose; they do not create inbox records. The restaurant agrees on details with the customer and records the booking manually. Only the quote form enters the inbox."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Menú digital, fotos y PDF públicos",
  "titleEn": "Digital menu, photos and public PDFs",
  "text": "Reutilice su catálogo y publique solo los archivos destinados a visitantes.",
  "textEn": "Reuse your catalog and publish only files intended for visitors.",
  "details": [
    "En Configuración → Página pública → Contenido, use las listas de menús y salones: busque, marque varias casillas o pulse Seleccionar todos. Deseleccionar lista retira esas copias de la página al guardar; no borra el catálogo interno. También puede agregar elementos manualmente. Puede organizar una carta digital por categorías y subir fotos de sus espacios. Las copias públicas se revisan por separado cuando cambie el catálogo interno. Los seleccionados permanecen en la misma lista, sin repetirse debajo. Pulse Editar detalles en la fila para cambiar nombre público, descripción, precio o foto. Los elementos manuales también se editan en esa lista.",
    "Puede publicar hasta 5 PDF. El límite es 3 MB por archivo y 20 MB / 30 archivos almacenados por restaurante. Para fotos se admite PNG, JPEG o WebP. Los PDF se abren con un enlace /menus/ del dominio de UnoMesa y un nombre legible, también los ya subidos. Solo se descargan cuando el visitante los abre; no se cargan todos al entrar al sistema. El botón principal Ver menú abre el PDF; con varios PDF, primero permite elegir. Sin PDF conserva el acceso a la carta digital.",
    "Los PDF e imágenes de esta sección son públicos: no suba documentos privados. Para borrar un archivo, quite sus referencias de la página, guarde y elimínelo en Archivos almacenados. Desactivar la página no elimina los archivos ni revoca las copias que alguien ya descargó.",
    "En cada salón seleccionado, indique Capacidad máxima (personas). La página muestra ese número y el selector del formulario también lo indica. No se calcula a partir de las mesas ni cambia las reservas; si falta, se muestra Capacidad por confirmar. El encabezado público dice Su mesa, su manera."
  ],
  "detailsEn": [
    "In Settings → Public page → Content, search and tick several menu or space checkboxes, or select Select all. Deselect list removes public copies after saving, without deleting the internal catalog. You can also add items manually. Organize a digital menu by category and upload space photos. Review public copies separately when the internal catalog changes. Selected items remain in the same list without repeating below. Select Edit details in the row to change the public name, description, price or photo. Manual items are edited in this same list.",
    "You can publish up to 5 PDFs. Limits are 3 MB per file and 20 MB / 30 stored files per restaurant. Photos support PNG, JPEG or WebP. PDFs open under UnoMesa’s /menus/ address with a readable filename, including existing uploads. They download only when visitors open them; they are not all loaded when opening the system. The main View menu button opens the PDF; with multiple PDFs it offers a choice first. Without a PDF it retains access to the digital menu.",
    "PDFs and images in this section are public: never upload private documents. To delete a file, remove its page references, save, then delete it under Stored files. Disabling the page does not delete files or revoke copies already downloaded.",
    "For each selected space, enter Maximum capacity (guests). The public page and quote form space selector show that number. It is not inferred from tables and does not change bookings; if missing, Capacity to be confirmed appears. The public heading says Your table, your way."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Enlace personalizado, QR y datos de cada restaurante",
  "titleEn": "Restaurant link, QR and separate data",
  "text": "Cada restaurante administra su página y su propio buzón.",
  "textEn": "Each restaurant manages its own page and inbox.",
  "details": [
    "En Configuración → Página pública → Publicar, elija un nombre disponible para su enlace. El formato es https://www.unomesa.com/r/nombre-restaurante; es un ejemplo, no la confirmación de que ese enlace esté publicado. Otro restaurante no puede usar el mismo nombre.",
    "Después de guardar y publicar, copie el enlace a sus perfiles sociales o descargue el QR para compartir el menú y formulario. Si cambia el nombre, los enlaces anteriores siguen apuntando a su página. Desactivar la página oculta su contenido y bloquea solicitudes nuevas.",
    "La administración y las solicitudes se separan por restaurante y permisos. La página pública solo muestra lo que decide publicar; no revela clientes, cotizaciones ni reservaciones internas. Los archivos publicados sí pueden abrirse con su enlace.",
    "Compartir o publicar un enlace no garantiza aparecer primero en Google ni ser indexado de inmediato. Las páginas públicas de UnoMesa sobre gestión de eventos explican el software; no sustituyen el enlace particular de su restaurante ni constituyen una campaña de publicidad automática."
  ],
  "detailsEn": [
    "In Settings → Public page → Publish, choose an available name for your link. The format is https://www.unomesa.com/r/restaurant-name; this is an example, not confirmation that a page is published. Another restaurant cannot use the same name.",
    "After saving and publishing, copy the link to social profiles or download the QR to share your menu and form. If you rename it, earlier links still point to your page. Disabling the page hides its content and blocks new requests.",
    "Management and requests are separated by restaurant and permissions. The public page shows only what you publish; it does not expose internal customers, quotes or bookings. Published files can be opened through their links.",
    "Sharing or publishing a link does not guarantee first place in Google or immediate indexing. UnoMesa’s public event-management pages describe the software; they do not replace your restaurant’s own link or run automatic advertising campaigns."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Actualizar pagos y volver a contratar un plan",
  "titleEn": "Refresh billing and subscribe again",
  "text": "Compruebe el estado en Lemon Squeezy antes de reiniciar una suscripción finalizada.",
  "textEn": "Check the Lemon Squeezy status before purchasing a plan after a subscription ends.",
  "details": [
    "Propietario: abra Configuración → Suscripción → Actualizar estado. Se consulta Lemon Squeezy desde el servidor y se verifican la suscripción, los comprobantes y su vínculo con el restaurante. Solo al sincronizar el resultado aparece Estado actualizado y verificado con Lemon Squeezy. No cobra ni cambia el plan elegido.",
    "Si la consulta falla, aparece un error y no se anuncia una actualización exitosa. Las cuentas exentas conservan su exención. Si todavía no hay una suscripción de pago vinculada, se indica claramente; si acaba de pagar, espere la confirmación y no pague otra vez. Otros usuarios solo actualizan su vista local: la verificación del proveedor corresponde al propietario.",
    "Si la suscripción anterior ya finalizó en Lemon Squeezy, elija un plan mensual o anual y pulse Pagar ahora. Se abre una compra nueva en la misma cuenta; conserva los datos del restaurante y no obtiene otra prueba gratuita. No necesita entrar al portal para contratar de nuevo una suscripción finalizada.",
    "Si canceló la renovación pero conserva tiempo pagado, Reactivar plan actual permite restaurar la renovación, previa confirmación. Si hay un pago pendiente, la suscripción está pausada o el proveedor todavía la mantiene vigente, use Gestionar suscripción para revisar esa misma suscripción y evitar una segunda.",
    "Un pago reembolsado no demuestra por sí solo que la suscripción del proveedor haya terminado. Actualizar estado comprueba ambas cosas. No restaura acceso pagado por un comprobante totalmente reembolsado ni habilita una compra duplicada mientras siga vigente la anterior."
  ],
  "detailsEn": [
    "Owner: open Settings → Subscription → Refresh status. The server checks Lemon Squeezy and verifies the subscription, payment records and restaurant binding. Status updated and verified with Lemon Squeezy appears only after synchronization succeeds. Refreshing does not charge or change the chosen plan.",
    "If the check fails, an error appears without claiming success. Exempt accounts retain their exemption. If no paid subscription is linked yet, this is stated clearly; after a recent payment, wait for confirmation and do not pay again. Other users refresh their local view only; provider verification belongs to the owner.",
    "If the previous subscription has ended in Lemon Squeezy, choose a monthly or annual plan and select Pay now. A new purchase opens for the same account, keeping restaurant data without granting another free trial. You do not need the portal to buy again after a subscription ends.",
    "If renewal was canceled but paid time remains, Reactivate current plan restores renewal after confirmation. If payment is pending, the subscription is paused or the provider still keeps it live, use Manage subscription to resolve the existing subscription without creating a second one.",
    "A refunded payment alone does not prove the provider subscription has ended. Refresh status checks both. It never restores paid access from a fully refunded payment or permits a duplicate purchase while the old subscription is still live."
  ],
  "adminOnly": false
},

{
  "tab": "settings",
  "title": "Volver a UnoMesa después de pagar o gestionar un plan",
  "titleEn": "Return to UnoMesa after payment or subscription management",
  "text": "Conserve su sesión y actualice el estado de la suscripción al regresar.",
  "textEn": "Keep your session and refresh the subscription status when returning.",
  "details": [
    "Solo el propietario administra pagos en Configuración → Suscripción. En la web, Pagar ahora o Gestionar suscripción abre Lemon Squeezy en otra pestaña y conserva UnoMesa abierta. Al terminar o cancelar, cierre esa pestaña para volver. Si el navegador la bloquea, pulse Abrir pagos seguros.",
    "En iOS Build 14 o posterior, los pagos abren una ventana segura dentro de la app: pulse Listo (Done) para regresar incluso si no pagó. Los nuevos enlaces de pago y recibos incluyen una página con Volver a la app UnoMesa y Volver a UnoMesa web. En versiones anteriores y en Android se conserva la apertura externa: vuelva a UnoMesa después de terminar.",
    "Al volver, se carga el estado guardado de la suscripción. El propietario puede pulsar Actualizar estado para verificarlo directamente con Lemon Squeezy y sincronizarlo. Volver, cerrar o abrir un enlace nunca demuestra que el pago se completó: el plan cambia al recibirse y verificarse la confirmación del proveedor. Si ya le cobraron y sigue pendiente, no vuelva a pagar; espere y contacte a support@unomesa.com con su comprobante si persiste.",
    "La suscripción paga el uso de UnoMesa. La página pública del restaurante no cobra anticipos, no pide tarjetas y no confirma reservas automáticamente. El asistente puede explicar los pasos, pero no consultar su pago ni ejecutarlo."
  ],
  "detailsEn": [
    "Only the owner manages billing in Settings → Subscription. On the web, Pay now or Manage subscription opens Lemon Squeezy in another tab and keeps UnoMesa open. After finishing or canceling, close that tab to return. If blocked, select Open secure billing.",
    "On iOS Build 14 or later, billing opens a secure window within the app: tap Done to return even if you did not pay. New checkout and receipt links include a page with Return to the UnoMesa app and Return to UnoMesa on the web. Earlier versions and Android retain external opening: return to UnoMesa when finished.",
    "Returning loads the saved subscription status. The owner can select Refresh status to verify and synchronize it directly with Lemon Squeezy. Returning, closing or opening a link never proves payment: the plan changes after the provider confirmation is received and verified. If you were charged but status is pending, do not pay again; wait and contact support@unomesa.com with your receipt if it persists.",
    "The subscription pays for using UnoMesa. A restaurant’s public page does not charge deposits, ask for cards or confirm bookings automatically. The assistant can explain steps but cannot look up or execute a payment."
  ],
  "adminOnly": false
},

{"tab": "quotes", "title": "Pendientes y recordatorios del evento", "titleEn": "Event pending items and reminders", "text": "Escriba lo que falta por confirmar; aparece en Recordatorios, arriba de Cotizaciones.", "textEn": "Write what needs confirming; it appears under Reminders at the top of Quotes.", "details": ["1. Abra Pendientes en una cotización o reserva guardada. Escriba, por ejemplo, Falta confirmar menú y pulse Agregar pendiente. Solo el texto es obligatorio; no se crean listas automáticas.", "2. Recordatorios aparece directamente arriba de Cotizaciones en web y app, con texto, cotización, cliente y fecha. Modificar abre la edición de la cotización vinculada; tocar el número abre su documento. Para cambiar el texto del pendiente, abra Pendientes en la cotización y pulse Modificar junto al texto. Editar la cotización no quita el aviso. Muestra cinco recordatorios por página y conserva los demás en las siguientes páginas, solo mientras la fecha del evento no haya pasado. Al día siguiente se oculta automáticamente; el pendiente se conserva dentro del evento. Si cambia la fecha a hoy o al futuro, vuelve a aparecer. Se usa la fecha local del dispositivo y se actualiza al abrir, volver a la app o en la revisión visible cada 30 segundos.", "3. Quitar retira el aviso para todo el equipo. Conserva el registro en Quitados y resueltos, donde Volver a mostrar lo reactiva. No cambia ni elimina la cotización, reservación, importe o anticipo. Los detalles anteriores se conservan al modificar el texto.", "Cotizaciones y reservas vinculadas comparten sus pendientes. No se copian al convertir. Las notas siguen siendo internas. No hay popup automático, sonido, envío de mensajes ni cobros. La conversación con el cliente continúa por WhatsApp.", "El cambio se refleja al guardarlo en esta pantalla y otras pestañas del mismo navegador. Otros dispositivos actualizan al volver al módulo, refrescar o durante la revisión cada 30 segundos mientras está visible y conectado. Un borrador abierto se conserva y se avisa si otra persona cambió el mismo pendiente. Los roles de lectura consultan; editar o quitar requiere permiso.", "Se usa el servicio de seguimiento ya existente (SQL 49). SQL 50 agrega la lectura que oculta recordatorios de fechas pasadas; no borra registros ni modifica SQL 49. Si ese servicio nunca se instaló, muestra que no está habilitado; no guarda pendientes solo en el dispositivo."], "detailsEn": ["1. Open Pending items on a saved quote or reservation. Write, for example, Confirm menu and select Add pending item. Only the text is required; no automatic checklist is created.", "2. Reminders appears directly at the top of Quotes on web and app, showing the text, quote, customer and date. Edit opens the linked quote editor; tapping the quote number opens its document. To change a pending item’s text, open Pending items on the quote and select Edit beside the text. Editing the quote does not dismiss its reminder. Five reminders appear per page, with the rest on subsequent pages, only while the event date has not passed. It disappears the next day; the pending item remains in the event history. Moving the event to today or a future date shows it again. Uses the device local date and refreshes on opening, returning to the app or the visible 30-second check.", "3. Dismiss removes the reminder for the whole team. The record remains in Dismissed and completed; Show again restores it. This does not modify or delete the quote, reservation, amount or deposit. Earlier details survive text edits.", "Linked quotes and reservations share pending items without copying them on conversion. Notes remain private. There is no automatic popup, sound, message sending or charging. Customer conversations can continue on WhatsApp.", "Changes refresh this screen and other tabs in the same browser after saving. Other devices refresh when returning, manually refreshing or during the 30-second check while visible and online. Open drafts survive refreshes; concurrent edits require review. Read-only roles can view; editing and dismissing require permission.", "Uses the existing follow-up service (SQL 49). SQL 50 adds a reader that hides past-event reminders; it does not delete records or change SQL 49. If the service was never installed, an unavailable message appears; tasks are not saved only on the device."], "adminOnly": false},
{"tab": null, "title": "Usar UnoMesa en la app", "titleEn": "Using UnoMesa in the app", "text": "Toque un registro para ver sus datos y acciones; las herramientas aparecen cuando las necesita.", "textEn": "Tap a record to view its details and actions; tools appear when needed.", "details": ["Para actualizar un módulo, vaya al inicio y deslice hacia abajo hasta ver Suelta para actualizar. En el plano hágalo sobre el encabezado; arrastrar el mapa conserva el movimiento y zoom. El círculo dura mientras se consultan los datos. Con un formulario o cambios sin guardar, el gesto se desactiva para conservarlos. Al abrir la app aparece el logo desde el inicio. Cuando terminan las comprobaciones y la carga inicial, se retira con un movimiento y brillo suaves. Reducir movimiento usa una transición discreta. Al entrar a un módulo, un círculo indica la carga hasta que sus datos iniciales y su distribución están listos; las actualizaciones posteriores conservan los formularios y filtros abiertos. La contraseña, la verificación en dos pasos y la revocación del acceso mantienen sus comprobaciones.", "El primer inicio muestra Continuar con Google o correo electrónico. Para ingresar con correo, escríbalo y pulse Siguiente; después introduzca su contraseña y pulse Entrar. Atrás permite cambiar el correo. Crear cuenta está al pie. En iOS, Google abre una ventana segura para elegir su cuenta y termina el ingreso en la misma pantalla de la app. Cancelar permite volver a intentar. El registro por correo tiene dos pasos cortos. Las cuentas nuevas reciben una única prueba de Advanced por 10 días; el aviso Prueba gratuita muestra lo que queda y Elegir plan permite activar una suscripción. Volver a registrarse no reinicia la prueba. Las cuentas exentas conservan su condición.", "El mapa completo abre primero. Toque una mesa para reservar o consultar su agenda: los detalles salen desde abajo en teléfono y a la derecha en tablet, dejando espacio al mapa. Amplíe o reduzca el panel con su botón o arrastrando el encabezado; X lo cierra. Dentro de la agenda, toque una reserva para desplegar sus datos y acciones. Editar reserva y Más, con cotización y eliminar, aparecen según permisos. Listado queda visible para volver a las reservaciones. La fecha tiene flechas para cambiar de día; tocarla abre filtros; los tres puntos permiten cambiar vista, imprimir/PDF y editar el plano. Dos dedos acercan o recorren el mapa hasta 12×, también en la web. Al tocar una mesa o una reserva, el mapa centra su ubicación sin reducir el lienzo. Los nombres quedan junto a las áreas; el selector Área muestra sus nombres completos. En Mapa completo, Ver agenda del salón aparece para el área que seleccione; no se elige el primer salón automáticamente. Al cambiar de nivel o ver todas las reservaciones se limpia esa selección. En los tres puntos del plano, Ocultar nombres de áreas despeja los títulos y Mostrar nombres de áreas los recupera. La elección se recuerda en este dispositivo y no borra nombres guardados. Ajustar aparece al ampliar. Elegir mesas conserva la selección; Guardar asignación confirma los cambios.", "En Reservaciones, Cotizaciones, Clientes y Usuarios, toque la tarjeta para consultar datos y abrir las acciones disponibles. Cerrar vuelve a la lista en su lugar. El botón + crea un registro. Los paneles se cierran con X, tocando fuera o deslizando su encabezado; cerrar un panel de opciones no guarda cambios ni limpia sus campos.", "En el listado de Reservaciones, cambie el día con la fecha visible, las flechas o Hoy. Fecha y filtros permite seleccionar rangos o todas las fechas. Opciones reúne importar, descargar, imprimir y seleccionar varios registros según permisos. Seleccionar activa las casillas; Terminar vuelve a las tarjetas normales. Los avisos de cotizaciones se abren desde su contador.", "Configuración muestra un selector de secciones y grupos desplegables. Abra solo el grupo que necesita; los campos conservan su borrador al cerrarlo. Guardar cambios aparece cuando hay cambios pendientes. Cambiar de sección mantiene la confirmación para descartar cambios.", "En Horarios, toque una casilla para abrir la asignación de ese empleado y fecha. Opciones de horarios reúne asignar, copiar y generar; imprimir o descargar tiene su propio panel. En Reportes, el selector reúne filtros y exportación, y tocar una fila muestra todas sus columnas.", "En teléfono, Reservas, Cotizaciones, Clientes y Más están abajo; en tablet grande pasan a la izquierda. Más abre el menú, también disponible deslizando desde el borde. Los formularios se abren desde abajo y mantienen la confirmación de cambios pendientes. Google regresa al modo app. La verificación de seguridad normalmente ocurre en segundo plano; si el proveedor exige interacción, se muestra para completar el acceso.", "App y web comparten cuenta, permisos y datos. La sesión se recuerda hasta 30 días sin actividad, sujeta al servicio; cerrar sesión, revocar el dispositivo o caducar el acceso exige ingresar otra vez. No se guarda la contraseña ni se opera sin conexión."], "detailsEn": ["To refresh a module, scroll to the top and pull down until Release to refresh appears. In the floor plan, pull from its heading; dragging the map keeps pan and zoom. The spinner remains during the data requests. Open forms and unsaved changes disable the gesture to preserve them. The UnoMesa logo appears from launch. Once access checks and initial loading finish, it leaves with gentle movement and a soft glow. Reduce Motion uses a subtle transition. Entering a module shows a spinner until its initial data and layout are ready; later refreshes preserve open forms and filters. Password, two-step verification and access revocation keep their checks.", "First launch offers Continue with Google or email. For email sign-in, enter your email and select Next; then enter your password and select Sign in. Back lets you change the email. Create account is at the bottom. On iOS, Google opens a secure account chooser and completes sign-in in the same app screen. Canceling lets you try again. Email registration has two short steps. New accounts receive one 10-day Advanced trial; the Free trial notice shows time left and Choose plan opens subscription management. Registering again never restarts the trial. Exempt accounts retain their status.", "The complete map opens first. Tap a table to reserve it or view its schedule. Details open from the bottom on phones and on the right on tablets, leaving room for the map. Expand or collapse the panel using its button or dragging its heading; X closes it. Within the schedule, tap a reservation to reveal details and actions. Edit reservation and More, containing quote and delete actions, appear according to permissions. List stays visible to return to reservations. Date arrows change the day; tapping the date opens filters; the three-dot menu holds view selection, printing/PDF and floor editing. Use two fingers to zoom or pan up to 12×, including on the web. Selecting a table or reservation centers its location without shrinking the canvas. Names stay beside their areas; the Area selector shows full names. Fit appears after zooming. Choose tables keeps the selection; Save assignment confirms changes. Use the floor options menu to Hide area names or Show area names. This preference is remembered on this device and never deletes saved names.", "In Reservations, Quotes, Customers and Users, tap a card to view details and available actions. Closing returns to the list in place. The + button creates a record. Close panels with X, by tapping outside or swiping their heading; closing an options panel does not save changes or clear its fields.", "In the reservation list, change the day using the visible date, arrows or Today. Date and filters lets you select ranges or all dates. Options groups importing, downloading, printing and bulk selection according to permissions. Select enables checkboxes; Done returns to normal cards. Quote reminders open from their count.", "Settings uses a section selector and expandable groups. Open the group you need; its fields retain their draft when collapsed. Save changes appears when edits are pending. Changing sections retains the confirmation to discard changes.", "In Schedules, tap a cell to open the assignment for that employee and date. Schedule options groups assignment, copying and generation; printing and downloading has its own panel. In Reports, the selector groups filters and export, and tapping a row shows every column.", "On phones, Reservations, Quotes, Customers and More sit at the bottom; large tablets use a left rail. More opens the menu, also available from an edge swipe. Forms open from below and keep unsaved-change confirmation. Google returns to app mode. Security verification normally runs in the background; if the provider requires interaction, the challenge is shown.", "App and web share the same account, permissions and data. Sessions last up to 30 days without activity, subject to service policy; signing out, device revocation or expiration requires sign-in again. Passwords are not stored and working offline is not supported."], "adminOnly": false},
{
 "tab":"reservations","title":"Eliminar una reserva desde el plano","titleEn":"Delete a reservation from the floor plan",
 "text":"Administrador y Gerente pueden enviar una reserva a la papelera desde el mapa o la agenda de una mesa.",
 "textEn":"Administrators and Managers can move a reservation to trash from the map or a table schedule.",
 "details":["Pulse Eliminar reserva junto a la reservación (en la app, dentro de Más) y revise la confirmación. Usa la misma papelera del listado; no elimina definitivamente el registro. Cancelar conserva la reserva.","Al confirmar, la reserva deja de aparecer en listado, agenda y plano, y sus mesas quedan disponibles si no hay otra reserva en ese horario. Si está vinculada a una cotización, se aplica el mismo proceso existente del listado y la cotización vuelve a Pendiente. Operador y Solo lectura no pueden eliminar."],
 "detailsEn":["Select Delete reservation next to the booking (inside More in the app) and review the confirmation. This uses the same trash flow as the list; it does not permanently delete the record. Cancel keeps the reservation.","After confirmation, the reservation leaves the list, schedule and map, and its tables become available unless another booking overlaps. A linked quote follows the existing list workflow and returns to Pending. Operations and Read-only users cannot delete."],"adminOnly":false
},
{
  "tab": "reservations",
  "title": "Armar el plano con guía paso a paso",
  "titleEn": "Build the floor plan with a step-by-step guide",
  "text": "Al entrar por primera vez a Editar plano, una guía te acompaña desde las áreas hasta guardar la distribución.",
  "textEn": "The first time you open Edit floor plan, a guide takes you from areas to saving the layout.",
  "details": [
    "1. Elige un área existente de Configuración o pulsa Agregar área. 2. Define Nivel del área; si hay otra planta, usa Agregar nivel en Mapa completo.",
    "3. Agrega mesas, elige nombre, capacidad, forma y tamaño, y arrástralas a su lugar. El contorno se ajusta al grupo. 4. En Mapa completo, acomoda las áreas en cada nivel. Activa Cambiar tamaño del área para ajustar su esquina.",
    "5. Revisa y pulsa Guardar plano y terminar. Después selecciona una mesa → Reservar esta mesa. Siguiente paso abre la vista correspondiente; Atrás permite revisar. Seguir sin guía cierra la ayuda y Guía paso a paso vuelve a abrirla. La guía recuerda que ya se mostró en este navegador; no guarda cambios del plano hasta confirmar. Solo Administrador y Gerente pueden editar."
  ],
  "detailsEn": [
    "1. Choose an existing area from Settings or select Add area. 2. Choose Area level; for another floor, use Add level in Complete map.",
    "3. Add tables, set names, capacity, shape and size, and drag them into place. The outline fits around the group. 4. In Complete map, arrange rooms on each floor. Enable Resize area to adjust a corner.",
    "5. Review and select Save floor plan and finish. Then select a table → Book this table. Next step opens the relevant view; Back lets you review. Continue without guide closes help and Step-by-step guide opens it again. The guide remembers being shown in this browser; layout changes are saved only when confirmed. Only Administrators and Managers can edit."
  ],
  "adminOnly": false
},
{
  "tab": "reservations",
  "title": "Sin mesa ni área y permisos del plano",
  "titleEn": "No table or area and floor plan permissions",
  "text": "Puede crear reservas y cotizaciones sin asignar ubicación. Solo Administrador y Gerente editan el plano.",
  "textEn": "Create reservations and quotes without assigning a location. Only Administrators and Managers edit the floor plan.",
  "details": [
    "Las reservas existentes con área y sin asignación de mesas se sincronizan como salón completo, incluso si todavía no se configuraron mesas. Se usa su hora y la duración predeterminada (180 minutos si no se cambió); no se reescriben registros. Las asignaciones individuales existentes y sus duraciones se conservan. Canceladas y sin área no bloquean; sin hora válida no se marca ocupación. Editar muestra la misma ubicación. Para quitarla use Sin mesa ni área.",
    "Los formularios nuevos empiezan en Sin mesa ni área. Complete cliente, fecha, invitados y los demás datos; puede guardar sin crear áreas ni mesas. En cotizaciones debe agregar al menos un producto o servicio.",
    "Para asignar ubicación después, edite el evento y elija un área y, si corresponde, sus mesas. Sin mesa ni área limpia ambas selecciones; Deseleccionar mesas conserva el área. Cerrar sin guardar conserva la asignación anterior. Reservar esta mesa y crear desde un evento vinculado mantienen el contexto elegido.",
    "Editar plano, configurar mesas, tamaños, posiciones y niveles corresponde únicamente a Administrador y Gerente. Operador puede gestionar reservas y sus asignaciones, sin cambiar el diseño. Solo lectura puede consultar e imprimir según sus permisos. El soporte temporal tampoco edita el diseño. La autorización de guardado se refuerza con 47_PERMISOS_EDITAR_PLANO.sql; no reescribe registros."
  ],
  "detailsEn": [
    "Existing reservations with an area and no table assignment sync as entire-room bookings, even before tables are configured. Their event time and the default duration (180 minutes unless changed) determine occupancy; records are not rewritten. Existing individual assignments and durations remain unchanged. Canceled reservations and those without an area do not block seats; no valid time means no assumed occupancy. Editing shows the same location. Use No table or area to remove it.",
    "New forms start with No table or area. Enter the customer, date, guests and other details; save without creating rooms or tables. Quotes still need at least one product or service.",
    "To assign a location later, edit the event and choose an area and tables if needed. No table or area clears both selections; Deselect tables keeps the area. Closing without saving preserves the previous assignment. Book this table and drafts from linked events keep the selected context.",
    "Only Administrators and Managers can edit the floor plan, tables, sizes, positions and levels. Operations users can manage reservations and seating assignments without changing the layout. Read-only users can view and print according to their permissions. Temporary support cannot edit the layout either. 47_PERMISOS_EDITAR_PLANO.sql enforces the save permission without rewriting records."
  ],
  "adminOnly": false
},
{
  "tab": "reservations",
  "title": "Mapa completo, niveles y duración predeterminada",
  "titleEn": "Complete map, levels and default duration",
  "text": "Abra Mapa completo para ver el restaurante por niveles y seleccione un área o una mesa para trabajar.",
  "textEn": "Open Complete map to see the restaurant by level, then select an area or table to work.",
  "details": [
    "Editar plano es el botón morado que aparece después de Nueva reservación. En Mesas por área, elija el área y cambie Nivel del área; Guardar plano confirma el traslado de sus mesas, conservando reservas y cotizaciones. El contorno del área se ajusta automáticamente alrededor de las mesas según su tamaño y giro, sin moverlas. También en Mapa completo y sus PDF: se eliminan márgenes vacíos para facilitar acomodar las áreas. Arrastre el cuadro visible para moverlo; si dos áreas siguen encima, reubíquelas y guarde. En Mapa completo, Agregar nivel permite crear segundo, tercer piso y hasta 10 niveles. Cambie el nombre del nivel y asigne cada área desde Nivel del área. Arrastre el cuadro del área para moverlo. Para cambiar el tamaño, active Cambiar tamaño del área y arrastre la esquina marcada; las flechas del teclado también funcionan. Fondo transparente permite superponer áreas sin tapar mesas; desactive Mostrar contorno para unirlas visualmente. Guardar plano confirma todos los cambios.",
    "Las áreas activas de Configuración → Reservaciones aparecen automáticamente en el plano, inicialmente sin mesas si aún no tienen distribución. No hace falta agregarlas otra vez. Seleccione el área → Configurar mesas y guarde cuando esté listo. Abrir el mapa no escribe datos; se conservan las mesas y posiciones existentes. Las áreas nuevas empiezan en el primer nivel. Configuración muestra las mesas y capacidad de cada área. Toque una mesa para editar nombre, capacidad, forma o tamaño; Agregar o editar mesas abre el mismo plano. Mover un salón a otro nivel conserva sus mesas, reservas y cotizaciones.",
    "Las mesas numeradas usan M1, M2… en español y T1, T2… en inglés. Cambiar el idioma solo cambia su etiqueta; los nombres personalizados y las asignaciones se conservan. La duración inicial es 180 minutos. Administradores y gerentes pueden cambiarla en Configuración, en el plano o en los formularios. Al salir del campo se guarda como predeterminada para nuevos eventos, también en otros dispositivos. Espere Guardada para nuevas reservas. Las reservas y propuestas ya guardadas conservan su duración; cambiar solo la preferencia no las reescribe. Operador puede modificar la duración de un evento, sin cambiar la preferencia compartida.",
    "El plano consulta disponibilidad en segundo plano sin desmontar la vista, perder el nivel ni cerrar una agenda. Las selecciones guardadas se actualizan al guardar una reserva o cotización; los cambios de mesas aún sin guardar se conservan. Los detalles de menú, anticipo y observaciones se cargan al abrir la reserva para evitar descargar esos textos en cada consulta de disponibilidad.",
    "Para permitir cruces de mesas confirmados, aplique 45_CRUCES_HORARIO_CONFIRMADOS.sql en el proyecto Supabase conectado a UnoMesa; no repita 43 y 44 si ya están instalados. SQL 45 solo actualiza funciones, sin cambiar tablas ni registros existentes. El mapa completo es por nivel; las áreas superpuestas se muestran tal como se acomodaron. La agenda del mapa completo reúne las reservas de todas las áreas y niveles, incluidas las sin mesa, finalizadas y canceladas. Permite buscar, filtrar por área, consultar detalles y cotizaciones, o ubicar las mesas de una reserva. Ver todas las reservaciones activa el día completo en ambas vistas: cada mesa muestra todas sus reservas ordenadas, con personas y hora, y los colores reúnen las reservas activas del día. Seleccionar otra hora vuelve al filtro por horario; no modifica la hora ni la duración guardadas de ningún evento. En la vista por horario se mantienen dos líneas y +N si hay más. p significa personas; ↶ indica el día anterior. Seleccione la mesa para ver la agenda completa. Los asientos adicionales se calculan con la capacidad habitual y se muestran por reserva; para varias mesas, el extra corresponde al grupo completo. El número en cada mesa indica sus reservas activas del día; los colores corresponden al horario elegido. Seleccionar una mesa en Mapa completo abre su agenda en el panel y conserva el nivel, zoom y posición. Puede reservar, vincular, editar y asignar mesas desde esa misma vista. Todas las reservaciones devuelve la agenda general y activa la vista del día completo; Mesas por área cambia la vista solo cuando lo elige. Ver agenda del salón se activa con otro color y al pulsarlo otra vez muestra todas las reservas. El mapa aprovecha el espacio disponible y ajusta todas las áreas del nivel a la vista normal, sin barras de desplazamiento. La agenda queda al lado cuando hay espacio; en pantallas estrechas aparece debajo. Al hacer zoom, arrastre para recorrer el mapa; 100% restablece la vista completa. Ampliar mapa aumenta su altura sin cambiar la agenda de lugar. Los nombres son etiquetas pequeñas de una línea junto al borde, fuera de las mesas. Nombres permite ocultarlos o mostrarlos sin cambiar el zoom ni mover el plano; la preferencia se recuerda en este navegador. Los nombres largos se abrevian solo en el dibujo: el nombre completo y la disponibilidad se consultan al seleccionar el área. En tablet o móvil, use dos dedos para acercar, alejar y recorrer el mapa; también funcionan +/− y Mover mapa. El gesto de dos dedos cancela el arrastre de un área o mesa sin cambiar su tamaño ni posición. Al redimensionar un área, sus mesas se adaptan a su ancho y alto. Fecha, Hora y Duración están justo debajo del mapa, tanto en Mapa completo como en Mesas por área. Se conservan al cambiar de vista. Al cambiar de fecha se conserva el plano mientras llegan las nuevas reservas."
  ],
  "detailsEn": [
    "Edit floor plan is the purple button after New reservation. In Tables by area, select the area and change Area level; Save floor plan confirms moving its tables, keeping reservations and quotes. The area outline automatically fits around the tables according to their size and rotation, without moving them. This also applies to Complete map and its PDFs: empty margins shrink so rooms are easier to arrange. Drag the visible room to move it; if rooms still overlap, reposition them and save. In Complete map, Add level creates a second or third floor, up to 10 levels. Rename the level and assign each area with Area level. Drag a room to move it. To resize, enable Resize area and drag the marked corner; arrow keys also work. Transparent background lets rooms overlap without hiding tables; turn off Show border to connect them visually. Save floor plan confirms all changes.",
    "Active areas in Settings → Reservations automatically appear on the floor plan, with no tables if a layout has not been created. No need to add them again. Select the area → Set up tables and save when ready. Opening the map does not write data; existing tables and positions are kept. New areas start on the first level. Settings shows each area’s tables and capacity. Select a table to edit name, capacity, shape or size; Add or edit tables opens the same floor plan. Moving a room to another level keeps its tables, reservations and quotes.",
    "Numbered tables use T1, T2… in English and M1, M2… in Spanish. Switching language changes only the label; custom names and assignments are kept. Initial duration is 180 minutes. Administrators and managers can change it in Settings, the floor plan or forms. Leaving the field saves the default for new events, including other devices. Wait for Saved for new reservations. Existing reservations and proposals keep their own duration; changing only the default does not rewrite them. Operators can change an event duration without changing the shared default.",
    "Availability refreshes in the background without unmounting the view, losing the level or closing a schedule. Automatic refresh pauses during layout or assignment edits. Menu, deposit and notes load when a reservation is opened, avoiding text downloads on every availability refresh.",
    "To allow confirmed table overlaps, apply 45_CRUCES_HORARIO_CONFIRMADOS.sql in the Supabase project connected to UnoMesa; do not rerun installed SQL 43 or 44. SQL 45 only updates functions, without changing tables or existing records. Complete map shows one level at a time; overlapping areas appear where you placed them. The complete map agenda includes all areas and levels, including unassigned, finished and canceled reservations. Search, filter by area, open details and quotes, or locate a reservation’s tables. View all reservations enables the full day in both views: each table shows all its reservations in order, with guests and time, and colors summarize active day bookings. Choosing another time returns to the time filter; saved event times and durations never change. The time-filtered view keeps two lines and +N for more. p means people; ↶ marks the previous day. Select the table for its full schedule. Added seats are calculated against usual capacity and shown per reservation; for multiple tables the extra belongs to the whole group. Each table badge counts active day reservations; colors reflect the selected time window. Selecting a table in Complete map opens its side schedule and keeps the level, zoom and position. Book, link, edit and assign tables in that same view. All reservations restores the general schedule and enables the full-day view; Tables by area switches views only when you choose it. View room schedule changes color when active; tap again to see all reservations. The map uses the available space and fits all rooms on the level into the normal view, without scrollbars. The schedule stays beside it when space allows, or below on narrow screens. After zooming in, drag to explore; 100% restores the full view. Expand map increases its height without moving the schedule. Area names are small, single-line edge labels placed outside tables. Names hides or shows them without changing zoom or moving the map; this browser remembers the preference. Long names are shortened only on the drawing: select the area for its full name and availability. On tablets and phones, use two fingers to zoom and pan; +/− and Pan map also work. Two fingers cancel any area or table drag without changing its size or position. Resizing an area scales its tables to its width and height. Date, Time and Duration sit directly below the map in both Complete map and Tables by area. They stay in sync when switching views. Changing the date keeps the map in place while new reservations load."
  ],
  "adminOnly": false
},
{
  "tab": "reservations",
  "title": "Agenda por mesa, salón reservado y nueva reservación",
  "titleEn": "Table schedule, full room and new reservation",
  "text": "Seleccione una mesa del plano para ver su agenda, crear una reserva o usar Vincular reservación para asignarle una reserva existente.",
  "textEn": "Select a table on the floor plan to view its schedule, create a booking or use Link reservation to assign an existing one.",
  "details": [
    "La agenda muestra cliente, teléfono, personas, mesas, hora de inicio y fin, estado, menú, anticipo y método de pago (si están visibles en el listado), y observaciones. Incluye eventos de la noche anterior que continúan ese día. Las finalizadas se conservan para consulta; las canceladas y papelera no ocupan mesas.",
    "Fecha, Desde y Duración definen la disponibilidad. Salón reservado completo identifica una reserva del área completa. Salón sin disponibilidad indica que ninguna mesa está libre durante todo el intervalo consultado, incluso si son reservas distintas. Cambie la hora para revisar otro turno.",
    "Para crear desde el plano, seleccione una mesa → Reservar esta mesa; o Reservar salón completo. Se abre el formulario habitual con la misma fecha, hora, área y mesa ya seleccionada; Plano y Lista conservan esa selección al cargar. Reservar salón completo precarga todo el salón. Complete cliente, personas y demás datos; revise la selección y guarde. Seleccionar la mesa por sí solo no crea una reserva. Vincular reservación permite elegir una reserva existente del día: revise las mesas y confirme con Guardar asignación. Si la reserva pertenecía a otra área, guardar reemplaza su selección; se conserva la misma reserva y su cotización.",
    "Un área sin mesas configuradas puede reservarse completa; agregue mesas después en Editar plano. El Área de arriba controla el mismo salón del plano y muestra las mesas seleccionadas, por ejemplo Salón principal - Mesa 1 + Mesa 2, tanto en reservaciones como en cotizaciones. Elija Mesas individuales o Salón completo; puede tocar las mesas en Plano o marcarlas en Lista y la selección se conserva al alternar. Salón completo reúne todas sus mesas; quitar una vuelve a mesas individuales. Los campos activados aparecen directamente en el formulario. El administrador elige cuáles mostrar desde Configuración → Reservaciones → Campos del formulario de reservación; ocultarlos conserva los valores guardados. Usar salón completo selecciona todas las mesas del área. El botón separado Deseleccionar mesas, en terracota, desmarca todas en Plano y Lista y desactiva Salón completo, conservando el área y la duración. Puede elegir otras mesas después; el cambio solo se aplica al guardar el evento. El cambio se confirma al guardar. Si se guarda el área sin mesas individuales, la reservación ocupa el salón completo. Para no bloquear ubicación, use Sin mesa ni área. Plano y Lista comparten las mismas marcas; el resumen conserva su espacio para que el formulario no salte. Se recuerda la última vista del formulario y de Reservaciones, incluido Mapa completo, en este navegador.",
    "En cada reserva del mapa completo, la lista lateral y la agenda están visibles Editar reserva y Ver cotización; si no tiene cotización, Crear cotización y Vincular cotización. Vincular abre el selector de cotizaciones existentes y confirma el mismo evento, conservando las mesas guardadas. Solo lectura puede consultar. La demo permite crear reservas ficticias desde el plano, pero no cotizaciones reales."
  ],
  "detailsEn": [
    "The schedule shows customer, phone, guests, tables, start and end times, status, menu, deposit and payment method (when visible in List), and notes. It includes reservations continuing from the previous night. Finished reservations remain for reference; canceled and trashed ones do not occupy tables.",
    "Date, From and Duration define availability. Entire room reserved identifies a whole-area booking. Room unavailable means no table stays free throughout the selected interval, even for separate reservations. Change the time to check another service.",
    "To create from the floor plan, select a table → Book this table; or Book entire room. The regular form opens with the same date, time, area and selected table; Map and List retain that selection after loading. Book entire room preselects the whole room. Complete customer, guests and other fields; review the selection and save. Selecting a table alone does not create a reservation. Link reservation lets you choose an existing day booking: review the tables and confirm with Save assignment. If it belonged to another area, saving replaces its selection; the reservation and quote stay linked.",
    "An area without configured tables can be used to save events without seating; add its tables later in Edit floor plan. The Area above controls the same room as the floor plan and shows selected tables, such as Main room - Table 1 + Table 2, in both reservations and quotes. Choose Individual tables or Entire room; tap tables in Map or check them in List and the selection stays the same when switching views. Entire room includes all its tables; removing one switches to individual tables. Enabled fields appear directly in the form. The administrator chooses what to show under Settings → Reservations → Reservation form fields; hiding them keeps saved values. Use entire room selects all tables in the area. The separate terracotta Deselect tables button clears both Map and List and turns off Entire room, keeping the area and duration. You can select other tables afterward; changes apply only when you save the event. Save confirms the change. Without configured tables, the event keeps its area without seating. Map and List share the same selected tables; the summary keeps its space so the form does not jump. This browser remembers the last form and Reservations view, including Complete map.",
    "Every reservation in the complete map, side list and schedule shows Edit reservation and View quote; without a quote, Create quote and Link quote are visible. Link quote opens the existing quote picker and confirms the same event, keeping its saved tables. Read-only can consult. The demo creates sample reservations from the floor plan but no real quotes."
  ],
  "adminOnly": false
},
{
  "tab": "quotes",
  "title": "Cotizaciones conectadas con mesas y salón completo",
  "titleEn": "Quotes connected to tables and whole rooms",
  "text": "Propuesta de mesas guarda los lugares previstos en una cotización. La disponibilidad se confirma al convertirla o vincularla a una reservación.",
  "textEn": "Proposed tables saves the intended seating in a quote. Availability is confirmed when converting or linking it to a reservation.",
  "details": [
    "En una cotización nueva o sin reserva vinculada, seleccione una o varias mesas o el área completa, y duración. La propuesta no bloquea lugares; puede coincidir con otras cotizaciones o reservas. El formulario lo avisa y la disponibilidad se valida al confirmar.",
    "Convertir en reservación lleva las mesas propuestas a la nueva reserva y comprueba el horario y la capacidad. Si alguna mesa está ocupada, puede elegir Revisar o Guardar de todos modos. Con SQL 45, confirmar permite el cruce y conserva ambas reservas; Revisar cancela la conversión completa. No se crea una reserva incompleta.",
    "Vincular con una reservación existente conserva las mesas que ya tenía esa reserva. Si aún no tenía mesas, intenta asignarle la propuesta de la cotización usando la fecha, hora y personas de la reserva. Un cruce requiere Guardar de todos modos y SQL 45. Con SQL 46, puede confirmar asientos adicionales para ese vínculo; no se cambia la capacidad habitual de las mesas.",
    "Para una cotización ya vinculada, la sección muestra Mesas de la reservación. Guardar comprueba y actualiza esas mesas dentro de la misma operación de guardado de la cotización. Desde la agenda del plano use Ver cotización; si no tiene una, Crear cotización abre el formulario vinculado a esa reserva.",
    "Estas funciones están disponibles en UnoMesa funcional y requieren las ampliaciones 43 y 44; los cruces confirmados requieren además 45 y los asientos adicionales requieren 46. No repita los SQL ya instalados. La vista de ejemplo del plano no escribe cotizaciones ni datos reales."
  ],
  "detailsEn": [
    "For a new or unlinked quote, choose one or more tables or an entire area, plus duration. The proposal does not block seats; it may overlap other quotes or reservations. The form warns about this, and availability is checked on confirmation.",
    "Convert to reservation transfers the proposed tables to the new reservation and checks time and capacity. For booked tables, choose Review or Save anyway. With SQL 45, confirmation allows the overlap and keeps both reservations; Review cancels the entire conversion. No incomplete reservation is created.",
    "Linking to an existing reservation preserves that reservation’s own tables. If it has none, the quote proposal is assigned using the reservation date, time and guests. An overlap requires Save anyway and SQL 45. With SQL 46, confirm added seats for that link; usual table capacities stay unchanged.",
    "For a linked quote, the section shows Reservation tables. Saving checks and updates those tables in the same transaction as the quote. In the floor-plan schedule choose View quote; if none is linked, Create quote opens the form for that reservation.",
    "These features are available in UnoMesa funcional and require extensions 43 and 44; confirmed overlaps also require 45 and added seats require 46. Do not rerun installed SQL files. Floor-plan sample mode does not write quotes or real data."
  ],
  "adminOnly": false
},
{
  "tab": "reservations",
  "title": "Plano de mesas: prueba, áreas y distribución",
  "titleEn": "Floor plan: demo, areas and layout",
  "text": "Reservaciones → Plano de mesas muestra una vista opcional del salón. El Listado conserva las funciones anteriores.",
  "textEn": "Reservations → Floor plan shows an optional dining-room view. List keeps the existing features.",
  "details": [
    "Puede usar Probar con datos de ejemplo antes de activar el guardado. La franja Vista de prueba identifica datos ficticios; los cambios se pierden al salir y nunca se guardan en su restaurante. Volver a mis datos vuelve a consultar sus registros.",
    "Para guardar entre computadoras, el administrador debe aplicar 43_PLANO_MESAS.sql y después 44_PLANO_FORMULARIOS_COTIZACIONES.sql, en el mismo proyecto Supabase de UnoMesa. Añada 45_CRUCES_HORARIO_CONFIRMADOS.sql para cruces confirmados y 46_ASIENTOS_ADICIONALES.sql para asientos adicionales. Ejecute solo los archivos pendientes, en ese orden. 43 y 44 añaden tablas y funciones separadas; 45 y 46 actualizan funciones. Al instalarlos no se reescriben clientes, cotizaciones ni reservaciones. No sustituye la instalación existente. Sin estas ampliaciones la aplicación muestra la opción de prueba.",
    "Administrador y Gerente: Crear mi plano o Editar plano → área del restaurante → agregar mesas → Guardar plano. Agregar área permite crear un salón desde el plano y guardarlo de inmediato en Configuración y en los formularios, o elegir uno existente sin duplicarlo. Guardar plano confirma la distribución; cancelar su diseño conserva el área del catálogo. En planos antiguos con otro nombre, elija una vez el Área del restaurante correspondiente. Arrastre las mesas; cambie capacidad, forma, orientación y Tamaño de mesa (40–100%). El tamaño visual no cambia su capacidad.",
    "El plano admite hasta 20 áreas y 200 mesas. Las nuevas asignaciones guardan el área compartida junto con las mesas; abrir el plano o cambiar su diseño no reescribe eventos anteriores. Una mesa o área con asignaciones guardadas no puede eliminarse; quite antes esas asignaciones. En móvil, desplace el plano horizontalmente y use el panel debajo.",
    "Ocultar menú / Mostrar menú amplía el espacio sin salir de la vista. Recuerda la preferencia en este navegador, separada entre móvil y pantallas grandes. En móvil el menú se abre encima del contenido. El módulo está disponible con Reservaciones en todos los planes. Operador puede asignar mesas; no editar el diseño. Solo lectura puede consultar, imprimir y descargar PDF. Los permisos y la suscripción se verifican otra vez al guardar."
  ],
  "detailsEn": [
    "Use Try sample data before activating saved layouts. The Demo view banner identifies sample records; changes are lost on exit and never saved to your restaurant. Back to my data reloads your records.",
    "To save across computers, the administrator must apply 43_PLANO_MESAS.sql followed by 44_PLANO_FORMULARIOS_COTIZACIONES.sql, in the same Supabase project used by UnoMesa. Add 45_CRUCES_HORARIO_CONFIRMADOS.sql for confirmed overlaps and 46_ASIENTOS_ADICIONALES.sql for added seats. Run only missing files, in that order. 43 and 44 add separate tables and functions; 45 and 46 update functions. Installation does not rewrite customers, quotes or reservations. It does not replace the existing installation. Without these extensions, the application offers the demo.",
    "Administrator and Manager: Create my floor plan or Edit floor plan → restaurant area → add tables → Save floor plan. Add area creates a room directly from the floor plan and immediately saves it in Settings and forms, or reuses an existing one without duplication. Save floor plan confirms the layout; canceling the design keeps the catalog area. For older layouts with another name, choose the matching Restaurant area once. Drag tables and change capacity, shape, rotation and Table size (40–100%). Visual size does not change capacity.",
    "The plan supports up to 20 areas and 200 tables. New assignments save the shared area together with tables; opening or designing the plan does not rewrite earlier events. A table or area with saved assignments cannot be deleted; remove those assignments first. In the app, use two fingers to zoom or pan; tap a table to open its contextual panel.",
    "Hide menu / Show menu expands the workspace without leaving the view. This browser remembers the choice separately for mobile and larger screens. On mobile the menu opens over the content. The view is available with Reservations on every plan. Operator can assign tables but cannot edit the design. Read-only can view, print and download PDF. Permissions and subscription are checked again when saving."
  ],
  "adminOnly": false
},
{
  "tab": "reservations",
  "title": "Asignar mesas, reservar un área completa y liberar lugares",
  "titleEn": "Assign tables, reserve an entire area and release seats",
  "text": "En Plano de mesas, elija la fecha y una reservación del panel para seleccionar una o varias mesas.",
  "textEn": "In Floor plan, choose a date and a reservation in the panel to select one or more tables.",
  "details": [
    "La lista muestra reservas activas del día, sus personas y si tienen mesa. Busque por cliente, teléfono o área, o active Solo sin mesa. Las canceladas y las de papelera no ocupan mesas. Una reserva sin hora debe editarse primero en el Listado.",
    "Elija la reservación, revise su hora, indique Duración estimada entre 15 y 1,440 minutos y seleccione mesas. Si el grupo supera la capacidad, SQL 46 permite confirmar asientos adicionales para esa reserva. Guardar asignación confirma las mesas; seleccionar o cambiar de área todavía no guarda. Si una mesa está ocupada, puede elegir Revisar o Guardar de todos modos. La confirmación permite el cruce horario; se siguen comprobando capacidad, permisos y cambios recientes.",
    "Reservar esta área completa bloquea todas las mesas de esa área durante el evento, incluidas las mesas que se agreguen después. El área necesita al menos una mesa. Al guardar se actualiza también el Área de esa reserva. Cada selección usa un solo salón; elegir una mesa de otro salón reemplaza las mesas anteriores al guardar. Cambiar la pestaña del salón sin elegir otra mesa solo permite consultar.",
    "Los estados del salón son Reservada, En mesa y Finalizada. Finalizada libera las mesas al guardar y conserva la asignación para consulta; no cambia el estado comercial, cobros o importes de la reservación. Quitar asignación pide confirmación y conserva la reservación.",
    "Solo las asignaciones guardadas bloquean lugares. Las reservas antiguas empiezan sin mesa y deben asignarse; una mesa disponible no demuestra que todas las reservas del restaurante ya estén acomodadas. No incluye pedidos, POS, cobros por mesa, mensajes ni lista de espera."
  ],
  "detailsEn": [
    "The list shows active reservations for the day, guests and table assignments. Search by customer, phone or area, or enable Unassigned only. Canceled and trashed reservations do not occupy tables. Edit a reservation without an event time in List first.",
    "Select a reservation, check its time, enter an Estimated duration from 15 to 1,440 minutes and select tables. If the party exceeds usual capacity, SQL 46 lets you confirm added seats for that reservation. Save assignment confirms tables; selecting or switching areas alone does not save. For booked tables, choose Review or Save anyway. Confirmation permits the time overlap; capacity, permissions and recent-change checks still apply.",
    "Reserve this entire area blocks every table in that area during the event, including tables added later. The area needs at least one table. Saving also updates that reservation’s Area. Each selection uses one room; choosing a table in another room replaces the previous tables when saved. Switching room tabs without choosing a different table only changes the view.",
    "Dining-room statuses are Reserved, Seated and Finished. Saving Finished releases tables while keeping the assignment for reference; it does not change the reservation business status, payments or amounts. Remove assignment asks for confirmation and keeps the reservation.",
    "Only saved assignments block seats. Existing reservations begin unassigned and need table assignments; an available table does not mean every reservation has been seated. This feature does not include orders, POS, table billing, messages or a waitlist."
  ],
  "adminOnly": false
},
{
  "tab": "reservations",
  "title": "Disponibilidad del plano, cruces de horario e impresión",
  "titleEn": "Floor-plan availability, time conflicts and printing",
  "text": "Fecha, Desde y Duración definen el intervalo consultado; al seleccionar una reserva se usa su hora y duración.",
  "textEn": "Date, From and Duration define the requested interval; selecting a reservation uses its time and duration.",
  "details": [
    "Verde significa Disponible; azul intenso con texto blanco, Reservada; naranja, En mesa; rojo, Revisar. La disponibilidad es para todo el intervalo elegido e incluye cruces de medianoche hasta 24 horas. El fin de una asignación puede coincidir con el inicio de otra. No es seguimiento automático de presencia física.",
    "Las horas de eventos se usan tal como están guardadas; no se convierten por la zona horaria de la computadora ni por el país. Hoy sí se determina con la fecha del dispositivo. Use Fecha para elegir el día del restaurante si está en otra zona.",
    "Guardar comprueba cruces y capacidad en la base de datos. Con SQL 45, Guardar de todos modos permite un cruce explícitamente confirmado y conserva ambas reservas; Revisar mantiene el borrador. Capacidad, permisos y cambios recientes siguen validándose. Si otra pantalla cambió la asignación o el plano, aparece un aviso para Actualizar; el borrador no se sobrescribe silenciosamente. Actualizar pide descartar cambios pendientes.",
    "Con la integración 44 activa, el formulario guarda reservación y mesas juntas: un cruce o asientos adicionales sin confirmar cancelan todo el guardado. SQL 45 permite confirmar el cruce horario; SQL 46 añade una confirmación separada para asientos adicionales. También se comprueban las mesas de la reserva vinculada al guardar su cotización. Si una edición externa o una versión anterior cambia el evento, puede aparecer Revisar; actualice la asignación. Una reserva con mesas necesita hora. Quitar asignación en el panel del plano libera las mesas y conserva el evento.",
    "La disponibilidad se actualiza cada 30 segundos en segundo plano mientras está visible y no se edita diseño o asignación; conserva el nivel, el desplazamiento y la agenda. Actualizar consulta de inmediato. No se muestra disponibilidad parcial si falla la consulta o hay más de 2,000 reservas entre el día anterior, el seleccionado y el siguiente.",
    "Más opciones → Imprimir o Descargar PDF permite Solo plano, Plano y reservaciones, Solo reservaciones o Reservaciones con datos completos. Áreas y niveles permite Mapa completo (una página por nivel), Un nivel o el área/nivel que estaba viendo, siempre sin recorte del zoom. La lista permite todas las áreas o las del plano, e incluir canceladas. Incluye eventos que continúan del día anterior. Los datos completos añaden menú, anticipo y método si están habilitados, vínculo con cotización y observaciones. Cierre el editor o una asignación pendiente antes de imprimir. Descargar PDF crea un archivo A4 horizontal. PDF listo deja los enlaces Descargar archivo y Abrir PDF si el navegador no inicia la descarga. En iPhone/iPad puede abrirse en el visor para guardar o compartir; los datos ficticios se identifican como DEMO."
  ],
  "detailsEn": [
    "Green means Available; strong blue with white text, Reserved; orange, Seated; red, Review. Availability covers the entire selected interval, including midnight crossings up to 24 hours. One assignment can end exactly when another begins. This is not automatic tracking of physical occupancy.",
    "Event times are used as saved; they are not converted by the computer timezone or country. Today does use the device date. Use Date to select the restaurant day if you are in another timezone.",
    "Saving checks capacity and time conflicts in the database. With SQL 45, Save anyway allows an explicitly confirmed overlap and keeps both reservations; Review preserves the draft. Capacity, permissions and recent-change checks still apply. If another screen changes the assignment or floor plan, a Refresh notice appears; drafts are not silently overwritten. Refresh asks to discard pending changes.",
    "With integration 44 active, the form saves reservation and tables together: an unconfirmed overlap or added seats cancel the entire save. SQL 45 permits confirmed time overlaps; SQL 46 adds a separate added-seat confirmation. Saving a linked quote also checks its reservation tables. An external edit or older version may cause Review; update the assignment. A reservation with tables needs an event time. Remove assignment in the map panel frees tables and keeps the event.",
    "Availability refreshes every 30 seconds in the background while visible and no layout or assignment is being edited; it keeps the level, scroll and schedule. Refresh queries immediately. Partial availability is not displayed after a failed query or when more than 2,000 reservations span the previous, selected and next day.",
    "More options → Print or Download PDF offers Map only, Map and reservations, Reservations only or Reservations with full details. Rooms and floors offers Complete map (one page per floor), One floor or the area/floor you were viewing, always without the zoom crop. Choose all areas or visible map areas, and whether to include canceled bookings. Overnight events are included. Full details add menu, deposit and method when enabled, quote link status and notes. Close the editor or pending assignment before printing. Download PDF creates an A4 landscape file. PDF ready keeps Download file and Open PDF links available if the browser does not start the download. On iPhone/iPad it may open in the viewer to save or share; sample data is marked DEMO."
  ],
  "adminOnly": false
},
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
{"tab": "settings", "title": "Cambio seguro del correo de acceso", "titleEn": "Secure login email change", "text": "Configuración → Cuenta permite cambiar el correo mediante códigos en ambas direcciones.", "textEn": "Settings → Account lets you change your email using codes sent to both addresses.", "details": ["Escriba el correo nuevo dos veces y pulse Enviar códigos. Debe haber ingresado con contraseña y completado la verificación en dos pasos si la tiene activada.", "Recibirá un código en el correo actual para autorizar el cambio y otro en el nuevo para comprobar que también es suyo. Escriba ambos códigos dentro de la misma sesión de UnoMesa que los solicitó. No hay enlaces para confirmar. Una persona que reciba por error el código del correo nuevo no puede completar el cambio por sí sola.", "Los códigos duran 10 minutos, tienen hasta cinco intentos y solo sirven para esa solicitud. Solicitar códigos nuevos invalida los anteriores; espere al menos un minuto entre envíos. Cancelar cambio conserva el correo actual. Si inició otra solicitud desde otra sesión, solo la más reciente es válida.", "Mientras está pendiente se mantiene el correo anterior. Actualizar estado recupera una solicitud pendiente de esta sesión o comprueba el resultado si perdió conexión. Después de confirmar se mantiene su usuario, sus permisos y los datos del restaurante, y se cierran sus demás sesiones. Use el correo nuevo en el próximo ingreso.", "Se intenta avisar al correo anterior cuando el cambio se completa; un fallo de ese aviso no revierte un cambio completado. Si no tiene acceso al correo anterior, contacte a support@unomesa.com para verificar su identidad. Soporte temporal no puede cambiar el correo de otro usuario."], "detailsEn": ["Enter the new email twice and select Send codes. You must have signed in with a password and completed two-step verification if enabled.", "One code arrives at your current email to authorize the change, and another at your new email to prove that you control it too. Enter both codes in the same UnoMesa session that requested them. There are no confirmation links. Someone who receives the new-email code by mistake cannot complete the change alone.", "Codes expire after 10 minutes, allow up to five attempts and work only for that request. Request new codes invalidates earlier codes; wait at least one minute between sends. Cancel change keeps your current email. If you start a new request in another session, only the latest request is valid.", "Your previous email stays active while the change is pending. Refresh status restores this session’s pending request or checks the result after a lost connection. Confirming preserves your user, permissions and restaurant data, and closes your other sessions. Use the new email for your next sign-in.", "An email notification is attempted to the previous address on completion; delivery failure does not undo a completed change. If you cannot access your previous email, contact support@unomesa.com for identity verification. Temporary support cannot change another user’s email."], "adminOnly": false},
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
    "Seleccione la distribución y escala antes de pulsar Imprimir o Descargar PDF. Ambos usan el mismo formato A4 horizontal. Cambiar el zoom del visor o la escala del diálogo después de generar un PDF solo reduce sus páginas; no reúne áreas. Para reorganizar, vuelva a UnoMesa y genere nuevamente.",
    "Las fechas se repiten al continuar tablas, los colores cubren las casillas y las observaciones siguen al pie de cada hoja. Los intervalos largos conservan bloques de hasta 14 días. Solo cambia la presentación; no se modifican turnos ni registros guardados."
  ],
  "detailsEn": [
    "Continuous places areas below one another with a small gap and uses available page space. Page per area starts each area and date block on a fresh page; large areas may span multiple pages.",
    "Print scale offers 70%, 80%, 90%, 100%, 110% and 120%. Smaller scales reduce text, padding and row height; the document recalculates page breaks and moves content up. Choose a readable scale.",
    "Choose layout and scale before Print or Download PDF. Both use the same A4 landscape layout. Changing viewer zoom or print-dialog scale after a PDF is generated only shrinks its pages; it does not combine areas. Return to UnoMesa and generate again to repaginate.",
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
    "Se muestran usuario, correo, navegador, sistema operativo aproximado, última actividad registrada y Esta sesión. Buscar filtra nombre, correo o dispositivo. Hay 50 resultados por página. Actualizar vuelve a consultar la lista; una sesión abierta no garantiza que la persona esté conectada en ese instante. Solo aparecen sesiones que todavía tienen acceso. La lista se actualiza cada minuto. En navegador, tras una hora sin actividad la sesión caduca. En la app, el acceso puede recordarse hasta 30 días, sujeto a las políticas del servicio. Revocar o cerrar sesión mantiene su efecto inmediato en las consultas del servidor. Cerrar una pestaña sin cerrar sesión puede dejarla visible hasta que venza ese plazo; las sesiones vencidas no se acumulan al volver a ingresar.",
    "Cerrar sesión requiere confirmación. Cerrar mis demás sesiones conserva la actual y solo afecta a las suyas. El administrador principal también puede cerrar una sesión de un invitado de su restaurante. La sesión se cierra para esa cuenta en ese navegador, incluso si la misma sesión accede a otro restaurante. No da acceso a los datos de esos otros restaurantes.",
    "Las nuevas consultas y cambios se rechazan en el servidor al revocar. La pantalla abierta detecta el cierre al volver a ella o en la siguiente comprobación, aproximadamente un minuto; no puede retirar información ya vista o descargada. Puede volver a ingresar con contraseña y, si corresponde, código por email. Un administrador que quiera retirar acceso permanente debe desactivar al invitado en Usuarios.",
    "Los dispositivos se identifican por la sesión del navegador, no por número de serie. Varias pestañas pueden compartir sesión. Nunca se muestran contraseñas ni tokens. Los invitados no pueden ver ni cerrar sesiones de otros usuarios; soporte temporal tampoco obtiene ese permiso."
  ],
  "detailsEn": [
    "The primary administrator opens Settings → Security → Active sessions. My sessions shows their own access; Restaurant team shows active invited users. Each invited user finds their own sessions alongside Two-step verification in Settings.",
    "The list shows user, email, approximate browser and operating system, last recorded activity and This session. Search filters name, email or device. Results use 50-row pages. Refresh reloads the list; an open session does not prove the user is online right now. Only sessions that still have access are listed. The list refreshes every minute. After one hour without activity in UnoMesa, the session expires and you must sign in again. Closing a tab without signing out may leave it visible until that deadline; expired sessions do not accumulate when signing in again.",
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
  "text": "Configuración → Soporte permite autorizar al equipo de soporte de UnoMesa por 24 horas sin consumir usuarios del plan.",
  "textEn": "Settings → Support lets you authorize the UnoMesa support team for 24 hours without using a plan seat.",
  "details": [
    "Solo un administrador del restaurante puede autorizar o revocar. Describa el problema y elija Solo lectura o Ver y editar. Si ya existe una solicitud activa para este restaurante, revóquela primero. Puede haber solicitudes de distintos restaurantes al mismo tiempo.",
    "Solo lectura permite revisar los datos. Ver y editar permite corregir clientes, cotizaciones, reservaciones, horarios y configuración operativa. Soporte no administra usuarios, pagos, propiedad, eliminación de la cuenta ni vaciado de la papelera. Los permisos y módulos del plan siguen aplicando.",
    "El permiso vence automáticamente a las 24 horas. Revocar acceso bloquea nuevas consultas y cambios; una pantalla abierta se cierra al verificar de nuevo, como máximo cada 15 segundos mientras está activa. Los datos ya vistos o descargados no se pueden retirar.",
    "Se envía un correo de aviso a support@unomesa.com con el restaurante, el problema, permiso, vencimiento y enlace. El enlace identifica la solicitud, pero requiere la cuenta de soporte autorizada y contraseña más código por email. Si el aviso falla, la autorización sigue visible y puede reintentar el correo.",
    "La cuenta de soporte entra a su listado de solicitudes. Un enlace abre la solicitud específica después de iniciar sesión. Dentro del restaurante aparece un aviso con su nombre y un botón Volver a solicitudes; guarde los cambios antes de cambiar.",
    "Las autorizaciones, revocaciones, entradas y cambios se registran en Configuración → Seguridad. El cliente puede consultar allí el historial. Nunca comparta contraseñas ni códigos con soporte."
  ],
  "detailsEn": [
    "Only a restaurant administrator can authorize or revoke access. Describe the issue and choose View only or View and edit. Revoke an existing active request for this restaurant first. Requests from different restaurants can coexist.",
    "View only allows reviewing data. View and edit allows corrections to customers, quotes, reservations, schedules and operational settings. Support cannot manage users, payments, ownership, account deletion or emptying the trash. Plan permissions and modules still apply.",
    "Permission expires automatically after 24 hours. Revocation blocks new queries and changes; an open screen closes when rechecked, at most every 15 seconds while active. Data already viewed or downloaded cannot be withdrawn.",
    "An email to support@unomesa.com contains the restaurant, issue, permission, expiration and link. The link identifies the request but requires the authorized support account, password and email code. If notification fails, the authorization stays visible and you can retry sending the email.",
    "The support account opens its request list. A request link opens the specific request after sign-in. A visible banner identifies the restaurant and provides Back to requests; save changes before switching.",
    "Authorizations, revocations, entries and changes are recorded in Settings → Security. The customer can review history there. Never share passwords or security codes with support."
  ],
  "adminOnly": true
},
  {
    "tab": null,
    "title": "Buscar y navegar historiales grandes",
    "titleEn": "Search and browse large histories",
    "text": "Cotizaciones muestra 25 registros por página; Clientes y Reservaciones, hasta 50. Seguridad muestra 10 cambios o eliminaciones por página.",
    "textEn": "Quotes shows 25 records per page; Customers and Reservations show up to 50. Security shows 10 changes or deleted records per page.",
    "details": [
      "Use Anterior y Siguiente para recorrer los resultados. Cambiar búsqueda, fechas u orden vuelve a la primera página. Los listados no calculan un total de todo el historial en cada página, para responder más rápido. Seleccionar esta página solo selecciona sus registros visibles.",
      "En Reservaciones, Todas muestra totales de la página visible. Elija un día o un período para calcular personas, anticipos y reservaciones de ese filtro. La impresión y Excel siguen usando los filtros, dentro de sus límites de descarga.",
      "Los avisos de cotizaciones también tienen páginas de 25 registros; avance para consultar los demás. Las opciones de ordenar por evento, número o creación se aplican antes de dividir las páginas.",
      "Si otros miembros cambian registros mientras navega, los resultados pueden variar. Vuelva a la primera página o cambie el filtro para actualizar el recorrido. Buscar o avanzar de página no cambia los datos guardados. Los catálogos incluyen registros más allá de los primeros 1,000; si una lectura supera 10,000 filas o 20 MB, aparece un error en vez de una lista incompleta."
    ],
    "detailsEn": [
      "Use Previous and Next to browse results. Changing search, dates or sorting returns to the first page. Lists do not recount the entire history on every page, which improves response times. Select this page selects only visible records.",
      "In Reservations, All shows totals for the visible page. Choose a day or date range to calculate people, deposits and reservations for that filter. Print and Excel still use the filters, within their download limits.",
      "Quote reminders also use 25-row pages; move to the next page to view more. Event date, number and creation-date sorting apply before dividing results into pages.",
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
    "Los catálogos se guardan para todo el restaurante. La preferencia de posponer se conserva solo en ese navegador y usuario. No hay un límite de cinco minutos: es una guía breve para comenzar.",
    "También está disponible para registros con Google: use Inicio rápido en el dashboard o Ayuda → Inicio rápido. Puede completar los datos del restaurante después en Configuración → General."
  ],
  "detailsEn": [
    "On Intermediate and Advanced, enter an employee area, the first employee’s name and an initial shift with start and end times. An employee record does not create a login, invite anyone or use a user seat. Basic skips this step because it does not include schedules.",
    "Create an event area for quotes and reservations, separate from the employee area. Add a menu item or service name, optional description and unit price in the restaurant currency.",
    "Next does not save yet. Review and select Save and start: setup is saved as one operation. Active records with matching names are reused without overwriting their data. Retrying after a connection loss does not duplicate completed setup.",
    "After saving, choose Create quote, Create reservation or Assign a schedule according to your plan. Quotes prefill the initial area and product; reservations prefill the area. Review quantities and prices and complete the customer, date and remaining fields before saving the event. No fictitious events or assignments are created automatically.",
    "Later closes quick setup. If you entered unsaved data, confirm whether to discard it. Return through Help → Quick setup. Completed setup shows the shortcuts; use Settings to add or change catalogs.",
    "Catalogs are saved for the entire restaurant. The postpone preference applies only to that browser and user. There is no five-minute time limit; this is a short guide to getting started.",
    "It is also available for Google registrations: use Quick setup on the dashboard or Help → Quick setup. Complete restaurant details later in Settings → General."
  ],
  "adminOnly": true
},
  {
  "tab": null,
  "title": "Ayuda: instructivo, tutorial y Asistente UnoMesa",
  "titleEn": "Help: guide, tutorial and UnoMesa Assistant",
  "text": "Abra Ayuda en el menú lateral cuando necesite orientación.",
  "textEn": "Open Help in the sidebar whenever you need guidance.",
  "details": [
    "Ayuda reúne Inicio rápido (administrador), Instructivo con buscador, Tutorial guiado, Asistente UnoMesa, consejos, soporte y sugerencias. Abra o cierre esta sección para ahorrar espacio.",
    "Tutorial es un recorrido breve de hasta 7 pasos, adaptado al plan y rol. Instructivo permite buscar y filtrar por módulo; abra solo el tema que necesita. Ambos se abren cuando usted lo elige.",
    "El Asistente UnoMesa explica las funciones disponibles según su plan y rol; no ve ni modifica los datos de su restaurante. El instructivo y tutorial no consumen consultas de IA."
  ],
  "detailsEn": [
    "Help groups Quick setup (administrator), the searchable Guide, guided Tutorial, UnoMesa Assistant, tips, support and suggestions. Expand or collapse it to save space.",
    "Tutorial is a short tour of up to 7 steps, adapted to your plan and role. Guide lets you search and filter by module; open only the topic you need. Both open when you choose.",
    "UnoMesa Assistant explains features according to your plan and role; it cannot see or change restaurant data. Guide and tutorial use no AI questions."
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
      "Use hasta 1,000 caracteres y 12 líneas impresas. Si el texto excede el espacio permitido, UnoMesa pide reducirlo; no lo corta silenciosamente."
    ],
    "detailsEn": [
      "Enter general team instructions before downloading the PDF or printing. They repeat in full at the bottom of every page, including separate areas, date ranges and employee overflow pages.",
      "Observations have reserved space below the table, separate from the page number. The document remains landscape A4 with light cell colors and up to 14 dates per block. Individual employee notes remain in their cells.",
      "They remain a draft for that restaurant in the current browser tab; they are not shared with other users or saved as employee notes. Review the draft before each print. Leave the field empty to omit observations; Excel does not include this footer.",
      "Use up to 1,000 characters and 12 printed lines. If the text exceeds the allowed space, UnoMesa asks you to shorten it rather than silently cutting it off."
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
    "Cambiar el formato no cambia las horas guardadas ni la zona horaria: 19:00 y 07:00 PM representan la misma hora. General y Horarios muestran la misma preferencia para todo el restaurante. Pulse Guardar configuración para aplicarla al equipo; Agregar turno guarda el turno, no esa preferencia. Descartar cambios conserva el formato anterior.",
    "Reportes usa el mismo formato de hora. La hora de creación y los cálculos que dependen de hoy usan la zona horaria del dispositivo; el país del restaurante no cambia esa zona."
  ],
  "detailsEn": [
    "Choose 12 hours (AM/PM) or 24 hours. This is a restaurant-wide preference shared by invited users. The default remains 24 hours. Other roles can ask the administrator to change it.",
    "In time fields for reservations, quotes, shifts and meal start and end, select hours and minutes. With 12-hour time also select AM or PM; with 24-hour time select 00 through 23. Clear time leaves the field empty. 12:00 AM is midnight (00:00); 12:00 PM is noon (12:00). Shifts require both Start and End to contain a time or text.",
    "The same format applies to lists, overlap alerts, quote previews and PDFs, reservation printing and Excel exports, and the schedule calendar, shift selector, meals, PDF, printing and Excel. Free text remains as entered. The reservation import template shows the chosen format and imports accept both formats.",
    "Changing the format does not change stored times or the time zone: 19:00 and 07:00 PM represent the same time. General and Schedules show the same restaurant-wide preference. Select Save settings to apply it to the team; Add shift saves the shift, not this preference. Discarding changes preserves the previous format.",
    "Reports uses the same hour format. Creation timestamps and calculations based on today use the device time zone; the restaurant country does not change that zone."
  ],
  "adminOnly": false
},
  {
  "tab": null,
  "title": "Comience aquí",
  "titleEn": "Start here",
  "text": "Recorra lo esencial en un tutorial breve y consulte los detalles cuando los necesite.",
  "textEn": "Explore the essentials in a short tutorial and consult details when needed.",
  "details": [
    "El tutorial tiene hasta 7 pasos según su plan y rol. Use el selector para saltar directamente a un paso.",
    "Anterior y Siguiente recorren los módulos. Ver instrucciones abre el instructivo del tema sin guardar registros.",
    "Puede cerrar el tutorial y volver desde Ayuda → Tutorial. Los formularios con cambios mantienen su confirmación antes de salir."
  ],
  "detailsEn": [
    "The tutorial has up to 7 steps based on your plan and role. Use the selector to jump directly to a step.",
    "Previous and Next move through modules. View instructions opens the topic guide without saving records.",
    "Close the tutorial and reopen it from Help → Tutorial. Forms with unsaved changes still ask before leaving."
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
    "Al seleccionar para borrar una cotización vinculada aparece un aviso: primero elimine la reservación o desvincule la cotización. Desvincular requiere confirmación y conserva ambos registros; la cotización vuelve a Pendiente.",
    "Al completar la conversión se abre la reservación recién creada en Reservaciones, en su fecha y resaltada. Ver todas las reservaciones vuelve al listado."
  ],
  "detailsEn": [
    "Open the quote and choose Convert to reservation when the customer confirms.",
    "Check the date, time, area, guests and deposit in the new confirmed reservation.",
    "Selecting a linked quote for deletion shows a warning: first delete the reservation or unlink the quote. Unlinking requires confirmation and keeps both records; the quote returns to Pending.",
    "After conversion, Reservations opens the newly created reservation on its date and highlights it. View all reservations returns to the list."
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
      "En Configuración, registre áreas de empleados, empleados y turnos con entrada, salida y comida. Al editar un empleado, elija Activo o Inactivo y guarde. Los inactivos quedan fuera de la programación, conservan su historial en reportes y pueden reactivarse desde el mismo listado.",
      "Seleccione el mes y año que desea organizar. Busque los empleados por área.",
      "Intermediate y Advanced incluyen horarios. La cantidad de empleados no equivale a usuarios con acceso a UnoMesa."
    ],
    "detailsEn": [
      "In Settings, add employee areas, employees and shifts with start, end and meal times. When editing an employee, choose Active or Inactive and save. Inactive employees are hidden from scheduling, retain their history in reports and can be reactivated from the same list.",
      "Select the month and year you want to organize. Find employees by area.",
      "Intermediate and Advanced include schedules. Employee records are different from users who can sign in to UnoMesa."
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
      "Para copiar sin arrastrar, toque una casilla, elija otros empleados o fechas y guarde. También puede copiar el mes anterior; generar automáticamente usa los 15 días anteriores a la primera fecha pendiente del mes y pide confirmación antes de completarlo.",
      "Revise fechas y empleados antes de guardar cambios masivos o borrar un período.",
      "Seleccione rango y áreas; use Descargar PDF o Imprimir. Ambos usan el mismo PDF A4 horizontal y el color cubre la casilla completa."
    ],
    "detailsEn": [
      "To copy without dragging, tap a cell, choose other employees or dates and save. You can also copy the previous month; automatic generation uses the 15 days before the month’s first empty date and asks for confirmation before completing it.",
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
    "title": "Configuración en pocas acciones",
    "titleEn": "Settings in a few steps",
    "text": "Elija una sección, ajuste sus opciones y guarde.",
    "textEn": "Choose a section, adjust its options and save.",
    "details": [
      "Restaurante reúne General, Reservaciones, Cotizaciones y Horarios según su plan. Equipo y acceso reúne usuarios y seguridad. Cuenta y ayuda reúne su cuenta, suscripción y soporte según sus permisos.",
      "Los encabezados agrupan opciones relacionadas. Abra solo los apartados adicionales que necesite, como los campos del documento o cobros adicionales. Plegarlos no borra lo que escribió.",
      "Campos del formulario de reservación y Campos del formulario de cotización permiten activar u ocultar datos opcionales sin borrarlos. No hay que desplegar Datos adicionales; los campos activados quedan a la vista.",
      "Guardar cambios aplica la configuración. Las áreas, empleados, turnos y productos tienen sus propios botones Agregar o Guardar cambios."
    ],
    "detailsEn": [
      "Restaurant groups General, Reservations, Quotes and Schedules according to your plan. Team & access groups users and security. Account & help groups your account, subscription and support according to your permissions.",
      "Headings group related options. Open only the extra sections you need, such as document fields or additional charges. Collapsing them does not erase your draft.",
      "Reservation form fields and Quote form fields let you show or hide optional data without erasing it. There is no Additional details section; enabled fields are visible directly.",
      "Save changes applies the settings. Areas, employees, shifts and products have their own Add or Save changes buttons."
    ],
    "adminOnly": false
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
    "Conserve acceso a su correo. Cada código se usa una vez; para desactivar la protección debe confirmar otro código por email.",
    "En cuentas normales también funciona al ingresar con Google: si la verificación de UnoMesa está activada, debe completar su código por email. Es una protección de UnoMesa independiente de la verificación de Google."
  ],
  "detailsEn": [
    "Open Settings → Two-step verification and choose Enable. It is optional for each user.",
    "Request the code sent to your account email and enter its 6 digits to confirm. It expires in 10 minutes.",
    "Keep access to your email. Each code is single-use; disabling protection requires another email code.",
    "For ordinary accounts it also works with Google sign-in: if UnoMesa verification is enabled, complete its email code. This is UnoMesa protection, separate from Google verification."
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
    "title": "Asistente UnoMesa",
    "titleEn": "UnoMesa Assistant",
    "text": "Resuelva dudas de uso con el tutorial y la ayuda de IA.",
    "textEn": "Resolve usage questions with the tutorial and AI help.",
    "details": [
      "Abra Asistente UnoMesa y escriba una pregunta concreta sobre el uso de la aplicación. El tutorial sigue disponible sin límite.",
      "Cada restaurante comparte 50 solicitudes al mes, renovadas el día 1 a las 00:00 UTC. Los intentos aceptados cuentan aunque no se obtenga respuesta.",
      "OpenAI procesa los mensajes del chat. No incluya información privada ni contraseñas. El asistente no lee sus registros ni guarda cambios y puede equivocarse."
    ],
    "detailsEn": [
      "Open UnoMesa Assistant and ask a specific question about using the app. The tutorial remains unlimited.",
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
  "text": "Configuración → General permite subir o quitar el logo.",
  "textEn": "Settings → General lets you upload or remove the logo.",
  "details": [
    "Use el control de carga para elegir una imagen y revise el resultado antes de guardar.",
    "El logo se utiliza en la interfaz y las cotizaciones. Prefiera una imagen legible y con fondo transparente si su diseño lo necesita.",
    "Si el logo no se ve en un documento, compruebe que guardó General y abra de nuevo la vista previa. No sustituya datos ni vuelva a crear la cotización para cambiar el logo.",
    "Para dejarlo vacío, pulse Quitar imagen y luego Guardar cambios arriba o Guardar configuración abajo. Quitar imagen cambia el borrador; guardar confirma que el restaurante quede sin logo."
  ],
  "detailsEn": [
    "Use the upload control to choose an image and review it before saving.",
    "The logo is used in the interface and quotes. Prefer a legible image with a transparent background when appropriate.",
    "If a document does not show it, confirm General was saved and reopen the preview. Do not recreate the quote just to change its logo.",
    "To leave it empty, select Remove image, then Save changes at the top or Save settings at the bottom. Remove image edits the draft; saving confirms that the restaurant has no logo."
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
      "En la app iOS o Android, abra Más → Apariencia → Cambiar para alternar entre claro y oscuro. La elección se recuerda en este dispositivo. El control está dentro del menú y no flota sobre los botones del módulo. En la web se conserva el botón de tema. El documento de cotización mantiene su presentación para imprimir, independiente del tema oscuro."
    ],
    "detailsEn": [
      "Use the language selector to change the interface. A manual preference takes priority over initial detection.",
      "The administrator changes the business language and currency in Settings → General. Available currencies are GTQ, USD and MXN; choosing one does not perform exchange-rate conversion.",
      "In the iOS or Android app, open More → Appearance → Change to switch between light and dark. The choice is remembered on this device. The control stays inside the menu instead of floating over module buttons. The web keeps its theme button. Quote documents keep their print presentation independently of dark mode."
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
      "La fecha siempre aparece arriba de Hoy, Anterior y Siguiente. De–a conserva esa casilla como Desde y agrega únicamente Hasta a su lado. Una fecha vuelve a mostrar una sola casilla. Las flechas recorren días, Hoy vuelve al día actual y Todas muestra todas las fechas.",
      "Escriba cliente, área o menú en el buscador. Si no aparece una reserva, revise tanto la búsqueda como las fechas.",
      "La paginación muestra hasta 50 registros por página. Seleccionar esta página no selecciona todos los resultados de otras páginas."
    ],
    "detailsEn": [
      "The date always appears above Today, Previous and Next. From–to keeps that field as From and adds only To beside it. One date returns to a single field. Arrows move between days, Today returns to the current day and All shows all dates.",
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
      "El aviso de posibles cruces compara fecha y área con horarios próximos dentro de tres horas. Revise el evento existente antes de confirmar otro. Guardar de todos modos permite el cruce horario de las mesas seleccionadas para ese guardado, sin quitar la otra reserva; Revisar conserva el borrador. Requiere SQL 45 en el proyecto Supabase conectado a UnoMesa.",
      "Un aviso ayuda a revisar coincidencias; no representa disponibilidad de mesas calculada por un plano ni garantiza capacidad del área."
    ],
    "detailsEn": [
      "Edit the status and save. Canceled appears in red; cancellation keeps the record and is different from moving it to trash.",
      "Potential overlap warnings compare date and area with nearby times within three hours. Review the existing event before confirming another. Save anyway permits overlapping selected tables for that save without removing the other reservation; Review keeps the draft. Requires SQL 45 in the Supabase project connected to UnoMesa.",
      "A warning helps check overlaps; it is not table availability calculated from a floor plan and does not guarantee area capacity."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Descargar PDF e imprimir reservas",
    "titleEn": "Download PDF and print reservations",
    "text": "Imprimir abre las opciones; Más opciones reúne PDF, Excel, plantilla e importación.",
    "textEn": "Print opens output choices; More options groups PDF, Excel, template and import tools.",
    "details": [
      "Primero seleccione fechas y búsqueda. Al pulsar Imprimir aparece un diálogo para elegir Todo: reservaciones y resumen, Solo reservaciones o Solo resumen. Después confirme Imprimir.",
      "Más opciones → Descargar PDF abre las mismas opciones y descarga un archivo A4 horizontal. Tanto PDF como impresión incluyen todos los resultados del filtro, también los de otras páginas. Los documentos con reservaciones tienen una columna Teléfono separada del cliente; conserva el código de país y muestra un guion cuando no hay teléfono guardado. Mantienen la visibilidad de personas y anticipos configurada.",
      "En el diálogo del navegador revise impresora, tamaño A4 horizontal y escala. En iPhone o iPad, guarde o comparta el PDF desde el visor. Más opciones → Descargar Excel y Descargar plantilla conservan los permisos de exportación; Importar reservaciones requiere permiso de operación."
    ],
    "detailsEn": [
      "Choose dates and search first. Print opens a dialog with Everything: reservations and summary, Reservations only or Summary only. Then confirm Print.",
      "More options → Download PDF opens the same choices and downloads an A4 landscape file. PDF and print include every filtered result, including other pages. Documents containing reservations have a separate Phone column; it preserves the country code and shows a dash when no phone is saved. They respect configured guest and deposit visibility.",
      "In the browser dialog check printer, A4 landscape paper and scale. On iPhone or iPad, save or share the PDF from its viewer. More options → Download Excel and Download template keep export permissions; Import reservations requires operational permission."
    ],
    "adminOnly": false
  },
  {
    "tab": "reservations",
    "title": "Importar reservaciones desde Excel",
    "titleEn": "Import reservations from Excel",
    "text": "Descargue la plantilla desde Reservaciones → Más opciones → Descargar plantilla.",
    "textEn": "Download the template under Reservations → More options → Download template.",
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
    "Administrador y Gerente pueden eliminar cotizaciones sin reservación vigente vinculada. Seleccionar esta página incluye las convertidas y muestra el aviso si hay un vínculo; no se borra ninguna de las seleccionadas hasta resolverlo y confirmar la eliminación. Operación puede crear, editar y convertir; Solo lectura consulta.",
    "Cotización creada muestra fecha y hora de creación según la zona horaria del dispositivo que abre UnoMesa; no se elige automáticamente por país. AM/PM o 24 horas sigue la preferencia del restaurante. Las fechas y horas del evento conservan el valor guardado."
  ],
  "detailsEn": [
    "Search by quote, customer, area or status; change pages where needed.",
    "In Sort by choose Event date, Quote number or Creation date. In Order choose ascending or descending. This applies across pages and searches; changing the order returns to the first page and clears selected rows. The default is earliest event date first, then time. Creation date appears below the customer in the device's time zone and is preserved when editing. Upcoming reminders keep their own event order.",
    "The pencil edits; View opens the preview; Convert to reservation creates the confirmed event; trash deletes subject to permission.",
    "Administrator and Manager can delete quotes without an existing linked reservation. Select this page includes converted quotes and shows a warning if linked; none of the selected quotes is deleted until the link is resolved and deletion is confirmed. Operations can create, edit and convert; Read-only can view.",
    "Quote created shows its creation date and time in the time zone of the device opening UnoMesa; it is not selected automatically by country. AM/PM or 24-hour display follows the restaurant preference. Event dates and times keep their stored values."
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
    "Los avisos activos aparecen desplegados. Revisar abre la cotización y Quitar aviso oculta únicamente esa alerta para el restaurante. Ver avisos ocultos permite consultar las próximas y usar Mostrar aviso para recuperarlas; la cotización se conserva.",
    "Después de la fecha, una pendiente se presenta como No realizada en gris. Confirmadas o convertidas no se tratan como pendientes. Cambiar la fecha reactiva un aviso oculto."
  ],
  "detailsEn": [
    "From five days before through event day, Contact appears in yellow. The alert identifies quotes by customer, number and date.",
    "Active reminders are expanded. Review opens the quote and Dismiss reminder hides only that alert for the restaurant. View hidden reminders lists upcoming hidden alerts; use Show reminder to restore one. The quote is preserved.",
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
    "En el aviso, Desvincular cotización pide confirmación y conserva ambos registros. La reservación mantiene fecha, estado, anticipo y demás datos; la cotización vuelve a Pendiente. Nada se borra automáticamente: si todavía desea eliminar la cotización, vuelva a pulsar la papelera y confirme. Cancelar una reservación no la desvincula.",
    "Al completar la conversión se abre la reservación recién creada en Reservaciones, en su fecha y resaltada. Ver todas las reservaciones vuelve al listado."
  ],
  "detailsEn": [
    "Check details, date, time, guests, area, deposit and payment method before converting.",
    "Conversion creates a confirmed reservation with event information and links both records. In Reservations, View quote opens the related document.",
    "In the list, Converted and Confirmed appear as separate, aligned badges. Confirmed uses soft green. This only changes presentation, not saved data or status.",
    "A converted quote cannot be deleted while it has a linked reservation outside the trash. Selecting it for deletion or pressing its trash button shows an Administrator or Manager a warning with the customer and date. Go to reservations opens that exact reservation and highlights it, even for past or future dates; no search or page change is needed. If the warning contains several, use View reservation beside the customer you want to open.",
    "The linked reservation view shows only that record, its details and available actions. View all reservations returns to the full list. Opening it does not change or delete information; Edit and Move to trash retain their permissions and confirmations. If it was deleted or you no longer have access, a notice appears instead of opening another reservation.",
    "In the warning, Unlink quote asks for confirmation and keeps both records. The reservation keeps its date, status, deposit and other data; the quote returns to Pending. Nothing is deleted automatically: if you still want to delete the quote, press trash again and confirm. Canceling a reservation does not unlink it.",
    "After conversion, Reservations opens the newly created reservation on its date and highlights it. View all reservations returns to the list."
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
    "Guarde la configuración y abra una vista previa para comprobar el resultado. Estos colores son distintos del tema oscuro de la aplicación y de los colores de Horarios.",
    "Vista previa, arriba en Configuración → Cotizaciones, muestra el diseño con los cambios del borrador y datos de ejemplo. No crea una cotización ni guarda la configuración. Use Guardar cambios arriba o Guardar configuración abajo para aplicarla."
  ],
  "detailsEn": [
    "Choose Modern, Classic or Basic. Font offers Georgia, Arial, Helvetica and Times New Roman.",
    "Text color changes lettering; Header color changes the header; Product header color changes the table band; Accent color applies the design accent.",
    "Save settings and open a preview to check the result. These colors are separate from the application dark theme and Schedule colors.",
    "Preview quote at the top of Settings → Quotes shows the draft design with sample data. It does not create a quote or save settings. Apply changes with Save changes at the top or Save settings at the bottom."
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
    "title": "Campos principales personalizados: NIT, empresa y dirección",
    "titleEn": "Custom main fields: tax ID, company and address",
    "text": "Abra Configuración → Cotizaciones → Campos personalizados.",
    "textEn": "Open Settings → Quotes → Custom fields.",
    "details": [
      "Escriba el nombre, por ejemplo NIT o Empresa, y elija Texto corto, Notas, Número o Fecha.",
      "Agregue el campo y use Mostrar para controlar su visibilidad. Al guardar, aparece junto a los campos principales, sin un bloque adicional. Desactivarlo conserva los valores guardados.",
      "Estos campos permiten registrar información; no verifican automáticamente un NIT ni generan una factura fiscal."
    ],
    "detailsEn": [
      "Enter a name, such as Tax ID or Company, and choose Short text, Notes, Number or Date.",
      "Add the field and use Show to control visibility. After saving, it appears alongside the main fields, with no extra section. Disabling it keeps saved values.",
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
    "Solo Administrador puede eliminar productos del catálogo. Quitar una línea de una cotización es una acción diferente y no borra el producto.",
    "Buscar menús guardados filtra por nombre o descripción. Se muestran hasta 5 filas a la vez; desplace la lista para ver las demás. Agregar o Guardar cambios del producto guarda ese producto; los botones de configuración superior e inferior guardan las preferencias de la sección."
  ],
  "detailsEn": [
    "Enter name, description and price. Description accepts multiple lines. Save the product to find it in a quote line search.",
    "The pencil edits an existing product. Administrator, Manager and Operations can maintain name, description and price.",
    "Only Administrator can delete catalog products. Removing a quote line is a different action and does not delete the product.",
    "Search saved menus filters by name or description. Up to 5 rows appear at once; scroll the list for the rest. The product Add or Save changes button saves that product; the top and bottom settings buttons save section preferences."
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
      "Empleado es una persona programada en el horario; Usuario es una cuenta con acceso a UnoMesa. Crear un empleado no envía una invitación de acceso."
    ],
    "detailsEn": [
      "Enter name, optional ID, phone and area. Save to include the employee in Schedule selection.",
      "The Settings list shows up to 10 employees at a time; smaller screens may show fewer. Scroll inside it with the mouse wheel, trackpad, scrollbar or finger to see the rest. You can also focus it with Tab and scroll with the keyboard; this is not a limit of 10 saved employees.",
      "Search employees filters by name, ID, phone or area as you type, ignoring case and accents. The counter shows matches and total; Clear restores the list. Changing the search returns the list to the top. Searching does not modify employees or discard an open edit form.",
      "The pencil loads details for editing; Save changes confirms and Cancel abandons editing. The trash button deletes according to the displayed confirmation.",
      "An employee is a person being scheduled; a user is an account with UnoMesa access. Creating an employee does not send a login invitation."
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
      "Elija Turno, Descanso, Permiso o Vacaciones. Vacaciones admite una fecha o rango y no suma horas de trabajo programadas. Para Turno seleccione el horario y, si aplica, Inicio comida y Fin comida. Ambos campos de comida aparecen uno debajo del otro, con hora y minutos completos y AM/PM cuando corresponda. La X borra únicamente la hora de ese campo. Notas o motivo agrega información de la asignación.",
      "Guardar o modificar aplica a todas las personas y fechas seleccionadas. Puede reemplazar asignaciones existentes; revise el alcance antes de confirmar."
    ],
    "detailsEn": [
      "One date assigns a day; Range shows From and To. The end date cannot precede the start.",
      "Choose Shift, Day off, Leave or Vacation. Vacation accepts one date or a range and does not add scheduled work hours. For Work select the shift and, when applicable, Meal start and Meal end. The two meal fields are stacked vertically, showing full hours and minutes, plus AM/PM when selected. The X clears only that field's time. Notes or reason adds assignment information.",
      "Save or modify applies to all selected people and dates. It may replace existing assignments; review the scope before confirming."
    ],
    "adminOnly": false
  },
  {
    "tab": "schedules",
    "title": "Colores de Turno, Descanso, Permiso y Vacaciones",
    "titleEn": "Colors for Shift, Day off, Leave and Vacation",
    "text": "Use Color de casilla en el panel de Horarios.",
    "textEn": "Use Cell color in the Schedule panel.",
    "details": [
      "Auto usa verde para trabajo, gris para descanso, tono durazno para permiso y lavanda para vacaciones. Puede elegir otro tono claro de la paleta.",
      "El color elegido se aplica a las personas y fechas seleccionadas cuando guarda; no cambia todas las asignaciones de ese tipo automáticamente.",
      "En PDF e impresión el fondo cubre toda la casilla con texto oscuro. Para imprimir colores, seleccione una impresora y un modo de impresión a color."
    ],
    "detailsEn": [
      "Auto uses green for work, gray for day off, peach for leave and lavender for vacation. You can choose another light palette shade.",
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
      "Copiar mes anterior pide confirmación e indica ambos meses: aplica a todos los empleados activos con horarios del mes anterior y puede reemplazar asignaciones. Copiar por fechas permite elegir origen, destino y empleados, filtrarlos por área y revisar el total antes de confirmar; conserva las fechas ocupadas. Ambas copias omiten vacaciones; copiar mes anterior conserva las vacaciones del destino. Generar automáticamente pide confirmación con las fechas del patrón (los 15 días anteriores a la primera fecha pendiente del mes seleccionado), el destino (desde esa fecha hasta fin de mes), los empleados y el total por crear. Si el mes está vacío, usa los últimos 15 días del mes anterior; si solo faltan tres días, completa esos tres. Cada empleado debe tener asignados los 15 días de origen. Conserva las fechas ocupadas y no repite vacaciones. Cancelar no guarda cambios.",
      "Borrar fecha o Borrar rango afecta la selección y pide confirmación. Borrar este día corresponde a la asignación cargada. Borrar un horario no elimina al empleado."
    ],
    "detailsEn": [
      "To copy on a touch screen, tap an existing cell, change people or dates in the panel and save. On a computer you can also drag an assignment to another cell.",
      "Copy previous month asks for confirmation showing both months: it applies to all active employees with previous-month schedules and may replace assignments. Copy by date lets you choose source, destination and employees, filter by area and review the count before confirming; occupied dates are preserved. Both copy options skip vacations; previous-month copy also preserves destination vacations. Automatic generation asks for confirmation showing the pattern dates (the 15 days before the selected month’s first empty date), the destination (that date through month-end), employees and the count to create. An empty month uses the previous month’s last 15 days; if only three days remain, it fills those three. Each employee must have assignments for all 15 source days. Occupied dates are preserved and vacations are not repeated. Cancelling saves no changes.",
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
    "Todas las cotizaciones incluye todos los estados; Pendientes solo el estado Pendiente, incluso si el evento ya pasó; Aprobadas y valor de venta incluye aprobadas y convertidas. Los importes de cotización no equivalen a cobros.",
    "Clientes más frecuentes y Clientes que han reservado ayudan a consultar actividad del cliente. Anticipos registrados por cliente usa el importe de la reserva vinculada y evita duplicar el de su cotización. Incluye canceladas; no es un historial de pagos o reembolsos.",
    "Elija tipo, fechas y búsqueda. La pantalla pagina resultados. Imprimir y Excel incluyen todos los resultados filtrados dentro de sus límites; nunca se entregan como completos si se supera un límite. Excel conserva números y una hoja con filtros, moneda y criterios.",
    "Clientes más frecuentes excluye reservas canceladas y agrupa por cliente vinculado; sin vínculo, por nombre y teléfono. Clientes que han reservado incluye canceladas y muestra su estado. Ambos usan la fecha del evento y excluyen la papelera."
  ],
  "detailsEn": [
    "All quotes includes every status; Pending includes only Pending status, even after the event; Approved quotes and sales value includes approved and converted quotes. Quote amounts are not collected payments.",
    "Most frequent customers and Customers with reservations help review customer activity. Recorded deposits by customer uses the linked reservation amount without duplicating its quote deposit. Includes cancellations; it is not a payment or refund ledger.",
    "Choose type, dates and search. The screen paginates results. Print and Excel include all filtered results within their limits; incomplete results are never delivered as complete. Excel preserves numbers and includes a sheet with filters, currency and calculation basis.",
    "Most frequent customers excludes cancelled reservations and groups by linked customer; otherwise by name and phone. Customers with reservations includes cancellations and their status. Both use event dates and exclude trash."
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
    "Saldos de eventos próximos muestra saldos positivos de cotizaciones vinculadas a reservas no canceladas, desde hoy y dentro de las fechas elegidas. Usa los importes guardados en la cotización; sus importes y los de la reserva se guardan por separado.",
    "Anticipación compara la fecha del evento con la fecha de ingreso a UnoMesa en la zona del dispositivo. Excluye canceladas; una importación puede tener una fecha de ingreso distinta de la reserva original.",
    "Comparación usa el período inmediatamente anterior de igual duración. Reservaciones incluye canceladas; Invitados las excluye. La diferencia de conversión se expresa en puntos porcentuales; un guion significa que no hay base para calcular."
  ],
  "detailsEn": [
    "Upcoming event balances shows positive quote balances linked to non-cancelled reservations, from today within the selected dates. It uses amounts saved on the quote; quote and reservation amounts are stored separately.",
    "Lead time compares the event date with the date entered into UnoMesa in the device time zone. It excludes cancellations; an import may have an entry date different from the original booking.",
    "Comparison uses the immediately preceding period of equal length. Reservations includes cancellations; Guests excludes them. Conversion differences are percentage points; a dash means there is no basis for calculation."
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
      "Seleccione el período y busque el empleado. Consulte nombre, código, área, días y horas programadas, comidas, descansos, permisos y vacaciones.",
      "Las horas netas usan entrada y salida numéricas o las horas auxiliares configuradas para texto, y admiten turnos nocturnos. La comida de la casilla sustituye los minutos de comida del turno. Días sin cálculo cuenta horarios incompletos o comidas incompatibles; sus duraciones no se suman. Descansos, permisos y vacaciones se cuentan por su tipo, no por las notas, y no suman horas. Se incluyen empleados inactivos y todas sus áreas del período.",
      "Es un reporte de programación: no registra automáticamente marcajes de entrada, salarios ni nómina. Para corregirlo revise Horarios y los turnos de origen."
    ],
    "detailsEn": [
      "Select the period and search for an employee. Review name, code, area, scheduled days and hours, meals, days off, leave and vacation.",
      "Net hours use numeric times or configured calculation times for text labels, including overnight shifts. A meal on the assignment replaces the shift meal minutes. Days without calculation counts incomplete times or incompatible meals; their durations are excluded. Days off, leave and vacation are counted by type rather than notes and add no hours. Inactive employees and all their areas in the period are included.",
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
    "Ingrese con contraseña o con Google en una cuenta normal. En Configuración → Verificación en dos pasos pulse Activar con código por email e ingrese los seis dígitos enviados a su correo. Si ya está activada, entrar con Google no omite el código de UnoMesa. La cuenta especial de soporte conserva contraseña más código.",
    "Cada código vence en diez minutos y se utiliza una vez. Espere 60 segundos para reenviar; hay cinco intentos por código y límites adicionales de envío.",
    "Desactivar también pide un código. Si no llega, revise spam y la dirección de su cuenta; si indica que el envío no está configurado, contacte al responsable de UnoMesa. No se usa QR."
  ],
  "detailsEn": [
    "Sign in with a password or Google on an ordinary account. In Settings → Two-step verification, select Enable with email code and enter the six digits sent to your email. If enabled, Google sign-in does not bypass the UnoMesa code. The special support account still requires password plus code.",
    "Each code expires in ten minutes and is single-use. Wait 60 seconds to resend; there are five attempts per code and additional sending limits.",
    "Disabling also requires a code. If it does not arrive, check spam and your account address; if sending is not configured, contact UnoMesa support. No QR is used."
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
      "UnoMesa permite un cambio exitoso de plan o periodicidad por restaurante cada 24 horas en pagos reales. En pagos de prueba se espera un minuto. Próximo cambio disponible muestra la fecha y hora. El límite se comprueba en servidor y no se reinicia al cerrar sesión o cambiar de dispositivo. Los intentos rechazados no consumen ese plazo; el control de intentos rápidos es independiente.",
      "Actualizar estado verifica y sincroniza la suscripción directamente con Lemon Squeezy antes de confirmar que está actualizada. Si se pierde una respuesta, el cambio puede seguir pendiente de verificación: no repita el pago. Espere la sincronización y, si persiste, contacte a soporte con la referencia del error. No se anuncia como fallido un cobro incierto ni se repite automáticamente. Algunos métodos, como PayPal, requieren confirmar también en el portal; si abandona esa aprobación y queda pendiente, contacte a soporte.",
      "Gestionar suscripción abre el portal del proveedor para pagos y cancelación. El límite de UnoMesa no controla cambios que el proveedor permita hacer directamente en su portal; su disponibilidad se administra en ese proveedor. Cancelar la renovación mantiene el acceso hasta el fin del período pagado. Este límite no bloquea gestionar o cancelar la suscripción.",
      "Para bajar de plan, los usuarios activos y las invitaciones pendientes deben caber en el límite nuevo. Resuelva pagos pendientes antes de cambiar. El asistente explica el proceso, pero no ejecuta ni confirma cobros. La cuenta creadora y sus invitados conservan Advanced sin pagos; no necesitan cambiar de plan."
    ],
    "detailsEn": [
      "Review your current plan and paid period. Choose Monthly or Annual and a plan. For an active subscription, Confirm subscription change opens with the current and new plan and their current catalog prices. Check an earlier subscription’s actual rate under Manage subscription. A prominent notice states that, after a successful change, you cannot change plans or billing cycles again for 24 hours (one minute in test mode). Cancel or Escape closes it without requesting a change. Only Confirm change submits it.",
      "You can request annual to monthly, monthly to annual or change plans while keeping the billing cycle. Availability requires the correct provider variants and prices. The provider calculates prorated adjustments and may charge immediately or reset renewal when changing cycles. A credit is not an automatic card refund. The dialog shows recurring prices before taxes, not the exact adjustment charged today.",
      "UnoMesa allows one successful plan or billing-cycle change per restaurant every 24 hours for live payments. Test payments have a one-minute wait. Next change available shows the date and time. The server enforces the limit across sessions and devices. Rejected attempts do not consume it; rapid-attempt protection is separate.",
      "Refresh status verifies and synchronizes the subscription directly with Lemon Squeezy before confirming it is updated. A lost response may leave a change awaiting verification: do not repeat payment. Wait for synchronization, then contact support with the error reference if it persists. An uncertain charge is never automatically repeated. Some methods, such as PayPal, require approval in the portal too; if you abandon approval and it remains pending, contact support.",
      "Manage subscription opens the provider portal for payments and cancellation. UnoMesa’s limit does not control changes allowed directly in the provider portal; configure their availability with that provider. Canceling renewal keeps access through the paid period. The change limit does not block managing or canceling your subscription.",
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
    "text": "El asistente explica controles y procedimientos de UnoMesa.",
    "textEn": "The assistant explains UnoMesa controls and procedures.",
    "details": [
      "Puede explicar campos, cálculos, permisos, estados, catálogos, reportes y pasos de configuración documentados. No ve sus registros ni su pantalla.",
      "No puede guardar, borrar, enviar mensajes, cobrar, cambiar planes ni obtener una lista real de sus clientes. Haga esas acciones en sus módulos con sus permisos.",
      "La navegación actual contiene Reservaciones, Clientes, Cotizaciones, Buzón de solicitudes, Horarios, Reportes y Configuración. No prometa POS, inventario, contabilidad, nómina, campañas automáticas como módulos disponibles. El plano de mesas está dentro de Reservaciones, disponible en todos los planes."
    ],
    "detailsEn": [
      "It can explain documented fields, calculations, permissions, statuses, catalogs, reports and configuration steps. It cannot see your records or screen.",
      "It cannot save, delete, send messages, charge, change plans or retrieve your actual customer list. Perform actions in their modules with your permissions.",
      "Current navigation contains Reservations, Customers, Quotes, Request inbox, Schedules, Reports and Settings. Do not promise POS, inventory, accounting, payroll, automatic campaigns as available modules. Floor plan is inside Reservations, available in all plans."
    ],
    "adminOnly": false
  }
,
{
  "tab": null,
  "title": "Registrarse e ingresar con Google",
  "titleEn": "Register and sign in with Google",
  "text": "Google permite entrar a UnoMesa con su cuenta verificada.",
  "textEn": "Google lets you enter UnoMesa with your verified account.",
  "details": [
    "Seleccione Continuar con Google y elija la cuenta correcta. Un registro nuevo abre el dashboard con 10 días de prueba Advanced; no necesita completar primero todos los datos del restaurante.",
    "El administrador puede completar nombre y datos de contacto en Configuración → General. Inicio rápido sigue disponible en el dashboard y en Ayuda para crear los primeros catálogos.",
    "Si ya tiene acceso a un restaurante, ingresar vuelve a su cuenta existente; no inicia otra prueba. UnoMesa no conoce ni cambia su contraseña de Google. Para disponer también de una contraseña de UnoMesa, abra Configuración → Cuenta."
  ],
  "detailsEn": [
    "Select Continue with Google and choose the correct account. A new registration opens the dashboard with a 10-day Advanced trial; restaurant details can be completed afterward.",
    "Administrators can complete name and contact details in Settings → General. Quick setup remains available on the dashboard and under Help to create initial catalogs.",
    "If you already have restaurant access, sign-in returns to that account; it does not start another trial. UnoMesa does not know or change your Google password. To also set a UnoMesa password, open Settings → Account."
  ],
  "adminOnly": false
},
{
  "tab": "settings",
  "title": "Crear o cambiar contraseña desde Cuenta",
  "titleEn": "Create or change a password in Account",
  "text": "Abra Configuración → Cuenta para gestionar su propia contraseña.",
  "textEn": "Open Settings → Account to manage your own password.",
  "details": [
    "Crear contraseña aparece para cuentas de Google sin contraseña de UnoMesa; si ya tiene una, aparece Cambiar contraseña. Es una contraseña independiente de Google y puede seguir entrando con Google.",
    "Escriba Nueva contraseña y Confirmar nueva contraseña con el mismo valor. Use entre 8 y 128 caracteres, con mayúscula, minúscula, número y símbolo. Pulse Crear contraseña o Cambiar contraseña para guardar.",
    "Si la pantalla lo solicita, confirme su contraseña actual de UnoMesa o use Enviar código de verificación y escriba el código recibido por correo. Complete primero los dos pasos de UnoMesa si están activados.",
    "Cada usuario, incluido Solo lectura, gestiona su propia contraseña; no cambia la de otra persona. Cancelar descarta lo escrito. Si no puede ingresar, use la recuperación de contraseña de la pantalla de acceso para su contraseña de UnoMesa; la de Google se recupera en Google."
  ],
  "detailsEn": [
    "Create password appears for Google accounts without a UnoMesa password; otherwise Change password appears. It is separate from Google, and you can continue signing in with Google.",
    "Enter the same value in New password and Confirm new password. Use 8–128 characters with uppercase, lowercase, a number and a symbol. Select Create password or Change password to save.",
    "If prompted, confirm your current UnoMesa password or select Send verification code and enter the code received by email. Complete UnoMesa two-step verification first if enabled.",
    "Each user, including Read-only, manages their own password, never another user’s. Cancel discards the entered text. If you cannot sign in, use password recovery on the sign-in screen for your UnoMesa password; recover your Google password through Google."
  ],
  "adminOnly": false
},
{
  "tab": null,
  "title": "Confirmaciones flotantes de guardado",
  "titleEn": "Floating save confirmations",
  "text": "Una operación completada puede mostrar una confirmación arriba de la pantalla.",
  "textEn": "A completed operation can show confirmation at the top of the screen.",
  "details": [
    "Avisos como Configuración guardada o Contraseña creada flotan arriba y desaparecen aproximadamente a los 5 segundos. Puede cerrarlos con la X.",
    "El temporizador se pausa mientras coloca el cursor encima o enfoca el aviso. Que el mensaje desaparezca no deshace el guardado.",
    "Los errores permanecen junto a la operación para corregirlos. Los avisos de cotizaciones son seguimiento del evento, no confirmaciones de guardado."
  ],
  "detailsEn": [
    "Messages such as Settings saved or Password created float at the top and disappear after about 5 seconds. Close them with X.",
    "The timer pauses while you hover over or focus the notification. Its disappearance does not undo the save.",
    "Errors remain beside the operation so you can correct them. Quote reminders are event follow-up, not save confirmations."
  ],
  "adminOnly": false
},
{
  "tab": "reports",
  "title": "Filtros, búsqueda, Excel e impresión de reportes",
  "titleEn": "Report filters, search, Excel and printing",
  "text": "Seleccione el reporte, el rango de fechas y la búsqueda; Actualizar vuelve a consultar.",
  "textEn": "Select the report, date range and search; Refresh reloads the information.",
  "details": [
    "La fecha inicial no puede ser posterior a la final. Conversión, cancelación, demanda, saldos, anticipación y comparación admiten hasta 366 días. Las fechas son del evento, salvo Empleados, que usa la fecha programada.",
    "Cambiar filtros vuelve a la primera página y oculta las filas anteriores mientras carga. Si falla una consulta, verá un error; use Actualizar para reintentar. La búsqueda filtra los valores del reporte; no recalcula los porcentajes de cada grupo.",
    "Excel exporta todas las filas filtradas, no solo la página visible, conserva importes numéricos y agrega Detalles con filtros, moneda, zona horaria y criterios. Imprimir incluye esos datos y respeta el formato AM/PM o 24 horas.",
    "Excel admite hasta 10,000 filas y la impresión hasta 2,000, con límite de 20 MB. Las consultas de empleados, clientes frecuentes, pendientes y búsqueda también pueden requerir acortar fechas si superan 10,000 registros de origen. Un límite muestra error, nunca un reporte parcial presentado como completo."
  ],
  "detailsEn": [
    "The start date cannot be after the end date. Conversion, cancellations, demand, balances, lead time and comparison accept up to 366 days. Dates refer to events, except Employees, which uses scheduled dates.",
    "Changing filters returns to the first page and hides previous rows while loading. Failed queries show an error; use Refresh to retry. Search filters report values; it does not recalculate each group’s percentages.",
    "Excel exports all filtered rows, not only the visible page, preserves numeric amounts and adds Details with filters, currency, time zone and calculation basis. Print includes that information and respects AM/PM or 24-hour display.",
    "Excel accepts up to 10,000 rows and printing up to 2,000, with a 20 MB limit. Employee, frequent-customer, pending and search queries may also require shorter dates above 10,000 source records. A limit produces an error, never an incomplete report presented as complete."
  ],
  "adminOnly": true
}
];
