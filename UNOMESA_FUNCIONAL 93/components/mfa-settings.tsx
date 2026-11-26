"use client";
import {AccessLoading} from "./app-launch";
import { isAppMode, sessionActivityStorage } from "@/lib/app-mode";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase, signOutCurrentSession, isSigningOut, SESSION_SIGN_OUT_EVENT } from "@/lib/supabase";
import { ACTIVITY_KEY, ACTIVITY_EVENT, SESSION_CHECK_INTERVAL, initializeSessionActivity, remainingIdleSeconds, deviceLabel } from "@/lib/session-activity";
import { SessionManager } from "@/components/security-center";
import { readMfaAccess } from "@/lib/mfa";
import { classifyVerificationFailure, runSessionVerification, SESSION_RETRY_DELAYS, sessionTokenId, verificationDiagnostic } from "@/lib/session-verification";
import { SessionConnectionDialog } from "./session-connection-dialog";
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
 const [state,setState]=useState<{enabled:boolean;configured:boolean;password:boolean;primary?:boolean}|null>(null);
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
  <p>{en?'After signing in, enter a single-use code sent to your account email. No QR code or authenticator app is needed.':'Después de iniciar sesión, ingrese un código de un solo uso enviado al correo de su cuenta. No necesita QR ni aplicación autenticadora.'}</p>
  {!state?<button className="secondary" onClick={()=>void load()}>{en?'Retry':'Reintentar'}</button>:<>
   {!challenge&&<p><strong>{state.enabled?(en?'Enabled · Email':'Activada · Email'):(en?'Not enabled':'Desactivada')}</strong></p>}
   {!state.configured?<p role="alert">{en?'Email verification is not configured yet. Contact support.':'El envío de códigos aún no está configurado. Contacte a soporte.'}</p>:
    !(state.primary ?? state.password)?<p role="alert">{en?'Sign out and sign in with your password to continue.':'Cierre sesión e ingrese con su contraseña para continuar.'}</p>:<>
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
  const [status, setStatus] = useState<"checking" | "allowed" | "challenge" | "offline" | "retrying" | "error" | "signing-out">("checking");
  const generation = useRef(0), userId = useRef<string | null>(null);
  const retainedSurface = useRef(false), verifiedSessionId = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retries = useRef(0), lastDiagnostic = useRef("");
  const cancelPending = useCallback(() => {
    generation.current++;
    clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
    active.current?.abort();
    active.current = null;
  }, []);
  const refresh = useCallback(async function check() {
    if (isSigningOut() || document.visibilityState === 'hidden') return;
    // Focus, activity and heartbeat can arrive together. Let the bounded check
    // finish instead of repeatedly cancelling a slow but healthy request.
    if (active.current && !active.current.signal.aborted) return;
    cancelPending();
    if (navigator.onLine === false) { setStatus('offline'); return; }
    const request = generation.current, controller = new AbortController();
    active.current = controller;
    const currentRequest = () => request === generation.current && !isSigningOut() && !controller.signal.aborted;
    let stage = 'session';
    try {
      await runSessionVerification(controller, async signal => {
        const current = await supabase.auth.getSession();
        if (!currentRequest()) return;
        if (current.error) throw current.error;
        if (current.data.session) {
          // Recording a check is not activity. Only user input renews inactivity.
          const sessionId = sessionTokenId(current.data.session.access_token);
          if (!sessionId) throw { code:'SESSION_INVALID' };
          initializeSessionActivity(sessionActivityStorage(), sessionId);
          const remaining = remainingIdleSeconds(sessionActivityStorage().getItem(ACTIVITY_KEY));
          if (!remaining) { await signOutCurrentSession(); return; }
          stage = 'activity';
          const alive = await supabase.rpc('v2_session_touch_active', {
            p_device:deviceLabel(navigator.userAgent,navigator.maxTouchPoints), p_idle_seconds:remaining,
          }).abortSignal(signal);
          if (!currentRequest()) return;
          if (alive.error) throw { ...alive.error, status:alive.status };
          if (alive.data === false) { await signOutCurrentSession('security'); return; }
          if (alive.data !== true) throw { code:'SESSION_RESPONSE_INVALID' };
        }
        stage = 'mfa';
        const result = await readMfaAccess(supabase, signal);
        if (!currentRequest()) return;
        if (result.allowed && result.userId && isAppMode()) {
          stage = 'remember';
          const remembered = await supabase.rpc('v2_session_remember_device', { p_device:deviceLabel(navigator.userAgent,navigator.maxTouchPoints) }).abortSignal(signal);
          if (!currentRequest()) return;
          if (remembered.error) throw { ...remembered.error, status:remembered.status };
          if (remembered.data === false) { await signOutCurrentSession('security'); return; }
          if (remembered.data !== true) throw { code:'SESSION_RESPONSE_INVALID' };
        }
        userId.current = result.userId;
        retainedSurface.current = result.allowed && !!result.userId;
        verifiedSessionId.current = retainedSurface.current && current.data.session ? sessionTokenId(current.data.session.access_token) : null;
        retries.current = 0;
        lastDiagnostic.current = '';
        setStatus(result.allowed ? 'allowed' : 'challenge');
      });
    } catch (error) {
      if (request !== generation.current || isSigningOut()) return;
      const failure = classifyVerificationFailure(error, navigator.onLine);
      if (failure === 'error') { retainedSurface.current = false; verifiedSessionId.current = null; }
      setStatus(failure);
      const diagnostic = verificationDiagnostic(stage, failure, error), key = JSON.stringify(diagnostic);
      if (key !== lastDiagnostic.current) {
        lastDiagnostic.current = key;
        console.warn('[UnoMesa] Access verification unavailable', diagnostic);
      }
      // Keep credentials and existing drafts, but block the work surface until
      // all checks succeed again. No new private content mounts on an error.
      if (failure === 'retrying' && document.visibilityState === 'visible') {
        const delay = SESSION_RETRY_DELAYS[Math.min(retries.current++, SESSION_RETRY_DELAYS.length - 1)];
        retryTimer.current = setTimeout(() => { retryTimer.current = undefined; void check(); }, delay);
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [cancelPending]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signOutTransition = () => {
      cancelPending();
      clearTimeout(timer);
      if (isSigningOut()) { retainedSurface.current = false; verifiedSessionId.current = null; setStatus('signing-out'); }
      else void refresh();
    };
    window.addEventListener(SESSION_SIGN_OUT_EVENT, signOutTransition);
    if (isSigningOut()) signOutTransition();
    else void refresh();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { cancelPending(); clearTimeout(timer); userId.current = null; retainedSurface.current = false; verifiedSessionId.current = null; setStatus(isSigningOut() ? 'signing-out' : 'allowed'); return; }
      if (isSigningOut()) { signOutTransition(); return; }
      cancelPending();
      if (session && (session.user.id !== userId.current || (verifiedSessionId.current && sessionTokenId(session.access_token) !== verifiedSessionId.current))) {
        retainedSurface.current = false; verifiedSessionId.current = null; setStatus('checking');
      }
      // Supabase callbacks must not await another Auth method inside its lock.
      clearTimeout(timer); timer = setTimeout(() => { void refresh(); }, 0);
    });
    const focus = () => { void refresh(); };
    const online = () => { retries.current = 0; void refresh(); };
    const offline = () => {
      if (isSigningOut()) return;
      cancelPending();
      setStatus('offline');
    };
    const heartbeat = setInterval(() => { void refresh(); }, SESSION_CHECK_INTERVAL);
    // Report real input at most once per minute, with a trailing report.
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
    const visible = () => {
      if (document.visibilityState === 'hidden') cancelPending();
      else void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', focus);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      cancelPending(); clearTimeout(timer); clearTimeout(activityTimer); clearInterval(heartbeat);
      data.subscription.unsubscribe();
      window.removeEventListener(ACTIVITY_EVENT, activity);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener(SESSION_SIGN_OUT_EVENT, signOutTransition);
    };
  }, [refresh, cancelPending]);
  const recoveryScreen = typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("reset") === "1" || new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  const workSurface = <Fragment key={verifiedSessionId.current ? `${userId.current}:${verifiedSessionId.current}` : 'public'}>{children}</Fragment>;
  if (status === "signing-out") return <main className="center" translate="no"><div role="status" aria-live="polite"><div className="loader"/><p>{en ? "Signing out…" : "Cerrando sesión…"}</p></div></main>;
  if (recoveryScreen || status === "allowed") return <>{workSurface}{null}</>;
  if (status === "checking") return <AccessLoading text={en?"Verifying access…":"Validando acceso…"}/>;
  if (status === "challenge") return <MfaChallenge done={() => void refresh()} />;
  if (status === 'offline' || status === 'retrying') {
    const loading = <AccessLoading text={en ? 'Loading UnoMesa…' : 'Cargando UnoMesa…'}/>;
    // Existing forms remain mounted behind a document-wide modal; initial
    // access stays behind the opening curtain until verification succeeds.
    return <>{retainedSurface.current ? workSurface : null}{retainedSurface.current ? <SessionConnectionDialog>{loading}</SessionConnectionDialog> : loading}</>;
  }
  const title = en ? 'We could not verify your access' : 'No pudimos verificar su acceso';
  const message = en ? 'The access check could not be completed. Please retry. If the issue continues, contact support.' : 'No se pudo completar la comprobación de acceso. Reintente y, si el problema continúa, contacte a soporte.';
  const notice = <main className="center sessionConnectionNotice" translate="no"><section className="moduleCard mfaPanel">
    <div role={status === 'error' ? 'alert' : 'status'} aria-live="polite"><h2>{title}</h2><p>{message}</p></div>
    <button className="primary" onClick={() => void refresh()}>{en ? 'Retry now' : 'Reintentar ahora'}</button>
    <button className="link" onClick={() => void signOutCurrentSession()}>{en ? 'Sign out' : 'Cerrar sesión'}</button>
  </section></main>;
  return notice;
}
