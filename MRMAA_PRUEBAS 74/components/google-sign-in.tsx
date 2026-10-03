'use client';
import { useRef, useState } from 'react';
import { configured } from '@/lib/supabase';
import { GOOGLE_AUTH_ENABLED, googleOAuthClient, clearGoogleOAuthStorage } from '@/lib/google-auth';
import { useAppPreferences } from '@/components/app-preferences';
import { PUBLIC_SIGNUP_ENABLED } from '@/lib/plans';
import { publicLocale } from '@/lib/public-locale';
import { saveGoogleRegistrationIntent, clearGoogleRegistrationIntent } from '@/lib/google-registration-intent';

export function GoogleSignIn({ disabled = false }: { disabled?: boolean }) {
  const { language, country } = useAppPreferences(), en = language === 'en';
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  if (!GOOGLE_AUTH_ENABLED) return null;
  async function start() {
    if (locked.current || disabled) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (!configured) throw new Error('CONFIG');
      clearGoogleOAuthStorage();
      clearGoogleRegistrationIntent();
      if (PUBLIC_SIGNUP_ENABLED) saveGoogleRegistrationIntent({ language, currency: publicLocale(country).currency, country });
      const { data, error } = await googleOAuthClient().auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: `${window.location.origin}/auth/google`, scopes: 'openid email profile',
        queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true,
      }});
      if (error || !data.url) throw error || new Error('GOOGLE_UNAVAILABLE');
      window.location.assign(data.url);
    } catch {
      clearGoogleOAuthStorage(); locked.current = false; setBusy(false);
      clearGoogleRegistrationIntent();
      setError(en ? 'Google sign-in is unavailable. Try again or use your email and password.' : 'No se pudo iniciar con Google. Intente nuevamente o use su correo y contraseña.');
    }
  }
  return <div className="googleSignIn" translate="no">
    <button type="button" className="googleAuthButton" disabled={disabled || busy} onClick={() => void start()}>
      <img src="/brand/google-g.png" width="20" height="20" alt="" aria-hidden="true" />
      {busy ? (en ? 'Connecting…' : 'Conectando…') : (en ? 'Continue with Google' : 'Continuar con Google')}
    </button>
    {PUBLIC_SIGNUP_ENABLED && <p className="googleConsent">
      {en ? 'By continuing with Google, you accept our ' : 'Al continuar con Google, acepta los '}
      <a href="/terminos" target="_blank" rel="noreferrer">{en ? 'Terms' : 'Términos'}</a>
      {en ? ' and ' : ' y la '}<a href="/privacidad" target="_blank" rel="noreferrer">{en ? 'Privacy Policy' : 'Política de privacidad'}</a>.
      {' '}{en ? 'New accounts get 10 days of Advanced free. No card required.' : 'Las cuentas nuevas reciben 10 días de Advanced gratis. Sin tarjeta.'}
    </p>}
    {error && <p className="formError" role="alert">{error}</p>}
    <p className="googleAuthDivider">{en ? 'or use your email' : 'o use su correo electrónico'}</p>
  </div>;
}
