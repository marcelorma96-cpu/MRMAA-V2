import { validateScheduleRange, type ScheduleRow } from "./schedule-range";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T12:00:00Z`);
const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);

export function scheduleCopyDates(from: string, to: string, destination: string) {
  validateScheduleRange(from, to);
  validateScheduleRange(destination, destination);
  const days = Math.round((utc(to) - utc(from)) / DAY) + 1;
  if (days > 366) throw new Error("Seleccione un período de hasta 366 días.");
  const end = dateAt(utc(destination) + (days - 1) * DAY);
  validateScheduleRange(destination, end);
  if (end > "9999-12-31") throw new Error("Seleccione un rango de fechas válido.");
  return { days, end, offset: utc(destination) - utc(from) };
}

export function prepareScheduleCopy(source: ScheduleRow[], existing: ScheduleRow[], employeeIds: string[], from: string, to: string, destination: string) {
  const dates = scheduleCopyDates(from, to, destination);
  const selected = new Set(employeeIds);
  if (!selected.size) throw new Error("Seleccione uno o varios empleados.");
  if (selected.size * dates.days > 5000) throw new Error("Seleccione menos empleados o un período más corto (máximo 5000 días de empleado).");
  const occupied = new Set(existing.map(row => `${row.employee_id}|${row.work_date}`));
  const payload: Omit<ScheduleRow, "id">[] = [];
  let skipped = 0, vacations = 0;
  for (const row of source) {
    if (!selected.has(row.employee_id) || row.work_date < from || row.work_date > to) continue;
    if (row.entry_type === "vacation") { vacations++; continue; }
    const work_date = dateAt(utc(row.work_date) + dates.offset);
    const key = `${row.employee_id}|${work_date}`;
    if (occupied.has(key)) { skipped++; continue; }
    occupied.add(key);
    payload.push({ employee_id: row.employee_id, work_date, area_id: row.area_id, entry_type: row.entry_type,
      shift_id: row.entry_type === "work" ? row.shift_id : null, color: row.color || null,
      break_start: row.entry_type === "work" ? row.break_start : null,
      break_end: row.entry_type === "work" ? row.break_end : null, notes: row.notes || "" });
  }
  return { payload, skipped, vacations, end: dates.end };
}
