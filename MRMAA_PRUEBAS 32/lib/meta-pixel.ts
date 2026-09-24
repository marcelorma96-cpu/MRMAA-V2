// Marketing measurement only. Never import restaurant records or Supabase here.
export const META_PIXEL_ID = "1105508185670938";
const SCRIPT_ID = "mrmaa-meta-pixel";
const SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";
const MARKETING_PARAMS = new Set([
  "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
]);

type Pixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Pixel;
  loaded: boolean;
  version: string;
};
type PixelState = {
  entryUrl: string;
  active: Set<symbol>;
  ready?: Promise<boolean>;
  initialized: boolean;
  pageViewSent: boolean;
  registrations: Set<symbol>;
  registrationCompleted: boolean;
};
type PixelWindow = Window & {
  fbq?: Pixel;
  _fbq?: Pixel;
  __mrmaaMetaPixel?: PixelState;
};

// Keep the original URL: an auth callback can remove its token before rendering.
const entryUrl = typeof window === "undefined" ? "" : window.location.href;

export function isPublicLandingUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:"
      && ["mrmaa.com", "www.mrmaa.com"].includes(url.hostname)
      && !url.port && !url.username && !url.password && url.pathname === "/"
      && [...url.searchParams.keys()].every(key => MARKETING_PARAMS.has(key))
      && ["", "#top", "#funciones", "#planes", "#demostracion"].includes(url.hash);
  } catch { return false; }
}

function loadPixel(win: PixelWindow, state: PixelState): Promise<boolean> {
  if (state.ready) return state.ready;
  state.ready = new Promise(resolve => {
    if (win.fbq?.callMethod) { resolve(true); return; }
    if (!win.fbq) {
      const pixel = function (...args: unknown[]) {
        if (pixel.callMethod) pixel.callMethod(...args);
        else pixel.queue.push(args);
      } as Pixel;
      pixel.queue = [];
      pixel.push = pixel;
      pixel.loaded = true;
      pixel.version = "2.0";
      win.fbq = pixel;
      if (!win._fbq) win._fbq = pixel;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = SCRIPT_URL;
    script.referrerPolicy = "no-referrer";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return state.ready;
}

function isPublicRegistrationUrl(href: string): boolean {
  try {
    const url = new URL(href);
    if (url.searchParams.has("login")) {
      if (url.searchParams.getAll("login").length !== 1 || url.searchParams.get("login") !== "1") return false;
      url.searchParams.delete("login");
    }
    return isPublicLandingUrl(url.href);
  } catch { return false; }
}

/** Owned by anonymous components only; never mounted in the dashboard. */
function startPixel(registration: boolean): () => void {
  const noop = () => {};
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "false") return noop;
  const win = window as PixelWindow;
  const state = win.__mrmaaMetaPixel ??= {
    entryUrl, active: new Set(), initialized: false, pageViewSent: false,
    registrations: new Set(), registrationCompleted: false,
  };
  const allowed = registration ? isPublicRegistrationUrl : isPublicLandingUrl;
  if (!allowed(state.entryUrl) || !allowed(win.location.href)) return noop;
  const owner = Symbol("landing");
  state.active.add(owner);
  if (registration) state.registrations.add(owner);
  // Measurement must never block navigation, sign-in or the public page.
  try {
    void loadPixel(win, state).then(ready => {
      if (!ready || !state.active.has(owner) || !allowed(win.location.href)) return;
      const pixel = win.fbq;
      if (!pixel) return;
      if (!state.initialized) {
        // Disable automatic form/button metadata and automatic event detection.
        // Do not provide advanced-matching data (email, phone, name, etc.).
        pixel("set", "autoConfig", false, META_PIXEL_ID);
        pixel("init", META_PIXEL_ID);
        state.initialized = true;
      }
      pixel("consent", "grant");
      if (!registration && !state.pageViewSent) {
        pixel("trackSingle", META_PIXEL_ID, "PageView");
        state.pageViewSent = true;
      }
    }).catch(noop);
  } catch { /* A blocked marketing script must not affect the application. */ }
  return () => {
    state.active.delete(owner);
    state.registrations.delete(owner);
    if (!state.active.size && state.initialized) {
      // Suspend transmission on login, recovery and private workspace.
      try { win.fbq?.("consent", "revoke"); } catch { /* Non-blocking. */ }
    }
  };
}


export function startLandingPixel(): () => void { return startPixel(false); }
export function startRegistrationPixel(): () => void { return startPixel(true); }

const registrationEvents = new Map([
  ["Registro_abierto", "Registro_abierto"],
  ["Registro_intento", "Registro_intento"],
  ["Registro_exitoso", "CompleteRegistration"],
  ["Registro_error", "Registro_error"],
]);

/** Only fixed event names; never accepts form values or provider error text. */
export function trackMetaRegistration(name: string): void {
  try {
    if (typeof window === "undefined" || process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "false") return;
    const win = window as PixelWindow;
    const state = win.__mrmaaMetaPixel;
    const event = registrationEvents.get(name);
    if (!state || !event || !state.registrations.size
      || !isPublicRegistrationUrl(state.entryUrl) || !isPublicRegistrationUrl(win.location.href)) return;
    const owners = [...state.registrations];
    const send = () => {
      if (!state.initialized || !owners.some(owner => state.registrations.has(owner))
        || !isPublicRegistrationUrl(win.location.href)) return;
      if (event === "CompleteRegistration" && state.registrationCompleted) return;
      win.fbq?.(event === "CompleteRegistration" ? "trackSingle" : "trackSingleCustom", META_PIXEL_ID, event);
      if (event === "CompleteRegistration") state.registrationCompleted = true;
    };
    if (state.initialized) send();
    else void state.ready?.then(send).catch(() => {});
  } catch { /* Ad blockers and marketing failures must not interrupt signup. */ }
}
