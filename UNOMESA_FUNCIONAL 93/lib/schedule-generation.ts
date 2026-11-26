import { validateScheduleRange, type ScheduleRow } from "./schedule-range";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T12:00:00Z`);
const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);

export function scheduleGenerationRange(month: string) {
  const first = `${month}-01`;
  validateScheduleRange(first, first);
  const next = new Date(`${first}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { first, from: dateAt(utc(first) - 15 * DAY), to: dateAt(next.getTime() - DAY) };
}

// The source is exactly the 15 calendar days before the first unassigned day
// in the selected month. Repeat each employee's own pattern in date order.
export function prepareScheduleGeneration(rows: ScheduleRow[], employeeIds: string[], month: string) {
  const range = scheduleGenerationRange(month);
  const ids = [...new Set(employeeIds)];
  const byCell = new Map(rows.map(row => [`${row.employee_id}|${row.work_date}`, row]));
  const dates: string[] = [];
  for (let time = utc(range.first); time <= utc(range.to); time += DAY) dates.push(dateAt(time));
  const from = dates.find(date => ids.some(id => !byCell.has(`${id}|${date}`))) || null;
  const payload: Omit<ScheduleRow, "id">[] = [];
  const missing: { employeeId: string; dates: string[] }[] = [];
  if (!from) return { from, to: range.to, sourceFrom: null, sourceTo: null, employees: 0, payload, missing };
  const sourceFrom = dateAt(utc(from) - 15 * DAY), sourceTo = dateAt(utc(from) - DAY);
  const affected = ids.filter(id => dates.some(date => date >= from && !byCell.has(`${id}|${date}`)));
  for (const id of affected) {
    const absent: string[] = [];
    for (let offset = 0; offset < 15; offset++) {
      const date = dateAt(utc(sourceFrom) + offset * DAY);
      if (!byCell.has(`${id}|${date}`)) absent.push(date);
    }
    if (absent.length) missing.push({ employeeId: id, dates: absent });
  }
  // An incomplete history is not a day off: require explicit assignments.
  if (!missing.length) {
    for (const id of affected) for (const date of dates) {
      if (date < from || byCell.has(`${id}|${date}`)) continue;
      const offset = Math.round((utc(date) - utc(from)) / DAY) % 15;
      const source = byCell.get(`${id}|${dateAt(utc(sourceFrom) + offset * DAY)}`)!;
      if (source.entry_type === "vacation") continue;
      payload.push({ employee_id: id, work_date: date, area_id: source.area_id, entry_type: source.entry_type,
        shift_id: source.entry_type === "work" ? source.shift_id : null, color: source.color || null,
        break_start: source.entry_type === "work" ? source.break_start : null,
        break_end: source.entry_type === "work" ? source.break_end : null, notes: source.notes || "" });
    }
  }
  return { from, to: range.to, sourceFrom, sourceTo, employees: affected.length, payload, missing };
}
