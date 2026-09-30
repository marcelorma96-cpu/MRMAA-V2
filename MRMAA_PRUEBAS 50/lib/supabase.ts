import { createClient } from "@supabase/supabase-js";
import { endSession } from "@/lib/session-control";
import { ACTIVITY_KEY } from "@/lib/session-activity";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
const authStorageKeys = new Set<string>();
let discardAuthWrites = false;
const browserSessionStorage = {
  getItem(key: string) {
    authStorageKeys.add(key);
    if (discardAuthWrites) return null;
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    authStorageKeys.add(key);
    if (discardAuthWrites) return;
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
};
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: browserSessionStorage,
    },
  },
);

let logoutPending: Promise<void> | null = null;
export const SESSION_SIGN_OUT_EVENT = 'unomesa:session-sign-out';
export function isSigningOut() { return logoutPending !== null || discardAuthWrites; }

function notifySignOut() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSION_SIGN_OUT_EVENT));
}

export function signOutCurrentSession() {
  if (logoutPending) return logoutPending;
  logoutPending = endSession({
    revoke: () => supabase.rpc('v2_session_close'),
    signOut: () => supabase.auth.signOut({ scope: 'local' }),
    forceLocal: () => {
      if (typeof window === 'undefined') return;
      // An outstanding refresh must not restore credentials during navigation.
      discardAuthWrites = true;
      for (const storageKey of authStorageKeys) window.sessionStorage.removeItem(storageKey);
      window.sessionStorage.removeItem(ACTIVITY_KEY);
      window.location.replace('/?login=1');
    },
  }).finally(() => {
    try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(ACTIVITY_KEY); } catch {}
    logoutPending = null;
    notifySignOut();
  });
  // The gate hides private screens while closing. Set the destination before
  // it unmounts HomeContent, whose SIGNED_OUT listener may no longer be present.
  if (typeof window !== 'undefined') {
    try { window.history.replaceState({}, '', `${window.location.pathname}?login=1`); } catch {}
  }
  // Synchronous invalidation precedes the first network request in endSession.
  notifySignOut();
  return logoutPending;
}
