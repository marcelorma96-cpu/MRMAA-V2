export const ACTIVITY_KEY = "mrmaa-session-activity-v2";
export const ACTIVITY_SESSION_KEY = 'mrmaa-activity-session';
export const IDLE_LIMIT = 60 * 60 * 1000;
export const ACTIVITY_EVENT = 'mrmaa-session-activity';
export const SESSION_CHECK_INTERVAL = 60 * 1000;

export function initializeSessionActivity(storage: Pick<Storage, 'getItem' | 'setItem'>, sessionId: string, now = Date.now()) {
  if (storage.getItem(ACTIVITY_SESSION_KEY) !== sessionId) {
    storage.setItem(ACTIVITY_SESSION_KEY, sessionId);
    storage.setItem(ACTIVITY_KEY, String(now));
  }
}

export function remainingIdleSeconds(value: string | null, now = Date.now()) {
  return Math.ceil(remainingIdleTime(value, now) / 1000);
}

export function remainingIdleTime(value: string | null, now = Date.now()) {
  const time = Number(value);
  if (!value || !Number.isFinite(time) || time <= 0 || time > now) return IDLE_LIMIT;
  return Math.max(0, IDLE_LIMIT - (now - time));
}

// Descriptive only: never used to decide identity or permissions.
export function deviceLabel(agent: string, touchPoints = 0) {
  const os = /Android/i.test(agent) ? 'Android' : /iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && touchPoints > 1) ? 'iOS / iPadOS' : /Windows/i.test(agent) ? 'Windows' : /Macintosh|Mac OS/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : 'Other / Otro';
  const browser = /Edg\//i.test(agent) ? 'Edge' : /OPR\//i.test(agent) ? 'Opera' : /Firefox|FxiOS/i.test(agent) ? 'Firefox' : /Chrome|CriOS/i.test(agent) ? 'Chrome' : /Safari/i.test(agent) ? 'Safari' : 'Browser / Navegador';
  return `${browser} · ${os}`;
}
