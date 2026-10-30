import type { AppLanguage } from "./translations";
import type { LegalDocumentId } from "./legal-routes";

export type LegalDocumentContent = {
  title: string;
  intro: string;
  updatedOn: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
};

// Bilingual legal content. Historical consent IDs are not publicity authorizations;
// the optional customer-reference permission below must be obtained separately.
export const LEGAL_DOCUMENTS: Record<LegalDocumentId, Record<AppLanguage, LegalDocumentContent>> = {
  "accountDeletion": {
  "es": {
    "title": "Eliminar cuenta y datos de UnoMesa",
    "intro": "Solicite a UnoMesa LLC la eliminación de su cuenta y los datos personales asociados. La solicitud se gestiona por soporte y requiere verificar su identidad.",
    "updatedOn": "2026-10-17",
    "sections": [
      {
        "title": "1. Envíe su solicitud",
        "paragraphs": [
          "Escriba a support@unomesa.com, preferiblemente desde el correo de su cuenta. Indique el correo registrado, el nombre del restaurante o empresa y si desea eliminar su cuenta personal o cerrar el negocio completo. Si tiene acceso a varias sucursales, indíquelo para revisar el alcance.",
          "No envíe contraseñas, códigos de verificación ni datos de tarjeta. Si perdió acceso a su correo, explique la situación: soporte le indicará una forma de verificar la titularidad. No necesita reinstalar la aplicación ni tener una suscripción activa para solicitar la eliminación."
        ]
      },
      {
        "title": "2. Verificación y confirmación",
        "paragraphs": [
          "La solicitud se revisa manualmente. Soporte verificará la identidad y la autorización, confirmará qué datos se eliminarán y le comunicará el plazo de tramitación. Recibirá una confirmación cuando se complete. Abrir esta página o preparar el correo no elimina datos ni constituye una solicitud enviada.",
          "Si es propietario y el restaurante continuará funcionando, coordine la transferencia de administración. Si desea cerrar el negocio completo, indíquelo en el correo para que soporte verifique su autorización y el alcance sobre sus sucursales. Puede iniciar la solicitud aunque todavía no haya realizado la transferencia."
        ]
      },
      {
        "title": "3. Qué se elimina y qué permanece",
        "paragraphs": [
          "Una solicitud de eliminación de cuenta incluye la identidad de acceso y los datos personales vinculados a ella, como perfil, correo de acceso, vínculos de autenticación y membresías, salvo los datos que deban conservarse por los motivos indicados abajo. Tener acceso a varias sucursales requiere revisar todas las membresías; salir de una sucursal no equivale a eliminar la cuenta global.",
          "Los registros operativos compartidos que pertenecen a un restaurante que continúa activo —clientes, reservaciones, cotizaciones, menús, planos y horarios— no se borran automáticamente al retirar a una persona del equipo. Se revisarán los datos personales de esa persona presentes en esos registros y las obligaciones del restaurante. El cierre completo del negocio requiere autorización del propietario y una revisión separada de sus datos y archivos.",
          "Si es cliente de un restaurante y desea borrar los datos de una reserva o solicitud, contacte al restaurante que los recibió. También puede escribir a soporte de UnoMesa indicando cuál es el restaurante; se coordinará la solicitud con su responsable."
        ]
      },
      {
        "title": "4. Conservación y plazos",
        "paragraphs": [
          "La papelera ordinaria de registros puede conservar información hasta 365 días. Una sucursal eliminada tiene un período de recuperación de 30 días. Estos mecanismos operativos no son una eliminación definitiva de cuenta ni significan que todos los datos se borren automáticamente en 90 días.",
          "Al tramitar su solicitud de eliminación definitiva, soporte confirmará el plazo aplicable y los datos que deban permanecer por obligaciones legales, facturación, seguridad, prevención de fraude o controversias. Se limitará la conservación a lo necesario y se informará el motivo y el período correspondiente.",
          "Las copias de seguridad técnicas tienen ciclos distintos a la papelera. Su plazo depende de la configuración del servicio; soporte informará el período aplicable al atender la solicitud. Esta página no promete un borrado inmediato de todos los respaldos."
        ]
      },
      {
        "title": "5. Suscripciones",
        "paragraphs": [
          "Solicitar la eliminación, retirar una membresía o desinstalar la aplicación no cancela automáticamente una suscripción. Antes de cerrar su cuenta, cancele la renovación con el proveedor con el que contrató: Google Play, Apple o Lemon Squeezy. En Configuración → Suscripción puede identificar el proveedor original.",
          "Si no puede acceder, indique en su solicitud qué proveedor utilizó; soporte le ayudará a identificar el proceso de cancelación. No necesita volver a pagar para solicitar la eliminación."
        ]
      },
      {
        "title": "6. Desde la aplicación",
        "paragraphs": [
          "En UnoMesa para web, iOS o Android, abra Configuración → Cuenta → Solicitar eliminación de cuenta. Se abrirá esta página con las mismas instrucciones. También puede escribir directamente a support@unomesa.com.",
          "Los controles existentes para transferir administración o retirar el acceso de un usuario conservan sus permisos. Esta vía de soporte permite iniciar una solicitud aunque un control automático no esté disponible para su rol."
        ]
      }
    ]
  },
  "en": {
    "title": "Delete your UnoMesa account and data",
    "intro": "Request deletion of your UnoMesa account and its associated personal data from UnoMesa LLC. Support handles requests after verifying your identity.",
    "updatedOn": "2026-10-17",
    "sections": [
      {
        "title": "1. Send your request",
        "paragraphs": [
          "Email support@unomesa.com, preferably from your account email. Include the registered email, restaurant or company name, and whether you want to delete your personal account or close the entire business. If you have access to several locations, mention them so the scope can be reviewed.",
          "Do not send passwords, verification codes or payment card details. If you lost access to your email, explain the situation: support will explain how to verify ownership. You do not need to reinstall the app or hold an active subscription to request deletion."
        ]
      },
      {
        "title": "2. Verification and confirmation",
        "paragraphs": [
          "Requests are reviewed manually. Support will verify identity and authorization, confirm which data will be deleted and communicate the processing timeframe. You will receive confirmation when the request is completed. Opening this page or preparing an email does not delete data or submit a request.",
          "If you own a restaurant that will continue operating, arrange an ownership transfer. If you want to close the entire business, say so in your email so support can verify your authority and the scope across locations. You may start your request before completing an ownership transfer."
        ]
      },
      {
        "title": "3. What is deleted and what remains",
        "paragraphs": [
          "An account deletion request covers your sign-in identity and associated personal data, such as your profile, login email, authentication links and memberships, except data that must be retained for the reasons below. Access to several locations requires reviewing all memberships; leaving one location is not the same as deleting the global account.",
          "Shared operational records belonging to a restaurant that continues operating — customers, reservations, quotes, menus, floor plans and schedules — are not automatically deleted when an individual leaves its team. The person’s personal data in those records and the restaurant’s obligations will be reviewed. Closing an entire business requires owner authorization and a separate review of its records and files.",
          "If you are a restaurant guest requesting deletion of reservation or inquiry data, contact the restaurant that received it. You may also contact UnoMesa Support and identify the restaurant so the request can be coordinated with its responsible administrator."
        ]
      },
      {
        "title": "4. Retention and timeframes",
        "paragraphs": [
          "The ordinary record trash may retain information for up to 365 days. A deleted location has a 30-day recovery period. These operational mechanisms are not permanent account deletion and do not mean that all data is automatically deleted within 90 days.",
          "When handling your permanent deletion request, support will confirm the applicable timeframe and any data that must remain for legal obligations, billing, security, fraud prevention or disputes. Retention will be limited to what is necessary, and its reason and applicable period will be explained.",
          "Technical backups follow cycles separate from trash. Their retention period depends on the service configuration; support will explain the applicable period when handling your request. This page does not promise immediate erasure from every backup."
        ]
      },
      {
        "title": "5. Subscriptions",
        "paragraphs": [
          "Requesting deletion, removing a membership or uninstalling the app does not automatically cancel a subscription. Before closing your account, cancel renewal through the provider where you subscribed: Google Play, Apple or Lemon Squeezy. Settings → Subscription identifies the original provider.",
          "If you cannot sign in, mention your payment provider in your request; support will help you identify the cancellation process. You do not need to pay again to request deletion."
        ]
      },
      {
        "title": "6. From the app",
        "paragraphs": [
          "In UnoMesa on web, iOS or Android, open Settings → Account → Request account deletion. This page will open with the same instructions. You can also email support@unomesa.com directly.",
          "Existing ownership transfer and user-access removal controls retain their permission requirements. This support pathway lets you initiate a request even when an automatic control is unavailable for your role."
        ]
      }
    ]
  }
},
  "terms": {
    "es": {
      "title": "Términos y condiciones",
      "intro": "Condiciones aplicables al acceso y uso profesional de UnoMesa por restaurantes y sus usuarios autorizados.",
      "updatedOn": "2026-10-29",
      "sections": [
        {
          "title": "1. Proveedor y aceptación",
          "paragraphs": [
            "UnoMesa es una plataforma operada por UnoMesa LLC. Al crear, activar o utilizar una cuenta, el negocio contratante y sus usuarios autorizados aceptan estos términos, la Política de Privacidad y las condiciones del plan contratado. Quien acepta en nombre de un negocio declara tener autoridad suficiente."
          ]
        },
        {
          "title": "2. Servicio",
          "paragraphs": [
            "UnoMesa facilita la administración de reservaciones, clientes, cotizaciones, anticipos registrados, empleados, horarios, reportes y configuraciones. No constituye asesoría legal, contable, fiscal o laboral, ni sustituye un sistema oficial de facturación o procesamiento bancario."
          ]
        },
        {
          "title": "3. Cuentas y roles",
          "paragraphs": [
            "El administrador principal controla invitaciones y permisos. Las credenciales son personales. El negocio debe mantener actualizados sus usuarios, desactivar accesos innecesarios y proteger sus dispositivos. El negocio responde por las acciones realizadas mediante sus cuentas, salvo fallas atribuibles directamente a UnoMesa."
          ]
        },
        {
          "title": "4. Datos del cliente",
          "paragraphs": [
            "El negocio conserva la titularidad de la información que incorpora. Autoriza a UnoMesa LLC y a sus proveedores técnicos a alojarla y procesarla únicamente para operar, asegurar, respaldar y mejorar el servicio. El negocio garantiza que puede tratar legítimamente los datos de sus clientes y empleados."
          ]
        },
        {
          "title": "4.1. Contenido y marcas dentro del servicio",
          "paragraphs": [
            "Antes de incorporar nombres comerciales, logotipos, fotografías, menús, documentos u otros contenidos, el negocio debe contar con su titularidad o con las autorizaciones necesarias para los usos que solicite a UnoMesa. La autorización operativa de la sección anterior comprende alojar, reproducir y mostrar esos contenidos a los usuarios autorizados y en los documentos que el negocio genere. Si el negocio activa una página pública, también comprende publicar los contenidos que haya seleccionado para esa página. Esta autorización es limitada a prestar esas funciones y no transfiere la propiedad del contenido.",
            "Publicar una página del restaurante o cargar su logotipo no autoriza por sí solo a UnoMesa a incorporarlo a sus propias campañas, listas públicas de clientes o testimonios. Esos usos se rigen por la sección 14."
          ]
        },
        {
          "title": "5. Prueba, pagos y renovación",
          "paragraphs": [
            "La duración de la prueba, precio, moneda, impuestos, periodicidad y fecha de renovación se mostrarán antes de contratar. Una suscripción recurrente solo se cobrará con autorización expresa. Salvo indicación distinta, la cancelación evita renovaciones futuras y el servicio continúa hasta finalizar el período pagado."
          ]
        },
        {
          "title": "6. Mora y acceso restringido",
          "paragraphs": [
            "Ante falta de pago podrá aplicarse un período de gracia. Después, la cuenta podrá pasar a modo de solo lectura para permitir la consulta y exportación durante el plazo informado. Vencido ese plazo, el acceso podrá suspenderse, sin perjuicio de las obligaciones legales de conservación."
          ]
        },
        {
          "title": "7. Uso permitido",
          "paragraphs": [
            "No se permite vulnerar controles, acceder a otros negocios, introducir código malicioso, realizar cargas automatizadas abusivas, usar datos obtenidos ilegalmente, revender el servicio sin autorización o emplearlo para actividades ilícitas. UnoMesa podrá limitar o suspender accesos ante un riesgo razonable."
          ]
        },
        {
          "title": "8. Disponibilidad y terceros",
          "paragraphs": [
            "UnoMesa procurará una disponibilidad razonable, pero no garantiza operación ininterrumpida. Puede depender de Supabase, Vercel, proveedores de correo, pagos y comunicaciones. Podrán realizarse mantenimientos y medidas de emergencia para proteger el sistema."
          ]
        },
        {
          "title": "9. Verificación de información",
          "paragraphs": [
            "El negocio debe revisar fechas, horarios, áreas, precios, impuestos, descuentos, propinas, anticipos, saldos y documentos antes de utilizarlos o enviarlos. UnoMesa no garantiza que la información introducida por el usuario sea correcta."
          ]
        },
        {
          "title": "10. Propiedad intelectual",
          "paragraphs": [
            "UnoMesa LLC conserva los derechos sobre UnoMesa, su código, diseño, documentación y marcas. La suscripción concede un derecho limitado, revocable, no exclusivo y no transferible de uso interno durante la vigencia del servicio."
          ]
        },
        {
          "title": "11. Responsabilidad",
          "paragraphs": [
            "En la máxima medida permitida por la ley, UnoMesa no responderá por daños indirectos, lucro cesante o decisiones tomadas con información no verificada. La responsabilidad acumulada de UnoMesa LLC se limitará a lo pagado por el cliente durante los doce meses anteriores al hecho, excepto cuando la ley prohíba esa limitación."
          ]
        },
        {
          "title": "12. Terminación y exportación",
          "paragraphs": [
            "El cliente puede cancelar conforme a su plan. La eliminación completa de un negocio requerirá confirmación del administrador. Los registros podrán conservarse temporalmente en papelera o respaldos técnicos conforme a la Política de Privacidad; un respaldo técnico no garantiza restauración individual."
          ]
        },
        {
          "title": "13. Cambios y legislación",
          "paragraphs": [
            "Los cambios materiales se notificarán razonablemente y podrán requerir nueva aceptación. Estos términos se rigen principalmente por las leyes de Guatemala. Las normas obligatorias aplicables de México o Estados Unidos prevalecerán para clientes ubicados allí. Las partes procurarán una solución de buena fe antes de acudir a la autoridad competente."
          ]
        },
        {
          "title": "14. Referencias comerciales y autorización de marca",
          "paragraphs": [
            "El negocio puede autorizar voluntariamente a UnoMesa LLC a utilizar su nombre comercial y el logotipo que apruebe para identificarlo públicamente como cliente de UnoMesa. La autorización debe ser expresa, específica y separada de la contratación, otorgada por una persona con facultades suficientes y conservada por escrito, por ejemplo mediante correo electrónico. Suscribirse, pagar, aceptar los términos generales o no responder a una solicitud no equivale a conceder esta autorización. Negarse o retirarla no afecta el acceso al servicio ni el precio del plan.",
            "La autorización identificará el negocio y las marcas aprobadas, los canales permitidos, el territorio y su duración. Salvo acuerdo expreso distinto, se limita al sitio web y las presentaciones comerciales de UnoMesa, accesibles internacionalmente, mientras el negocio sea cliente activo y no retire su autorización. La licencia es no exclusiva, gratuita y revocable, no transfiere la propiedad de la marca ni permite cederla o sublicenciarla. Se respetarán las instrucciones de marca y no se alterará el logotipo salvo ajustes proporcionales de tamaño o formato.",
            "Una referencia como «Negocios que utilizan UnoMesa» debe corresponder a una relación real y vigente. Expresiones como «confían en UnoMesa», recomendaciones, testimonios, resultados o casos de éxito requieren además la aprobación expresa del texto o material concreto y deben reflejar una experiencia verdadera. La referencia no implica sociedad, patrocinio ni certificación. Las publicaciones en redes sociales y los anuncios pagados requieren que esos canales estén expresamente incluidos en la autorización.",
            "La autorización de marca no permite divulgar información de clientes o empleados, reservaciones, cotizaciones, ingresos, pagos, reportes, conversaciones ni capturas con datos privados. Cualquier uso adicional necesita una autorización específica y las demás condiciones legales aplicables. Si existe una compensación o incentivo por un testimonio, se informará cuando corresponda.",
            "El negocio puede retirar o limitar su autorización escribiendo a support@unomesa.com. Una vez verificada la solicitud, UnoMesa detendrá los nuevos usos y retirará las referencias de los canales bajo su control dentro de un máximo de diez días hábiles, o antes si la ley lo exige. Aplicará el mismo retiro al terminar la relación de cliente. No se distribuirán nuevas copias de materiales retirados; las copias ya entregadas y las cachés de terceros pueden permanecer fuera de su control. UnoMesa podrá conservar el comprobante de autorización y retiro para gestionar el permiso y atender obligaciones o controversias, sin reutilizarlo como publicidad. Esta sección no concede permisos retroactivos sobre negocios existentes."
          ]
        }
      ]
    },
    "en": {
      "title": "Terms and Conditions",
      "intro": "Terms governing professional access to and use of UnoMesa by restaurants and their authorized users.",
      "updatedOn": "2026-10-29",
      "sections": [
        {
          "title": "1. Provider and acceptance",
          "paragraphs": [
            "UnoMesa is a platform operated by UnoMesa LLC. By creating, activating, or using an account, the subscribing business and its authorized users accept these terms, the Privacy Policy, and the terms of the subscribed plan. Anyone accepting on behalf of a business represents that they have sufficient authority."
          ]
        },
        {
          "title": "2. Service",
          "paragraphs": [
            "UnoMesa supports the management of reservations, customers, quotes, recorded deposits, employees, schedules, reports, and settings. It does not provide legal, accounting, tax, or employment advice and does not replace an official invoicing or payment-processing system."
          ]
        },
        {
          "title": "3. Accounts and roles",
          "paragraphs": [
            "The primary administrator controls invitations and permissions. Credentials are personal. The business must keep users current, disable unnecessary access, and protect its devices. The business is responsible for actions performed through its accounts, except for failures directly attributable to UnoMesa."
          ]
        },
        {
          "title": "4. Customer data",
          "paragraphs": [
            "The business retains ownership of the information it enters. It authorizes UnoMesa LLC and its technical providers to host and process it solely to operate, secure, back up, and improve the service. The business represents that it may lawfully process customer and employee data."
          ]
        },
        {
          "title": "4.1. Content and trademarks within the service",
          "paragraphs": [
            "Before providing trade names, logos, photographs, menus, documents, or other content, the business must own it or hold the permissions required for the uses it requests from UnoMesa. The operational authorization in the previous section includes hosting, reproducing, and displaying that content to authorized users and in documents the business generates. If the business enables a public page, it also includes publishing the content selected for that page. This authorization is limited to providing those functions and does not transfer ownership of the content.",
            "Publishing a restaurant page or uploading its logo does not by itself authorize UnoMesa to include it in its own campaigns, public customer lists, or testimonials. Section 14 governs those uses."
          ]
        },
        {
          "title": "5. Trial, payments, and renewal",
          "paragraphs": [
            "The trial duration, price, currency, taxes, billing frequency, and renewal date will be shown before purchase. A recurring subscription will only be charged with express authorization. Unless stated otherwise, cancellation prevents future renewals and service continues through the paid period."
          ]
        },
        {
          "title": "6. Late payment and restricted access",
          "paragraphs": [
            "A grace period may apply after nonpayment. The account may then enter read-only mode to allow viewing and export during the stated period. Access may be suspended after that period, subject to legal retention obligations."
          ]
        },
        {
          "title": "7. Acceptable use",
          "paragraphs": [
            "Users may not bypass controls, access other businesses, introduce malicious code, perform abusive automated uploads, use unlawfully obtained data, resell the service without authorization, or use it for illegal activities. UnoMesa may limit or suspend access when a reasonable risk exists."
          ]
        },
        {
          "title": "8. Availability and third parties",
          "paragraphs": [
            "UnoMesa will seek reasonable availability but does not guarantee uninterrupted operation. It may depend on Supabase, Vercel, email, payment, and communications providers. Maintenance and emergency measures may be performed to protect the system."
          ]
        },
        {
          "title": "9. Information verification",
          "paragraphs": [
            "The business must review dates, times, areas, prices, taxes, discounts, tips, deposits, balances, and documents before using or sending them. UnoMesa does not guarantee that user-entered information is correct."
          ]
        },
        {
          "title": "10. Intellectual property",
          "paragraphs": [
            "UnoMesa LLC retains all rights in UnoMesa, its code, design, documentation, and trademarks. The subscription grants a limited, revocable, non-exclusive, non-transferable right for internal use during the service term."
          ]
        },
        {
          "title": "11. Liability",
          "paragraphs": [
            "To the fullest extent permitted by law, UnoMesa will not be liable for indirect damages, lost profits, or decisions based on unverified information. UnoMesa LLC's aggregate liability will be limited to amounts paid by the customer during the twelve months before the event, except where the law prohibits that limitation."
          ]
        },
        {
          "title": "12. Termination and export",
          "paragraphs": [
            "The customer may cancel according to its plan. Complete deletion of a business requires administrator confirmation. Records may remain temporarily in trash or technical backups under the Privacy Policy; a technical backup does not guarantee individual restoration."
          ]
        },
        {
          "title": "13. Changes and governing law",
          "paragraphs": [
            "Material changes will be reasonably notified and may require renewed acceptance. These terms are governed primarily by the laws of Guatemala. Mandatory rules of Mexico or the United States prevail for customers located there. The parties will seek a good-faith solution before resorting to the competent authority."
          ]
        },
        {
          "title": "14. Customer references and brand permission",
          "paragraphs": [
            "The business may voluntarily authorize UnoMesa LLC to use its trade name and approved logo to identify it publicly as a UnoMesa customer. Permission must be express, specific, separate from the subscription, granted by a duly authorized representative, and retained in writing, for example by email. Subscribing, paying, accepting the general terms, or not replying to a request does not grant this permission. Refusing or withdrawing permission does not affect service access or plan pricing.",
            "The permission will identify the business and approved trademarks, permitted channels, territory, and duration. Unless expressly agreed otherwise, it is limited to UnoMesa's website and sales presentations, accessible internationally, while the business remains an active customer and has not withdrawn permission. The license is non-exclusive, royalty-free, and revocable; it does not transfer trademark ownership and may not be assigned or sublicensed. Brand instructions will be respected, and the logo will not be altered except for proportional size or format adjustments.",
            "A reference such as 'Businesses using UnoMesa' must reflect a real, current customer relationship. Statements such as 'trust UnoMesa', recommendations, testimonials, results, or case studies additionally require express approval of the specific wording or material and must reflect a genuine experience. A reference does not imply partnership, sponsorship, or certification. Social media posts and paid advertisements require those channels to be expressly included in the permission.",
            "Brand permission does not authorize disclosure of customer or employee information, reservations, quotes, revenue, payments, reports, conversations, or screenshots containing private data. Any additional use requires specific permission and satisfaction of other applicable legal requirements. Compensation or incentives for a testimonial will be disclosed where required.",
            "The business may withdraw or limit permission by emailing support@unomesa.com. After verifying the request, UnoMesa will stop new uses and remove references from channels it controls within ten business days, or sooner if required by law. The same removal applies when the customer relationship ends. No new copies of withdrawn materials will be distributed; copies already delivered and third-party caches may remain beyond its control. UnoMesa may retain evidence of permission and withdrawal to administer the permission and address obligations or disputes, without reusing it for advertising. This section does not grant retroactive permission for existing customers."
          ]
        }
      ]
    }
  },
  "privacy": {
    "es": {
      "title": "Política de privacidad",
      "intro": "Cómo UnoMesa LLC recopila, utiliza, protege y conserva información al prestar UnoMesa.",
      "updatedOn": "2026-10-29",
      "sections": [
        {
          "title": "1. Información tratada",
          "paragraphs": [
            "Podemos tratar datos de cuenta, contacto, restaurante, suscripción, soporte, seguridad y uso. Por cuenta del restaurante alojamos datos que este registra sobre clientes, reservaciones, cotizaciones, empleados y horarios."
          ]
        },
        {
          "title": "2. Finalidades",
          "paragraphs": [
            "Utilizamos la información para autenticar usuarios, prestar funciones, enviar comunicaciones necesarias, prevenir fraude, mantener auditorías, brindar soporte, cumplir obligaciones legales y mejorar seguridad y rendimiento."
          ]
        },
        {
          "title": "3. Roles de privacidad",
          "paragraphs": [
            "El restaurante determina los fines de los datos de sus clientes y empleados y actúa como responsable. UnoMesa LLC los procesa como proveedor conforme a instrucciones del restaurante, salvo datos propios de cuenta, facturación, seguridad y cumplimiento."
          ]
        },
        {
          "title": "3.1. Confidencialidad de los datos del restaurante",
          "paragraphs": [
            "Los datos personales y operativos que registra cada restaurante, incluidos clientes, empleados, reservaciones, cotizaciones, precios, anticipos, horarios y reportes, se tratan como información confidencial. UnoMesa mantiene esta información separada por negocio. Dentro de la aplicación, su acceso se limita a usuarios autorizados del restaurante, conforme a sus roles y permisos.",
            "UnoMesa no vende los datos personales u operativos del restaurante ni los utiliza para publicidad de terceros. Tampoco los pone a disposición de otros restaurantes. El restaurante controla los documentos y archivos que sus usuarios decidan exportar, imprimir o compartir.",
            "El personal autorizado de UnoMesa y sus proveedores técnicos podrán tratar esta información o acceder a ella únicamente cuando sea necesario para prestar el servicio, brindar soporte, mantener la seguridad o cumplir una obligación legal, limitando el acceso a lo necesario y bajo obligaciones de confidencialidad."
          ]
        },
        {
          "title": "3.2. Páginas públicas y solicitudes de eventos",
          "paragraphs": [
            "El restaurante puede publicar voluntariamente su información de contacto, fotografías, menús, PDF y salones. Esos contenidos y archivos serán públicos. Los datos enviados por visitantes en el formulario de cotización (nombre, teléfono, correo, fecha, hora, personas, preferencias y detalles del evento) se entregan al restaurante correspondiente para atender la solicitud y elaborar una cotización. No se publican en la página del restaurante.",
            "Los enlaces a WhatsApp, correo y llamadas abren servicios externos. Las conversaciones que continúan allí no se incorporan automáticamente a UnoMesa. Una solicitud no confirma una reservación ni genera un cobro. Para ejercer derechos sobre una solicitud, contacte al restaurante que la recibió."
          ]
        },
        {
          "title": "3.3. Referencias públicas autorizadas",
          "paragraphs": [
            "Solo con autorización específica del negocio utilizaremos su nombre comercial y el logotipo aprobado para identificarlo como cliente en los canales autorizados. La suscripción y la carga de un logo no constituyen esa autorización. Los testimonios o afirmaciones de confianza requieren aprobación del material concreto, conforme a la sección 14 de los Términos. No se publican datos privados de clientes, empleados ni operaciones por esta autorización.",
            "Conservaremos la autorización, la identidad y el cargo del representante, la fecha, su alcance y los retiros para administrar el permiso y atender obligaciones o controversias. Puede solicitar su retiro en support@unomesa.com sin afectar su servicio. Cuando el nombre o logo identifique a una persona física, el uso público también deberá estar expresamente autorizado y cumplir los requisitos de protección de datos aplicables."
          ]
        },
        {
          "title": "4. Proveedores y transferencias",
          "paragraphs": [
            "Podemos utilizar proveedores de infraestructura, autenticación, alojamiento, correo, analítica y pagos, incluidos servicios ubicados fuera del país del usuario. Exigiremos medidas contractuales y técnicas apropiadas según el servicio y jurisdicción."
          ]
        },
        {
          "title": "4.1. Medición de rendimiento",
          "paragraphs": [
            "Utilizamos Vercel Speed Insights para medir tiempos de carga, respuesta y estabilidad visual. El servicio recoge métricas técnicas del navegador, dispositivo, conexión y país, sin grabar sesiones ni el contenido de formularios. La integración elimina parámetros y fragmentos de las direcciones, agrupa las páginas públicas de restaurantes sin enviar su nombre de enlace y excluye los enlaces de autenticación, invitaciones y archivos. No envía nombres de clientes, teléfonos, correos ni registros de reservaciones o cotizaciones como propiedades de medición. Esta medición técnica es independiente de la analítica publicitaria."
          ]
        },
        {
          "title": "5. Conservación",
          "paragraphs": [
            "Conservamos información mientras la cuenta esté activa y por períodos razonables posteriores para seguridad, respaldo, disputas y obligaciones legales. La papelera de la aplicación puede conservar registros hasta 365 días. Los respaldos técnicos siguen ciclos separados y no funcionan como archivo individual permanente."
          ]
        },
        {
          "title": "6. Seguridad",
          "paragraphs": [
            "Aplicamos controles de acceso, autenticación, separación por negocio, cifrado proporcionado por la infraestructura, registro de actividad y respaldos para prevenir accesos no autorizados, divulgación, pérdida o alteración de información. Ningún sistema puede garantizar la ausencia absoluta de filtraciones o incidentes. El cliente debe usar contraseñas únicas, MFA cuando esté disponible y dispositivos protegidos."
          ]
        },
        {
          "title": "7. Derechos y solicitudes",
          "paragraphs": [
            "Según la jurisdicción, una persona puede solicitar acceso, corrección, eliminación, oposición o portabilidad. Las solicitudes relativas a datos cargados por un restaurante deben dirigirse primero al restaurante. También puede escribir a support@unomesa.com."
          ]
        },
        {
          "title": "8. Incidentes",
          "paragraphs": [
            "Investigaremos incidentes confirmados y notificaremos al cliente afectado y, cuando corresponda, a autoridades o personas dentro de los plazos exigidos por la legislación aplicable."
          ]
        },
        {
          "title": "9. Menores",
          "paragraphs": [
            "UnoMesa es un servicio empresarial y no está dirigido a menores de edad. El cliente no debe cargar datos de menores salvo que cuente con una base legal y sean necesarios para su operación legítima."
          ]
        },
        {
          "title": "Asistente de inteligencia artificial",
          "paragraphs": [
            "El asistente de ayuda utiliza OpenAI para responder preguntas sobre UnoMesa. Al enviar una consulta, se transmiten su mensaje, un historial breve de la conversación, el idioma, el plan y el rol, junto con fragmentos del tutorial. No consulta automáticamente registros de clientes, cotizaciones, reservaciones ni empleados. Evite incluir datos personales, contraseñas o códigos. UnoMesa guarda el contador de uso y respuestas para evitar solicitudes duplicadas; no guarda el texto de las preguntas en este registro. El proveedor puede conservar datos conforme a sus políticas de seguridad y retención. Las respuestas pueden contener errores."
          ]
        }
      ]
    },
    "en": {
      "title": "Privacy Policy",
      "intro": "How UnoMesa LLC collects, uses, protects, and retains information while providing UnoMesa.",
      "updatedOn": "2026-10-29",
      "sections": [
        {
          "title": "1. Information processed",
          "paragraphs": [
            "We may process account, contact, restaurant, subscription, support, security, and usage data. On behalf of the restaurant, we host data it records about customers, reservations, quotes, employees, and schedules."
          ]
        },
        {
          "title": "2. Purposes",
          "paragraphs": [
            "We use information to authenticate users, provide features, send necessary communications, prevent fraud, maintain audits, provide support, comply with legal obligations, and improve security and performance."
          ]
        },
        {
          "title": "3. Privacy roles",
          "paragraphs": [
            "The restaurant determines the purposes for customer and employee data and acts as controller. UnoMesa LLC processes that data as a provider under the restaurant's instructions, except for its own account, billing, security, and compliance data."
          ]
        },
        {
          "title": "3.1. Confidentiality of restaurant data",
          "paragraphs": [
            "Personal and operational data entered by each restaurant, including customers, employees, reservations, quotes, prices, deposits, schedules, and reports, is treated as confidential information. UnoMesa keeps this information separate for each business. Within the application, access is limited to the restaurant’s authorized users, according to their roles and permissions.",
            "UnoMesa does not sell the restaurant’s personal or operational data or use it for third-party advertising. It does not make this data available to other restaurants. The restaurant controls the documents and files its users choose to export, print, or share.",
            "Authorized UnoMesa personnel and technical providers may process or access this information only as necessary to provide the service, offer support, maintain security, or meet a legal obligation, with access limited to what is necessary and subject to confidentiality obligations."
          ]
        },
        {
          "title": "3.2. Public pages and event requests",
          "paragraphs": [
            "The restaurant may voluntarily publish its contact information, photographs, menus, PDFs, and rooms. That content and those files will be public. Information submitted by visitors through the quote request form (name, phone number, email, date, time, number of guests, preferences, and event details) is provided to the relevant restaurant to handle the request and prepare a quote. It is not published on the restaurant’s page.",
            "WhatsApp, email, and call links open external services. Conversations that continue there are not automatically incorporated into UnoMesa. A request does not confirm a reservation or result in a charge. To exercise rights concerning a request, contact the restaurant that received it."
          ]
        },
        {
          "title": "3.3. Authorized public references",
          "paragraphs": [
            "Only with specific permission from the business will we use its trade name and approved logo to identify it as a customer in the authorized channels. Subscribing and uploading a logo do not grant that permission. Testimonials or statements of trust require approval of the specific material under section 14 of the Terms. This permission does not make private customer, employee, or operational data public.",
            "We retain the permission, the representative's identity and position, its date, scope, and withdrawals to administer the permission and address obligations or disputes. You may request withdrawal at support@unomesa.com without affecting your service. If a name or logo identifies an individual, public use must also be expressly authorized and comply with applicable data protection requirements."
          ]
        },
        {
          "title": "4. Providers and transfers",
          "paragraphs": [
            "We may use infrastructure, authentication, hosting, email, analytics, and payment providers, including services located outside the user's country. We will require appropriate contractual and technical safeguards based on the service and jurisdiction."
          ]
        },
        {
          "title": "4.1. Performance measurement",
          "paragraphs": [
            "We use Vercel Speed Insights to measure loading times, responsiveness, and visual stability. The service collects technical metrics about the browser, device, connection, and country, without recording sessions or form content. The integration removes URL parameters and fragments, groups public restaurant pages without sending their link names, and excludes authentication links, invitations, and files. It does not send customer names, phone numbers, email addresses, or reservation or quote records as measurement properties. This technical measurement is separate from advertising analytics."
          ]
        },
        {
          "title": "5. Retention",
          "paragraphs": [
            "We retain information while the account is active and for reasonable periods afterward for security, backup, disputes, and legal obligations. The application's trash may retain records for up to 365 days. Technical backups follow separate cycles and do not serve as a permanent individual archive."
          ]
        },
        {
          "title": "6. Security",
          "paragraphs": [
            "We apply access controls, authentication, business separation, infrastructure-provided encryption, activity logs, and backups to prevent unauthorized access, disclosure, loss, or alteration of information. No system can guarantee the complete absence of data leaks or incidents. Customers must use unique passwords, MFA where available, and protected devices."
          ]
        },
        {
          "title": "7. Rights and requests",
          "paragraphs": [
            "Depending on the jurisdiction, a person may request access, correction, deletion, objection, or portability. Requests concerning data uploaded by a restaurant should first be directed to that restaurant. You may also write to support@unomesa.com."
          ]
        },
        {
          "title": "8. Incidents",
          "paragraphs": [
            "We will investigate confirmed incidents and notify the affected customer and, where applicable, authorities or individuals within the timeframes required by applicable law."
          ]
        },
        {
          "title": "9. Minors",
          "paragraphs": [
            "UnoMesa is a business service and is not directed to minors. Customers must not upload minors' data unless they have a lawful basis and the data is necessary for legitimate operations."
          ]
        },
        {
          "title": "AI help assistant",
          "paragraphs": [
            "The help assistant uses OpenAI to answer questions about UnoMesa. Sending a question transmits your message, a short conversation history, language, plan and role, together with tutorial excerpts. It does not automatically access customer, quote, reservation or employee records. Avoid including personal data, passwords or codes. UnoMesa stores usage counts and responses to prevent duplicate requests; it does not store question text in this record. The provider may retain data under its security and retention policies. Answers may contain errors."
          ]
        }
      ]
    }
  },
  "subscriptions": {
    "es": {
      "title": "Suscripciones, cancelaciones y reembolsos",
      "intro": "Reglas comerciales aplicables a pruebas y planes pagados de UnoMesa.",
      "updatedOn": "2026-10-08",
      "sections": [
        {
          "title": "Prueba",
          "paragraphs": [
            "La prueba dura 10 días desde la activación. Al terminar sin pago confirmado se bloquea el acceso a los módulos del restaurante y sus invitados; el administrador principal puede activar un plan desde la pantalla de bloqueo. El bloqueo no elimina los registros en ese momento; se aplica la política de conservación indicada en la cuenta. No se realizará un cobro automático si el cliente no proporcionó un método de pago y autorizó claramente la renovación."
          ]
        },
        {
          "title": "Cobros",
          "paragraphs": [
            "Antes de confirmar se mostrará el plan, precio total, moneda, periodicidad, impuestos conocidos y próxima fecha de cobro. El cliente autoriza al procesador de pagos a efectuar cargos recurrentes hasta la cancelación."
          ]
        },
        {
          "title": "Cancelación",
          "paragraphs": [
            "El administrador podrá cancelar desde la cuenta cuando la función esté habilitada o mediante soporte. La cancelación será tan accesible como la contratación y detendrá cargos posteriores; no elimina inmediatamente los datos."
          ]
        },
        {
          "title": "Reembolsos",
          "paragraphs": [
            "Salvo error de cobro, duplicidad, indisponibilidad sustancial atribuible a UnoMesa o derecho obligatorio aplicable, los períodos ya iniciados no son reembolsables. Las solicitudes se evaluarán de buena fe y no limitan derechos legales irrenunciables."
          ]
        },
        {
          "title": "Mora",
          "paragraphs": [
            "Un pago rechazado puede generar avisos, período de gracia y modo de solo lectura. El cliente dispondrá del plazo mostrado para exportar información antes de una suspensión completa."
          ]
        }
      ]
    },
    "en": {
      "title": "Subscriptions, cancellations, and refunds",
      "intro": "Business terms for UnoMesa trials and paid plans.",
      "updatedOn": "2026-10-08",
      "sections": [
        {
          "title": "Trial",
          "paragraphs": [
            "The trial lasts 10 days from activation. When it ends without confirmed payment, access to restaurant modules is locked for the owner and invited users; the main administrator can activate a plan from the locked screen. Locking does not delete records at that moment; the retention policy shown in the account applies. No automatic charge is made unless the customer supplied a payment method and clearly authorized renewal."
          ]
        },
        {
          "title": "Charges",
          "paragraphs": [
            "Before confirmation, the plan, total price, currency, billing frequency, known taxes, and next charge date will be shown. The customer authorizes the payment processor to make recurring charges until cancellation."
          ]
        },
        {
          "title": "Cancellation",
          "paragraphs": [
            "The administrator may cancel from the account when the feature is enabled or through support. Cancellation will be as accessible as signup and will stop future charges; it does not immediately delete data."
          ]
        },
        {
          "title": "Refunds",
          "paragraphs": [
            "Except for billing errors, duplicate charges, substantial unavailability attributable to UnoMesa, or applicable mandatory rights, periods already started are nonrefundable. Requests will be evaluated in good faith and do not limit non-waivable legal rights."
          ]
        },
        {
          "title": "Late payment",
          "paragraphs": [
            "A declined payment may result in notices, a grace period, and read-only mode. The customer will have the displayed period to export information before full suspension."
          ]
        }
      ]
    }
  },
  "dataProcessing": {
    "es": {
      "title": "Acuerdo de tratamiento de datos",
      "intro": "Condiciones básicas bajo las cuales UnoMesa procesa datos por cuenta del restaurante contratante.",
      "updatedOn": "2026-10-08",
      "sections": [
        {
          "title": "Objeto e instrucciones",
          "paragraphs": [
            "UnoMesa LLC procesará los datos personales cargados por el cliente únicamente para prestar UnoMesa, conforme al contrato, configuración del cliente e instrucciones documentadas lícitas."
          ]
        },
        {
          "title": "Personas y datos",
          "paragraphs": [
            "El tratamiento puede comprender datos de clientes, prospectos, empleados y usuarios; datos identificativos, contacto, reservaciones, preferencias operativas, cotizaciones, horarios y registros de actividad. No deben cargarse datos sensibles innecesarios."
          ]
        },
        {
          "title": "Confidencialidad y seguridad",
          "paragraphs": [
            "UnoMesa LLC tratará como confidenciales los datos personales y operativos del restaurante, mantendrá su separación respecto de otros negocios y limitará el acceso dentro de UnoMesa a los usuarios autorizados del restaurante según sus permisos. No venderá estos datos ni los utilizará para publicidad de terceros ni los pondrá a disposición de otros restaurantes. El cliente administrará roles, credenciales, archivos compartidos y legitimidad de la información.",
            "El personal autorizado de UnoMesa y sus proveedores técnicos podrán tratar esta información o acceder a ella únicamente cuando sea necesario para prestar el servicio, brindar soporte, mantener la seguridad o cumplir una obligación legal, limitando el acceso a lo necesario y bajo obligaciones de confidencialidad.",
            "Aplicaremos las medidas de protección descritas en la Política de privacidad para prevenir accesos no autorizados y filtraciones. Los incidentes confirmados se investigarán y comunicarán conforme a dicha política y la legislación aplicable."
          ]
        },
        {
          "title": "Subencargados",
          "paragraphs": [
            "El cliente autoriza el uso de proveedores necesarios de infraestructura, autenticación, comunicaciones y pagos. UnoMesa LLC mantendrá obligaciones apropiadas con dichos proveedores y comunicará cambios materiales cuando corresponda."
          ]
        },
        {
          "title": "Asistencia",
          "paragraphs": [
            "UnoMesa brindará asistencia razonable para responder solicitudes de derechos, investigar incidentes y exportar o eliminar información, considerando la naturaleza del servicio y la información disponible."
          ]
        },
        {
          "title": "Finalización",
          "paragraphs": [
            "Al terminar el servicio, el cliente podrá exportar información durante el plazo aplicable. Después, los datos se eliminarán o anonimizarán conforme a la política de retención, excepto cuando una obligación legal exija conservarlos."
          ]
        },
        {
          "title": "Asistente de inteligencia artificial",
          "paragraphs": [
            "El asistente de ayuda utiliza OpenAI para responder preguntas sobre UnoMesa. Al enviar una consulta, se transmiten su mensaje, un historial breve de la conversación, el idioma, el plan y el rol, junto con fragmentos del tutorial. No consulta automáticamente registros de clientes, cotizaciones, reservaciones ni empleados. Evite incluir datos personales, contraseñas o códigos. UnoMesa guarda el contador de uso y respuestas para evitar solicitudes duplicadas; no guarda el texto de las preguntas en este registro. El proveedor puede conservar datos conforme a sus políticas de seguridad y retención. Las respuestas pueden contener errores."
          ]
        }
      ]
    },
    "en": {
      "title": "Data Processing Agreement",
      "intro": "Basic terms under which UnoMesa processes data on behalf of the subscribing restaurant.",
      "updatedOn": "2026-10-08",
      "sections": [
        {
          "title": "Purpose and instructions",
          "paragraphs": [
            "UnoMesa LLC will process personal data uploaded by the customer solely to provide UnoMesa, under the contract, customer settings, and lawful documented instructions."
          ]
        },
        {
          "title": "People and data",
          "paragraphs": [
            "Processing may include customer, prospect, employee, and user data; identification and contact data; reservations; operational preferences; quotes; schedules; and activity logs. Unnecessary sensitive data must not be uploaded."
          ]
        },
        {
          "title": "Confidentiality and security",
          "paragraphs": [
            "UnoMesa LLC will treat the restaurant’s personal and operational data as confidential, keep it separate from other businesses, and limit access within UnoMesa to the restaurant’s authorized users according to their permissions. It will not sell this data, use it for third-party advertising, or make it available to other restaurants. The customer will manage roles, credentials, shared files, and the lawfulness of the information.",
            "Authorized UnoMesa personnel and technical providers may process or access this information only as necessary to provide the service, offer support, maintain security, or meet a legal obligation, with access limited to what is necessary and subject to confidentiality obligations.",
            "We will apply the safeguards described in the Privacy Policy to prevent unauthorized access and data leaks. Confirmed incidents will be investigated and reported in accordance with that policy and applicable law."
          ]
        },
        {
          "title": "Subprocessors",
          "paragraphs": [
            "The customer authorizes the use of necessary infrastructure, authentication, communications, and payment providers. UnoMesa LLC will maintain appropriate obligations with those providers and communicate material changes when appropriate."
          ]
        },
        {
          "title": "Assistance",
          "paragraphs": [
            "UnoMesa will provide reasonable assistance with rights requests, incident investigations, and exporting or deleting information, considering the nature of the service and available information."
          ]
        },
        {
          "title": "Termination",
          "paragraphs": [
            "When service ends, the customer may export information during the applicable period. Data will then be deleted or anonymized under the retention policy, except where a legal obligation requires retention."
          ]
        },
        {
          "title": "AI help assistant",
          "paragraphs": [
            "The help assistant uses OpenAI to answer questions about UnoMesa. Sending a question transmits your message, a short conversation history, language, plan and role, together with tutorial excerpts. It does not automatically access customer, quote, reservation or employee records. Avoid including personal data, passwords or codes. UnoMesa stores usage counts and responses to prevent duplicate requests; it does not store question text in this record. The provider may retain data under its security and retention policies. Answers may contain errors."
          ]
        }
      ]
    }
  }
};
