'use client';
import {useEffect,useRef,useState} from 'react';
import {MailCheck,ArrowLeft,ShieldCheck} from 'lucide-react';
import {BrandLogo} from './brand-logo';
import {AccessVerification} from './access-verification';
import {useAppPreferences} from './app-preferences';
import styles from './registration-confirmation.module.css';

export function RegistrationConfirmation({email,app,initialWait=60,onLogin,onRegister}:{email:string;app:boolean;initialWait?:number;onLogin:()=>void;onRegister:()=>void}) {
 const {language,t}=useAppPreferences(),en=language==='en';
 const [deadline,setDeadline]=useState(()=>Date.now()+initialWait*1000),[remaining,setRemaining]=useState(initialWait);
 const [busy,setBusy]=useState(false),[token,setToken]=useState(''),[attempt,setAttempt]=useState(0);
 const [feedback,setFeedback]=useState(''),[error,setError]=useState(false),[retryRegistration,setRetryRegistration]=useState(false),[helpOpen,setHelpOpen]=useState(false);
 const inFlight=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
 useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0});},[]);
 useEffect(()=>{const tick=()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[deadline]);
 async function resend() {
  if(inFlight.current||remaining>0)return;
  setFeedback('');setError(false);
  if(siteKey&&!token){setError(true);setFeedback(en?'Complete the security check below.':'Complete la verificación de seguridad.');return;}
  inFlight.current=true;setBusy(true);
  try {
   const response=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend',email,captchaToken:token||undefined})});
   const result=await response.json();
   if(response.ok&&result.ok){setFeedback(en?'A new confirmation link has been requested. Check your inbox and spam folder.':'Se solicitó un nuevo enlace de confirmación. Revise su bandeja de entrada y correo no deseado.');setDeadline(Date.now()+60000);}
   else {setError(true);setFeedback(t(result.error||'No pudimos confirmar el envío del correo.'));setRetryRegistration(result.code==='REGISTRATION_RETRY_REQUIRED');if(result.retryAfter)setDeadline(Date.now()+Math.min(300,result.retryAfter)*1000);}
  } catch {setError(true);setFeedback(en?'Connection failed. Please try again.':'No se pudo conectar. Intente nuevamente.');}
  finally {setToken('');setAttempt(n=>n+1);inFlight.current=false;setBusy(false);}
 }
 return <main className={styles.page} data-app={app||undefined} translate="no">
  <div className={styles.brand}><BrandLogo/></div>
  <section className={styles.card} aria-labelledby="confirmation-heading">
   <div className={styles.icon}><MailCheck size={38} strokeWidth={1.6}/></div>
   <p className={styles.eyebrow}>{en?'ONE LAST STEP':'SOLO FALTA UN PASO'}</p>
   <h1 id="confirmation-heading" ref={heading} tabIndex={-1}>{en?'Check your email':'Revisa tu correo'}</h1>
   <p className={styles.intro}>{en?'Confirm your email address to activate your UnoMesa account.':'Confirma tu correo para activar tu cuenta de UnoMesa.'}</p>
   <strong className={styles.email}>{email}</strong>
   <ol className={styles.steps}>
    <li><span>1</span>{en?'Open the UnoMesa confirmation email.':'Abre el correo de confirmación de UnoMesa.'}</li>
    <li><span>2</span>{en?'Tap the confirmation link to continue.':'Pulsa el enlace de confirmación para continuar.'}</li>
   </ol>
   <div className={styles.note}><ShieldCheck size={18}/><span>{en?'You need to confirm your email before signing in.':'Necesitas confirmar tu correo antes de iniciar sesión.'}</span></div>
   <details className={styles.help} onToggle={e=>setHelpOpen(e.currentTarget.open)}>
    <summary>{en?'Did not receive the email?':'¿No recibiste el correo?'}</summary>
    <p>{en?'Check spam and promotions, and make sure the address above is correct. Delivery may take a few minutes.':'Revisa spam y promociones y comprueba que el correo de arriba sea correcto. La entrega puede tardar unos minutos.'}</p>
    {helpOpen&&siteKey&&<AccessVerification key={attempt} quiet={app} siteKey={siteKey} onToken={setToken}/>}
    <button type="button" className={styles.resend} onClick={resend} disabled={busy||remaining>0}>{busy?(en?'Sending…':'Enviando…'):remaining>0?(en?`Resend in ${remaining}s`:`Reenviar en ${remaining}s`):(en?'Resend confirmation':'Reenviar confirmación')}</button>
    {feedback&&<p className={error?styles.error:styles.success} role={error?'alert':'status'}>{feedback}</p>}
    {retryRegistration&&<button className={styles.link} onClick={onRegister}>{en?'Return to registration':'Volver al registro'}</button>}
    <p className={styles.support}>{en?'Still need help?':'¿Necesitas ayuda?'} <a href="mailto:support@unomesa.com">support@unomesa.com</a></p>
   </details>
   <button type="button" className={styles.login} onClick={onLogin} disabled={busy}><ArrowLeft size={15}/>{en?'Back to sign in':'Volver al inicio de sesión'}</button>
  </section>
 </main>;
}
