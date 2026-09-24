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
      && ["", "#top", "#funciones", "#planes"].includes(url.hash);
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

/** Called only while the anonymous landing is mounted, after auth restoration. */
export function startLandingPixel(): () => void {
  const noop = () => {};
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "false") return noop;
  const win = window as PixelWindow;
  const state = win.__mrmaaMetaPixel ??= {
    entryUrl, active: new Set(), initialized: false, pageViewSent: false,
  };
  if (!isPublicLandingUrl(state.entryUrl) || !isPublicLandingUrl(win.location.href)) return noop;
  const owner = Symbol("landing");
  state.active.add(owner);
  // Measurement must never block navigation, sign-in or the public page.
  try {
    void loadPixel(win, state).then(ready => {
      if (!ready || !state.active.has(owner) || !isPublicLandingUrl(win.location.href)) return;
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
      if (!state.pageViewSent) {
        pixel("trackSingle", META_PIXEL_ID, "PageView");
        state.pageViewSent = true;
      }
    }).catch(noop);
  } catch { /* A blocked marketing script must not affect the application. */ }
  return () => {
    state.active.delete(owner);
    if (!state.active.size && state.initialized) {
      // Landing, signup and the private workspace share a document. Suspend
      // pixel transmission when leaving the landing, including sign-in/signup.
      try { win.fbq?.("consent", "revoke"); } catch { /* Non-blocking. */ }
    }
  };
}
