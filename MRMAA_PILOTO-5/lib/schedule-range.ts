import type { SupabaseClient } from "@supabase/supabase-js";

export type ScheduleRow = {
  id: string; employee_id: string; area_id: string | null; shift_id: string | null;
  work_date: string; entry_type: string; break_start: string | null; break_end: string | null; notes: string;
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
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await client.from("v2_schedules")
      .select("id,employee_id,area_id,shift_id,work_date,entry_type,break_start,break_end,notes")
      .eq("restaurant_id", restaurantId).gte("work_date", from).lte("work_date", to)
      .order("work_date").order("id").range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    const batch = (result.data || []) as ScheduleRow[];
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
