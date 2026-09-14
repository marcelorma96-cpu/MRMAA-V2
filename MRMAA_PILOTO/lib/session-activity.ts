export const ACTIVITY_KEY = "mrmaa-session-activity-v2";
export const IDLE_LIMIT = 60 * 60 * 1000;

export function remainingIdleTime(value: string | null, now = Date.now()) {
  const time = Number(value);
  if (!value || !Number.isFinite(time) || time <= 0 || time > now) return IDLE_LIMIT;
  return Math.max(0, IDLE_LIMIT - (now - time));
}
