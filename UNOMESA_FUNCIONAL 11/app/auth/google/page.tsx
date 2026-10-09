'use client';
import { useEffect, useState } from 'react';
import { AccessLoading } from '@/components/app-launch';
import { GOOGLE_AUTH_ENABLED } from '@/lib/google-auth';
import { completeGoogleSession } from '@/lib/google-session';
import { useAppPreferences } from '@/components/app-preferences';
import { restoreGoogleDestination } from '@/lib/app-mode';

let completion: Promise<void> | undefined;
let destination='/login';
async function completeGoogle() {
  // Restore presentation before setSession chooses the credential store.
  destination=restoreGoogleDestination();
  const params = new URLSearchParams(window.location.search), code = params.get('code');
  // Do not keep the one-use code in browser history or forward it anywhere.
  history.replaceState({}, '', '/auth/google');
  if (!GOOGLE_AUTH_ENABLED || params.has('error') || !code) throw new Error('GOOGLE_RETURN');
  destination=await completeGoogleSession(code,params.get('flow_id')||undefined);
}
export default function GoogleReturn() {
  const { language } = useAppPreferences(), en = language === 'en';
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    // React Strict Mode can run the effect twice; exchange this code only once.
    completion ??= completeGoogle();
    void completion.then(() => { if (mounted) window.location.replace(destination); })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, []);
  if (!failed) return <AccessLoading text={en ? 'Preparing UnoMesa…' : 'Preparando UnoMesa…'}/>;
  return <main className="center" translate="no"><section className="moduleCard mfaPanel">
    {failed ? <><h1>{en ? 'Could not complete sign-in' : 'No se pudo completar el ingreso'}</h1>
      <p role="alert">{en ? 'The request was canceled, expired, or opened in a different browser. Please start again from Sign in.' : 'La solicitud se canceló, venció o se abrió en otro navegador. Comience nuevamente desde Iniciar sesión.'}</p>
      <a className="primary" href={destination}>{en ? 'Back to sign in' : 'Volver a iniciar sesión'}</a></>
      : <p role="status">{en ? 'Completing Google sign-in…' : 'Completando el ingreso con Google…'}</p>}
  </section></main>;
}
