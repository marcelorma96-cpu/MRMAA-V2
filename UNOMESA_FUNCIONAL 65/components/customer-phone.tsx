'use client';
import {useId,useState} from 'react';
import {parsePhoneNumberFromString} from 'libphonenumber-js/min';
import {Modal} from './dashboard-ui';
import {useCustomerContactCountry,useCustomerContactSetup} from './customer-contact-country';
import {WhatsAppOpenOptions} from './whatsapp-open-options';
import {customerWhatsAppMessage,customerWhatsAppNumber,type CustomerWhatsAppMessage} from '@/lib/customer-whatsapp';
import s from './customer-phone.module.css';

type Props=CustomerWhatsAppMessage&{phone?:string|null};
function WhatsAppAction({phone,defaultCountry,...context}:Props&{defaultCountry?:string}){
 const {configured,onConfigure}=useCustomerContactSetup();
 const en=!!context.en,id=useId(),[open,setOpen]=useState(false),[number,setNumber]=useState(phone||'');
 const message=customerWhatsAppMessage(context);
 const label=en?`Contact via WhatsApp${context.name?' for '+context.name:''}`:`Contactar por WhatsApp${context.name?' para '+context.name:''}`;
 const content=<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.16 1.6 5.98L0 24l6.2-1.63a11.94 11.94 0 0 0 5.85 1.49h.01C18.64 23.86 24 18.5 24 11.91a11.87 11.87 0 0 0-3.48-8.43ZM12.06 21.85a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.68.96.98-3.59-.23-.37a9.93 9.93 0 1 1 8.34 4.59Zm5.44-7.43c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.58-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/></svg>;
 const iconClass=`${s.button} ${s.iconButton}`;
 const title=`${label} · +${customerWhatsAppNumber(phone,defaultCountry)||phone}`;
 const setupLabel=en?'Set up restaurant WhatsApp':'Configurar WhatsApp del restaurante';
 return <>
  <button className={iconClass} type="button" aria-label={!configured?setupLabel:label} title={!configured?setupLabel:title} aria-haspopup={!configured&&onConfigure?undefined:'dialog'} aria-expanded={open} onClick={()=>{if(!configured&&onConfigure){onConfigure();return;}setNumber(phone||'');setOpen(true)}}>{content}</button>
  {open&&<Modal title={en?'Contact via WhatsApp':'Contactar por WhatsApp'} close={()=>setOpen(false)}>
   <div className={s.dialog} translate="no">
    <p>{en?'Check the customer’s full number before opening the chat.':'Revise el número completo del cliente antes de abrir el chat.'}</p>
    <label htmlFor={id}>{en?'Phone with country code':'Teléfono con código de país'}</label>
    <input id={id} type="tel" inputMode="tel" autoComplete="off" dir="ltr" value={number} maxLength={40} placeholder="+502 5555 4444" aria-describedby={`${id}-hint`} onChange={e=>setNumber(e.target.value)}/>
    <small id={`${id}-hint`}>{en?'Examples: +502 Guatemala · +52 Mexico · +1 USA. This correction is used only to open this chat.':'Ejemplos: +502 Guatemala · +52 México · +1 EE. UU. Esta corrección se usa solo para abrir este chat.'}</small>
    <p className={s.preview}>{message}</p>
    <WhatsAppOpenOptions phone={number} message={message} country={defaultCountry} en={en}/>
   </div>
  </Modal>}
 </>;
}

/** Shared by cards and mobile detail sheets; never nested inside a row's summary button. */
export function CustomerPhone(props:Props){
 const phone=props.phone?.trim();
 const defaultCountry=useCustomerContactCountry(),number=customerWhatsAppNumber(phone,defaultCountry);
 const displayPhone=number&&number!==customerWhatsAppNumber(phone)?parsePhoneNumberFromString(`+${number}`)?.formatInternational():phone;
 return <span className={s.phone} translate="no"><span className={s.number} dir="ltr">{displayPhone||(props.en?'No phone':'Sin teléfono')}</span>
  {phone&&<WhatsAppAction key={JSON.stringify([phone,defaultCountry,props.name,props.restaurantName,props.context,props.eventDate,props.en])} {...props} defaultCountry={defaultCountry}/>}</span>;
}
