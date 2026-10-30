import type { SupabaseClient } from "@supabase/supabase-js";
import { planFor } from "./plans";
import { permissionsFor } from "./permissions";

export type QuickStartTarget = "reservations" | "floor" | "quotes" | "clients" | "schedules" | "reports";
export type QuickStartProgress = { status: "active" | "dismissed" | "completed"; step: QuickStartTarget; updatedAt: number };
export type QuickStartStep = { id: QuickStartTarget; title: string; value: string; instructions: string[]; action: string; seconds: number };

// Presentation preferences only. Never use user metadata to authorize restaurant access.
export const quickStartMetadataKey = (restaurantId: string) => `unomesa_quick_start_${restaurantId}`;
export const quickStartStorageKey = (userId: string, restaurantId: string) => `unomesa:quick-start:${userId}:${restaurantId}`;
export function parseQuickStart(value: unknown): QuickStartProgress | null {
  if (!value || typeof value !== "object") return null;
  const state = value as QuickStartProgress;
  if (!["active", "dismissed", "completed"].includes(state.status) || !["reservations", "floor", "quotes", "clients", "schedules", "reports"].includes(state.step) || !Number.isFinite(state.updatedAt)) return null;
  return { status: state.status, step: state.step, updatedAt: state.updatedAt };
}
export function mergeQuickStart(local: QuickStartProgress | null, remote: QuickStartProgress | null) {
  if (local?.status === "completed") return local;
  if (remote?.status === "completed") return remote;
  return !local || (remote && remote.updatedAt > local.updatedAt) ? remote : local;
}
export async function saveQuickStart(client: SupabaseClient, userId: string, restaurantId: string, progress: QuickStartProgress) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error("QUICK_START_SESSION");
  const remote = parseQuickStart(data.user.user_metadata?.[quickStartMetadataKey(restaurantId)]);
  const saved = mergeQuickStart(progress, remote)!;
  // One top-level field per restaurant preserves other restaurants and unrelated profile fields.
  const result = await client.auth.updateUser({ data: { [quickStartMetadataKey(restaurantId)]: saved } });
  if (result.error) throw result.error;
  return saved;
}

export function quickStartSteps(en: boolean, plan: string, role: string, status: string): QuickStartStep[] {
  const permissions = permissionsFor(role, status), access = planFor(plan);
  if (!permissions.canRead || permissions.isSupport) return [];
  const c = (es: string, english: string) => en ? english : es;
  const steps: QuickStartStep[] = [
    { id: "reservations", seconds: 60, title: c("Sus reservas, en orden", "Reservations, organized"),
      value: c("Vea quién llega, a qué hora y cuántas personas recibirá.", "See who is arriving, when, and how many guests to expect."),
      instructions: [c("Abra el listado y cambie la fecha para consultar el día que necesita.", "Open the list and change the date to see the day you need."), permissions.canOperate ? c("Con Nuevo puede registrar cliente, hora, personas y área. Guarde solo cuando tenga una reserva real.", "Use New to enter a customer, time, party size and area. Save when you have a real reservation.") : c("Busque una reserva para consultar sus datos y estado.", "Find a reservation to check its details and status.")],
      action: c("Ver reservas", "View reservations") },
    { id: "floor", seconds: 45, title: c("Visualice su salón", "See your dining room"),
      value: c("Ubique mesas y consulte sus reservaciones desde el plano.", "Find tables and check their reservations on the floor plan."),
      instructions: [permissions.canManageFloorPlan ? c("Si el plano está vacío, podrá agregar áreas y mesas cuando quiera. No necesita dibujarlo ahora.", "If the plan is empty, you can add rooms and tables later. You do not need to draw it now.") : c("El administrador o gerente prepara las áreas y mesas del restaurante.", "Your administrator or manager sets up the restaurant's rooms and tables."), c("Seleccione una fecha y toque una mesa para consultar su agenda. Listado vuelve a sus reservas.", "Choose a date and select a table to check its schedule. List returns to your reservations.")],
      action: c("Ver plano de mesas", "View floor plan") },
    { id: "quotes", seconds: 90, title: c("De propuesta a reservación", "From proposal to reservation"),
      value: c("Prepare una cotización, comparta su PDF y conviértala en reserva cuando el cliente confirme.", "Prepare a quote, share its PDF and convert it to a reservation when the customer confirms."),
      instructions: [permissions.canOperate ? c("Con Nuevo agregue cliente, fecha, productos y precios. Los menús guardados agilizan la siguiente cotización.", "Use New to add a customer, date, items and prices. Saved menus make your next quote faster.") : c("Abra una cotización para revisar el evento, productos, total y anticipo.", "Open a quote to review the event, items, total and deposit."), permissions.canOperate ? c("En una cotización guardada puede ver el PDF, registrar el anticipo y convertirla en reserva sin volver a escribirla.", "On a saved quote, view the PDF, record a deposit and convert it to a reservation without re-entering it.") : c("Consulte el PDF y el seguimiento; un usuario con permisos de edición puede convertirla en reserva.", "View the PDF and follow-up; a user with editing permission can convert it to a reservation.")],
      action: c("Ver cotizaciones", "View quotes") },
    { id: "clients", seconds: 30, title: c("Recuerde a cada cliente", "Remember every customer"),
      value: c("Encuentre sus datos y reutilícelos en reservas y cotizaciones.", "Find customer details and reuse them in reservations and quotes."),
      instructions: [c("Busque por nombre, teléfono o correo antes de crear otro registro.", "Search by name, phone or email before creating another record."), c("Al preparar una reserva o cotización, seleccione el cliente guardado para completar sus datos.", "When preparing a reservation or quote, select the saved customer to fill in their details.")],
      action: c("Ver clientes", "View customers") },
  ];
  if (access.schedules) steps.push({ id: "schedules", seconds: 45, title: c("Organice a su equipo", "Organize your team"),
    value: c("Consulte turnos, descansos y cobertura del mes en un solo lugar.", "See shifts, days off and monthly coverage in one place."),
    instructions: [c("Seleccione el mes y un área de empleados para ver el horario.", "Select a month and employee area to see the schedule."), permissions.canManageSchedules ? c("Con empleados y turnos configurados, seleccione personas y fechas para asignar el horario. Puede imprimirlo o descargarlo.", "Once employees and shifts are set up, select people and dates to assign the schedule. You can print or download it.") : c("Consulte las asignaciones; el administrador o gerente realiza los cambios.", "View assignments; your administrator or manager makes changes.")],
    action: c("Ver horarios", "View schedules") });
  if (access.reports && permissions.isAdmin) steps.push({ id: "reports", seconds: 30, title: c("Tome decisiones con sus datos", "Make decisions with your data"),
    value: c("Revise eventos, anticipos, clientes y horas programadas.", "Review events, deposits, customers and scheduled hours."),
    instructions: [c("Elija un reporte y un rango de fechas para consultar sus resultados.", "Choose a report and date range to see your results."), c("Al guardar sus primeros datos, los reportes empezarán a llenarse. Puede exportarlos a Excel.", "Reports will fill as you save your first records. You can export them to Excel.")],
    action: c("Ver reportes", "View reports") });
  return steps;
}
