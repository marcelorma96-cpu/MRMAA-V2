"use client";
import {useState,useRef,useEffect} from 'react';
import {supabase} from '@/lib/supabase';
import {eventLinkError} from '@/lib/event-linking';
import {saveWithFloorConfirmation} from '@/lib/floor-conflict-confirmation';
import {useFloorConflictConfirmation} from './floor-conflict-confirmation';
import {notifyFloorChange} from '@/lib/floor-sync';
import {formatAppMoney} from './app-preferences';
type Value=string|number|boolean|null|string[];
type Review={before:Record<string,Value>;after:Record<string,Value>;token:string;keeps_place:boolean;keeps_time:boolean;client_change:boolean};
const fields=[
 ['guests','Personas','Guests'],['area','Áreas','Areas'],['tables','Mesas','Tables'],['whole','Área completa','Entire area'],['minutes','Duración (min)','Duration (min)'],
 ['date','Fecha del evento','Event date'],['time','Hora','Time'],['client','Cliente','Customer'],['phone','Teléfono','Phone'],['menu','Menú','Menu'],
 ['subtotal','Subtotal','Subtotal'],['discount','Descuento','Discount'],['tip','Propina','Tip'],['total','Total','Total'],['deposit','Anticipo','Deposit'],['payment','Método de pago','Payment method'],['balance','Saldo','Balance'],['notes','Notas internas','Internal notes'],
 ['reservation_status','Estado de reserva','Reservation status'],['quote_status','Estado de cotización','Quote status'],['service','Estado de mesas','Table status']
];
export function EventLinkReview({restaurantId,reservationId,quoteId,en,onBusy,linked}:{restaurantId:string;reservationId:string;quoteId:string;en:boolean;onBusy:(value:boolean)=>void;linked:()=>void}){
 const [review,setReview]=useState<Review|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false),live=useRef(true),floor=useFloorConflictConfirmation(en);
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[]);
 const say=(es:string,eng:string)=>en?eng:es;
 const show=(key:string,v:Value)=>{
  if(v==null||v===''||(Array.isArray(v)&&!v.length))return '—';
  if(Array.isArray(v))return v.join(', ');
  if(typeof v==='boolean')return v?say('Sí','Yes'):say('No','No');
  if(['subtotal','total','deposit','balance'].includes(key))return formatAppMoney(Number(v));
  if(['discount','tip'].includes(key))return v+'%';
  if(key==='date'&&!en)return String(v).split('-').reverse().join('/');
  if(key==='time')return String(v).replace(/^(\d{2}:\d{2}):00$/, '$1');
  if(key==='service')return ({reserved:say('Reservado','Reserved'),seated:say('En mesa','Seated'),finished:say('Finalizado','Finished')} as Record<string,string>)[String(v)]??String(v);
  return String(v);
 };
 async function proceed(){
  if(locked.current)return;locked.current=true;setBusy(true);onBusy(true);setError('');
  const args={p_restaurant:restaurantId,p_reservation:reservationId,p_quote:quoteId};
  try{
   if(!review){const res=await supabase.rpc('v2_review_event_link',{...args,p_expected:null});
    if(res.error)throw res.error;if(!res.data?.token||!res.data?.before||!res.data?.after)throw Error('EVENT_LINK_READ');
    if(live.current)setReview(res.data);return;}
   const res=await saveWithFloorConfirmation((conflict,extra)=>supabase.rpc('v2_review_event_link',{...args,p_expected:review.token,p_allow_conflict:conflict,p_allow_extra_seats:extra}),floor.confirm);
   if(!res)return;if(res.error)throw res.error;if(!(res.data as {linked?:boolean})?.linked)throw Error('EVENT_LINK_READ');
   notifyFloorChange(restaurantId);if(live.current)linked();
  }catch(e){if(live.current){setError(eventLinkError(e,en));setReview(null);}}
  finally{locked.current=false;if(live.current){setBusy(false);onBusy(false);}}
 }
 const changes=review?fields.filter(([f])=>JSON.stringify(review.before[f])!==JSON.stringify(review.after[f])):[];
 return <section className="formStack" aria-busy={busy} translate="no">
 {review&&<div className="moduleNotice" role="region" aria-label={say('Revisión del vínculo','Link review')}>
 <strong>{say('Revisa antes de vincular','Review before linking')}</strong>
 <p>{say('La reserva conservará su número. Solo se aplicarán los cambios cuando confirmes.','The reservation keeps its ID. Changes apply only when you confirm.')}</p>
 {review.keeps_place&&<p>{say('La cotización no indica ubicación; se conservarán las áreas y mesas de la reserva.','The quote has no location; the reservation keeps its areas and tables.')}</p>}
 {review.keeps_time&&<p>{say('La cotización no indica hora; se conservará la hora de la reserva.','The quote has no time; the reservation time will be kept.')}</p>}
 {review.client_change&&<p>{say('La ficha de cliente se determinará con los datos de la cotización y puede cambiar aunque el nombre coincida.','The customer record will follow the quote and may change even if the name matches.')}</p>}
 {changes.length?<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',overflowWrap:'anywhere'}}><thead><tr><th>{say('Dato','Field')}</th><th>{say('Actual','Current')}</th><th>{say('Al vincular','After linking')}</th></tr></thead><tbody>
 {changes.map(([k,es,eng])=><tr key={k}><th scope="row">{say(es,eng)}</th><td>{show(k,review.before[k])}</td><td>{show(k,review.after[k])}</td></tr>)}</tbody></table></div>:<p>{say('No hay otras diferencias en los datos mostrados.','There are no other differences in the displayed details.')}</p>}
 </div>}
 {error&&<p role="alert" className="moduleError">{error}</p>}
 <div className="rowActions">{review&&<button type="button" disabled={busy} onClick={()=>setReview(null)}>{say('Volver','Back')}</button>}
 <button type="button" className="primary" disabled={busy} onClick={()=>void proceed()}>{busy?say('Un momento…','Please wait…'):review?say('Confirmar vínculo','Confirm link'):say('Revisar vínculo','Review link')}</button></div>{floor.dialog}
 </section>
}
