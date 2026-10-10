import {formatEventTime} from './local-date';
export type EventTarget = {kind:'quote'|'reservation'; id:string};
export type EventTask = {id:string; quote_id:string|null; reservation_id:string|null; category:string; title:string; status:'pending'|'waiting'|'done'|'not_needed'; assignee:string; due_date:string|null; notes:string; revision:number; updated_at:string};
export type EventInfo = EventTarget & {quote_number?:number;client_name:string;phone:string|null;event_date:string;event_time:string|null;area:string;guests:number|null;status:string};
export type EventFollowup = {event:EventInfo;quote_id:string|null;reservation_ids:string[];tasks:EventTask[]};
export type EventInbox = {total:number;rows:(Pick<EventTask,'id'|'title'|'status'|'assignee'|'due_date'> & {updated_at?:string;kind:EventTarget['kind'];event_id:string;client_name:string;event_date:string;event_time:string|null})[]};
export const EVENT_FOLLOWUP_OPEN='unomesa:event-followup-open';
export const EVENT_FOLLOWUP_CHANGED='unomesa:event-followup-changed';
export function openEventFollowup(restaurantId:string,target:EventTarget|null,taskId?:string){
  window.dispatchEvent(new CustomEvent(EVENT_FOLLOWUP_OPEN,{detail:{restaurantId,target,taskId}}));
}
export function notifyEventFollowup(restaurantId:string){
  window.dispatchEvent(new CustomEvent(EVENT_FOLLOWUP_CHANGED,{detail:{restaurantId}}));
  try {const channel=new BroadcastChannel('unomesa-event-followup');channel.postMessage({restaurantId});channel.close();} catch {/* Focus/visible polling also refreshes browsers without BroadcastChannel. */}
}
export function eventFollowupError(error:unknown,en:boolean){
  const e=error as {message?:string;code?:string};const message=e?.message||'';
  if(message.includes('v2_event_inbox_current')&&(e?.code==='PGRST202'||e?.code==='42883'))return en?'Install SQL 50 to enable automatic removal of past-event reminders.':'Instale SQL 50 para habilitar el retiro automático de recordatorios de eventos pasados.';
  if(e?.code==='PGRST202'||(e?.code==='42883'&&message.includes('v2_event_')))return en?'Pending items is not available yet. Ask your administrator to enable its database service.':'Pendientes aún no está disponible. Solicite al administrador habilitar su servicio en la base de datos.';
  if(message.includes('EVENT_STALE'))return en?'Someone updated this step. Your draft is preserved. Review the latest version before saving.':'Otra persona actualizó este paso. Su borrador se conserva; revise la versión más reciente antes de guardar.';
  if(message.includes('EVENT_READ_ONLY'))return en?'Your account currently has read-only access.':'Su cuenta tiene acceso de solo lectura en este momento.';
  if(message.includes('EVENT_ACCESS'))return en?'You do not have permission for this action. Check your session and role.':'No tiene permiso para esta acción. Revise su sesión y rol.';
  if(message.includes('EVENT_NOT_FOUND'))return en?'This event is no longer available here. It may have been unlinked or moved to trash.':'Este evento ya no está disponible aquí. Puede haberse desvinculado o enviado a la papelera.';
  if(message.includes('EVENT_LIMIT'))return en?'This event has reached the 200-step limit. Review its existing steps.':'Este evento alcanzó el límite de 200 pasos. Revise los pasos existentes.';
  if(message.includes('EVENT_INPUT')||e?.code==='22007'||e?.code==='22008')return en?'Check the title, date and field lengths.':'Revise el título, la fecha y la longitud de los campos.';
  return en?'Could not connect. Your draft is preserved; check your connection and retry.':'No se pudo conectar. Su borrador se conserva; revise la conexión y reintente.';
}
/** Never guesses a country, reads internal notes, or marks a message as sent. */
export function eventWhatsAppUrl(phone:string,message:string){
  const normalized=phone.trim().replace(/[\s().-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(normalized)||!message.trim())return null;
  return `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message.trim())}`;
}
export function eventCustomerMessage(event:EventInfo,restaurant:string,area:string,en:boolean,timeFormat:unknown){
  const date=event.event_date?.split('-').reverse().join('/')||'—';
  const label=event.kind==='quote'?(en?'Quote':'Cotización'):(en?'Reservation':'Reservación');
  return [en?`Hello ${event.client_name}, here are the event details from ${restaurant}:`:`Hola ${event.client_name}, le compartimos los datos del evento en ${restaurant}:`,
    `${label}${event.quote_number?` #${event.quote_number}`:''}`,
    `${en?'Date':'Fecha'}: ${date} · ${formatEventTime(event.event_time,timeFormat)}`,
    `${en?'Guests':'Personas'}: ${event.guests??'—'}`,
    `${en?'Space':'Espacio'}: ${area||(en?'To be arranged':'Por definir')}`,
    '',en?'Please let us know if you have any questions.':'Quedamos atentos a sus comentarios.'].join('\n');
}
