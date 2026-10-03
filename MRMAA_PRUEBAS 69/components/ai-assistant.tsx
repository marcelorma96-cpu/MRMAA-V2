'use client';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppPreferences } from './app-preferences';
type Message={role:'user'|'assistant';content:string};
type Quota={used:number;limit:number;resets_at:string;enabled:boolean};
export function AiAssistant({restaurantId,onTutorial,page}:{restaurantId:string;onTutorial:()=>void;page?:string}){
 const {language}=useAppPreferences(),en=language==='en';
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[usage,setUsage]=useState<Quota|null>(null);
 const locked=useRef(false),alive=useRef(true),inputRef=useRef<HTMLTextAreaElement>(null),launcher=useRef<HTMLButtonElement>(null),log=useRef<HTMLDivElement>(null);
 const pending=useRef<{request_id:string;question:string;history:Message[]}|null>(null);
 const copy=(es:string,english:string)=>en?english:es;
 const errors:Record<string,string>={
  AI_ACCESS:copy('Su acceso o suscripción no permite usar el asistente. Consulte al administrador.','Your access or subscription does not allow assistant use. Ask the administrator.'),
  AI_MFA:copy('Complete la verificación en dos pasos y vuelva a intentarlo.','Complete two-step verification and try again.'),
  AI_INPUT:copy('Escriba una pregunta de hasta 1,000 caracteres.','Enter a question of up to 1,000 characters.'),
  AI_DISABLED:copy('El asistente aún no está disponible. Puede consultar el tutorial.','The assistant is not available yet. You can use the tutorial.'),
  AI_UNAVAILABLE:copy('No se pudo conectar. Intente nuevamente o consulte el tutorial.','Could not connect. Retry or use the tutorial.'),
  AI_BUSY:copy('Hay una consulta en proceso. Espere unos segundos y reintente; no se duplicará su solicitud.','A question is being processed. Wait a few seconds and retry; your request will not be duplicated.'),
  AI_RATE:copy('Ha enviado varias consultas seguidas. Espere un minuto.','You sent several questions in a row. Please wait a minute.'),
  AI_LIMIT:copy('Su restaurante alcanzó las 50 consultas de este mes. El tutorial sigue disponible sin límite.','Your restaurant reached its 50 questions this month. The tutorial remains unlimited.'),
  AI_FAILED:copy('No se obtuvo una respuesta. El intento se contó para controlar el consumo. Puede hacer una nueva consulta o usar el tutorial.','No answer was received. The attempt counted toward usage control. You can ask a new question or use the tutorial.'),
 };
 async function headers(){const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('AI_ACCESS');return {Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'};}
 async function refresh(){try{const response=await fetch(`/api/assistant?restaurant_id=${encodeURIComponent(restaurantId)}`,{headers:await headers(),cache:'no-store'});const value=await response.json();if(!response.ok)throw new Error(value.error||'AI_UNAVAILABLE');if(alive.current){setUsage(value);}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'AI_UNAVAILABLE');}}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!open)return;void refresh();inputRef.current?.focus();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[open,restaurantId]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight});},[messages,busy,open]);
 function close(){setOpen(false);launcher.current?.focus();}
 async function submit(){
  if(locked.current||!question.trim()||!usage?.enabled||(usage.used>=50&&!pending.current))return;
  locked.current=true;setBusy(true);setError('');
  if(!pending.current){pending.current={request_id:crypto.randomUUID(),question:question.trim(),history:messages.slice(-4).map(m=>({...m,content:m.content.slice(0,500)}))};setMessages(old=>[...old.slice(-19),{role:'user',content:question.trim()}]);}
  const payload=pending.current;
  try{
   const response=await fetch('/api/assistant',{method:'POST',headers:await headers(),body:JSON.stringify({...payload,restaurant_id:restaurantId,language,page})});
   const value=await response.json();
   if(!alive.current)return;
   if(typeof value.used==='number')setUsage(old=>old?{...old,used:value.used,resets_at:value.resets_at}:old);
   if(!response.ok){if(value.error==='AI_FAILED'){pending.current=null;void refresh();}throw new Error(value.error||'AI_UNAVAILABLE');}
   if(typeof value.answer!=='string')throw new Error('AI_UNAVAILABLE');
   setMessages(old=>[...old.slice(-19),{role:'assistant',content:value.answer}]);setQuestion('');pending.current=null;
  }catch(e){if(alive.current)setError(e instanceof Error&&errors[e.message]?e.message:'AI_UNAVAILABLE');}
  finally{locked.current=false;if(alive.current){setBusy(false);inputRef.current?.focus();}}
 }
 return <div translate="no">
  <button ref={launcher} type="button" className="tutorialLauncher" onClick={()=>setOpen(true)}><MessageCircle/><span>{copy('Asistente UnoMesa','UnoMesa Assistant')}</span></button>
  {open&&typeof document!=='undefined'&&createPortal(<aside translate="no" className="aiHelpPanel" role="dialog" aria-label={copy('Asistente de ayuda UnoMesa','UnoMesa help assistant')} onKeyDown={event=>{if(event.key==='Escape')close();}}>
   <header><div><strong>{copy('Asistente UnoMesa','UnoMesa Assistant')}</strong><small>{copy('Ayuda para usar su aplicación','Help with using your application')}</small></div><button type="button" onClick={close} aria-label={copy('Cerrar','Close')}><X/></button></header>
   <div className="aiHelpMeta">
    <p>{usage?copy(`${Math.max(0,50-usage.used)} de 50 consultas disponibles para su restaurante.`,`${Math.max(0,50-usage.used)} of 50 questions available for your restaurant.`):copy('Consultando disponibilidad…','Checking availability…')}</p>
    {usage&&<small>{copy('Se renuevan el','Resets on')} {usage.resets_at} (UTC).</small>}
    <button type="button" onClick={()=>{close();onTutorial();}}>{copy('Abrir tutorial · sin límite','Open tutorial · unlimited')}</button>
   </div>
   <div className="aiHelpLog" ref={log} role="log" aria-live="polite" aria-relevant="additions">
    {!messages.length&&<div className="aiHelpWelcome"><h3>{copy('¿En qué paso necesita ayuda?','Which step do you need help with?')}</h3><p>{copy('Explico las funciones de UnoMesa. No consulto ni modifico registros de su restaurante.','I explain UnoMesa features. I do not access or edit your restaurant records.')}</p>
      {[copy('¿Cómo creo una cotización?','How do I create a quote?'),copy('¿Cómo cambio los colores del horario?','How do I change schedule colors?'),copy('¿Cómo activo los dos pasos?','How do I enable two-step verification?')].map(text=><button type="button" key={text} onClick={()=>{setQuestion(text);inputRef.current?.focus();}}>{text}</button>)}
    </div>}
    {messages.map((message,index)=><div key={index} className={`aiHelpMessage ${message.role}`}><small>{message.role==='user'?copy('Usted','You'):copy('Asistente IA','AI assistant')}</small><p>{message.content}</p></div>)}
    {busy&&<p role="status">{copy('Preparando respuesta…','Preparing an answer…')}</p>}
   </div>
   <div className="aiHelpCompose">
    {(error||usage?.enabled===false)&&<p className="error" role="alert">{errors[error]||errors.AI_DISABLED} {!usage&&<button type="button" onClick={()=>{setError('');void refresh();}}>{copy('Reintentar','Retry')}</button>}</p>}
    <form onSubmit={event=>{event.preventDefault();void submit();}}>
     <textarea ref={inputRef} value={question} maxLength={1000} rows={3} disabled={busy} aria-label={copy('Su pregunta','Your question')} placeholder={copy('Pregunte cómo usar UnoMesa…','Ask how to use UnoMesa…')} onChange={event=>{setQuestion(event.target.value);pending.current=null;}}/>
     <div><small>{question.length}/1000</small><button type="submit" className="primary" disabled={busy||!question.trim()||!usage?.enabled||(usage.used>=50&&!pending.current)}><Send/>{copy('Enviar','Send')}</button></div>
    </form>
    <small>{copy('OpenAI procesa su pregunta y los últimos mensajes. No incluya datos de clientes, contraseñas ni códigos. La IA puede equivocarse. Cada envío aceptado cuenta, aunque no produzca respuesta.','OpenAI processes your question and recent messages. Do not include customer data, passwords or codes. AI can make mistakes. Each accepted request counts, even if no answer is produced.')}</small>
   </div>
  </aside>,document.body)}
 </div>;
}
