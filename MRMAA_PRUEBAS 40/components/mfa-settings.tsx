"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase, signOutCurrentSession, isSigningOut, SESSION_SIGN_OUT_EVENT } from "@/lib/supabase";
import { ACTIVITY_KEY, ACTIVITY_EVENT, SESSION_CHECK_INTERVAL, initializeSessionActivity, remainingIdleSeconds, deviceLabel } from "@/lib/session-activity";
import { SessionManager } from "@/components/security-center";
import { readMfaAccess } from "@/lib/mfa";
import { useAppPreferences } from "@/components/app-preferences";

async function emailRequest(body?: object) {
 const session = await supabase.auth.getSession();
 if (!session.data.session) throw new Error('EMAIL_AUTH');
 const response = await fetch('/api/security/email', {method:body?'POST':'GET',cache:'no-store',
  headers:{Authorization:`Bearer ${session.data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || 'EMAIL_UNAVAILABLE');
 return data;
}
function EmailVerification({ challenge=false, done }: {challenge?:boolean;done?:()=>void}) {
 const { language } = useAppPreferences(), en=language==='en';
 const [state,setState]=useState<{enabled:boolean;configured:boolean;password:boolean}|null>(null);
 const [code,setCode]=useState(''),[purpose,setPurpose]=useState<'login'|'enable'|'disable'>(challenge?'login':'enable');
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[cooldown,setCooldown]=useState(0);
 const locked=useRef(false);
 const load=useCallback(async()=>{try{setState(await emailRequest());}catch{setNotice(en?'Could not load security. Retry.':'No se pudo cargar la seguridad. Reintente.');}},[en]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(x=>Math.max(0,x-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
 function errorText(error:unknown) {
  const key=error instanceof Error?error.message:'';
  if(key==='EMAIL_INVALID')return en?'Invalid or expired code. After 5 attempts, request a new one.':'Código incorrecto o vencido. Después de 5 intentos, solicite uno nuevo.';
  if(key==='EMAIL_WAIT')return en?'A code was recently requested. Enter it below if you received it, or wait 60 seconds to request another.':'Se solicitó un código recientemente. Ingréselo abajo si lo recibió o espere 60 segundos para solicitar otro.';
  if(key==='EMAIL_DELIVERY_FAILED')return en?'The email could not be sent. Check the SMTP configuration and sender authorization.':'No se pudo enviar el correo. Revise la configuración SMTP y la autorización del remitente.';
  if(key==='EMAIL_CONFIG')return en?'Email delivery is not configured correctly. Contact support.':'El envío de correo no está configurado correctamente. Contacte a soporte.';
  if(key==='EMAIL_RATE')return en?'Too many attempts. Try again later.':'Demasiados intentos. Intente más tarde.';
  if(key==='EMAIL_PASSWORD')return en?'Sign out and sign in with your password first.':'Cierre sesión e ingrese primero con su contraseña.';
  return en?'Could not complete verification. Check your connection and retry.':'No se pudo completar la verificación. Revise su conexión y reintente.';
 }
 async function run(action:'send'|'verify',nextPurpose=purpose) {
  if(locked.current)return;locked.current=true;setBusy(true);setNotice('');
  try{
   await emailRequest({action,purpose:nextPurpose,code,language});
   if(action==='send'){setPurpose(nextPurpose);setSent(true);setCode('');setCooldown(60);setNotice(en?'Code sent. Check your inbox and spam folder.':'Código enviado. Revise su bandeja de entrada y spam.');}
   else {setSent(false);setCode('');await load();setNotice(en?'Verification completed.':'Verificación completada.');done?.();}
  }catch(error){setNotice(errorText(error));if(action==='verify')setCode('');
   if(action==='send' && error instanceof Error && ['EMAIL_WAIT','EMAIL_DELIVERY_FAILED'].includes(error.message)){setPurpose(nextPurpose);setSent(true);setCooldown(60);}
  }
  finally{locked.current=false;setBusy(false);}
 }
 return <section className="moduleCard settingsPanel mfaPanel" translate="no">
  <ShieldCheck/><h2>{en?'Two-step verification':'Verificación en dos pasos'}</h2>
  <p>{en?'After your password, enter a single-use code sent to your account email. No QR code or authenticator app is needed.':'Después de su contraseña, ingrese un código de un solo uso enviado al correo de su cuenta. No necesita QR ni aplicación autenticadora.'}</p>
  {!state?<button className="secondary" onClick={()=>void load()}>{en?'Retry':'Reintentar'}</button>:<>
   {!challenge&&<p><strong>{state.enabled?(en?'Enabled · Email':'Activada · Email'):(en?'Not enabled':'Desactivada')}</strong></p>}
   {!state.configured?<p role="alert">{en?'Email verification is not configured yet. Contact support.':'El envío de códigos aún no está configurado. Contacte a soporte.'}</p>:
    !state.password?<p role="alert">{en?'Sign out and sign in with your password to continue.':'Cierre sesión e ingrese con su contraseña para continuar.'}</p>:<>
    {!sent?<button type="button" className="primary" disabled={busy||cooldown>0} onClick={()=>void run('send',challenge?'login':state.enabled?'disable':'enable')}>{busy?(en?'Sending…':'Enviando…'):challenge?(en?'Send code':'Enviar código'):state.enabled?(en?'Disable with email code':'Desactivar con código por email'):(en?'Enable with email code':'Activar con código por email')}</button>:<form className="formStack" onSubmit={event=>{event.preventDefault();if(code.length===6)void run('verify');}}>
     <p>{purpose==='disable'?(en?'Confirm this code to disable verification.':'Confirme este código para desactivar la verificación.'):(en?'The code expires in 10 minutes.':'El código vence en 10 minutos.')}</p>
     <label>{en?'6-digit code':'Código de 6 dígitos'}<input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
     <button className="primary" disabled={busy||code.length!==6}>{busy?(en?'Verifying…':'Verificando…'):(en?'Confirm code':'Confirmar código')}</button>
     <button type="button" className="secondary" disabled={busy||cooldown>0} onClick={()=>void run('send')}>{cooldown>0?`${en?'Resend in':'Reenviar en'} ${cooldown}s`:(en?'Resend code':'Reenviar código')}</button>
     {!challenge&&<button type="button" className="link" disabled={busy} onClick={()=>{setSent(false);setCode('');}}>{en?'Cancel':'Cancelar'}</button>}
    </form>}
   </>}
  </>}
  {notice&&<p role="status" aria-live="polite">{notice}</p>}
  <p className="muted">{en?'Keep access to your email and never share your code. Each user controls their own verification.':'Conserve acceso a su correo y nunca comparta su código. Cada usuario administra su propia verificación.'}</p>
  {challenge&&<button className="link" disabled={busy} onClick={()=>void signOutCurrentSession()}>{en?'Sign out':'Cerrar sesión'}</button>}
 </section>;
}
export function MfaChallenge({done}:{done:()=>void}) {return <main className="center"><EmailVerification challenge done={done}/></main>;}
export function MfaSettings(){return <div className="moduleStack"><EmailVerification/><SessionManager/></div>;}

// Auth endpoints remain available for challenges. Business data stays behind
// this gate and the independently enforced database/API checks.
export function MfaSessionGate({ children }: { children: ReactNode }) {
  const { language } = useAppPreferences(), en = language === "en";
  const [status, setStatus] = useState<"checking" | "allowed" | "challenge" | "error" | "signing-out">("checking");
  const generation = useRef(0), userId = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    if (isSigningOut()) return;
    const request = ++generation.current;
    try {
      const current = await supabase.auth.getSession();
      if (request !== generation.current || isSigningOut()) return;
      if (current.error) throw current.error;
      if (current.data.session) {
        // Recording a check is not activity. Only input in the app renews the hour.
        const claims = JSON.parse(atob(current.data.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if (typeof claims.session_id !== 'string' || !claims.session_id) throw new Error('SESSION_INVALID');
        initializeSessionActivity(sessionStorage, claims.session_id);
        const remaining = remainingIdleSeconds(sessionStorage.getItem(ACTIVITY_KEY));
        if (!remaining) { await signOutCurrentSession(); return; }
        const alive = await supabase.rpc('v2_session_touch_active', {
          p_device:deviceLabel(navigator.userAgent,navigator.maxTouchPoints), p_idle_seconds:remaining,
        });
        if (request !== generation.current || isSigningOut()) return;
        if (alive.error) throw alive.error;
        if (alive.data !== true) {
          if (request === generation.current) setStatus('checking');
          await signOutCurrentSession();
          if (request === generation.current) setStatus('allowed');
          return;
        }
      }
      const result = await readMfaAccess(supabase);
      if (request !== generation.current || isSigningOut()) return;
      userId.current = result.userId;
      setStatus(result.allowed ? "allowed" : "challenge");
    } catch { if (request === generation.current && !isSigningOut()) setStatus("error"); }
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signOutTransition = () => {
      generation.current++;
      clearTimeout(timer);
      if (isSigningOut()) setStatus("signing-out");
      else void refresh();
    };
    window.addEventListener(SESSION_SIGN_OUT_EVENT, signOutTransition);
    if (isSigningOut()) signOutTransition();
    else void refresh();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { generation.current++; clearTimeout(timer); userId.current = null; setStatus(isSigningOut() ? "signing-out" : "allowed"); return; }
      if (isSigningOut()) { signOutTransition(); return; }
      generation.current++;
      if (session && session.user.id !== userId.current) setStatus("checking");
      // Supabase callbacks must not await another Auth method inside its lock.
      clearTimeout(timer); timer = setTimeout(() => { void refresh(); }, 0);
    });
    const focus = () => { void refresh(); };
    const heartbeat = setInterval(() => { if(document.visibilityState==='visible')void refresh(); },SESSION_CHECK_INTERVAL);
    // Report input at most once per minute, with a trailing report. Background
    // transitions also attempt a check; closing a browser is never guaranteed
    // to deliver a request, so the server deadline remains authoritative.
    let activityTimer: ReturnType<typeof setTimeout> | undefined;
    let lastActivityReport = 0;
    const activity = () => {
      if (activityTimer) return;
      const delay = Math.max(0, SESSION_CHECK_INTERVAL - (Date.now() - lastActivityReport));
      activityTimer = setTimeout(() => {
        activityTimer = undefined; lastActivityReport = Date.now(); void refresh();
      }, delay);
    };
    window.addEventListener(ACTIVITY_EVENT, activity);
    const visible = () => { void refresh(); };
    document.addEventListener('visibilitychange',visible);
    window.addEventListener("focus", focus);
    return () => { clearTimeout(activityTimer); window.removeEventListener(ACTIVITY_EVENT, activity); clearInterval(heartbeat); document.removeEventListener("visibilitychange",visible); generation.current++; clearTimeout(timer); data.subscription.unsubscribe(); window.removeEventListener("focus", focus); window.removeEventListener(SESSION_SIGN_OUT_EVENT, signOutTransition); };
  }, [refresh]);
  const recoveryScreen = typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("reset") === "1" || new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  if (status === "signing-out") return <main className="center" translate="no"><div role="status" aria-live="polite"><div className="loader"/><p>{en ? "Signing out…" : "Cerrando sesión…"}</p></div></main>;
  if (recoveryScreen || status === "allowed") return children;
  if (status === "challenge") return <MfaChallenge done={() => void refresh()} />;
  return <main className="center" translate="no"><section className="moduleCard mfaPanel">
    {status === "checking" ? <p role="status">{en ? "Verifying access…" : "Validando acceso…"}</p> : <><p role="alert">{en ? "Could not verify account security. Please retry." : "No se pudo comprobar la seguridad de su cuenta. Intente nuevamente."}</p><button className="primary" onClick={() => void refresh()}>{en ? "Retry" : "Reintentar"}</button><button className="link" onClick={() => void signOutCurrentSession()}>{en ? "Sign out" : "Cerrar sesión"}</button></>}
  </section></main>;
}
