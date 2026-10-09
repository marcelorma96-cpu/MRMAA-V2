import { supabase } from '@/lib/supabase';
import { googleOAuthClient, clearGoogleOAuthStorage, hasGoogleIdentity } from '@/lib/google-auth';
import { restoreGoogleDestination, sessionActivityStorage } from '@/lib/app-mode';
import { ACTIVITY_KEY } from '@/lib/session-activity';

/** Finish in the context that created the verifier; never transfer tokens to native code. */
export async function completeGoogleSession(code: string, flowId?: string) {
  const destination = restoreGoogleDestination();
  try {
    if (!code || code.length > 2048) throw new Error('GOOGLE_RETURN');
    // Let the primary client's initial restore finish before installing new credentials.
    await supabase.auth.initialize();
    const result = await googleOAuthClient().auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (result.error || !result.data.session || !result.data.user || !hasGoogleIdentity(result.data.user)) throw new Error('GOOGLE_EXCHANGE');
    sessionActivityStorage().setItem(ACTIVITY_KEY, String(Date.now()));
    const installed = await supabase.auth.setSession({
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
    });
    if (installed.error || installed.data.session?.user.id !== result.data.user.id) throw new Error('GOOGLE_SESSION');
    return destination;
  } finally { clearGoogleOAuthStorage(); }
}
