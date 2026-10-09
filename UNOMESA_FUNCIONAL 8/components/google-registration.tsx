'use client';
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { BrandLogo } from '@/components/brand-logo';
import { useAppPreferences } from '@/components/app-preferences';
import { publicLocale } from '@/lib/public-locale';
import { supabase, signOutCurrentSession } from '@/lib/supabase';
import { readGoogleRegistrationIntent, saveGoogleRegistrationIntent, clearGoogleRegistrationIntent } from '@/lib/google-registration-intent';
import { startRegistrationAnalytics, trackRegistration } from '@/lib/registration-analytics';
import { startRegistrationPixel, trackMetaRegistration } from '@/lib/meta-pixel';
import { startRegistrationGoogleAds, trackGoogleAdsRegistration } from '@/lib/google-ads';

export async function googleProfileRequest(body?: object) {
  const current = await supabase.auth.getSession();
  if (current.error || !current.data.session) throw new Error('GOOGLE_SESSION');
  const response = await fetch('/api/auth/google/profile', { method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { Authorization: `Bearer ${current.data.session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code || 'GOOGLE_UNAVAILABLE');
  return result as { state?: 'ready' | 'needs_profile' | 'blocked' | 'closed'; ok?: boolean; created?: boolean };
}
export function GoogleRegistration({ user, done }: { user: User; done: () => void }) {
  const { language, country } = useAppPreferences(), en = language === 'en';
  const request = useRef<Promise<{ ok?: boolean; created?: boolean }> | null>(null);
  const successTracked = useRef(false), doneRef = useRef(done);
  doneRef.current = done;
  const [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState(''), [needsConsent, setNeedsConsent] = useState(false);
  useEffect(() => {
    const stops = [startRegistrationAnalytics(), startRegistrationPixel(), startRegistrationGoogleAds()];
    return () => stops.forEach(stop => stop());
  }, []);
  useEffect(() => {
    let active = true;
    const intent = readGoogleRegistrationIntent();
    if (!intent) { setBusy(false); setNeedsConsent(true); return; }
    setBusy(true); setNeedsConsent(false); setNotice('');
    // Share the request across Strict Mode effect replays.
    if (!request.current) {
      trackRegistration('Registro_intento');
      request.current = googleProfileRequest(intent);
    }
    void request.current.then(result => {
      if (!active) return;
      if (result.ok !== true) throw new Error('GOOGLE_UNAVAILABLE');
      if (result.created && !successTracked.current) {
        successTracked.current = true;
        trackRegistration('Registro_exitoso'); trackMetaRegistration('Registro_exitoso'); trackGoogleAdsRegistration();
      }
      clearGoogleRegistrationIntent();
      doneRef.current();
    }).catch(error => {
      if (!active) return;
      request.current = null; setBusy(false);
      const code = error instanceof Error ? error.message : '';
      trackRegistration('Registro_error', code === 'GOOGLE_RATE' ? 'rate_limit' : 'server');
      setNotice(code === 'GOOGLE_RATE' ? (en ? 'Too many attempts. Wait one minute, then retry.' : 'Demasiados intentos. Espere un minuto y reintente.')
        : code === 'GOOGLE_CLOSED' ? (en ? 'Registration is temporarily closed.' : 'El registro está temporalmente cerrado.')
        : code === 'GOOGLE_ACCESS' ? (en ? 'This account cannot create a restaurant. Contact your administrator.' : 'Esta cuenta no puede crear un restaurante. Contacte a su administrador.')
        : (en ? 'Could not prepare your restaurant. Please retry; your account is preserved.' : 'No se pudo preparar su restaurante. Reintente; su cuenta se conserva.'));
    });
    return () => { active = false; };
  }, [attempt, en]);
  function retry() {
    if (busy) return;
    if (needsConsent) {
      try { saveGoogleRegistrationIntent({ language, currency: publicLocale(country).currency, country }); }
      catch { setNotice(en ? 'Allow storage in your browser to continue.' : 'Permita el almacenamiento en su navegador para continuar.'); return; }
    }
    setBusy(true); setAttempt(value => value + 1);
  }
  return <main className="center googleRegistrationPage" translate="no">
    <section className="moduleCard mfaPanel">
      <BrandLogo/>
      <h1>{busy ? (en ? 'Preparing your dashboard…' : 'Preparando su dashboard…') : (en ? 'Continue to UnoMesa' : 'Continuar a UnoMesa')}</h1>
      <p>{en ? 'Advanced: 10 days free. Complete your restaurant details from the dashboard whenever you are ready.' : 'Advanced: 10 días gratis. Complete los datos de su restaurante desde el dashboard cuando lo desee.'}</p>
      <p className="googleAccountEmail">{user.email}</p>
      {busy && <p role="status">{en ? 'Creating your restaurant…' : 'Creando su restaurante…'}</p>}
      {needsConsent && <p className="googleConsent">{en ? 'By continuing, you accept our ' : 'Al continuar, acepta los '}
        <a href="/terminos" target="_blank" rel="noreferrer">{en ? 'Terms' : 'Términos'}</a>
        {en ? ' and ' : ' y la '}<a href="/privacidad" target="_blank" rel="noreferrer">{en ? 'Privacy Policy' : 'Política de privacidad'}</a>.</p>}
      {notice && <p role="alert">{notice}</p>}
      {!busy && <button type="button" className="primary" onClick={retry}>{needsConsent ? (en ? 'Continue to dashboard' : 'Continuar al dashboard') : (en ? 'Retry' : 'Reintentar')}</button>}
      {!busy && <button type="button" className="link" onClick={() => { clearGoogleRegistrationIntent(); void signOutCurrentSession(); }}>{en ? 'Sign out / use another account' : 'Cerrar sesión / usar otra cuenta'}</button>}
    </section>
  </main>;
}
