// This is a UI consent receipt, never an authorization credential. The server
// independently verifies the user, OAuth session, membership and rollout flags.
export const GOOGLE_LEGAL_VERSION = '2026-09-10';
const key = 'unomesa-google-registration-intent';
export type GoogleRegistrationIntent = {
  accepted: true; legal_version: string; language: 'es' | 'en';
  currency: 'GTQ' | 'USD' | 'MXN'; country: string | null; started_at: number;
};
export function saveGoogleRegistrationIntent(preferences: Pick<GoogleRegistrationIntent, 'language' | 'currency' | 'country'>) {
  const intent: GoogleRegistrationIntent = { ...preferences, accepted: true, legal_version: GOOGLE_LEGAL_VERSION, started_at: Date.now() };
  window.sessionStorage.setItem(key, JSON.stringify(intent));
  return intent;
}
export function readGoogleRegistrationIntent(): GoogleRegistrationIntent | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) || 'null');
    if (!value || value.accepted !== true || value.legal_version !== GOOGLE_LEGAL_VERSION
      || !['es', 'en'].includes(value.language) || !['GTQ', 'USD', 'MXN'].includes(value.currency)
      || (value.country !== null && !/^[A-Z]{2}$/.test(value.country))
      || !Number.isFinite(value.started_at) || value.started_at > Date.now()
      || Date.now() - value.started_at > 60 * 60 * 1000) return null;
    return value;
  } catch { return null; }
}
export function clearGoogleRegistrationIntent() {
  try { window.sessionStorage.removeItem(key); } catch { /* Optional cleanup. */ }
}
