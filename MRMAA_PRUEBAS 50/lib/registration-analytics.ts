import { inject, track } from "@vercel/analytics";
import type { BeforeSendEvent } from "@vercel/analytics";
import { isPublicLandingUrl } from "./meta-pixel";

const entryUrl = typeof window === "undefined" ? "" : window.location.href;
const names = new Set(["Registro_abierto", "Registro_intento", "Registro_exitoso", "Registro_error"]);
const reasons = new Set(["browser_validation", "configuration", "closed", "password_mismatch", "password_policy", "terms", "captcha", "pending", "rate_limit", "server", "network"]);
let active = false;

// Allow the app's public login switch, but never auth callbacks or arbitrary parameters.
export function isRegistrationUrl(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.searchParams.has("login")) {
      if (url.searchParams.getAll("login").length !== 1 || url.searchParams.get("login") !== "1") return false;
      url.searchParams.delete("login");
    }
    return isPublicLandingUrl(url.href);
  } catch { return false; }
}

export function filterRegistrationEvent(event: BeforeSendEvent, entry: string, current: string, enabled: boolean): BeforeSendEvent | null {
  if (!enabled || !isRegistrationUrl(entry) || !isRegistrationUrl(current)
    || !isRegistrationUrl(event.url) || event.type !== "event") return null;
  const url = new URL(event.url);
  // SDK beforeSend exposes only type and URL. Event payloads are allowlisted in trackRegistration.
  return { type: "event", url: `${url.origin}${url.pathname}` };
}

export function startRegistrationAnalytics(): () => void {
  active = false;
  try {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production"
      || process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "false"
      || !isRegistrationUrl(entryUrl) || !isRegistrationUrl(window.location.href)) return () => {};
    active = true;
    inject({ mode: "production", debug: false, beforeSend: event =>
      filterRegistrationEvent(event, entryUrl, window.location.href, active) });
  } catch { active = false; }
  return () => { active = false; };
}

export function trackRegistration(name: "Registro_abierto" | "Registro_intento" | "Registro_exitoso" | "Registro_error", reason?: string): void {
  try {
    if (!names.has(name) || !active || typeof window === "undefined" || !isRegistrationUrl(window.location.href)) return;
    track(name, name === "Registro_error" && reason && reasons.has(reason) ? { reason } : undefined);
  } catch { /* Measurement must never interrupt registration. */ }
}
