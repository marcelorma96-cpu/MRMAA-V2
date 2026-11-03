'use client';
import {ContactLink} from './contact-link';
import {customerWhatsAppLink,customerWhatsAppWebLink} from '@/lib/customer-whatsapp';
import s from './customer-phone.module.css';

/** No timed redirects: Web login and installed apps cannot be probed across origins. */
export function WhatsAppOpenOptions({phone,message,country,en=false}:{phone?:string|null;message:string;country?:string;en?:boolean}){
 const web=customerWhatsAppWebLink(phone,message,country),app=customerWhatsAppLink(phone,message,country);
 return <div className={s.openOptions} translate="no">
  <div className={s.actions}>
   {web?<ContactLink className={s.button} href={web}>{en?'Open WhatsApp Web':'Abrir WhatsApp Web'}</ContactLink>:<button className={s.button} type="button" disabled>{en?'Open WhatsApp Web':'Abrir WhatsApp Web'}</button>}
   {app&&<ContactLink className={s.appAlternative} href={app}>{en?'Open app':'Abrir aplicación'}</ContactLink>}
  </div>
  <small>{en?'If WhatsApp Web does not open, choose Open app. Use the restaurant’s account and review the message before sending.':'Si WhatsApp Web no se abre, elija Abrir aplicación. Use la cuenta del restaurante y revise el mensaje antes de enviarlo.'}</small>
 </div>;
}
