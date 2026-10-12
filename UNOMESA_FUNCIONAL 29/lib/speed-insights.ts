import type { SpeedInsightsProps } from "@vercel/speed-insights";

type VitalEvent = Parameters<NonNullable<SpeedInsightsProps["beforeSend"]>>[0];

const paths = new Set([
  "/", "/es", "/mobile", "/login", "/restaurant-event-management",
  "/es/software-eventos-restaurantes", "/privacidad", "/terminos",
  "/tratamiento-datos", "/suscripciones",
]);
const allowedQueryKeys = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "dclid",
  "login", "signup", "app", "native",
]);

/** Only aggregate page names leave the browser. Callback and file URLs are excluded. */
export function speedInsightsPath(rawUrl: string, allowedOrigin: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.origin !== allowedOrigin || url.username || url.password) return null;
    // Unknown parameters can be credentials, invitations, private record IDs or searches.
    if ([...url.searchParams.keys()].some(key => !allowedQueryKeys.has(key.toLowerCase()))) return null;
    if (url.hash.includes("=") || url.hash.includes("%3D") || url.hash.includes("%3d")) return null;
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (paths.has(path)) return path;
    if (/^\/r\/[a-z0-9][a-z0-9-]*$/i.test(path)) return "/r/[slug]";
    return null;
  } catch { return null; }
}

export function filterSpeedInsights(
  event: VitalEvent, entryUrl: string, currentUrl: string, allowedOrigin: string,
): VitalEvent | null {
  if (event.type !== "vital" || !speedInsightsPath(entryUrl, allowedOrigin)
    || !speedInsightsPath(currentUrl, allowedOrigin)) return null;
  const path = speedInsightsPath(event.url, allowedOrigin);
  if (!path) return null;
  // Rebuild the SDK metadata: never forward arbitrary extra properties, URL
  // parameters, fragments, restaurant slugs or a route supplied by the event.
  return { type: "vital", url: `${allowedOrigin}${path}`, route: path };
}
