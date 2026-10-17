"use client";
import {useEffect,useRef,useState} from 'react';
import {loadTurnstile,type TurnstileApi} from '@/lib/turnstile';
import {useAppPreferences} from './app-preferences';

/** Quiet app appearance keeps the same server-verified, single-use protection. */
export function AccessVerification({onToken,quiet=false,siteKey}:{onToken:(token:string)=>void;quiet?:boolean;siteKey:string}){
 const {language}=useAppPreferences(),en=language==='en';
 const container=useRef<HTMLDivElement>(null);
 const [status,setStatus]=useState(''),[failed,setFailed]=useState(false),[interactive,setInteractive]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let id:string|undefined,api:TurnstileApi|undefined,cancelled=false;
  let expiry:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
  const say=(es:string,english:string)=>en?english:es;
  onToken('');setFailed(false);setInteractive(false);setStatus(say('Verificando acceso…','Checking access…'));
  const fail=(message:string)=>{if(cancelled)return;clearTimeout(expiry);clearTimeout(deadline);onToken('');setFailed(true);setStatus(message)};
  void loadTurnstile().then(loaded=>{
   if(cancelled||!container.current)return;api=loaded;
   deadline=setTimeout(()=>fail(say('No pudimos verificar la conexión. Intente nuevamente.','We could not verify the connection. Try again.')),60000);
   id=api.render(container.current,{
    sitekey:siteKey,theme:'auto',language,size:'flexible',appearance:quiet?'interaction-only':'always',
    'before-interactive-callback':()=>{if(!cancelled){setInteractive(true);setStatus(say('Confirme el acceso para continuar.','Confirm access to continue.'))}},
    'after-interactive-callback':()=>{if(!cancelled)setInteractive(false)},
    callback:token=>{if(cancelled)return;clearTimeout(deadline);clearTimeout(expiry);setFailed(false);setInteractive(false);setStatus(say('Verificación completada.','Verification complete.'));onToken(token);
     expiry=setTimeout(()=>{if(cancelled)return;onToken('');if(quiet)setRetry(n=>n+1);else fail(say('La verificación venció. Vuelva a verificar.','Verification expired. Please verify again.'))},290000);
    },
    'expired-callback':()=>{if(cancelled)return;onToken('');if(quiet)setRetry(n=>n+1);else fail(say('La verificación venció. Vuelva a verificar.','Verification expired. Please verify again.'))},
    'timeout-callback':()=>fail(say('La verificación agotó el tiempo. Intente nuevamente.','Verification timed out. Try again.')),
    'error-callback':()=>{fail(say('No se pudo verificar el acceso. Revise su conexión e intente nuevamente.','Access could not be verified. Check your connection and retry.'));return true},
   });
  }).catch(()=>fail(say('No se pudo verificar el acceso. Revise su conexión e intente nuevamente.','Access could not be verified. Check your connection and retry.')));
  return()=>{cancelled=true;clearTimeout(expiry);clearTimeout(deadline);if(id!==undefined&&api)api.remove(id)};
 },[onToken,retry,language,quiet,siteKey,en]);
 return <div className={`turnstileWrap ${quiet?'verificationQuiet':''}`} translate="no"><div ref={container}/>{(!quiet||failed||interactive)&&<small role="status">{status}</small>}{failed&&<button type="button" className="link" onClick={()=>setRetry(n=>n+1)}>{en?'Retry':'Reintentar'}</button>}</div>;
}
