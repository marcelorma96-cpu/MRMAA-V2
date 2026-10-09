import { formatEventTime } from "./local-date";
import { translate, type AppLanguage } from "./translations";
import type { ReportKind, ReportRow } from "./report-data";

export const reportTitles: Record<ReportKind, string> = {
  allquotes: "Todas las cotizaciones", frequent: "Clientes más frecuentes", reserved: "Clientes que han reservado",
  pending: "Cotizaciones pendientes", approved: "Cotizaciones aprobadas y valor de venta", deposits: "Anticipos registrados por cliente",
  employees: "Empleados, días y horas programadas", conversion: "Conversión de cotizaciones", cancellations: "Cancelaciones de reservaciones",
  demand: "Demanda por día y hora", balances: "Saldos de eventos próximos", leadtime: "Anticipación de reservaciones", comparison: "Comparación con el período anterior",
};
export const reportColumns: Record<ReportKind, string[]> = {
  allquotes: ["Numero", "Fecha", "Cliente", "Telefono", "Area", "Estado", "Total", "Anticipo", "Saldo"], balances: ["Fecha", "Cliente", "Numero", "Total", "Anticipo", "Saldo"],
  leadtime: ["Anticipación", "Reservaciones", "Porcentaje (%)"], comparison: ["Indicador", "Actual", "Anterior", "Diferencia"],
  conversion: ["Fecha", "Area", "Cotizaciones", "Convertidas", "ConversionPct"], cancellations: ["Fecha", "Hora", "Area", "Reservaciones", "Canceladas", "CancelacionPct"],
  demand: ["Fecha", "Hora", "Area", "Reservaciones", "Invitados"], frequent: ["Cliente", "Telefono", "Reservaciones", "Invitados", "Ultima"],
  reserved: ["Fecha", "Hora", "Cliente", "Telefono", "Area", "Invitados", "Estado"], pending: ["Numero", "Fecha", "Cliente", "Telefono", "Total", "Estado"],
  approved: ["Numero", "Fecha", "Cliente", "Venta", "Anticipo", "Saldo"], deposits: ["Fecha", "Cliente", "Origen", "Anticipo", "Metodo"],
  employees: ["Empleado", "Codigo", "Area", "Dias", "HorasNetas", "SinCalculo", "HorasComida", "Descansos", "Permisos", "Vacaciones"],
};
export const moneyColumn = (key: string) => ["Total", "Venta", "Anticipo", "Saldo"].includes(key);
export const percentColumn = (key: string) => ["ConversionPct", "CancelacionPct", "Porcentaje (%)"].includes(key);
const labels: Record<string, [string, string]> = {
  Numero: ["Número", "Number"], Telefono: ["Teléfono", "Phone"], Area: ["Área", "Area"], Ultima: ["Última reserva", "Last reservation"], Codigo: ["Código", "Code"],
  Dias: ["Días programados", "Scheduled days"], HorasNetas: ["Horas netas", "Net hours"], SinCalculo: ["Días sin cálculo", "Days without calculation"], HorasComida: ["Horas de comida", "Meal hours"],
  ConversionPct: ["Conversión (%)", "Conversion (%)"], CancelacionPct: ["Cancelación (%)", "Cancellation (%)"], Metodo: ["Método", "Method"],
};
export const reportColumnLabel = (key: string, language: AppLanguage) => labels[key]?.[language === "en" ? 1 : 0] || translate(key, language);
export function reportCell(key: string, value: ReportRow[string] | undefined, language: AppLanguage, timeFormat: unknown) {
  if (value === null || value === undefined) return "—";
  if (key === "Hora") return formatEventTime(String(value), timeFormat, translate(String(value) || "Sin hora", language));
  if (["Estado", "Indicador", "Anticipación"].includes(key)) return translate(String(value), language);
  // Customer names and catalog values must not be translated as UI labels.
  return value;
}
export function reportNote(kind: ReportKind, en: boolean) {
  const notes: Record<ReportKind, [string, string]> = {
    allquotes: ["Incluye todos los estados e importes registrados en las cotizaciones; no representa cobros.", "Includes all statuses and amounts recorded on quotes; these are not collected payments."],
    frequent: ["Excluye canceladas. Agrupa por cliente vinculado; sin vínculo, por nombre y teléfono. Usa los datos de la última reserva del período.", "Excludes cancellations. Groups linked customers by ID; otherwise by name and phone. Uses details from the latest reservation in the period."],
    reserved: ["Incluye reservas canceladas, identificadas por su estado.", "Includes cancelled reservations, identified by their status."],
    pending: ["Incluye solo el estado Pendiente, también en eventos pasados. No incluye aprobadas, convertidas ni canceladas.", "Includes only Pending status, including past events. Excludes approved, converted and cancelled quotes."],
    approved: ["Incluye cotizaciones aprobadas y convertidas, con los importes guardados en la cotización. El valor de venta no equivale a dinero cobrado.", "Includes approved and converted quotes, using amounts saved on the quote. Sales value is not money collected."],
    deposits: ["Usa el anticipo de la reserva; el de la cotización solo si no tiene reserva vinculada fuera de la papelera. Incluye canceladas. Son importes registrados, no un historial de pagos ni reembolsos; la fecha no es la del cobro.", "Uses the reservation deposit; the quote deposit only when no linked reservation exists outside trash. Includes cancellations. These are recorded amounts, not a payment or refund ledger; the date is not the collection date."],
    employees: ["Por fecha programada. Usa horas numéricas o auxiliares configuradas y admite turnos nocturnos. La comida de la casilla sustituye los minutos del turno. Sin cálculo indica horas o comidas incompletas o incompatibles; no suma esas duraciones. Descansos, permisos y vacaciones no suman horas. Incluye empleados inactivos; no es asistencia ni nómina.", "By scheduled date. Uses numeric or configured calculation times and supports overnight shifts. A meal on the assignment replaces the shift meal minutes. Days without calculation indicates missing or incompatible shift/meal times; those durations are excluded. Days off, leave and vacation add no hours. Includes inactive employees; this is not attendance or payroll."],
    conversion: ["Convertidas son cotizaciones con una reserva vinculada no cancelada. Cada porcentaje usa las cotizaciones de su fila.", "Converted means quotes linked to a non-cancelled reservation. Each percentage uses the quotes in its row."],
    cancellations: ["Reservaciones incluye todos los estados; Canceladas es parte de ese total. Cada porcentaje corresponde a su fila.", "Reservations includes all statuses; Cancelled is part of that total. Each percentage applies to its row."],
    demand: ["Excluye canceladas. Agrupa por fecha, hora y área; invitados es la suma de personas reservadas.", "Excludes cancellations. Groups by date, hour and area; guests is the sum of booked people."],
    balances: ["Desde hoy hasta la fecha final seleccionada, dentro del rango. Usa saldos positivos guardados en cotizaciones con reserva vinculada no cancelada. Los importes de reserva y cotización se guardan por separado.", "From today through the selected end date, within the range. Uses positive balances saved on quotes linked to non-cancelled reservations. Reservation and quote amounts are stored separately."],
    leadtime: ["Excluye canceladas. Usa la fecha de ingreso a UnoMesa en la zona del dispositivo; en importaciones puede diferir de la reserva original. Los porcentajes usan todas las reservas del período, antes de la búsqueda.", "Excludes cancellations. Uses the date entered into UnoMesa in the device time zone; imports may differ from the original booking date. Percentages use all reservations in the period, before search."],
    comparison: ["Compara el período anterior de igual duración. Reservaciones incluye canceladas; Invitados las excluye. Conversión usa cotizaciones con reserva no cancelada; su diferencia se expresa en puntos porcentuales. Un guion indica falta de base para calcular.", "Compares the preceding period of equal length. Reservations includes cancellations; Guests excludes them. Conversion uses quotes linked to a non-cancelled reservation; its difference is in percentage points. A dash means no basis for calculation."],
  };
  return (kind === "employees" ? "" : en ? "Dates refer to the event; trash is excluded. " : "Las fechas corresponden al evento; se excluye la papelera. ") + notes[kind][en ? 1 : 0];
}
