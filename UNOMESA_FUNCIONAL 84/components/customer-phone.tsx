'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Check,Copy} from 'lucide-react';
import {parsePhoneNumberFromString} from 'libphonenumber-js/min';
import {useCustomerContactCountry} from './customer-contact-country';
import {customerPhoneNumber} from '@/lib/customer-phone';
import {copyText} from '@/lib/clipboard';
import s from './customer-phone.module.css';

type Props={phone?:string|null;name?:string|null;en?:boolean};
function CopyPhone({value,name,en=false}:{value:string;name?:string|null;en?:boolean}){
 const [state,setState]=useState<'idle'|'copying'|'copied'|'error'>('idle');
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),alive=useRef(true),busy=useRef(false),id=useId();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current)}},[]);
 const label=(en?'Copy number':'Copiar número')+(name?(en?' for ':' de ')+name:'');
 const notice=state==='copied'?(en?'Number copied':'Número copiado'):state==='error'?(en?'Select the number and copy it manually.':'Seleccione el número y cópielo manualmente.'):'';
 async function copy(){
  if(busy.current)return;busy.current=true;clearTimeout(timer.current);setState('copying');
  try{
   const copied=await copyText(value);
   if(!alive.current)return;
   setState(copied?'copied':'error');
   if(copied)timer.current=setTimeout(()=>setState('idle'),2200);
  }catch{if(alive.current)setState('error');}
  finally{busy.current=false;}
 }
 return <span className={s.action} onClick={e=>e.stopPropagation()}>
  <button className={s.copyButton} type="button" aria-label={label} title={state==='copied'?notice:label} aria-describedby={notice?id:undefined} disabled={state==='copying'} onClick={()=>void copy()}>
   {state==='copied'?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}
  </button>
  <span id={id} role="status" aria-live="polite" className={s.status}>{notice}</span>
  {state==='error'&&<span className={s.fallback}>
   <span>{notice}</span>
   <input aria-label={en?'Number to copy':'Número para copiar'} type="text" inputMode="tel" readOnly value={value} dir="ltr" autoFocus onFocus={e=>e.currentTarget.select()}/>
  </span>}
 </span>;
}

/** Copy actions belong outside clickable row summaries and are omitted from print/PDF. */
export function CustomerPhone({phone:raw,name,en=false}:Props){
 const phone=raw?.trim()||'',country=useCustomerContactCountry(),number=customerPhoneNumber(phone,country);
 const value=number?'+'+number:phone;
 const display=number?parsePhoneNumberFromString('+'+number)?.formatInternational()||value:phone;
 return <span className={s.phone} translate="no"><span className={s.number} dir="ltr">{display||(en?'No phone':'Sin teléfono')}</span>
  {phone&&<CopyPhone key={JSON.stringify([value,name,en])} value={value} name={name} en={en}/>}</span>;
}
