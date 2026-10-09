import { TUTORIAL_GUIDE } from "./tutorial-guide";
import { planFor } from "./plans";
import { permissionsFor } from "./permissions";
import type { AppLanguage } from "./translations";

export type HelpModule = "reservations" | "clients" | "quotes" | "schedules" | "reports" | "settings";
export type HelpSection = "all" | "general" | HelpModule;
export type HelpTopic = { tab: HelpModule | null; title: string; text: string; details: string[] };
export type TourStep = HelpTopic & { id: string; guideSection: HelpSection };
export const helpSections: Record<HelpSection, [string, string]> = {
  all: ["Todos los módulos", "All modules"], general: ["Primeros pasos y ayuda", "Getting started and help"],
  reservations: ["Reservaciones", "Reservations"], clients: ["Clientes", "Customers"], quotes: ["Cotizaciones", "Quotes"],
  schedules: ["Horarios", "Schedules"], reports: ["Reportes", "Reports"], settings: ["Configuración y cuenta", "Settings and account"],
};
export function availableHelpTopics(language: AppLanguage, plan: string, isAdmin: boolean): HelpTopic[] {
  const access = planFor(plan), en = language === "en";
  return TUTORIAL_GUIDE.filter(topic => (!topic.adminOnly || isAdmin) && (topic.tab !== "reports" || (isAdmin && access.reports)) && (topic.tab !== "schedules" || access.schedules))
    .map(topic => ({ tab: topic.tab as HelpModule | null, title: en ? topic.titleEn : topic.title, text: en ? topic.textEn : topic.text, details: en ? topic.detailsEn : topic.details }));
}
export function helpMatches(topic: HelpTopic, query: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ignored = new Set("como donde para puedo puede quiero necesito que los las del una con how where what can the for".split(" "));
  const text = normalize([topic.title, topic.text, ...topic.details].join(" "));
  return normalize(query).split(/\s+/).filter(word => word.length > 1 && !ignored.has(word)).every(word => text.includes(word));
}
export function searchHelpTopics(topics: HelpTopic[], section: HelpSection, query: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = normalize(query).split(/\s+/).filter(word => word.length > 2);
  const score = (topic: HelpTopic) => words.reduce((total, word) => total + (normalize(topic.title).includes(word) ? 4 : 0) + (normalize(topic.text).includes(word) ? 1 : 0), 0);
  const matches = topics.filter(topic => (section === "all" || (topic.tab || "general") === section) && helpMatches(topic, query));
  return query.trim() ? matches.sort((a, b) => score(b) - score(a)) : matches;
}

/** The tour is intentionally separate from the full reference used by Guide and AI. */
export function quickTutorial(language: AppLanguage, plan: string, role: string, status: string): TourStep[] {
  const en = language === "en", access = planFor(plan), permissions = permissionsFor(role, status);
  const copy = (es: string, english: string) => en ? english : es;
  const steps: TourStep[] = [
    { id: "start", tab: null, guideSection: "general", title: copy("Empiece por lo esencial", "Start with the essentials"),
      text: copy("Un recorrido corto. Puede saltar de paso o cerrar cuando quiera.", "A short tour. Jump to any step or close it at any time."),
      details: [
        permissions.isAdmin ? copy("En Ayuda → Inicio rápido cree sus primeras áreas y productos. También está disponible si se registró con Google.", "Use Help → Quick setup to create your first areas and products. It is also available after Google registration.") : copy("El menú muestra los módulos de su plan. Las acciones dependen del rol asignado por su administrador.", "The menu shows your plan’s modules. Your administrator’s assigned role determines available actions."),
        copy("Siguiente abre el módulo de cada paso. No crea registros ni guarda formularios.", "Next opens each step’s module. It does not create records or save forms."),
        copy("En la app, toque una tarjeta para ver datos y acciones. Opciones reúne las demás herramientas; Ver instrucciones abre la ayuda.", "In the app, tap a card for details and actions. Options groups the other tools; View instructions opens help."),
      ] },
    { id: "quotes", tab: "quotes", guideSection: "quotes", title: copy("Cotice y dé seguimiento", "Quote and follow up"), text: copy("Cotizaciones reúne propuestas, documentos y seguimiento del evento.", "Quotes brings together proposals, documents and event follow-up."),
      details: permissions.canOperate ? [
        copy("Cree una cotización: busque el cliente y complete fecha, hora, área y productos.", "Create a quote: find the customer and enter the date, time, area and products."),
        copy("En una cotización ya guardada, pulse Pendientes y escriba lo que falta. Aparece arriba, en Recordatorios: Modificar abre la edición de la cotización; Quitar retira el aviso.", "On a saved quote, select Pending items and write what is missing. It appears under Reminders at the top: Edit opens the quote editor; Dismiss removes the reminder."),
        copy("Cuando el cliente confirme, conviértala en reservación. Se abre en su fecha y conserva el seguimiento vinculado.", "When the customer confirms, convert it to a reservation. It opens on its date and keeps the linked follow-up."),
      ] : [
        copy("Busque por cliente o número y seleccione las fechas que necesita.", "Search by customer or number and select the dates you need."),
        copy("Abra Ver para consultar el documento, el total y el anticipo.", "Open View to check the document, total and deposit."),
        copy("Su rol permite consultar. Pida al administrador los cambios o la conversión en reservación.", "Your role allows viewing. Ask the administrator to make changes or convert a quote to a reservation."),
      ] },
    { id: "reservations", tab: "reservations", guideSection: "reservations", title: copy("Organice sus reservaciones", "Organize reservations"), text: copy("Revise la fecha del evento antes de trabajar en el listado.", "Check the event date before working with the list."),
      details: [copy("Busque por cliente, fecha o área. Pendientes permite anotar lo que falta; las reservas y cotizaciones vinculadas comparten esas notas.", "Search by customer, date or area. Pending items lets you record what is missing; linked reservations and quotes share these notes."),
        permissions.canOperate ? copy("Al crear o editar, seleccione el cliente guardado. Revise el aviso de reservas cercanas antes de confirmar.", "When creating or editing, select the saved customer. Review nearby reservations before confirming.") : copy("Consulte los detalles y pida los cambios a un usuario con permiso de edición.", "Review the details and ask a user with editing permission to make changes."),
        permissions.canOperate ? copy("En Plano de mesas, toque una mesa para ver su agenda o reservar. El formulario y las cotizaciones también permiten elegir mesas.", "In Floor plan, select a table to view its schedule or book. Reservation and quote forms also let you choose tables.") : copy("En Plano de mesas consulte la distribución y los horarios. En Clientes consulte los datos guardados.", "In Floor plan, view the layout and times. Customers shows saved customer details."),
      ] },
  ];
  if (access.schedules) steps.push({ id: "schedules", tab: "schedules", guideSection: "schedules", title: copy("Revise el horario del equipo", "Review the team schedule"), text: copy("Seleccione el mes y el área que necesita.", "Select the month and area you need."),
    details: [permissions.canManageSchedules ? copy("Seleccione empleados y una fecha o rango; asigne Turno, Descanso, Permiso o Vacaciones.", "Select employees and a date or range; assign Shift, Day off, Leave or Vacation.") : copy("Consulte turnos, descansos, permisos y vacaciones; solicite cambios al administrador o gerente.", "Review shifts, days off, leave and vacation; ask an administrator or manager to make changes."),
      copy("Revise entrada, salida y comida. Vacaciones no suma horas de trabajo programadas.", "Check start, end and meal times. Vacation adds no scheduled work hours."),
      copy("En Descargar o imprimir horarios elija fechas y áreas; genere PDF, impresión o Excel según su permiso.", "Under Download or print schedules, choose dates and areas; generate PDF, print or Excel according to your permission."),
    ] });
  if (access.reports && permissions.isAdmin) steps.push({ id: "reports", tab: "reports", guideSection: "reports", title: copy("Compruebe sus reportes", "Check your reports"), text: copy("Disponibles para Administrador en Advanced.", "Available to Administrators on Advanced."),
    details: [copy("Elija reporte, fechas y búsqueda. Lea el criterio que aparece debajo de los filtros.", "Choose the report, dates and search. Read the calculation basis below the filters."),
      copy("Revise estados y fechas: clientes frecuentes excluye canceladas; horas programadas distingue vacaciones y días sin cálculo.", "Check statuses and dates: frequent customers excludes cancellations; scheduled hours identifies vacation and days without calculation."),
      copy("Use Actualizar si necesita recargar. Excel conserva números e incluye todas las filas filtradas dentro del límite.", "Use Refresh to reload. Excel keeps numeric values and includes all filtered rows within the limit."),
    ] });
  steps.push({ id: "account", tab: "settings", guideSection: "settings", title: copy("Cuide su cuenta", "Take care of your account"), text: copy("Configuración → Cuenta reúne su contraseña personal.", "Settings → Account contains your personal password controls."),
    details: [copy("Use Crear contraseña si entró con Google y aún no tiene una de UnoMesa; en otro caso, Cambiar contraseña.", "Use Create password if you joined with Google and have no UnoMesa password yet; otherwise, Change password."),
      copy("Escriba la nueva contraseña dos veces y complete la verificación que solicite la pantalla. No cambia su contraseña de Google.", "Enter the new password twice and complete any verification requested. This does not change your Google password."),
      permissions.isAdmin ? copy("En General puede completar datos y quitar el logo. Guarde los cambios; la confirmación aparece arriba unos segundos.", "In General, complete restaurant details or remove the logo. Save changes; confirmation appears at the top for a few seconds.") : copy("Verificación en dos pasos protege su acceso individual, también al ingresar con Google.", "Two-step verification protects your individual account, including Google sign-in."),
    ] });
  steps.push({ id: "help", tab: null, guideSection: "all", title: copy("Encuentre ayuda al momento", "Find help when you need it"), text: copy("No necesita memorizar todo el sistema.", "You do not need to memorize the whole system."),
    details: [copy("Instructivo: busque una función o filtre por módulo y abra el tema que necesita.", "Guide: search for a feature or filter by module and open the topic you need."),
      copy("Asistente UnoMesa: pregunte cómo realizar una tarea. Usa la misma referencia; no ve ni modifica sus registros.", "UnoMesa Assistant: ask how to perform a task. It uses the same reference; it cannot see or edit your records."),
      copy("El instructivo y este tutorial están disponibles en Ayuda y no consumen consultas de IA.", "The guide and this tutorial are available under Help and use no AI questions."),
    ] });
  return steps;
}
