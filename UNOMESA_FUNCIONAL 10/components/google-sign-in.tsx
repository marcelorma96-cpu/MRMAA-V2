'use client';
import { useEffect, useRef, useState } from 'react';
import { AccessLoading } from '@/components/app-launch';
import { configured } from '@/lib/supabase';
import { GOOGLE_AUTH_ENABLED, googleOAuthClient, clearGoogleOAuthStorage } from '@/lib/google-auth';
import { useAppPreferences } from '@/components/app-preferences';
import { PUBLIC_SIGNUP_ENABLED } from '@/lib/plans';
import { publicLocale } from '@/lib/public-locale';
import { saveGoogleRegistrationIntent, clearGoogleRegistrationIntent } from '@/lib/google-registration-intent';
import { rememberGoogleDestination } from '@/lib/app-mode';
import { launchGoogleAuthorization } from '@/lib/native-google';

export function GoogleSignIn({ disabled = false, compact = false, prominent = false }: { disabled?: boolean; compact?: boolean; prominent?: boolean }) {
  const { language, country } = useAppPreferences(), en = language === 'en';
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  useEffect(()=>{
    const finished=(event:Event)=>{const status=(event as CustomEvent).detail?.status;if(status!=='cancelled'&&status!=='failed')return;locked.current=false;setBusy(false);clearGoogleOAuthStorage();clearGoogleRegistrationIntent();if(status==='failed')setError(en?'Google could not return to UnoMesa. Please try again.':'Google no pudo volver a UnoMesa. Intente nuevamente.');};
    const restored=(event:PageTransitionEvent)=>{if(event.persisted){locked.current=false;setBusy(false);}};
    window.addEventListener('pageshow',restored);
    window.addEventListener('unomesa:google-auth',finished);return()=>{window.removeEventListener('pageshow',restored);window.removeEventListener('unomesa:google-auth',finished);};
  },[en]);
  if (!GOOGLE_AUTH_ENABLED) return null;
  async function start() {
    if (locked.current || disabled) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (!configured) throw new Error('CONFIG');
      clearGoogleOAuthStorage();
      clearGoogleRegistrationIntent();
      rememberGoogleDestination();
      if (PUBLIC_SIGNUP_ENABLED) saveGoogleRegistrationIntent({ language, currency: publicLocale(country).currency, country });
      const { data, error } = await googleOAuthClient().auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: `${window.location.origin}/auth/google`, scopes: 'openid email profile',
        queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true,
      }});
      if (error || !data.url) throw error || new Error('GOOGLE_UNAVAILABLE');
      await launchGoogleAuthorization(data.url);
    } catch {
      clearGoogleOAuthStorage(); locked.current = false; setBusy(false);
      clearGoogleRegistrationIntent();
      setError(en ? 'Google sign-in is unavailable. Try again or use your email and password.' : 'No se pudo iniciar con Google. Intente nuevamente o use su correo y contraseña.');
    }
  }
  return <div className={`googleSignIn ${compact?'googleCompact':''}`} translate="no">
    {busy && <div className="googleHandoffOverlay"><AccessLoading text={en ? "Connecting to Google…" : "Conectando con Google…"}/></div>}
    {compact&&!prominent&&<p className="googleAuthDivider">{en?'or':'o'}</p>}
    <button type="button" className="googleAuthButton" disabled={disabled || busy} onClick={() => void start()}>
      <img src="/brand/google-g.png" width="20" height="20" alt="" aria-hidden="true" />
      {busy ? (en ? 'Connecting…' : 'Conectando…') : (en ? 'Continue with Google' : 'Continuar con Google')}
    </button>
    {prominent&&<p className="googleAuthDivider">{en?'or with email':'o con correo electrónico'}</p>}
    {PUBLIC_SIGNUP_ENABLED && !compact && <p className="googleConsent">
      {en ? 'By continuing with Google, you accept our ' : 'Al continuar con Google, acepta los '}
      <a href="/terminos" target="_blank" rel="noreferrer">{en ? 'Terms' : 'Términos'}</a>
      {en ? ' and ' : ' y la '}<a href="/privacidad" target="_blank" rel="noreferrer">{en ? 'Privacy Policy' : 'Política de privacidad'}</a>.
      {' '}{en ? 'New accounts get 10 days of Advanced free. No card required.' : 'Las cuentas nuevas reciben 10 días de Advanced gratis. Sin tarjeta.'}
    </p>}
    {error && <p className="formError" role="alert">{error}</p>}
    {!compact&&<p className="googleAuthDivider">{en ? 'or use your email' : 'o use su correo electrónico'}</p>}
  </div>;
}
