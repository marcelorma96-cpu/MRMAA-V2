"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,Plus,RefreshCw} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {EVENT_FOLLOWUP_OPEN,EVENT_FOLLOWUP_CHANGED,openEventFollowup,notifyEventFollowup,eventFollowupError,type EventFollowup,type EventTarget,type EventTask} from '@/lib/event-followup';
import {readReminderInbox,readEventPending,pendingDraft,saveEventPending,dismissEventPending,REMINDER_FETCH_SIZE,REMINDER_VISIBLE_PAGE_SIZE,type PendingDraft} from '@/lib/event-reminders';
import {createReadQueue} from '@/lib/list-query';
import {confirmDiscardChanges,useUnsavedChanges} from '@/lib/unsaved-changes';
import {formatEventTime} from '@/lib/local-date';
import {useRefreshTask} from './pull-refresh';
import {AppSheet} from './app-context';
import {Pagination} from './pagination';
import {useSuccessToast} from './success-toast';
import styles from './event-pending.module.css';
const dateLabel=(value:string|null)=>value?value.split('-').reverse().join('/'):'—';

/** One bounded read queue per visible panel; local writes refresh now, other devices on focus/30s. */
function usePendingQuery<T>(restaurant:string,key:string,read:(signal:AbortSignal)=>Promise<T>,version=''){
 const [state,setState]=useState<{key:string;data:T|null;error:unknown}>({key,data:null,error:null});
 const [loading,setLoading]=useState(true),queue=useRef<ReturnType<typeof createReadQueue<T>>|null>(null);
 const reader=useRef(read);reader.current=read;
 useRefreshTask(()=>queue.current?.refreshAndWait());
 const refresh=useCallback(()=>queue.current?.refresh(),[]);
 useEffect(()=>{
  const q=createReadQueue<T>({read:signal=>reader.current(signal),onData:data=>setState({key,data,error:null}),onError:error=>setState(old=>({key,data:old.key===key?old.data:null,error})),onLoading:setLoading});
  queue.current=q;q.refresh();
  const visible=()=>{if(document.visibilityState==='visible'&&navigator.onLine)q.refresh()};
  const changed=(event:Event)=>{if((event as CustomEvent).detail?.restaurantId===restaurant)visible()};
  const timer=window.setInterval(visible,30000);
  window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);window.addEventListener(EVENT_FOLLOWUP_CHANGED,changed);
  let channel:BroadcastChannel|undefined;
  try{channel=new BroadcastChannel('unomesa-event-followup');channel.onmessage=e=>{if(e.data?.restaurantId===restaurant)visible()}}catch{}
  return()=>{q.stop();if(queue.current===q)queue.current=null;clearInterval(timer);channel?.close();window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);window.removeEventListener(EVENT_FOLLOWUP_CHANGED,changed)};
 },[restaurant,key,version]);
 return {...(state.key===key?state:{data:null,error:null}),loading,refresh};
}

export function EventReminders({restaurantId,canEdit,en,timeFormat,version,onViewQuote,onEditQuote,opening=false}:{restaurantId:string;canEdit:boolean;en:boolean;timeFormat:unknown;version:string;onViewQuote:(id:string)=>void;onEditQuote:(id:string)=>void;opening?:boolean}){
 const [page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const offset=Math.floor((page-1)*REMINDER_VISIBLE_PAGE_SIZE/REMINDER_FETCH_SIZE)*REMINDER_FETCH_SIZE;
 const query=usePendingQuery(restaurantId,`${restaurantId}:inbox:${offset}`,signal=>readReminderInbox(supabase,restaurantId,offset,signal),version);
 const showSuccess=useSuccessToast();
 useEffect(()=>{if(query.data&&page>Math.max(1,Math.ceil(query.data.total/REMINDER_VISIBLE_PAGE_SIZE)))setPage(Math.max(1,Math.ceil(query.data.total/REMINDER_VISIBLE_PAGE_SIZE)))},[query.data,page]);
 const first=(page-1)*REMINDER_VISIBLE_PAGE_SIZE-offset,rows=query.data?.rows.slice(first,first+REMINDER_VISIBLE_PAGE_SIZE)||[];
 async function dismiss(row:typeof rows[number]){
  if(!canEdit||lock.current||query.error)return;lock.current=true;setBusy(true);setError('');
  try{await dismissEventPending(supabase,restaurantId,{kind:row.kind,id:row.event_id},row.id,row.updated_at);notifyEventFollowup(restaurantId);if(alive.current)showSuccess(en?'Reminder dismissed. The event stays saved.':'Recordatorio quitado. El evento se conserva.');}
  catch(e){if(alive.current){setError(eventFollowupError(e,en));query.refresh();}}
  finally{lock.current=false;if(alive.current)setBusy(false)}
 }
 return <section className={styles.reminders} aria-label={en?'Pending reminders':'Recordatorios de pendientes'} translate="no" aria-busy={query.loading}>
  <header><div><Bell aria-hidden="true"/><h2>{en?'Reminders':'Recordatorios'}</h2><span>{query.data?.total??'…'}</span></div><button type="button" className={styles.refresh} aria-label={en?'Refresh reminders':'Actualizar recordatorios'} onClick={query.refresh} disabled={query.loading||busy}><RefreshCw size={17}/></button></header>
  <p className={styles.caption}>{en?'To add a pending item, select Pending items on a saved quote.':'Para agregar un pendiente, pulsa el botón Pendientes en una cotización ya guardada.'}</p>
  {query.error?<p className={styles.error} role="alert">{eventFollowupError(query.error,en)}</p>:null}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {!query.data&&!query.error&&<p role="status">{en?'Checking reminders…':'Consultando pendientes…'}</p>}
  {query.data&&!query.data.total&&<p className={styles.caption}>{en?'No pending reminders.':'No hay recordatorios pendientes.'}</p>}
  <ul>{rows.map(row=><li key={row.id} data-pending-id={row.id}>
   <div className={styles.reminderText}><strong>{row.title}</strong><small>{row.kind==='quote'?<button type="button" className={styles.contextLink} onClick={()=>onViewQuote(row.event_id)} disabled={busy||opening}>{en?'Quote':'Cotización'}{query.data?.quoteNumbers[row.event_id]!=null?` #${query.data.quoteNumbers[row.event_id]}`:''} · {row.client_name}</button>:<span>{en?'Reservation':'Reservación'} · {row.client_name}</span>} · {dateLabel(row.event_date)} · {formatEventTime(row.event_time,timeFormat)}</small></div>
   <div className={styles.actions}>
    {canEdit&&row.kind==='quote'?<button type="button" onClick={()=>onEditQuote(row.event_id)} disabled={busy||opening} title={en?'Edit quote':'Editar cotización'}>{en?'Edit':'Modificar'}</button>:<button type="button" onClick={()=>openEventFollowup(restaurantId,{kind:row.kind,id:row.event_id},row.id)} disabled={busy||opening}>{en?'View pending item':'Ver pendiente'}</button>}
    {canEdit&&<button type="button" disabled={busy||!!query.error||query.loading} onClick={()=>void dismiss(row)}>{en?'Dismiss':'Quitar'}</button>}
   </div>
  </li>)}</ul>
  <Pagination page={page} onPage={setPage} total={query.data?.total||0} pageSize={REMINDER_VISIBLE_PAGE_SIZE} loading={query.loading||busy} language={en?'en':'es'}/>
 </section>;
}

type OpenPending={target:EventTarget;taskId?:string};
export function EventPendingHost({restaurantId,canRead,canEdit,en}:{restaurantId:string;canRead:boolean;canEdit:boolean;en:boolean}){
 const [view,setView]=useState<OpenPending|null>(null),busy=useRef(false);
 useEffect(()=>{
  const open=(event:Event)=>{const d=(event as CustomEvent).detail;
   if(!canRead||busy.current||d?.restaurantId!==restaurantId||!['quote','reservation'].includes(d.target?.kind)||typeof d.target?.id!=='string')return;
   if(confirmDiscardChanges())setView({target:d.target,taskId:typeof d.taskId==='string'?d.taskId:undefined});
  };
  window.addEventListener(EVENT_FOLLOWUP_OPEN,open);return()=>window.removeEventListener(EVENT_FOLLOWUP_OPEN,open);
 },[restaurantId,canRead]);
 useEffect(()=>setView(null),[restaurantId,canRead]);
 const close=()=>{if(!busy.current&&confirmDiscardChanges())setView(null)};
 if(!view||!canRead)return null;
 return <AppSheet open title={en?'Pending items':'Pendientes'} close={close}><PendingEditor key={`${restaurantId}:${view.target.kind}:${view.target.id}:${view.taskId||''}`} restaurantId={restaurantId} target={view.target} taskId={view.taskId} canEdit={canEdit} en={en} onBusy={value=>{busy.current=value}}/></AppSheet>;
}
function PendingEditor({restaurantId,target,taskId,canEdit,en,onBusy}:{restaurantId:string;target:EventTarget;taskId?:string;canEdit:boolean;en:boolean;onBusy:(value:boolean)=>void}){
 const query=usePendingQuery<EventFollowup>(restaurantId,`${restaurantId}:${target.kind}:${target.id}`,signal=>readEventPending(supabase,restaurantId,target,signal));
 const [draft,setDraft]=useState<PendingDraft>(()=>pendingDraft()),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false),alive=useRef(true),opened=useRef(false),showSuccess=useSuccessToast(),input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;onBusy(false)}},[]);
 const reset=()=>{setDraft(pendingDraft());setBaseline('')};
 const markSaved=useUnsavedChanges(draft.title!==baseline,reset);
 const event=query.data?.event,tasks=query.data?.tasks||[],pending=tasks.filter(t=>['pending','waiting'].includes(t.status)),closed=tasks.filter(t=>!['pending','waiting'].includes(t.status));
 const current=draft.revision?tasks.find(t=>t.id===draft.id):undefined;
 const stale=!!draft.revision&&!!query.data&&(!current||current.revision!==draft.revision);
 useEffect(()=>{
  if(!query.data||opened.current)return;opened.current=true;
  const task=taskId?query.data.tasks.find(t=>t.id===taskId):undefined;
  if(task){setDraft(pendingDraft(task));setBaseline(task.title)}
  else if(taskId)setError(en?'This item is no longer available. Refresh to review the event.':'Este pendiente ya no está disponible. Actualice para revisar el evento.');
 },[query.data,taskId,en]);
 function edit(task:EventTask){if(saving.current||!confirmDiscardChanges())return;setDraft(pendingDraft(task));setBaseline(task.title);setError('');input.current?.focus()}
 async function write(value:PendingDraft,kind:'save'|'dismiss'|'restore'){
  if(!canEdit||saving.current||query.error)return;saving.current=true;setBusy(true);onBusy(true);setError('');
  try{await saveEventPending(supabase,restaurantId,target,value);notifyEventFollowup(restaurantId);
   if(!alive.current)return;
   if(kind==='save'||value.id===draft.id){markSaved();reset()}
   showSuccess(kind==='dismiss'?(en?'Reminder dismissed.':'Recordatorio quitado.'):kind==='restore'?(en?'Reminder restored.':'Recordatorio visible nuevamente.'):(en?'Pending item saved.':'Pendiente guardado.'));
  }catch(e){if(alive.current){setError(eventFollowupError(e,en));query.refresh()}}
  finally{saving.current=false;if(alive.current)setBusy(false);onBusy(false)}
 }
 function closeTask(task:EventTask){if(confirmDiscardChanges())void write({...pendingDraft(task),status:'not_needed'},'dismiss')}
 return <div className={styles.panel} translate="no">
  {!event&&!query.error&&<p role="status">{en?'Loading pending items…':'Cargando pendientes…'}</p>}
  {query.error?<p className={styles.error} role="alert">{eventFollowupError(query.error,en)} <button type="button" onClick={query.refresh}>{en?'Retry':'Reintentar'}</button></p>:null}
  {event&&<>
   <div className={styles.event}><small>{event.kind==='quote'?`${en?'Quote':'Cotización'} #${event.quote_number}`:(en?'Reservation':'Reservación')}</small><h3>{event.client_name}</h3><p>{dateLabel(event.event_date)}</p></div>
   {canEdit&&<form className={styles.form} onSubmit={e=>{e.preventDefault();if(!stale)void write(draft,'save')}}>
    <label htmlFor="event-pending-title">{draft.revision?(en?'Edit pending item':'Modificar pendiente'):(en?'What needs confirming?':'¿Qué falta por confirmar?')}</label>
    <textarea id="event-pending-title" ref={input} rows={2} maxLength={160} required placeholder={en?'For example: Confirm menu':'Por ejemplo: Falta confirmar menú'} value={draft.title} disabled={busy} onChange={e=>setDraft({...draft,title:e.target.value})}/>
    {stale&&<p className={styles.error} role="alert">{en?'This item changed on another screen. Your text is preserved; review the latest version before saving.':'Este pendiente cambió en otra pantalla. Su texto se conserva; revise la versión actual antes de guardar.'}{current&&<button type="button" onClick={()=>edit(current)}>{en?'Load latest version':'Cargar versión actual'}</button>}</p>}
    {!!draft.revision&&(draft.notes||draft.assignee||draft.due_date)&&<details className={styles.savedDetails}><summary>{en?'Saved details':'Detalles guardados'}</summary>{draft.assignee&&<p>{draft.assignee}</p>}{draft.due_date&&<p>{dateLabel(draft.due_date)}</p>}{draft.notes&&<p>{draft.notes}</p>}</details>}
    <div className={styles.actions}>{!!draft.revision&&<button type="button" disabled={busy} onClick={()=>{if(confirmDiscardChanges()){reset();setError('')}}}>{en?'Cancel':'Cancelar'}</button>}<button type="submit" className={styles.primary} disabled={busy||stale||!!query.error||!draft.title.trim()||(!!draft.revision&&draft.title===baseline)}><Plus size={17}/>{busy?(en?'Saving…':'Guardando…'):draft.revision?(en?'Save changes':'Guardar cambios'):(en?'Add pending item':'Agregar pendiente')}</button></div>
   </form>}
   <p className={styles.caption}>{en?'Pending items appear under Reminders at the top of Quotes. Dismiss removes the reminder for your team; the event stays saved.':'Los pendientes aparecen en Recordatorios, arriba de Cotizaciones. Quitar retira el recordatorio para el equipo; el evento se conserva.'}</p>
   {!pending.length&&<p className={styles.caption}>{en?'No pending items for this event.':'Este evento no tiene pendientes.'}</p>}
   <ul className={styles.tasks}>{pending.map(task=><li key={task.id}><strong>{task.title}</strong><div className={styles.actions}>{canEdit?<><button type="button" disabled={busy} onClick={()=>edit(task)}>{en?'Edit':'Modificar'}</button><button type="button" disabled={busy||!!query.error} onClick={()=>closeTask(task)}>{en?'Dismiss':'Quitar'}</button></>:<small>{task.status==='waiting'?(en?'Waiting for customer':'Esperando al cliente'):(en?'Pending':'Pendiente')}</small>}</div></li>)}</ul>
   {!!closed.length&&<details className={styles.savedDetails}><summary>{en?'Dismissed and completed':'Quitados y resueltos'} ({closed.length})</summary><ul className={styles.tasks}>{closed.map(task=><li key={task.id}><strong>{task.title}</strong>{canEdit&&<button type="button" disabled={busy||!!query.error} onClick={()=>{if(confirmDiscardChanges())void write({...pendingDraft(task),status:'pending'},'restore')}}>{en?'Show again':'Volver a mostrar'}</button>}</li>)}</ul></details>}
  </>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
 </div>;
}
