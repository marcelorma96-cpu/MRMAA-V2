'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ACTIVITY_KEY } from '@/lib/session-activity';
import { GOOGLE_AUTH_ENABLED, googleOAuthClient, clearGoogleOAuthStorage, hasGoogleIdentity } from '@/lib/google-auth';
import { useAppPreferences } from '@/components/app-preferences';

let completion: Promise<void> | undefined;
async function completeGoogle() {
  const params = new URLSearchParams(window.location.search), code = params.get('code');
  // Do not keep the one-use code in browser history or forward it anywhere.
  history.replaceState({}, '', '/auth/google');
  if (!GOOGLE_AUTH_ENABLED || params.has('error') || !code) throw new Error('GOOGLE_RETURN');
  try {
    const result = await googleOAuthClient().auth.exchangeCodeForSession(code);
    if (result.error || !result.data.session || !hasGoogleIdentity(result.data.user!)) throw new Error('GOOGLE_RETURN');
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    const { error } = await supabase.auth.setSession({
      access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token,
    });
    if (error) throw error;
  } finally { clearGoogleOAuthStorage(); }
}
export default function GoogleReturn() {
  const { language } = useAppPreferences(), en = language === 'en';
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    // React Strict Mode can run the effect twice; exchange this code only once.
    completion ??= completeGoogle();
    void completion.then(() => { if (mounted) window.location.replace('/?login=1'); })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, []);
  return <main className="center" translate="no"><section className="moduleCard mfaPanel">
    {failed ? <><h1>{en ? 'Could not complete sign-in' : 'No se pudo completar el ingreso'}</h1>
      <p role="alert">{en ? 'The request was canceled, expired, or opened in a different browser. Please start again from Sign in.' : 'La solicitud se canceló, venció o se abrió en otro navegador. Comience nuevamente desde Iniciar sesión.'}</p>
      <a className="primary" href="/?login=1">{en ? 'Back to sign in' : 'Volver a iniciar sesión'}</a></>
      : <p role="status">{en ? 'Completing Google sign-in…' : 'Completando el ingreso con Google…'}</p>}
  </section></main>;
}
