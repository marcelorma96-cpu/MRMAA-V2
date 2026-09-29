import { exportBudget } from "./export-limits";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventTimeParts, formatEventTime } from "./local-date";

export type ScheduleRow = {
  id: string; employee_id: string; area_id: string | null; shift_id: string | null;
  color?: string | null; work_date: string; entry_type: string; break_start: string | null; break_end: string | null; notes: string;
};

export function validateScheduleRange(from: string, to: string) {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  if (!valid(from) || !valid(to) || to < from)
    throw new Error("Seleccione un rango de fechas válido.");
}

// Always query the selected range, not the currently displayed calendar.
// Pages stay tenant/date scoped and include a unique ordering tie-breaker.
export async function readScheduleRange(client: SupabaseClient, restaurantId: string, from: string, to: string) {
  validateScheduleRange(from, to);
  const output: ScheduleRow[] = [];
  const budget = exportBudget();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await client.from("v2_schedules")
      .select("id,employee_id,area_id,shift_id,work_date,entry_type,break_start,break_end,notes,color")
      .eq("restaurant_id", restaurantId).gte("work_date", from).lte("work_date", to)
      .order("work_date").order("id").range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    const batch = (result.data || []) as ScheduleRow[];
    budget.add(batch);
    output.push(...batch);
    if (batch.length < pageSize) return output;
  }
}

// Include inactive catalog entries referenced by historical assignments.
export async function readScheduleReferences<T>(client: SupabaseClient, restaurantId: string, table: string, columns: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))], output: T[] = [];
  for (let offset = 0; offset < unique.length; offset += 200) {
    const result = await client.from(table).select(columns)
      .eq("restaurant_id", restaurantId).in("id", unique.slice(offset, offset + 200));
    if (result.error) throw result.error;
    output.push(...(result.data || []) as unknown as T[]);
  }
  return output;
}

export const SCHEDULE_COLORS = [
  { value: "#dbeafe", es: "Azul", en: "Blue" },
  { value: "#dcfce7", es: "Verde", en: "Green" },
  { value: "#fef3c7", es: "Amarillo", en: "Yellow" },
  { value: "#ffedd5", es: "Durazno", en: "Peach" },
  { value: "#fce7f3", es: "Rosa", en: "Pink" },
  { value: "#ede9fe", es: "Lavanda", en: "Lavender" },
  { value: "#ccfbf1", es: "Menta", en: "Mint" },
  { value: "#e4e4e7", es: "Gris", en: "Gray" },
  { value: "#ffffff", es: "Blanco", en: "White" },
] as const;
export function scheduleCellColor(row?: { color?: string | null; entry_type: string }) {
  if (!row) return "#ffffff";
  if (SCHEDULE_COLORS.some(option => option.value === row.color)) return row.color!;
  return row.entry_type === "rest" ? "#e4e4e7" : row.entry_type === "permission" ? "#ffedd5" : "#dcfce7";
}

export type ShiftTimes = { name: string; start_time: string | null; end_time: string | null; start_text?: string | null; end_text?: string | null; calculation_start_time?: string | null; calculation_end_time?: string | null };
export type ShiftDraft = { name: string; start_time: string; end_time: string; start_text: string; end_text: string; start_mode: "time" | "text"; end_mode: "time" | "text"; calculation_start_time: string; calculation_end_time: string; start_calculate: boolean; end_calculate: boolean; break_minutes: number };
export function newShiftDraft(): ShiftDraft {
  return { name: "", start_time: "09:00", end_time: "17:00", start_text: "", end_text: "", start_mode: "time", end_mode: "time", calculation_start_time: "", calculation_end_time: "", start_calculate: false, end_calculate: false, break_minutes: 0 };
}
export function shiftDraftFromRow(shift: ShiftTimes & { break_minutes: number }): ShiftDraft {
  return { name: shift.name, start_time: shift.start_time?.slice(0,5) || "", end_time: shift.end_time?.slice(0,5) || "",
    start_text: shift.start_text || "", end_text: shift.end_text || "", start_mode: shift.start_text ? "text" : "time", end_mode: shift.end_text ? "text" : "time", calculation_start_time: shift.calculation_start_time?.slice(0,5) || "", calculation_end_time: shift.calculation_end_time?.slice(0,5) || "", start_calculate: Boolean(shift.calculation_start_time), end_calculate: Boolean(shift.calculation_end_time), break_minutes: shift.break_minutes || 0 };
}
/** Calculation times are explicit optional values, never inferred from free text. */
export function shiftDraftPayload(draft: ShiftDraft) {
  const name = draft.name.trim();
  if (!name || name.length > 120) return null;
  for (const side of ["start", "end"] as const) {
    if (draft[`${side}_mode`] === "text") {
      const value = draft[`${side}_text`].trim();
      if (!value || value.length > 40 || /[\r\n]/.test(value)) return null;
      if (draft[`${side}_calculate`] && !eventTimeParts(draft[`calculation_${side}_time`])) return null;
    } else if (!eventTimeParts(draft[`${side}_time`])) return null;
  }
  return { name, start_time: draft.start_mode === "time" ? draft.start_time : null,
    end_time: draft.end_mode === "time" ? draft.end_time : null,
    start_text: draft.start_mode === "text" ? draft.start_text.trim() : null,
    end_text: draft.end_mode === "text" ? draft.end_text.trim() : null,
    calculation_start_time: draft.start_mode === "text" && draft.start_calculate ? draft.calculation_start_time : null,
    calculation_end_time: draft.end_mode === "text" && draft.end_calculate ? draft.calculation_end_time : null,
    break_minutes: draft.break_minutes };
}
export function scheduleEndpointLabel(time: string | null | undefined, text: string | null | undefined, format: unknown) {
  return text?.trim() || formatEventTime(time, format);
}
export function scheduleShiftLabel(shift: ShiftTimes | undefined, format: unknown, compact = false) {
  if (!shift) return "";
  const hours = `${scheduleEndpointLabel(shift.start_time,shift.start_text,format)} - ${scheduleEndpointLabel(shift.end_time,shift.end_text,format)}`;
  return compact ? hours : [shift.name,hours].filter(Boolean).join('\n');
}
