import type { SupabaseClient } from "@supabase/supabase-js";
import { exportBudget, EXPORT_ROW_LIMIT } from "./export-limits";
import { requirePermission } from "./permissions";
import { validateScheduleRange, type ScheduleRow, type ShiftTimes } from "./schedule-range";
import { isCancelledReservation } from "./reservation-totals";
import { eventTimeParts } from "./local-date";

export type ReportKind = "allquotes" | "frequent" | "reserved" | "pending" | "approved" | "deposits" | "employees" | "conversion" | "cancellations" | "demand" | "balances" | "leadtime" | "comparison";
export type ReportRow = Record<string, string | number | null>;
export type ReportQuery = { restaurantId: string; kind: ReportKind; from: string; to: string; search: string; timezone: string };
export const localReport = (kind: ReportKind) => ["frequent", "pending", "employees"].includes(kind);
export const followupReport = (kind: ReportKind) => ["balances", "leadtime", "comparison"].includes(kind);
export const operationalReport = (kind: ReportKind) => ["conversion", "cancellations", "demand"].includes(kind);
const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const reportDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value;
export function filterReport(rows: ReportRow[], search: string, display?: (key: string, value: ReportRow[string]) => unknown) {
  const needle = normalize(search);
  return needle ? rows.filter(row => Object.entries(row).some(([key, value]) => normalize(value).includes(needle) || (display && normalize(display(key, value)).includes(needle)))) : rows;
}
export function validateReportQuery(query: ReportQuery) {
  validateScheduleRange(query.from, query.to);
  if ((followupReport(query.kind) || operationalReport(query.kind)) && (Date.parse(query.to) - Date.parse(query.from)) / 86400000 > 365)
    throw new Error("Seleccione un período de hasta 366 días para este reporte.");
}

// These corrected reports use existing tables and the caller's session/RLS.
// Nothing here writes data or creates/replaces database objects.
export async function requireReportAccess(client: SupabaseClient, restaurantId: string) {
  await requirePermission(client, restaurantId, "isAdmin");
  const result = await client.rpc("v2_account_billing", { p_restaurant: restaurantId });
  if (result.error) throw result.error;
  if (result.data?.plan_code !== "advanced") throw new Error("Reportes requiere el plan Advanced.");
}

/** Count-based paging also works when the service caps responses below our page size. */
export async function readReportSource<T extends { id: string }>(fetchPage: (offset: number, limit: number) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>, signal?: AbortSignal): Promise<T[]> {
  const output: T[] = [], seen = new Set<string>(), budget = exportBudget();
  let expected: number | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const result = await fetchPage(output.length, 500);
    if (result.error) throw result.error;
    if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("No se pudo comprobar que el reporte esté completo. Intente nuevamente.");
    if (result.count > EXPORT_ROW_LIMIT) throw new Error("Este reporte supera 10,000 registros de origen. Reduzca el rango de fechas.");
    if (expected !== null && expected !== result.count) throw new Error("Los datos cambiaron durante la consulta. Actualice el reporte.");
    expected = result.count;
    const batch = result.data || [];
    for (const row of batch) {
      if (seen.has(row.id)) throw new Error("Los datos cambiaron durante la consulta. Actualice el reporte.");
      seen.add(row.id);
    }
    budget.add(batch); output.push(...batch);
    if (output.length === expected) return output;
    if (!batch.length || output.length > expected) throw new Error("No se pudo comprobar que el reporte esté completo. Intente nuevamente.");
  }
}

type FrequentReservation = { id: string; client_id: string | null; client_name: string; phone: string | null; event_date: string; guests: number; status: string };
export function frequentReport(reservations: FrequentReservation[]): ReportRow[] {
  const active = reservations.filter(row => !isCancelledReservation(row.status));
  const identity = (row: FrequentReservation) => JSON.stringify([normalize(row.client_name), String(row.phone || "").replace(/\D/g, "")]);
  const known = new Map<string, Set<string>>();
  for (const row of active) if (row.client_id) {
    const ids = known.get(identity(row)) || new Set<string>(); ids.add(row.client_id); known.set(identity(row), ids);
  }
  const grouped = new Map<string, { row: ReportRow; date: string }>();
  for (const reservation of [...active].sort((a, b) => b.event_date.localeCompare(a.event_date) || a.id.localeCompare(b.id))) {
    const candidates = known.get(identity(reservation));
    const clientId = reservation.client_id || (candidates?.size === 1 ? [...candidates][0] : null);
    const key = clientId ? `id:${clientId}` : `legacy:${identity(reservation)}`;
    let group = grouped.get(key);
    if (!group) {
      group = { date: reservation.event_date, row: { Cliente: reservation.client_name, Telefono: reservation.phone || "", Reservaciones: 0, Invitados: 0, Ultima: reportDate(reservation.event_date) } };
      grouped.set(key, group);
    }
    group.row.Reservaciones = Number(group.row.Reservaciones) + 1;
    group.row.Invitados = Number(group.row.Invitados) + Number(reservation.guests || 0);
  }
  return [...grouped.entries()].sort((a, b) => Number(b[1].row.Reservaciones) - Number(a[1].row.Reservaciones) || b[1].date.localeCompare(a[1].date) || a[0].localeCompare(b[0])).map(([, group]) => group.row);
}

export type ReportEmployee = { id: string; name: string; employee_code: string | null; area_id: string | null };
export type ReportShift = ShiftTimes & { id: string; break_minutes: number };
const minutes = (value: string | null | undefined) => { const parts = eventTimeParts(value); return parts ? parts.hour * 60 + Number(parts.minute) : null; };
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function scheduledMinutes(row: ScheduleRow, shift?: ReportShift): { net: number; meal: number } | null {
  if (row.entry_type !== "work" || !shift) return null;
  const start = minutes(shift.start_time ?? shift.calculation_start_time), end = minutes(shift.end_time ?? shift.calculation_end_time);
  if (start === null || end === null) return null;
  const duration = end >= start ? end - start : end - start + 1440;
  let meal = Number(shift.break_minutes || 0);
  if (row.break_start || row.break_end) {
    const mealStart = minutes(row.break_start), mealEnd = minutes(row.break_end);
    if (mealStart === null || mealEnd === null) return null;
    meal = mealEnd >= mealStart ? mealEnd - mealStart : mealEnd - mealStart + 1440;
    const startOffset = (mealStart - start + 1440) % 1440;
    if (startOffset + meal > duration) return null;
  }
  if (!Number.isFinite(meal) || meal < 0 || meal > duration) return null;
  return { net: duration - meal, meal };
}
export function employeeReport(employees: ReportEmployee[], schedules: ScheduleRow[], shifts: ReportShift[], areas: { id: string; name: string }[]): ReportRow[] {
  const shiftById = new Map(shifts.map(row => [row.id, row])), areaById = new Map(areas.map(row => [row.id, row.name]));
  const byEmployee = new Map<string, ScheduleRow[]>();
  for (const row of schedules) { const list = byEmployee.get(row.employee_id) || []; list.push(row); byEmployee.set(row.employee_id, list); }
  // A missing reference must not silently erase historical assignments.
  const allEmployees = new Map(employees.map(row => [row.id, row]));
  for (const row of schedules) if (!allEmployees.has(row.employee_id)) allEmployees.set(row.employee_id, { id: row.employee_id, name: "Empleado no disponible", employee_code: row.employee_id, area_id: null });
  return [...allEmployees.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(employee => {
    let net = 0, meal = 0, unknown = 0;
    const days = new Set<string>(), rests = new Set<string>(), leaves = new Set<string>(), vacations = new Set<string>(), names = new Set<string>();
    for (const row of byEmployee.get(employee.id) || []) {
      names.add(areaById.get(row.area_id || employee.area_id || "") || "Sin área");
      if (row.entry_type === "rest") rests.add(row.work_date);
      else if (row.entry_type === "permission") leaves.add(row.work_date);
      else if (row.entry_type === "vacation") vacations.add(row.work_date);
      else if (row.entry_type === "work") {
        days.add(row.work_date);
        const duration = scheduledMinutes(row, shiftById.get(row.shift_id || ""));
        if (duration) { net += duration.net; meal += duration.meal; } else unknown++;
      }
    }
    if (!names.size) names.add(areaById.get(employee.area_id || "") || "Sin área");
    return { Empleado: employee.name, Codigo: employee.employee_code || "", Area: [...names].sort().join(", "), Dias: days.size, HorasNetas: round(net / 60), SinCalculo: unknown, HorasComida: round(meal / 60), Descansos: rests.size, Permisos: leaves.size, Vacaciones: vacations.size };
  });
}

export async function readLocalReport(client: SupabaseClient, query: ReportQuery, signal?: AbortSignal) {
  validateReportQuery(query);
  await requireReportAccess(client, query.restaurantId);
  const read = <T extends { id: string }>(table: string, columns: string, dateColumn?: string, trash = false, pending = false) => readReportSource<T>(async (offset, size) => {
    let request = client.from(table).select(columns, { count: "exact" }).eq("restaurant_id", query.restaurantId);
    if (dateColumn) request = request.gte(dateColumn, query.from).lte(dateColumn, query.to);
    if (trash) request = request.is("deleted_at", null);
    if (pending) request = request.eq("status", "pendiente");
    request = request.order("id").range(offset, offset + size - 1);
    if (signal) request = request.abortSignal(signal);
    const result = await request;
    return { ...result, data: result.data as unknown as T[] | null };
  }, signal);
  let output: ReportRow[];
  if (query.kind === "employees") {
    const [employees, schedules, shifts, areas] = await Promise.all([
      read<ReportEmployee>("v2_employees", "id,name,employee_code,area_id"),
      read<ScheduleRow>("v2_schedules", "id,employee_id,area_id,shift_id,work_date,entry_type,break_start,break_end,notes", "work_date"),
      read<ReportShift>("v2_shifts", "id,name,start_time,end_time,start_text,end_text,calculation_start_time,calculation_end_time,break_minutes"),
      read<{ id: string; name: string }>("v2_areas", "id,name"),
    ]);
    output = employeeReport(employees, schedules, shifts, areas);
  } else if (query.kind === "frequent") {
    output = frequentReport(await read<FrequentReservation>("v2_reservations", "id,client_id,client_name,phone,event_date,guests,status", "event_date", true));
  } else if (query.kind === "pending") {
    type PendingQuote = { id: string; quote_number: number; event_date: string; client_name: string; client_phone: string; total: number; status: string };
    output = (await read<PendingQuote>("v2_quotes", "id,quote_number,event_date,client_name,client_phone,total,status", "event_date", true, true))
      .sort((a, b) => b.event_date.localeCompare(a.event_date) || a.id.localeCompare(b.id))
      .map(row => ({ Numero: `#${row.quote_number}`, Fecha: reportDate(row.event_date), Cliente: row.client_name, Telefono: row.client_phone || "", Total: row.total, Estado: row.status }));
  } else throw new Error("Tipo de reporte no válido.");
  return filterReport(output, query.search);
}

export async function readReportPage(client: SupabaseClient, query: ReportQuery, offset: number, limit: number, signal?: AbortSignal) {
  validateReportQuery(query);
  const rpc = query.kind === "allquotes" ? "v2_all_quotes_report_rows" : followupReport(query.kind) ? "v2_followup_report_rows" : operationalReport(query.kind) ? "v2_operational_report_rows" : "v2_report_rows";
  const rows: ReportRow[] = [];
  let total: number | null = null;
  for (;;) {
    signal?.throwIfAborted();
    let request = client.rpc(rpc, { p_restaurant_id: query.restaurantId, p_kind: query.kind, p_from: query.from, p_to: query.to, p_search: query.search.trim(), p_offset: offset + rows.length, p_limit: limit - rows.length, ...(followupReport(query.kind) ? { p_timezone: query.timezone } : {}) });
    if (signal) request = request.abortSignal(signal);
    const result = await request;
    if (result.error) throw result.error;
    const values = (result.data || []) as { row_data: ReportRow; total_count: number | string }[];
    const count = Number(values[0]?.total_count || 0);
    if (total !== null && total !== count) throw new Error("Los datos cambiaron durante la consulta. Actualice el reporte.");
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("No se pudo comprobar que el reporte esté completo. Intente nuevamente.");
    total = count; rows.push(...values.map(value => value.row_data));
    if (rows.length >= limit || offset + rows.length >= total) return { rows, total };
    if (!values.length) throw new Error("No se pudo obtener el reporte completo. Intente nuevamente.");
  }
}

export async function readReportExport(client: SupabaseClient, query: ReportQuery, maxRows = EXPORT_ROW_LIMIT) {
  const budget = exportBudget(maxRows);
  if (localReport(query.kind)) { const rows = await readLocalReport(client, query); budget.add(rows); return rows; }
  if (query.search.trim()) {
    const rows = filterReport(await readReportExport(client, { ...query, search: "" }), query.search);
    budget.add(rows); return rows;
  }
  const output: ReportRow[] = [];
  let expected: number | null = null;
  for (;;) {
    const result = await readReportPage(client, query, output.length, 1000);
    if (result.total > maxRows) throw new Error(`El reporte supera ${maxRows.toLocaleString("en-US")} filas. Reduzca las fechas o la búsqueda.`);
    if (expected !== null && expected !== result.total) throw new Error("Los datos cambiaron durante la exportación. Intente nuevamente.");
    expected = result.total;
    budget.add(result.rows); output.push(...result.rows);
    if (output.length === expected) return output;
    if (!result.rows.length || output.length > expected) throw new Error("No se pudo obtener el reporte completo. Intente nuevamente.");
  }
}
