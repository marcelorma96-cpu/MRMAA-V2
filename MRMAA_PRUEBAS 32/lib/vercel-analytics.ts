import type { BeforeSendEvent } from "@vercel/analytics/react";
import { isPublicLandingUrl } from "./meta-pixel";

/** The app shares '/' between the landing and private views. URL alone is insufficient. */
export function filterLandingAnalytics(
  event: BeforeSendEvent,
  entryUrl: string,
  currentUrl: string,
  landingActive: boolean,
): BeforeSendEvent | null {
  if (!landingActive || event.type !== "pageview"
    || !isPublicLandingUrl(entryUrl) || !isPublicLandingUrl(currentUrl)
    || !isPublicLandingUrl(event.url)) return null;
  const url = new URL(event.url);
  // Never include query strings, fragments, authentication tokens or record IDs.
  return { type: "pageview", url: `${url.origin}${url.pathname}` };
}
