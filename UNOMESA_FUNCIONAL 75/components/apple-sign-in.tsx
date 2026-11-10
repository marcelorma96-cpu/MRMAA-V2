'use client';
import { useEffect, useRef, useState } from 'react';
import { appleNativeBridge, requestAppleCredential } from '@/lib/apple-native';
import { APPLE_AUTH_ENABLED } from '@/lib/google-auth';
import { supabase, configured } from '@/lib/supabase';
import { ACTIVITY_KEY } from '@/lib/session-activity';
import { sessionActivityStorage } from '@/lib/app-mode';
import { useAppPreferences } from '@/components/app-preferences';
import { saveGoogleRegistrationIntent, clearGoogleRegistrationIntent } from '@/lib/google-registration-intent';
import { PUBLIC_SIGNUP_ENABLED } from '@/lib/plans';
import { publicLocale } from '@/lib/public-locale';
import { AccessVerification } from '@/components/access-verification';

export function AppleSignIn({disabled}: {disabled?: boolean}) {
  const {language,country}=useAppPreferences(), en=language==='en';
  const [visible,setVisible]=useState(false), [busy,setBusy]=useState(false), [notice,setNotice]=useState(false);
  const [challenge,setChallenge]=useState(0),[captcha,setCaptcha]=useState('');
  const locked=useRef(false), siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(()=>setVisible(APPLE_AUTH_ENABLED && !!appleNativeBridge()),[]);
  if(!visible) return null;
  async function submit() {
    const bridge=appleNativeBridge();
    if(!bridge || disabled || locked.current) return;
    locked.current=true; setBusy(true); setNotice(false);
    try {
      if(!configured) throw new Error('CONFIG');
      const credential=await requestAppleCredential(bridge);
      if(!credential) return;
      clearGoogleRegistrationIntent();
      if(PUBLIC_SIGNUP_ENABLED) saveGoogleRegistrationIntent({language,currency:publicLocale(country).currency,country});
      const response=await fetch('/api/auth/apple/session',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...credential,captcha:captcha||undefined})});
      const result=await response.json();
      if(result.error==='captcha_failed' && siteKey) {
        clearGoogleRegistrationIntent();setCaptcha('');setChallenge(x=>x+1);return;
      }
      if(!response.ok || typeof result.access_token!=='string' || typeof result.refresh_token!=='string') throw new Error('APPLE_SESSION');
      await supabase.auth.initialize();
      sessionActivityStorage().setItem(ACTIVITY_KEY,String(Date.now()));
      const {data,error}=await supabase.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
      if(error || !data.session) throw new Error('APPLE_SESSION');
      // The primary client's SIGNED_IN listener drives the existing MFA and account gates.
    } catch { clearGoogleRegistrationIntent();setNotice(true); }
    finally { locked.current=false;setBusy(false); }
  }
  return <div className="googleSignIn googleCompact appleNativeLogin" translate="no">
    {challenge>0 && siteKey && <><p role="status">{en?'Complete verification, then continue with Apple.':'Complete la verificación y continúe con Apple.'}</p><AccessVerification key={challenge} siteKey={siteKey} onToken={setCaptcha}/></>}
    <button type="button" className="googleAuthButton appleAuthButton" disabled={disabled||busy||(challenge>0&&!captcha)} onClick={()=>void submit()}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M17.05 12.54c.03 3.56 3.12 4.75 3.15 4.76-.02.08-.49 1.69-1.62 3.35-.98 1.43-2 2.85-3.6 2.88-1.57.04-2.08-.93-3.88-.93-1.8 0-2.37.9-3.86.97-1.54.06-2.71-1.54-3.7-2.97C1.52 17.68-.02 12.35 2.06 8.75c1.03-1.79 2.87-2.92 4.86-2.95 1.52-.03 2.95 1.03 3.88 1.03.93 0 2.67-1.27 4.5-1.08.77.03 2.92.31 4.3 2.34-.11.07-2.58 1.51-2.55 4.45zM14.09 3.8C14.91 2.81 15.46 1.43 15.31.05c-1.18.05-2.61.79-3.45 1.78-.76.87-1.42 2.26-1.24 3.58 1.32.1 2.66-.66 3.47-1.61z"/></svg>
      {en?'Continue with Apple':'Continuar con Apple'}
    </button>
    {busy && <small role="status">{en?'Connecting…':'Conectando…'}</small>}
    {notice && <p className="formError" role="alert">{en?'Could not sign in with Apple. Please try again.':'No se pudo ingresar con Apple. Intente nuevamente.'}</p>}
  </div>;
}
