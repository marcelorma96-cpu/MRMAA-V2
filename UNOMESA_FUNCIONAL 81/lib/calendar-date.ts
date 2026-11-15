/** Calendar dates stay in local time, including across daylight-saving changes. */
export function calendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(0);
  result.setHours(12, 0, 0, 0);
  result.setFullYear(year, month - 1, day);
  return result;
}

export function calendarISO(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftCalendarDay(value: string, delta: number): string {
  const date = calendarDate(value);
  date.setDate(date.getDate() + delta);
  return calendarISO(date);
}

/** Keep the day where possible; January 31 goes to February's last day. */
export function shiftCalendarMonth(value: string, delta: number): string {
  const date = calendarDate(value), day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  const end = new Date(date);
  end.setMonth(end.getMonth() + 1, 0);
  const last = end.getDate();
  date.setDate(Math.min(day, last));
  return calendarISO(date);
}

export function clampCalendarDate(value: string, min?: string, max?: string): string {
  const time = calendarDate(value).getTime();
  return min && time < calendarDate(min).getTime() ? min : max && time > calendarDate(max).getTime() ? max : value;
}

export function calendarMonthDays(value: string): string[] {
  const first = `${value.slice(0, 7)}-01`;
  const offset = calendarDate(first).getDay(); // Sunday first, with localized labels.
  return Array.from({length: 42}, (_, index) => shiftCalendarDay(first, index - offset));
}

export function calendarKeyDate(value: string, key: string, shift: boolean, min?: string, max?: string): string | null {
  const weekday = calendarDate(value).getDay();
  const deltas: Record<string, number> = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday};
  const next = key in deltas ? shiftCalendarDay(value, deltas[key]) : key === 'PageUp' ? shiftCalendarMonth(value, shift ? -12 : -1) : key === 'PageDown' ? shiftCalendarMonth(value, shift ? 12 : 1) : null;
  return next === null ? null : clampCalendarDate(next, min, max);
}
