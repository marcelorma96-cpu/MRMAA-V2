import { createClient, type User } from '@supabase/supabase-js';

export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
const storageKey = 'unomesa-google-oauth';
let oauthClient: ReturnType<typeof createClient> | undefined;
// An isolated PKCE client leaves email confirmation/recovery behavior intact.
// The verifier stays in this tab; both the start and callback use the same origin.
export function googleOAuthClient() {
  if (typeof window === 'undefined') throw new Error('GOOGLE_BROWSER_REQUIRED');
  if (!oauthClient) oauthClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: 'pkce', storageKey, storage: window.sessionStorage,
      persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return oauthClient;
}
export function clearGoogleOAuthStorage() {
  if (typeof window === 'undefined') return;
  // SDK versions can create per-flow verifier keys as well as the main key.
  for (const key of Object.keys(window.sessionStorage)) {
    if (key === storageKey || key.startsWith(`${storageKey}-`)) window.sessionStorage.removeItem(key);
  }
}
// Routing hint only. The API must call Auth getUser before trusting these claims.
export function hasOAuthMethod(token: string) {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(claims.amr) && claims.amr.some((a: { method?: string }) => a.method === 'oauth');
  } catch { return false; }
}
export function hasGoogleIdentity(user: User) {
  return !!user.email_confirmed_at && user.identities?.some(identity => identity.provider === 'google') === true;
}
