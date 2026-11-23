'use client';
import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Maximize2, Minimize2, BookOpen } from 'lucide-react';
import { usePanelViewport } from './use-panel-viewport';
import { isTopOverlay, registerOverlay } from '@/lib/overlay-stack';
import { supabase } from '@/lib/supabase';
import { useAppPreferences } from './app-preferences';
type Message={role:'user'|'assistant';content:string};
type Quota={used:number;limit:number;resets_at:string;enabled:boolean};
export function AiAssistant({restaurantId,onTutorial,page}:{restaurantId:string;onTutorial:()=>void;page?:string}){
 const {language}=useAppPreferences(),en=language==='en';
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[usage,setUsage]=useState<Quota|null>(null);
 const locked=useRef(false),alive=useRef(true),inputRef=useRef<HTMLTextAreaElement>(null),launcher=useRef<HTMLButtonElement>(null),log=useRef<HTMLDivElement>(null);
 const [expanded,setExpanded]=useState(false),layer=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),privacyId=useId();
 const viewportStyle=usePanelViewport(open);
 const compact=typeof viewportStyle?.height==='number'&&viewportStyle.height<480;
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
 useEffect(()=>{if(!open)return;void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[open,restaurantId]);
 useEffect(()=>{
  if(!open||!layer.current)return;
  const element=layer.current,unregister=registerOverlay(element);
  // Opening help must not open the software keyboard or hide the conversation.
  closeButton.current?.focus({preventScroll:true});
  const keys=(event:KeyboardEvent)=>{
   if(!isTopOverlay(element))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
   if(event.key==='Tab'){
    const nodes=Array.from(element.querySelectorAll<HTMLElement>('button,textarea,summary,a[href],[tabindex="0"]')).filter(node=>node.tabIndex>=0&&node.getClientRects().length&&!(node as HTMLButtonElement).disabled&&!node.closest('[inert],[hidden]'));
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',keys);
  return()=>{document.removeEventListener('keydown',keys);unregister();};
 },[open]);
 useLayoutEffect(()=>{
  const input=inputRef.current;if(!open||!input)return;
  const resize=()=>{input.style.height='0px';input.style.height=`${Math.max(44,Math.min(input.scrollHeight,compact?64:96))}px`;};
  resize();let width=input.clientWidth;
  const observer=new ResizeObserver(()=>{if(input.clientWidth!==width){width=input.clientWidth;resize();}});
  observer.observe(input);return()=>observer.disconnect();
 },[question,open,compact]);
 useLayoutEffect(()=>{
  const element=log.current;if(!open||!element)return;
  if(error||usage?.enabled===false||busy){element.scrollTo({top:element.scrollHeight});return;}
  const last=messages.at(-1);
  if(last?.role==='assistant'){
   // Show the start of a new answer, including when it is longer than the panel.
   const answer=element.querySelector<HTMLElement>('[data-latest-answer]');
   if(answer){element.scrollTo({top:Math.max(0,element.scrollTop+answer.getBoundingClientRect().top-element.getBoundingClientRect().top-12)});return;}
  }
  element.scrollTo({top:messages.length?element.scrollHeight:0});
 },[messages,busy,open,error,usage?.enabled]);
 function close(){inputRef.current?.blur();setOpen(false);launcher.current?.focus({preventScroll:true});}
 async function submit(){
  if(locked.current||!question.trim()||!usage?.enabled||(usage.used>=50&&!pending.current))return;
  inputRef.current?.blur();
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
  finally{locked.current=false;if(alive.current){setBusy(false);}}
 }
 const privacy=copy('OpenAI procesa su pregunta y los últimos mensajes. No incluya datos de clientes, contraseñas ni códigos. La IA puede equivocarse. Cada envío aceptado cuenta, aunque no produzca respuesta.','OpenAI processes your question and recent messages. Do not include customer data, passwords or codes. AI can make mistakes. Each accepted request counts, even if no answer is produced.');
 const tutorial=()=>{close();onTutorial();};
 return <div translate="no">
  <button ref={launcher} type="button" className="tutorialLauncher" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><MessageCircle/><span>{copy('Asistente UnoMesa','UnoMesa Assistant')}</span></button>
  {open&&typeof document!=='undefined'&&createPortal(<div ref={layer} className="aiHelpLayer" data-expanded={expanded||undefined} data-compact={compact||undefined} style={viewportStyle}>
   <button type="button" className="aiHelpShade" tabIndex={-1} onClick={close} aria-label={copy('Cerrar asistente','Close assistant')}/>
   <aside translate="no" className="aiHelpPanel" role="dialog" aria-modal="true" aria-label={copy('Asistente de ayuda UnoMesa','UnoMesa help assistant')}>
    <header><div><strong>{copy('Asistente UnoMesa','UnoMesa Assistant')}</strong><small>{copy('Ayuda para usar su aplicación','Help with using your application')}</small></div>
     <button type="button" className="aiHelpExpand" aria-label={expanded?copy('Reducir asistente','Collapse assistant'):copy('Ampliar asistente','Expand assistant')} aria-pressed={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?<Minimize2/>:<Maximize2/>}</button>
     <button ref={closeButton} type="button" onClick={close} aria-label={copy('Cerrar','Close')}><X/></button>
    </header>
    <div className="aiHelpMeta">
     <span>{usage?copy(`${Math.max(0,50-usage.used)}/50 consultas disponibles`,`${Math.max(0,50-usage.used)}/50 questions available`):copy('Consultando disponibilidad…','Checking availability…')}</span>
     <button type="button" onClick={tutorial}><BookOpen size={16}/>{copy('Tutorial','Tutorial')}</button>
    </div>
    <div className="aiHelpLog" ref={log} role="log" aria-label={copy('Conversación','Conversation')} aria-live="polite" aria-relevant="additions" tabIndex={0}>
     <details className="aiHelpInfo">
      <summary>{copy('Privacidad y consultas','Privacy and usage')}</summary>
      <p>{privacy}</p>
      {usage&&<p>{copy(`${Math.max(0,50-usage.used)} de 50 consultas disponibles para su restaurante.`,`${Math.max(0,50-usage.used)} of 50 questions available for your restaurant.`)} {copy('Se renuevan el','Resets on')} {usage.resets_at} (UTC).</p>}
      <button type="button" onClick={tutorial}>{copy('Abrir tutorial · sin límite','Open tutorial · unlimited')}</button>
     </details>
     {!messages.length&&<div className="aiHelpWelcome"><h3>{copy('¿En qué paso necesita ayuda?','Which step do you need help with?')}</h3><p>{copy('Explico las funciones de UnoMesa. No consulto ni modifico registros de su restaurante.','I explain UnoMesa features. I do not access or edit your restaurant records.')}</p>
       {[copy('¿Cómo creo una cotización?','How do I create a quote?'),copy('¿Cómo publico mi enlace y recibo solicitudes?','How do I publish my link and receive requests?'),copy('¿Cómo regreso después de pagar mi plan?','How do I return after paying for my plan?')].map(text=><button type="button" key={text} onClick={()=>{setQuestion(text);inputRef.current?.focus({preventScroll:true});}}>{text}</button>)}
     </div>}
     {messages.map((message,index)=><div key={index} data-latest-answer={index===messages.length-1&&message.role==='assistant'?true:undefined} className={`aiHelpMessage ${message.role}`}><small>{message.role==='user'?copy('Usted','You'):copy('Asistente IA','AI assistant')}</small><p>{message.content}</p></div>)}
     {busy&&<p role="status">{copy('Preparando respuesta…','Preparing an answer…')}</p>}
     {(error||usage?.enabled===false)&&<p className="aiHelpError error" role="alert">{errors[error]||errors.AI_DISABLED} {!usage&&<button type="button" onClick={()=>{setError('');void refresh();}}>{copy('Reintentar','Retry')}</button>}</p>}
    </div>
    <div className="aiHelpCompose">
     <form onSubmit={event=>{event.preventDefault();void submit();}}>
      <div className="aiHelpInputRow"><textarea ref={inputRef} value={question} maxLength={1000} rows={1} disabled={busy} aria-label={copy('Su pregunta','Your question')} aria-describedby={privacyId} placeholder={copy('Pregunte cómo usar UnoMesa…','Ask how to use UnoMesa…')} onChange={event=>{setQuestion(event.target.value);pending.current=null;}}/>
       <button type="submit" className="primary" aria-label={copy('Enviar pregunta','Send question')} disabled={busy||!question.trim()||!usage?.enabled||(usage.used>=50&&!pending.current)}><Send size={18}/><span>{copy('Enviar','Send')}</span></button>
      </div>
      <div className="aiHelpComposeNote"><small id={privacyId}>{copy('IA de OpenAI. No incluya datos privados.','OpenAI AI. Do not include private data.')}</small><small>{question.length}/1000</small></div>
     </form>
    </div>
   </aside>
  </div>,document.body)}
 </div>;
}
