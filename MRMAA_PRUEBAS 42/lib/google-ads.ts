import { isPublicLandingUrl } from "./meta-pixel";

// Public acquisition measurement only. Never pass form values or restaurant data.
export const GOOGLE_ADS_ID = "AW-10836285487";
export const GOOGLE_ADS_SIGNUP = "AW-10836285487/Sf2SCLLI5oYdEK-wkq8o";
const SCRIPT_ID = "unomesa-google-ads";
const entryUrl = typeof window === "undefined" ? "" : window.location.href;
const clickParameters = ["gclid", "dclid", "gbraid", "wbraid", "gad_source", "gad_campaignid"];

type Gtag = (...args: unknown[]) => void;
type AdsState = {
  registrations: Set<symbol>;
  initialized: boolean;
  completed: boolean;
};
type AdsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Gtag;
  __unomesaGoogleAds?: AdsState;
};

export function isGoogleAdsPublicUrl(href: string, registration = false): boolean {
  try {
    const url = new URL(href);
    // Tag Assistant adds this diagnostic flag. Never transmit it as page data.
    if (url.searchParams.has("gtm_debug")) {
      if (url.searchParams.getAll("gtm_debug").length !== 1
        || !/^\d+$/.test(url.searchParams.get("gtm_debug") || "")) return false;
      url.searchParams.delete("gtm_debug");
    }
    if (registration && url.searchParams.has("login")) {
      if (url.searchParams.getAll("login").length !== 1 || url.searchParams.get("login") !== "1") return false;
      url.searchParams.delete("login");
    }
    return isPublicLandingUrl(url.href);
  } catch { return false; }
}

function publicPageLocation(href: string): string {
  const source = new URL(href);
  const page = new URL(source.origin + "/");
  for (const key of clickParameters) {
    const value = source.searchParams.get(key);
    if (value && /^[A-Za-z0-9._-]{1,512}$/.test(value)) page.searchParams.set(key, value);
  }
  return page.href;
}

function enabled(): boolean {
  return typeof window !== "undefined" && process.env.NODE_ENV === "production"
    && process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED !== "false";
}

function initialize(win: AdsWindow, state: AdsState): void {
  if (state.initialized) return;
  win.dataLayer ??= [];
  if (!win.gtag) {
    win.gtag = function () { win.dataLayer!.push(arguments); };
  }
  const gtag = win.gtag;
  // Queue synchronously: a slow tag must not lose a completed signup when the
  // existing UI immediately returns to sign-in. Nothing waits for Google.
  gtag("js", new Date());
  gtag("config", GOOGLE_ADS_ID, {
    send_page_view: false,
    allow_ad_personalization_signals: false,
    allow_enhanced_conversions: false,
    page_location: publicPageLocation(entryUrl),
    page_referrer: "",
    page_title: "UnoMesa",
  });
  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
    script.referrerPolicy = "no-referrer";
    document.head.appendChild(script);
  }
  state.initialized = true;
}

/** Called only from the anonymous landing or the public signup component. */
function startGoogleAds(registration: boolean): () => void {
  const noop = () => {};
  try {
    if (!enabled() || !isGoogleAdsPublicUrl(entryUrl, registration)
      || !isGoogleAdsPublicUrl(window.location.href, registration)) return noop;
    const win = window as AdsWindow;
    const state = win.__unomesaGoogleAds ??= {
      registrations: new Set(), initialized: false, completed: false,
    };
    initialize(win, state);
    const owner = Symbol("public-signup");
    if (registration) state.registrations.add(owner);
    return () => { state.registrations.delete(owner); };
  } catch { return noop; }
}

export function startLandingGoogleAds(): () => void { return startGoogleAds(false); }
export function startRegistrationGoogleAds(): () => void { return startGoogleAds(true); }

/** Called by Registro_exitoso only, after /api/register returns ok: true. */
export function trackGoogleAdsRegistration(): void {
  try {
    if (!enabled() || !isGoogleAdsPublicUrl(entryUrl, true)
      || !isGoogleAdsPublicUrl(window.location.href, true)) return;
    const win = window as AdsWindow;
    const state = win.__unomesaGoogleAds;
    if (!state?.initialized || !state.registrations.size || state.completed || !win.gtag) return;
    win.gtag("event", "conversion", {
      send_to: GOOGLE_ADS_SIGNUP,
      page_location: publicPageLocation(entryUrl),
      page_referrer: "",
      page_title: "UnoMesa",
    });
    state.completed = true;
  } catch { /* Measurement failures must never interrupt signup or sign-in. */ }
}
