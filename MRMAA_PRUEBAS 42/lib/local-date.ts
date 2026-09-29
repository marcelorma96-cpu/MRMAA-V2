export function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Timestamps use the device's local day; event dates remain calendar strings. */
export function localTimestampDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateISO(date);
}

export type EventTimeFormat = "12h" | "24h";
export const eventTimeFormat = (value: unknown): EventTimeFormat => value === "12h" ? "12h" : "24h";

/** Wall-clock event times: no date, time-zone conversion or change to stored data. */
export function eventTimeParts(value?: string | null) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
  return match ? { hour: Number(match[1]), minute: match[2] } : null;
}

export function formatEventTime(value?: string | null, format?: unknown, empty = "—") {
  const parts = eventTimeParts(value);
  if (!parts) return empty;
  if (eventTimeFormat(format) === "24h") return `${String(parts.hour).padStart(2, "0")}:${parts.minute}`;
  return `${String(parts.hour % 12 || 12).padStart(2, "0")}:${parts.minute} ${parts.hour < 12 ? "AM" : "PM"}`;
}

export function eventTimeFromParts(hour: string, minute: string, period: string, format?: unknown) {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return "";
  let hours = Number(hour);
  if (Number(minute) > 59) return "";
  if (eventTimeFormat(format) === "12h") {
    if (hours < 1 || hours > 12 || !["AM", "PM"].includes(period)) return "";
    hours = hours % 12 + (period === "PM" ? 12 : 0);
  } else if (hours > 23) return "";
  return `${String(hours).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
