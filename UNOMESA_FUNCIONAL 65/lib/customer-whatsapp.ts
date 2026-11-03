import {whatsappNumber} from './public-contact';
import {getCountries,parsePhoneNumberFromString,type CountryCode} from 'libphonenumber-js/min';
import countriesEs from 'react-phone-number-input/locale/es.json';
import countriesEn from 'react-phone-number-input/locale/en.json';

export type CustomerWhatsAppContext = 'customer' | 'reservation' | 'quote' | 'request';
export type CustomerWhatsAppMessage = {name?:string|null;restaurantName?:string;context?:CustomerWhatsAppContext;eventDate?:string|null;en?:boolean};

const countryKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const countryNames=new Map<string,CountryCode>();
for(const code of getCountries()){
 for(const label of [code,countriesEs[code],countriesEn[code]])countryNames.set(countryKey(label),code);
}
for(const [label,code] of [['USA','US'],['EEUU','US'],['United States of America','US'],['Estados Unidos de América','US'],['UK','GB']] as const)countryNames.set(countryKey(label),code);

/** The restaurant's saved country wins; the already-detected visitor country is a fallback. */
export function customerWhatsAppCountry(restaurantCountry?:string|null,detectedCountry?:string|null):CountryCode|undefined {
 return countryNames.get(countryKey(restaurantCountry||''))||countryNames.get(countryKey(detectedCountry||''));
}

/** Complete local numbers using the current restaurant country. Explicit international destinations win. */
export function customerWhatsAppNumber(value?:string|null,defaultCountry?:string|null):string {
 const raw=(value||'').trim();
 if(!raw||raw.length>254)return '';
 const explicit=/^(?:\+|00|(?:https:\/\/)?(?:wa\.me|api\.whatsapp\.com)\/)/i.test(raw);
 const compact=raw.replace(/[\s().\-\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'');
 if(explicit)return whatsappNumber(raw);
 if(!/^\d{7,15}$/.test(compact))return '';
 const country=customerWhatsAppCountry(defaultCountry);
 if(country){
  const local=parsePhoneNumberFromString(compact,{defaultCountry:country,extract:false});
  if(local?.isPossible()&&!local.ext)return local.number.slice(1);
 }
 // Keep legacy full international numbers when they cannot be parsed as local.
 // Without a known country, short numbers still require manual clarification.
 return /^[1-9]\d{10,14}$/.test(compact)?whatsappNumber(raw):'';
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

export function customerWhatsAppLink(phone:string|undefined|null,message:string,defaultCountry?:string|null):string {
 const number=customerWhatsAppNumber(phone,defaultCountry);
 return number?`https://wa.me/${number}?text=${encodeURIComponent(message)}`:'';
}

/** Explicit Web destination; the ordinary click-to-chat link remains the app alternative. */
export function customerWhatsAppWebLink(phone:string|undefined|null,message:string,defaultCountry?:string|null):string {
 const number=customerWhatsAppNumber(phone,defaultCountry);
 return number?`https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`:'';
}
