import type { BeforeSendEvent } from "@vercel/analytics/react";
import { isPublicLandingUrl } from "./meta-pixel";

/** The app shares '/' between the landing and private views. URL alone is insufficient. */
export function filterLandingAnalytics(
  event: BeforeSendEvent,
  entryUrl: string,
  currentUrl: string,
  landingActive: boolean,
  demoActive = false,
): BeforeSendEvent | null {
  // The SDK exposes only type and URL here. Demo event names/properties are
  // separately allowlisted by trackDemoEvent; accept events only while open.
  if (!landingActive || (event.type !== "pageview" && !(event.type === "event" && demoActive))
    || !isPublicLandingUrl(entryUrl) || !isPublicLandingUrl(currentUrl)
    || !isPublicLandingUrl(event.url)) return null;
  const url = new URL(event.url);
  // Never include query strings, fragments, authentication tokens or record IDs.
  return { type: event.type, url: `${url.origin}${url.pathname}` };
}
