'use client';
import {useId,useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {ContactLink} from './contact-link';
import {Modal} from './dashboard-ui';
import {customerWhatsAppLink,customerWhatsAppMessage,type CustomerWhatsAppMessage} from '@/lib/customer-whatsapp';
import s from './customer-phone.module.css';

type Props=CustomerWhatsAppMessage&{phone?:string|null};
function WhatsAppAction({phone,...context}:Props){
 const en=!!context.en,id=useId(),[open,setOpen]=useState(false),[number,setNumber]=useState(phone||'');
 const message=customerWhatsAppMessage(context),href=customerWhatsAppLink(phone,message);
 const corrected=customerWhatsAppLink(number,message);
 const label=en?`Open WhatsApp${context.name?' for '+context.name:''}`:`Abrir WhatsApp${context.name?' para '+context.name:''}`;
 const content=<><MessageCircle size={17} aria-hidden="true"/><span>WhatsApp</span></>;
 return <>
  {href?<ContactLink className={s.button} href={href} aria-label={label} title={en?'Review the message in WhatsApp before sending.':'Revise el mensaje en WhatsApp antes de enviarlo.'}>{content}</ContactLink>
   :<button className={s.button} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setNumber(phone||'');setOpen(true)}}>{content}</button>}
  {open&&<Modal title={en?'Contact via WhatsApp':'Contactar por WhatsApp'} close={()=>setOpen(false)}>
   <div className={s.dialog} translate="no">
    <p>{en?'Include the customer’s country code to open the right chat.':'Incluya el código de país del cliente para abrir el chat correcto.'}</p>
    <label htmlFor={id}>{en?'Phone with country code':'Teléfono con código de país'}</label>
    <input id={id} type="tel" inputMode="tel" autoComplete="off" dir="ltr" value={number} maxLength={40} placeholder="+502 5555 4444" aria-describedby={`${id}-hint`} onChange={e=>setNumber(e.target.value)}/>
    <small id={`${id}-hint`}>{en?'Examples: +502 Guatemala · +52 Mexico · +1 USA. This correction is used only to open this chat.':'Ejemplos: +502 Guatemala · +52 México · +1 EE. UU. Esta corrección se usa solo para abrir este chat.'}</small>
    <p className={s.preview}>{message}</p>
    <small>{en?'WhatsApp will open with the account signed in on this device. Review the message there and tap Send.':'Se abrirá la cuenta de WhatsApp de este dispositivo. Revise allí el mensaje y pulse Enviar.'}</small>
    <div className={s.actions}>{corrected?<ContactLink className={s.button} href={corrected}><MessageCircle size={18} aria-hidden="true"/>{en?'Open WhatsApp':'Abrir WhatsApp'}</ContactLink>:<button className={s.button} type="button" disabled>{en?'Open WhatsApp':'Abrir WhatsApp'}</button>}</div>
   </div>
  </Modal>}
 </>;
}

/** Shared by cards and mobile detail sheets; never nested inside a row's summary button. */
export function CustomerPhone(props:Props){
 const phone=props.phone?.trim();
 return <span className={s.phone} translate="no"><span className={s.number} dir="ltr">{phone||(props.en?'No phone':'Sin teléfono')}</span>
  {phone&&<WhatsAppAction key={JSON.stringify([phone,props.name,props.restaurantName,props.context,props.eventDate,props.en])} {...props}/>}</span>;
}
