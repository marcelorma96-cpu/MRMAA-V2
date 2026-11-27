import type { ReportKind, ReportRow } from "./report-data";
import { reportColumns } from "./report-presentation";

export type ReportMetric = {
  label: string;
  value: number | string | null;
  format?: "number" | "money" | "percent" | "days";
  hint?: string;
};
export type ReportGrouping = "summary" | "month" | "area" | "weekday" | "hour" | "detail";
export type ReportAnalysis = {
  rows: ReportRow[];
  columns: string[];
  metrics: ReportMetric[];
  groupings: { value: ReportGrouping; label: string }[];
  grouping: ReportGrouping;
  description: string;
  chart?: { label: string; value: number; secondary?: string }[];
  chartLabel?: string;
  warnings: string[];
};
type Options = { from: string; to: string; today: string; en: boolean; grouping?: ReportGrouping };
type CivilDate = { day: number; month: string; weekday: number };
const DAY = 86_400_000;
const normalized = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Empty strings and null are missing values, never zero. Database numerics may be strings.
function number(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function civilDate(value: unknown): CivilDate | null {
  const text = String(value ?? "").trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  let year: number, month: number, date: number;
  if (match) [, year, month, date] = match.map(Number);
  else {
    match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (!match) return null;
    [, date, month, year] = match.map(Number);
  }
  const time = new Date(0);
  time.setUTCFullYear(year, month - 1, date);
  time.setUTCHours(0, 0, 0, 0);
  if (time.getUTCFullYear() !== year || time.getUTCMonth() !== month - 1 || time.getUTCDate() !== date) return null;
  return { day: time.getTime() / DAY, month: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`, weekday: (time.getUTCDay() + 6) % 7 };
}
function hour(value: unknown): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(am|pm)?$/i.exec(String(value ?? "").trim());
  if (!match || Number(match[2]) > 59 || (match[3] && Number(match[3]) > 59)) return null;
  let hours = Number(match[1]);
  if (match[4]) {
    if (hours < 1 || hours > 12) return null;
    hours = hours % 12 + (match[4].toLowerCase() === "pm" ? 12 : 0);
  } else if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:00`;
}
function group(rows: ReportRow[], key: (row: ReportRow) => string): Map<string, ReportRow[]> {
  const result = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const name = key(row);
    const members = result.get(name);
    if (members) members.push(row); else result.set(name, [row]);
  }
  return result;
}
function ratio(part: number | null, total: number | null): number | null {
  return part === null || total === null || total <= 0 || part < 0 || part > total ? null : part / total * 100;
}
function leadBand(value: unknown): { key: string; label: string; order: number; interpretable: boolean; within7: boolean; unknown: boolean } {
  const original = String(value ?? "").trim();
  const name = normalized(original).replace(/[–—−]/g, "-").replace(/\s+/g, " ");
  const bands = [
    { names: ["mismo dia", "same day", "0 dias", "0 days"], key: "same", label: "Mismo día", order: 0, within7: true },
    { names: ["1-3 dias", "1-3 days"], key: "1-3", label: "1–3 días", order: 1, within7: true },
    { names: ["4-7 dias", "4-7 days"], key: "4-7", label: "4–7 días", order: 2, within7: true },
    { names: ["8-30 dias", "8-30 days"], key: "8-30", label: "8–30 días", order: 3, within7: false },
    { names: ["mas de 30 dias", "over 30 days", ">30 dias", ">30 days"], key: "over30", label: "Más de 30 días", order: 4, within7: false },
  ];
  const band = bands.find(item => item.names.includes(name.replace(/\s*-\s*/g, "-")));
  if (band) return { ...band, interpretable: true, unknown: false };
  const invalid = !name || ["registro posterior o sin fecha", "entered after event or missing date", "sin fecha", "missing date"].includes(name) || /^-\d+(?:\s*-\s*-?\d+)?\s*(?:dias?|days?)$/.test(name);
  return { key: name || "missing", label: original || "Registro posterior o sin fecha", order: invalid ? 5 : 6, interpretable: false, within7: false, unknown: !invalid };
}

/** Read-only analysis of the complete report output, before search and pagination. */
export function analyzeReport(kind: ReportKind, source: ReportRow[], options: Options): ReportAnalysis {
  const { en } = options;
  const t = (es: string, english: string) => en ? english : es;
  const warnings: string[] = [];
  const warn = (message: string) => { if (!warnings.includes(message)) warnings.push(message); };
  const sum = (rows: ReportRow[], key: string, money = false): number | null => {
    let total = 0;
    for (const row of rows) {
      const value = number(row[key]);
      if (value === null || (!money && value < 0)) {
        warn(money
          ? t(`Hay importes incompletos o inválidos en ${key}; su total se muestra sin calcular.`, `Some ${key} amounts are missing or invalid; their total is unavailable.`)
          : t(`Hay valores incompletos o inválidos en ${key}; los indicadores afectados se muestran sin calcular.`, `Some ${key} values are missing or invalid; affected metrics are unavailable.`));
        return null;
      }
      total += value;
    }
    if (!Number.isFinite(total)) { warn(t("El total supera el rango numérico admitido.", "The total exceeds the supported numeric range.")); return null; }
    return total;
  };
  const metric = (label: string, value: number | string | null, format: ReportMetric["format"] = "number", hint?: string): ReportMetric => ({ label, value, format, ...(hint ? { hint } : {}) });
  const financial = (label: string, key: string) => metric(label, sum(source, key, true), "money");
  const result: ReportAnalysis = {
    rows: source.map(row => ({ ...row })), columns: [...reportColumns[kind]], metrics: [],
    groupings: [{ value: "detail", label: t("Detalle", "Details") }], grouping: "detail", description: "", warnings,
  };
  const choose = (choices: { value: ReportGrouping; label: string }[], fallback: ReportGrouping) => {
    result.groupings = choices;
    result.grouping = choices.some(item => item.value === options.grouping) ? options.grouping! : fallback;
    return result.grouping;
  };
  const areaName = (row: ReportRow) => String(row.Area ?? "").trim() || t("Sin área", "No area");
  const missingDate = t("Sin fecha válida", "Missing or invalid date");
  const dateOf = (row: ReportRow) => {
    const parsed = civilDate(row.Fecha);
    if (!parsed) warn(t("Los registros sin fecha válida se conservan en un grupo separado.", "Records without a valid date are retained in a separate group."));
    return parsed;
  };
  const chart = (rows: ReportRow[], labelKey: string, valueKey: string, title: string) => {
    result.chart = rows.flatMap(row => {
      const value = number(row[valueKey]);
      return value === null ? [] : [{ label: String(row[labelKey] ?? ""), value }];
    });
    result.chartLabel = title;
  };

  if (kind === "conversion" || kind === "cancellations") {
    const conversion = kind === "conversion";
    const totalKey = conversion ? "Cotizaciones" : "Reservaciones";
    const partKey = conversion ? "Convertidas" : "Canceladas";
    const rateKey = conversion ? "ConversionPct" : "CancelacionPct";
    const total = sum(source, totalKey), part = sum(source, partKey);
    const inconsistent = source.some(row => {
      const all = number(row[totalKey]), subset = number(row[partKey]);
      return all !== null && subset !== null && subset > all;
    });
    if (inconsistent) warn(t("Hay registros con una parte mayor que su total; la tasa afectada no se calcula.", "Some records have a subset greater than their total; affected rates are unavailable."));
    result.metrics = [
      metric(conversion ? t("Cotizaciones", "Quotes") : t("Reservaciones", "Reservations"), total),
      metric(conversion ? t("Convertidas", "Converted") : t("Canceladas", "Cancelled"), part),
      metric(conversion ? t("Conversión global", "Overall conversion") : t("Tasa de cancelación", "Cancellation rate"), inconsistent ? null : ratio(part, total), "percent", t("Calculada sobre todo el período seleccionado.", "Calculated across the entire selected period.")),
    ];
    if (!conversion) result.metrics.push(metric(t("No canceladas", "Not cancelled"), inconsistent || total === null || part === null ? null : total - part));
    result.description = conversion
      ? t("Cotizaciones y conversiones consolidadas por fecha del evento. Cada tasa usa su propio total de cotizaciones.", "Quotes and conversions consolidated by event date. Each rate uses its own quote total.")
      : t("Cancelaciones consolidadas por fecha del evento. La tasa divide canceladas entre todas las reservaciones.", "Cancellations consolidated by event date. The rate divides cancellations by all reservations.");
    const grouping = choose([{ value: "month", label: t("Por mes", "By month") }, { value: "area", label: t("Por área", "By area") }, { value: "detail", label: t("Detalle de origen", "Source detail") }], "month");
    if (grouping === "detail") return result;
    const key = grouping === "month" ? "Mes" : "Area";
    const groups = group(source, row => grouping === "month" ? dateOf(row)?.month || missingDate : areaName(row));
    result.rows = [...groups.entries()].sort(([a], [b]) => a === missingDate ? 1 : b === missingDate ? -1 : a.localeCompare(b)).map(([label, members]) => {
      const all = sum(members, totalKey), subset = sum(members, partKey);
      const invalid = members.some(row => number(row[partKey]) !== null && number(row[totalKey]) !== null && number(row[partKey])! > number(row[totalKey])!);
      return { [key]: label, [totalKey]: all, [partKey]: subset, [rateKey]: invalid ? null : ratio(subset, all) };
    });
    result.columns = [key, totalKey, partKey, rateKey];
    chart(result.rows, key, totalKey, conversion ? t("Cotizaciones por grupo", "Quotes by group") : t("Reservaciones por grupo", "Reservations by group"));
    return result;
  }

  if (kind === "demand") {
    const weekdays = en ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const from = civilDate(options.from), to = civilDate(options.to);
    const days = from && to && to.day >= from.day ? to.day - from.day + 1 : null;
    const exposures = Array<number>(7).fill(0);
    if (days !== null && from) {
      exposures.fill(Math.floor(days / 7));
      for (let index = 0; index < days % 7; index++) exposures[(from.weekday + index) % 7]++;
    } else warn(t("El rango de fechas no permite calcular promedios diarios.", "The date range does not support daily averages."));
    const total = sum(source, "Reservaciones"), guests = sum(source, "Invitados");
    // Validate dates even in another breakdown, so averages cannot hide missing dates.
    let incompleteDates = false;
    const weekdayGroups = group(source, row => {
      const parsed = dateOf(row);
      if (!parsed) { incompleteDates = true; return missingDate; }
      if (from && to && (parsed.day < from.day || parsed.day > to.day)) {
        incompleteDates = true;
        warn(t("Hay registros fuera del rango seleccionado; se conservan y los promedios diarios no se calculan.", "Some records fall outside the selected range; they are retained and daily averages are unavailable."));
      }
      return weekdays[parsed.weekday];
    });
    const busiest = weekdays.map(label => ({ label, count: sum(weekdayGroups.get(label) || [], "Reservaciones") })).filter(item => item.count !== null && item.count > 0).sort((a, b) => b.count! - a.count!);
    result.metrics = [
      metric(t("Reservaciones no canceladas", "Non-cancelled reservations"), total),
      metric(t("Invitados reservados", "Booked guests"), guests),
      metric(t("Reservas por día calendario", "Bookings per calendar day"), incompleteDates || !days || total === null ? null : total / days, "number", t("Incluye días sin reservas, aunque el restaurante no abra.", "Includes days without bookings, even when the restaurant is closed.")),
      metric(t("Día con más reservas", "Busiest weekday"), incompleteDates || total === null || !busiest.length ? null : busiest.filter(item => item.count === busiest[0].count).map(item => item.label).join(", ")),
    ];
    result.description = t("Reservaciones no canceladas agrupadas por día de semana, hora de inicio o área. El promedio divide entre las veces que ese día aparece en el rango.", "Non-cancelled reservations grouped by weekday, starting hour or area. Each weekday average divides by its calendar occurrences in the range.");
    const grouping = choose([{ value: "weekday", label: t("Día de semana", "Weekday") }, { value: "hour", label: t("Hora de inicio", "Starting hour") }, { value: "area", label: t("Por área", "By area") }, { value: "detail", label: t("Detalle de origen", "Source detail") }], "weekday");
    if (grouping === "detail") return result;
    const key = grouping === "weekday" ? "Dia" : grouping === "hour" ? "Hora" : "Area";
    let entries: [string, ReportRow[]][];
    if (grouping === "weekday") {
      entries = weekdays.map(label => [label, weekdayGroups.get(label) || []]);
      if (weekdayGroups.has(missingDate)) entries.push([missingDate, weekdayGroups.get(missingDate)!]);
    } else {
      const noHour = t("Sin hora válida", "Missing or invalid time");
      const groups = group(source, row => {
        if (grouping === "area") return areaName(row);
        const parsed = hour(row.Hora);
        if (!parsed) warn(t("Los registros sin hora válida se conservan en un grupo separado.", "Records without a valid time are retained in a separate group."));
        return parsed || noHour;
      });
      entries = [...groups.entries()].sort(([a], [b]) => a === noHour ? 1 : b === noHour ? -1 : a.localeCompare(b));
    }
    result.rows = entries.map(([label, members]) => {
      const count = sum(members, "Reservaciones");
      const row: ReportRow = { [key]: label, Reservaciones: count, Invitados: sum(members, "Invitados"), "Porcentaje (%)": ratio(count, total) };
      if (grouping === "weekday") {
        const exposure = exposures[weekdays.indexOf(label)];
        row.PromedioReservas = incompleteDates || !exposure || count === null ? null : count / exposure;
      }
      return row;
    });
    result.columns = [key, "Reservaciones", "Invitados", "Porcentaje (%)", ...(grouping === "weekday" ? ["PromedioReservas"] : [])];
    chart(result.rows, key, "Reservaciones", t("Reservaciones por grupo", "Reservations by group"));
    return result;
  }

  if (kind === "leadtime") {
    const translated: Record<string, string> = { "Mismo día": "Same day", "1–3 días": "1–3 days", "4–7 días": "4–7 days", "8–30 días": "8–30 days", "Más de 30 días": "Over 30 days", "Registro posterior o sin fecha": "Entered after event or missing date" };
    const bands = new Map<string, { band: ReturnType<typeof leadBand>; members: ReportRow[] }>();
    for (const row of source) {
      const band = leadBand(row["Anticipación"]);
      const existing = bands.get(band.key);
      if (existing) existing.members.push(row); else bands.set(band.key, { band, members: [row] });
    }
    const total = sum(source, "Reservaciones");
    const ordered = [...bands.values()].sort((a, b) => a.band.order - b.band.order || a.band.label.localeCompare(b.band.label));
    const understood = ordered.filter(item => item.band.interpretable);
    const unknown = ordered.some(item => item.band.unknown);
    const analyzable = sum(understood.flatMap(item => item.members), "Reservaciones");
    const within7 = sum(understood.filter(item => item.band.within7).flatMap(item => item.members), "Reservaciones");
    const common = understood.map(item => ({ band: item.band, count: sum(item.members, "Reservaciones") })).filter(item => item.count !== null && item.count > 0).sort((a, b) => b.count! - a.count!);
    if (unknown) warn(t("Hay rangos de anticipación no reconocidos. Se conservan en el total; el porcentaje de hasta 7 días no se calcula.", "Some lead-time bands are not recognized. They remain in the total; the share within 7 days is unavailable."));
    if (ordered.some(item => !item.band.interpretable)) warn(t("El total y los porcentajes incluyen registros posteriores al evento, sin fecha o con rango no interpretable.", "Totals and percentages include entries after the event, missing dates and uninterpretable bands."));
    const bandLabel = (label: string) => en ? translated[label] || label : label;
    result.metrics = [
      metric(t("Reservaciones", "Reservations"), total),
      metric(t("Con anticipación interpretable", "With interpretable lead time"), analyzable),
      metric(t("Rango más frecuente", "Most common band"), unknown || analyzable === null || !common.length ? null : common.filter(item => item.count === common[0].count).map(item => bandLabel(item.band.label)).join(", "), "number", t("Entre las anticipaciones interpretables.", "Among interpretable lead times.")),
      metric(t("Con hasta 7 días registrados", "Recorded within 7 days"), unknown ? null : ratio(within7, total), "percent", t("Sobre todas las reservas, incluidas las que no tienen una fecha interpretable.", "Of all reservations, including those without an interpretable date.")),
    ];
    result.description = t("Distribución consolidada por rangos de anticipación. Los porcentajes usan todas las reservaciones del período; no se estima una media ni una mediana a partir de rangos.", "Consolidated distribution by lead-time band. Percentages use all reservations in the period; no mean or median is estimated from ranges.");
    choose([{ value: "summary", label: t("Por anticipación", "By lead time") }, { value: "detail", label: t("Detalle de origen", "Source detail") }], "summary");
    if (result.grouping !== "detail") result.rows = ordered.map(({ band, members }) => {
      const count = sum(members, "Reservaciones");
      return { "Anticipación": bandLabel(band.label), Reservaciones: count, "Porcentaje (%)": ratio(count, total) };
    });
    chart(result.rows, "Anticipación", "Reservaciones", t("Reservaciones por anticipación", "Reservations by lead time"));
    return result;
  }

  if (kind === "deposits") {
    const noMethod = t("Sin método", "No method");
    const groups = group(source, row => String(row.Metodo ?? "").trim() || noMethod);
    result.metrics = [financial(t("Anticipos registrados", "Recorded deposits"), "Anticipo"), metric(t("Registros con anticipo", "Deposit records"), source.length), metric(t("Sin método registrado", "Without a payment method"), groups.get(noMethod)?.length || 0)];
    result.description = t("Anticipos consolidados por método, según la fecha del evento. Cada fila de origen se cuenta una vez; no es un historial de cobros ni reembolsos.", "Deposits consolidated by method and event date. Each source record is counted once; this is not a collection or refund ledger.");
    choose([{ value: "summary", label: t("Por método", "By method") }, { value: "detail", label: t("Detalle de origen", "Source detail") }], "summary");
    if (result.grouping !== "detail") {
      result.rows = [...groups.entries()].map(([method, members]) => ({ Metodo: method, Registros: members.length, Anticipo: sum(members, "Anticipo", true) })).sort((a, b) => b.Registros - a.Registros || a.Metodo.localeCompare(b.Metodo));
      result.columns = ["Metodo", "Registros", "Anticipo"];
    }
    return result;
  }

  if (kind === "allquotes") {
    result.metrics = [metric(t("Cotizaciones", "Quotes"), source.length), financial(t("Valor cotizado", "Quoted value"), "Total"), financial(t("Anticipos en cotizaciones", "Deposits on quotes"), "Anticipo"), financial(t("Saldo en cotizaciones", "Balance on quotes"), "Saldo")];
    result.description = t("Resumen de todas las cotizaciones y sus importes registrados, con el detalle para seguimiento.", "Summary of all quotes and their recorded amounts, with details for follow-up.");
  } else if (kind === "approved") {
    result.metrics = [metric(t("Cotizaciones aprobadas o convertidas", "Approved or converted quotes"), source.length), financial(t("Valor aprobado", "Approved value"), "Venta"), financial(t("Anticipos en cotizaciones", "Deposits on quotes"), "Anticipo"), financial(t("Saldo en cotizaciones", "Balance on quotes"), "Saldo")];
    result.description = t("Valor de las cotizaciones aprobadas o convertidas. Los importes registrados no equivalen a ventas cobradas.", "Value of approved or converted quotes. Recorded amounts are not collected sales.");
  } else if (kind === "pending") {
    const today = civilDate(options.today);
    const dates = source.map(dateOf);
    const past = today && dates.every(Boolean) ? dates.filter(date => date!.day < today.day).length : null;
    result.metrics = [metric(t("Cotizaciones pendientes", "Pending quotes"), source.length), financial(t("Valor pendiente de aprobación", "Value awaiting approval"), "Total"), metric(t("Con fecha de evento pasada", "Past event date"), past)];
    result.description = t("Pendientes de aprobación y su valor cotizado. Los eventos pasados ayudan a identificar cotizaciones que necesitan seguimiento.", "Quotes awaiting approval and their quoted value. Past event dates identify quotes needing follow-up.");
  } else if (kind === "frequent") {
    const count = sum(source, "Reservaciones");
    result.metrics = [metric(t("Clientes identificados", "Identified customers"), source.length), metric(t("Reservaciones no canceladas", "Non-cancelled reservations"), count), metric(t("Invitados reservados", "Booked guests"), sum(source, "Invitados")), metric(t("Clientes con 2 o más reservas", "Customers with 2+ reservations"), count === null ? null : source.filter(row => number(row.Reservaciones)! >= 2).length)];
    result.description = t("Frecuencia de reserva por cliente dentro del período seleccionado. La repetición se mide solo en ese período.", "Booking frequency per customer in the selected period. Repeat bookings are measured only within that period.");
  } else if (kind === "reserved") {
    const cancelled = (row: ReportRow) => ["cancelada", "cancelado", "cancelled", "canceled"].includes(normalized(row.Estado));
    const missingStatus = source.some(row => !normalized(row.Estado));
    if (missingStatus) warn(t("Hay reservas sin estado; los indicadores que dependen del estado no se calculan.", "Some reservations have no status; status-dependent metrics are unavailable."));
    const active = source.filter(row => !cancelled(row));
    result.metrics = [metric(t("Reservaciones", "Reservations"), source.length), metric(t("No canceladas", "Not cancelled"), missingStatus ? null : active.length), metric(t("Canceladas", "Cancelled"), missingStatus ? null : source.length - active.length), metric(t("Invitados no cancelados", "Guests on non-cancelled reservations"), missingStatus ? null : sum(active, "Invitados"))];
    result.description = t("Detalle de reservaciones por fecha del evento. Los invitados del resumen excluyen las canceladas.", "Reservation details by event date. Summary guest counts exclude cancelled reservations.");
  } else if (kind === "employees") {
    const days = sum(source, "Dias"), incomplete = sum(source, "SinCalculo");
    result.metrics = [metric(t("Empleados con días programados", "Employees with scheduled days"), days === null ? null : source.filter(row => number(row.Dias)! > 0).length), metric(t("Días de empleado programados", "Scheduled employee-days"), days, "number", t("Suma de días de cada empleado, no días únicos del calendario.", "Sum of each employee's days, not unique calendar days.")), metric(t("Horas netas calculadas", "Calculated net hours"), sum(source, "HorasNetas")), metric(t("Días sin cálculo", "Days without calculation"), incomplete)];
    if (incomplete !== null && incomplete > 0) warn(t("Las horas netas excluyen los días sin cálculo; revise los turnos incompletos.", "Net hours exclude days without a calculation; review incomplete shifts."));
    result.description = t("Carga de trabajo programada por empleado. Los días se suman por empleado y las horas no representan asistencia ni nómina.", "Scheduled workload by employee. Days are summed per employee; hours do not represent attendance or payroll.");
  } else if (kind === "balances") {
    result.metrics = [metric(t("Eventos con saldo", "Events with a balance"), source.length), financial(t("Saldo pendiente", "Outstanding balance"), "Saldo"), financial(t("Anticipos registrados", "Recorded deposits"), "Anticipo"), financial(t("Valor de cotizaciones", "Quote value"), "Total")];
    result.description = t("Saldos positivos en cotizaciones con reserva no cancelada, para eventos desde hoy dentro del rango seleccionado.", "Positive quote balances linked to non-cancelled reservations for events from today within the selected range.");
  } else if (kind === "comparison") {
    // Only explicit, unit-bearing known labels are promoted. Unknown indicators stay in the table.
    const known = [
      { names: ["reservaciones", "reservations"], label: t("Reservaciones", "Reservations"), percent: false },
      { names: ["invitados", "guests"], label: t("Invitados", "Guests"), percent: false },
      { names: ["conversion %", "conversion (%)"], label: t("Conversión", "Conversion"), percent: true },
    ];
    const formatted = (value: unknown, suffix: string) => {
      const numeric = number(value);
      return numeric === null ? "—" : `${new Intl.NumberFormat(en ? "en-US" : "es-GT", { maximumFractionDigits: 2 }).format(numeric)}${suffix}`;
    };
    result.metrics = known.flatMap(indicator => {
      const matches = source.filter(row => indicator.names.includes(normalized(row.Indicador)));
      if (matches.length !== 1) return [];
      const row = matches[0];
      return [metric(indicator.label, number(row.Actual), indicator.percent ? "percent" : "number", `${t("Anterior", "Previous")}: ${formatted(row.Anterior, indicator.percent ? "%" : "")} · ${t("Diferencia", "Difference")}: ${formatted(row.Diferencia, indicator.percent ? " pp" : "")}`)];
    });
    result.description = t("Comparación con el período anterior de igual duración. Cada fila conserva la unidad de su indicador; las diferencias de conversión se expresan en puntos porcentuales.", "Comparison with the previous period of equal length. Each row keeps its metric's unit; conversion differences are in percentage points.");
  }
  return result;
}
