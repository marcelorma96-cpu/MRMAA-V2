"use client";
import { ContactLink } from './contact-link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,ChevronRight,ListChecks,MessageCircle,Plus,RefreshCw} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {translate} from '@/lib/translations';
import {confirmDiscardChanges,useUnsavedChanges} from '@/lib/unsaved-changes';
import {localDateISO,formatEventTime} from '@/lib/local-date';
import {EVENT_FOLLOWUP_OPEN,EVENT_FOLLOWUP_CHANGED,eventFollowupError,eventCustomerMessage,eventWhatsAppUrl,notifyEventFollowup,type EventTarget,type EventTask,type EventFollowup,type EventInbox,type EventInfo} from '@/lib/event-followup';
import {AppSheet} from './app-context';
import {useSuccessToast} from './success-toast';
import {useFloorAreaLabels} from './use-floor-area-labels';
import styles from './event-followup.module.css';
const dateLabel=(value:string|null)=>value?value.split('-').reverse().join('/'):'—';
const statusText=(status:EventTask['status'],en:boolean)=>({pending:en?'Pending':'Pendiente',waiting:en?'Waiting for customer':'Esperando al cliente',done:en?'Done':'Listo',not_needed:en?'Not applicable':'No aplica'}[status]);

/** Active panels refresh without remounting inputs. Background tabs do no polling. */
function useEventQuery<T>(restaurantId:string,method:string,args:Record<string,unknown>){
 const params=JSON.stringify(args),scope=`${restaurantId}:${method}:${params}`;
 const [version,setVersion]=useState(0),[state,setState]=useState<{scope:string;data:T|null;error:unknown;updated:string}>({scope:'',data:null,error:null,updated:''});
 useEffect(()=>{
  let stopped=false,busy=false;const controller=new AbortController();
  async function load(){
   if(stopped||busy)return;busy=true;
   try {const {data,error}=await supabase.rpc(method,{p_restaurant_id:restaurantId,...JSON.parse(params)}).abortSignal(controller.signal);
    if(stopped)return;if(error)throw error;
    setState({scope,data:data as T,error:null,updated:new Date().toISOString()});
   } catch(error){if(!stopped)setState(old=>({scope,data:old.scope===scope?old.data:null,error,updated:old.scope===scope?old.updated:''}));}
   finally{busy=false;}
  }
  void load();
  const visible=()=>{if(document.visibilityState==='visible')void load();};
  const changed=(e:Event)=>{if((e as CustomEvent).detail?.restaurantId===restaurantId)visible();};
  const timer=window.setInterval(visible,20000);
  window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);window.addEventListener(EVENT_FOLLOWUP_CHANGED,changed);
  let channel:BroadcastChannel|undefined;
  try{channel=new BroadcastChannel('unomesa-event-followup');channel.onmessage=e=>{if(e.data?.restaurantId===restaurantId)visible();};}catch{}
  return()=>{stopped=true;controller.abort();clearInterval(timer);channel?.close();window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);window.removeEventListener(EVENT_FOLLOWUP_CHANGED,changed);};
 },[restaurantId,method,params,scope,version]);
 const current=state.scope===scope?state:{data:null,error:null,updated:''};
 return {...current,refresh:useCallback(()=>setVersion(v=>v+1),[])};
}

export function EventFollowupHost({restaurantId,restaurantName,canRead,canEdit,en,timeFormat}:{restaurantId:string;restaurantName:string;canRead:boolean;canEdit:boolean;en:boolean;timeFormat:unknown}){
 const [view,setView]=useState<{target:EventTarget|null}|null>(null),busyRef=useRef(false);
 useEffect(()=>{
  const open=(e:Event)=>{const d=(e as CustomEvent).detail;if(!canRead||d?.restaurantId!==restaurantId||busyRef.current)return;
   if(d.target!==null&&(!['quote','reservation'].includes(d.target?.kind)||typeof d.target?.id!=='string'))return;
   if(confirmDiscardChanges())setView({target:d.target});};
  window.addEventListener(EVENT_FOLLOWUP_OPEN,open);return()=>window.removeEventListener(EVENT_FOLLOWUP_OPEN,open);
 },[restaurantId,canRead]);
 useEffect(()=>{setView(null)},[restaurantId,canRead]);
 const change=(target:EventTarget|null)=>{if(!busyRef.current&&confirmDiscardChanges())setView({target});};
 const close=()=>{if(!busyRef.current&&confirmDiscardChanges())setView(null);};
 if(!canRead||!view)return null;
 return <AppSheet open title={view.target?(en?'Event follow-up':'Seguimiento del evento'):(en?'Team follow-up':'Pendientes del equipo')} close={close}>
  {view.target?<EventPanel key={`${restaurantId}:${view.target.kind}:${view.target.id}`} restaurantId={restaurantId} target={view.target} restaurantName={restaurantName} canEdit={canEdit} en={en} timeFormat={timeFormat} back={()=>change(null)} onBusy={v=>{busyRef.current=v}}/>:<EventInboxPanel restaurantId={restaurantId} en={en} timeFormat={timeFormat} open={change}/>}
 </AppSheet>;
}

function EventInboxPanel({restaurantId,en,timeFormat,open}:{restaurantId:string;en:boolean;timeFormat:unknown;open:(target:EventTarget)=>void}){
 const [offset,setOffset]=useState(0);
 const query=useEventQuery<EventInbox>(restaurantId,'v2_event_inbox_current',{p_today:localDateISO(),p_offset:offset});
 useEffect(()=>{if(query.data&&offset>0&&offset>=query.data.total)setOffset(Math.max(0,Math.floor((query.data.total-1)/50)*50));},[query.data,offset]);
 return <div className={styles.panel} translate="no">
  <div className={styles.bar}><p className={styles.notice}>{en?'What your team still needs to arrange.':'Lo que su equipo aún necesita coordinar.'}</p><button type="button" aria-label={en?'Refresh':'Actualizar'} onClick={query.refresh}><RefreshCw size={18}/></button></div>
  {query.error?<p className={styles.error} role="alert">{eventFollowupError(query.error,en)}</p>:null}
  {!query.data&&!query.error&&<p role="status">{en?'Loading follow-up…':'Cargando pendientes…'}</p>}
  {query.data&&<>
   <small>{query.data.total} {en?'pending steps · ordered by due date':'pasos pendientes · ordenados por vencimiento'}</small>
   {!query.data.total&&<div className={styles.empty}><CheckCircle2/><h3>{en?'No pending steps':'Sin pasos pendientes'}</h3><p className={styles.notice}>{en?'Open a saved quote or reservation → Event follow-up → Add event steps.':'Abra una cotización o reservación guardada → Seguimiento → Agregar pasos del evento.'}</p></div>}
   <div className={styles.list}>{query.data.rows.map(row=><button type="button" className={styles.item} key={row.id} onClick={()=>open({kind:row.kind,id:row.event_id})}><ListChecks/><span><strong>{row.title}</strong><small>{row.client_name} · {dateLabel(row.event_date)} · {formatEventTime(row.event_time,timeFormat)}</small><small>{row.assignee||(en?'Unassigned':'Sin responsable')}</small>{row.due_date&&<small className={row.due_date<localDateISO()?styles.late:undefined}>{en?'Due':'Vence'} {dateLabel(row.due_date)}</small>}{row.status==='waiting'&&<em>{statusText(row.status,en)}</em>}</span><ChevronRight/></button>)}</div>
   {query.data.total>50&&<div className={styles.bar}><button type="button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>{en?'Previous':'Anterior'}</button><small>{offset+1}–{Math.min(offset+50,query.data.total)} / {query.data.total}</small><button type="button" disabled={offset+50>=query.data.total} onClick={()=>setOffset(n=>n+50)}>{en?'Next':'Siguiente'}</button></div>}
  </>}
  {query.updated&&<small className={styles.updated}>{en?'Updated':'Actualizado'} {new Date(query.updated).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · {en?'Refreshes every 20 seconds while visible':'Se actualiza cada 20 s mientras está visible'}</small>}
 </div>;
}

type Draft=Pick<EventTask,'id'|'title'|'category'|'status'|'assignee'|'due_date'|'notes'|'revision'>;
const toDraft=(t:EventTask):Draft=>({id:t.id,title:t.title,category:t.category,status:t.status,assignee:t.assignee,due_date:t.due_date,notes:t.notes,revision:t.revision});
function EventPanel({restaurantId,target,restaurantName,canEdit,en,timeFormat,back,onBusy}:{restaurantId:string;target:EventTarget;restaurantName:string;canEdit:boolean;en:boolean;timeFormat:unknown;back:()=>void;onBusy:(v:boolean)=>void}){
 const query=useEventQuery<EventFollowup>(restaurantId,'v2_event_read',{p_kind:target.kind,p_id:target.id});
 const [draft,setDraft]=useState<Draft|null>(null),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[writeError,setWriteError]=useState(''),[share,setShare]=useState(false);
 const saving=useRef(false),alive=useRef(true),showSuccess=useSuccessToast();
 const dirty=!!draft&&JSON.stringify(draft)!==baseline;
 const markSaved=useUnsavedChanges(dirty,()=>setDraft(null));
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;onBusy(false)}},[]);
 const event=query.data?.event;
 const areas=useFloorAreaLabels(restaurantId,target.kind,event?[{id:event.id,area:event.area||'',event_date:event.event_date}]:[],en,query.updated);
 const lastArea=useRef({key:'',label:''});
 const areaKey=JSON.stringify([target.kind,target.id,event?.area,event?.event_date,en]);
 if(event&&!areas.loading&&!areas.error)lastArea.current={key:areaKey,label:areas.labels[event.id]||event.area||''};
 const areaLabel=event?(areas.labels[event.id]||(lastArea.current.key===areaKey?lastArea.current.label:event.area)||''):'';
 const pending=query.data?.tasks.filter(t=>t.status==='pending'||t.status==='waiting')||[];
 const complete=query.data?.tasks.filter(t=>t.status==='done'||t.status==='not_needed')||[];
 const remote=draft?.revision?query.data?.tasks.find(t=>t.id===draft.id):undefined;
 const stale=!!draft?.revision&&!!query.data&&(!remote||remote.revision!==draft.revision);
 function edit(task?:EventTask){
  if(saving.current||!confirmDiscardChanges())return;
  const value:Draft=task?toDraft(task):{id:crypto.randomUUID(),title:'',category:'custom',status:'pending',assignee:'',due_date:null,notes:'',revision:0};
  setDraft(value);setBaseline(JSON.stringify(value));setWriteError('');setShare(false);
 }
 async function write(method:'v2_event_save_task'|'v2_event_add_steps'){
  if(!canEdit||saving.current||query.error)return;saving.current=true;setBusy(true);onBusy(true);setWriteError('');
  try{
   const args=method==='v2_event_save_task'?{p_task_id:draft!.id,p_revision:draft!.revision,p_payload:draft}:{p_english:en};
   const {error}=await supabase.rpc(method,{p_restaurant_id:restaurantId,p_kind:target.kind,p_id:target.id,...args});if(error)throw error;
   if(!alive.current)return;
   markSaved();setDraft(null);query.refresh();notifyEventFollowup(restaurantId);showSuccess(en?'Event follow-up saved.':'Seguimiento del evento guardado.');
  }catch(error){if(alive.current){setWriteError(eventFollowupError(error,en));if(String((error as {message?:string})?.message).includes('EVENT_STALE'))query.refresh();}}
  finally{saving.current=false;if(alive.current)setBusy(false);onBusy(false);}
 }
 function cancel(){if(!busy&&confirmDiscardChanges()){setDraft(null);setWriteError('')}}
 const taskCard=(task:EventTask)=><button type="button" key={task.id} className={styles.item} onClick={()=>edit(task)} disabled={busy}><span><strong>{task.title}</strong><small>{task.assignee||(en?'Unassigned':'Sin responsable')}{task.due_date?` · ${en?'Due':'Vence'} ${dateLabel(task.due_date)}`:''}</small><em>{statusText(task.status,en)}</em>{task.notes&&<small>{task.notes.length>90?`${task.notes.slice(0,90)}…`:task.notes}</small>}</span><ChevronRight/></button>;
 return <div className={styles.panel} translate="no">
  <div className={styles.bar}><button type="button" onClick={back} disabled={busy}><ArrowLeft/>{en?'Team follow-up':'Pendientes del equipo'}</button><button type="button" aria-label={en?'Refresh':'Actualizar'} onClick={query.refresh} disabled={busy}><RefreshCw/></button></div>
  {query.error?<p className={styles.error} role="alert">{eventFollowupError(query.error,en)}</p>:null}
  {!event&&!query.error&&<p role="status">{en?'Loading event…':'Cargando evento…'}</p>}
  {event&&<>
   <div className={styles.hero}><small>{target.kind==='quote'?`${en?'Quote':'Cotización'} #${event.quote_number}`:(en?'Reservation':'Reservación')}</small><h3>{event.client_name}</h3><p>{dateLabel(event.event_date)} · {formatEventTime(event.event_time,timeFormat)} · {event.guests??'—'} {en?'guests':'personas'}</p><p>{areaLabel||(en?'Space to be arranged':'Espacio por definir')}</p><small>{en?'Record status':'Estado del registro'}: {translate(event.status,en?'en':'es')}</small>{query.data?.quote_id&&query.data.reservation_ids.length>0&&<small>{en?'Shared with the linked quote and reservation.':'Compartido con la cotización y la reserva vinculadas.'}</small>}</div>
   {!draft&&!share&&<>
    {query.data!.tasks.length>0&&<div className={styles.progress}><div><strong>{pending.length} {en?'pending':'pendientes'}</strong><span>{complete.length}/{query.data!.tasks.length} {en?'resolved':'resueltos'}</span></div><progress value={complete.length} max={query.data!.tasks.length}/></div>}
    {!query.data!.tasks.length&&<div className={styles.empty}><ListChecks/><h3>{en?'Prepare this event':'Prepare este evento'}</h3><p className={styles.notice}>{en?'Confirmation, deposit, menu, setup and event lead — each with a status, owner and notes.':'Confirmación, anticipo, menú, montaje y responsable: cada paso con estado, encargado y acuerdos.'}</p>{canEdit&&<button type="button" className={`primary ${styles.trigger}`} disabled={busy||!!query.error} onClick={()=>void write('v2_event_add_steps')}>{busy?(en?'Saving…':'Guardando…'):(en?'Add event steps':'Agregar pasos del evento')}</button>}</div>}
    <div className={styles.list}>{pending.map(taskCard)}</div>
    {complete.length>0&&<details className={styles.complete}><summary>{en?'Resolved':'Resueltos'} ({complete.length})</summary><div className={styles.list}>{complete.map(taskCard)}</div></details>}
    <div className={styles.actions}>{canEdit&&<button type="button" disabled={busy||!!query.error} onClick={()=>edit()}><Plus/>{en?'Add step':'Agregar paso'}</button>}<button type="button" disabled={busy||areas.loading||areas.error||!!query.error} onClick={()=>setShare(true)}><MessageCircle/>WhatsApp</button></div>
    {areas.error&&<p className={styles.error} role="alert">{en?'Could not verify the selected tables. Refresh before sharing.':'No se pudieron verificar las mesas seleccionadas. Actualice antes de compartir.'}</p>}
    <p className={styles.notice}>{en?'Internal coordination only. Steps do not change amounts, payments or reservation status.':'Coordinación interna. Los pasos no cambian importes, pagos ni el estado de la reserva.'}</p>
   </>}
   {draft&&<form className={styles.editor} onSubmit={e=>{e.preventDefault();if(!stale)void write('v2_event_save_task')}}>
    <h3>{canEdit?(draft.revision?(en?'Edit step':'Editar paso'):(en?'New step':'Nuevo paso')):(en?'Step details':'Detalle del paso')}</h3>
    <label>{en?'Step':'Paso'}<input aria-label={en?'Step':'Paso'} autoFocus value={draft.title} maxLength={160} required disabled={!canEdit||busy} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <div className={styles.columns}><label>{en?'Status':'Estado'}<select aria-label={en?'Status':'Estado'} value={draft.status} disabled={!canEdit||busy} onChange={e=>setDraft({...draft,status:e.target.value as Draft['status']})}>{(['pending','waiting','done','not_needed'] as const).map(s=><option key={s} value={s}>{statusText(s,en)}</option>)}</select></label><label>{en?'Due date':'Fecha límite'}<input aria-label={en?'Due date':'Fecha límite'} type="date" min="2000-01-01" max="2100-12-31" value={draft.due_date||''} disabled={!canEdit||busy} onChange={e=>setDraft({...draft,due_date:e.target.value||null})}/></label></div>
    <label>{en?'Person in charge':'Responsable'}<input aria-label={en?'Person in charge':'Responsable'} value={draft.assignee} maxLength={100} placeholder={en?'Team member name':'Nombre de la persona del equipo'} disabled={!canEdit||busy} onChange={e=>setDraft({...draft,assignee:e.target.value})}/></label>
    <label>{en?'Agreements and internal notes':'Acuerdos y notas internas'}<textarea aria-label={en?'Agreements and internal notes':'Acuerdos y notas internas'} rows={4} value={draft.notes} maxLength={4000} disabled={!canEdit||busy} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
    <small>{en?'These notes are private to the team and are excluded from the customer message and quote PDF.':'Estas notas son privadas del equipo; no se incluyen en el mensaje al cliente ni en el PDF de cotización.'}</small>
    {stale&&<div className={styles.error} role="alert"><p>{en?'This step changed while you were editing. Your draft has not been overwritten. Copy any text you need, then load the current version.':'Este paso cambió mientras lo editaba. Su borrador se conserva. Copie el texto que necesite y cargue la versión actual.'}</p>{remote&&<button type="button" onClick={()=>edit(remote)}>{en?'Load current version':'Cargar versión actual'}</button>}</div>}
    <div className={styles.actions}><button type="button" disabled={busy} onClick={cancel}>{en?'Back':'Volver'}</button>{canEdit&&<button type="submit" className={styles.primary} disabled={busy||stale||!!query.error||!draft.title.trim()||(!dirty&&draft.revision>0)}>{busy?(en?'Saving…':'Guardando…'):(en?'Save step':'Guardar paso')}</button>}</div>
   </form>}
   {share&&<EventMessage event={event} restaurant={restaurantName} area={areaLabel} en={en} timeFormat={timeFormat} close={()=>setShare(false)}/>}
  </>}
  {writeError&&<p className={styles.error} role="alert">{writeError}</p>}
  {query.updated&&!draft&&!share&&<small className={styles.updated}>{en?'Updated':'Actualizado'} {new Date(query.updated).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · {en?'Refreshes every 20 s while visible':'Se actualiza cada 20 s mientras está visible'}</small>}
 </div>;
}
function EventMessage({event,restaurant,area,en,timeFormat,close}:{event:EventInfo;restaurant:string;area:string;en:boolean;timeFormat:unknown;close:()=>void}){
 const [phone,setPhone]=useState(event.phone||''),[message,setMessage]=useState(()=>eventCustomerMessage(event,restaurant,area,en,timeFormat));
 const [initial]=useState(()=>JSON.stringify([phone,message]));
 useUnsavedChanges(JSON.stringify([phone,message])!==initial,close);
 const link=eventWhatsAppUrl(phone,message);
 return <div className={styles.share}><h3>{en?'Review customer message':'Revise el mensaje al cliente'}</h3>
  <label>{en?'WhatsApp with country code':'WhatsApp con código de país'}<input aria-label={en?'WhatsApp with country code':'WhatsApp con código de país'} type="tel" value={phone} maxLength={30} placeholder="+502 …" onChange={e=>setPhone(e.target.value)}/></label>
  {!link&&<small>{en?'Use + and country code, followed by the number. The saved phone will not change.':'Use + y el código de país seguido del número. El teléfono guardado no cambia.'}</small>}
  <label>{en?'Message':'Mensaje'}<textarea aria-label={en?'Message':'Mensaje'} rows={9} maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
  <small>{en?'Opening WhatsApp does not send the message or mark this event as confirmed. To share the quote PDF, use View quote → PDF and attach/share that file.':'Abrir WhatsApp no envía el mensaje ni confirma el evento. Para compartir el PDF, use Ver cotización → PDF y adjunte o comparta ese archivo.'}</small>
  {link&&<ContactLink className={styles.primary} href={link}>{en?'Open WhatsApp':'Abrir WhatsApp'}</ContactLink>}
  <div className={styles.actions}><button type="button" onClick={()=>{if(confirmDiscardChanges())close()}}>{en?'Back to follow-up':'Volver al seguimiento'}</button></div>
 </div>;
}
