import {whatsappNumber} from './public-contact';

export type CustomerWhatsAppContext = 'customer' | 'reservation' | 'quote' | 'request';
export type CustomerWhatsAppMessage = {name?:string|null;restaurantName?:string;context?:CustomerWhatsAppContext;eventDate?:string|null;en?:boolean};

/** Do not infer a customer's country from the employee's device or the restaurant. */
export function customerWhatsAppNumber(value?:string|null):string {
 const raw=(value||'').trim();
 if(!raw||raw.length>254)return '';
 const explicit=/^(?:\+|00|(?:https:\/\/)?(?:wa\.me|api\.whatsapp\.com)\/)/i.test(raw);
 const compact=raw.replace(/[\s().\-\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'');
 // Legacy records often store the full country code without '+'. Short local numbers
 // remain ambiguous, even if a different country's numbering plan could accept them.
 if(!explicit&&!/^[1-9]\d{10,14}$/.test(compact))return '';
 return whatsappNumber(raw);
}

function oneLine(value:string|undefined|null){return (value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120)}
function eventDateLabel(value:string|undefined|null,en:boolean){
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
 const date=new Date(`${value}T12:00:00Z`);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return '';
 return new Intl.DateTimeFormat(en?'en-US':'es-GT',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(date);
}

/** Neutral wording works for pending, confirmed and cancelled events. It never confirms a booking. */
export function customerWhatsAppMessage({name,restaurantName,context='customer',eventDate,en=false}:CustomerWhatsAppMessage):string {
 const customer=oneLine(name),restaurant=oneLine(restaurantName),date=eventDateLabel(eventDate,en);
 if(en){
  const greeting=`Hello${customer?' '+customer:''}, we're contacting you from ${restaurant||'the restaurant'}`;
  const topic=context==='reservation'?'your reservation':context==='quote'?'your quote':context==='request'?'your event request':'';
  return `${greeting}${topic?' about '+topic:''}${topic&&date?' for '+date:''}.`;
 }
 const greeting=`Hola${customer?' '+customer:''}, le escribimos de ${restaurant||'nuestro restaurante'}`;
 const topic=context==='reservation'?'su reservación':context==='quote'?'su cotización':context==='request'?'su solicitud de evento':'';
 return `${greeting}${topic?' sobre '+topic:''}${topic&&date?' para el '+date:''}.`;
}

export function customerWhatsAppLink(phone:string|undefined|null,message:string):string {
 const number=customerWhatsAppNumber(phone);
 return number?`https://wa.me/${number}?text=${encodeURIComponent(message)}`:'';
}
