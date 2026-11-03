'use client';
import {useId,type Ref} from 'react';
import {ContactLink} from './contact-link';
import {customerWhatsAppNumber} from '@/lib/customer-whatsapp';

export function WhatsAppSettings({phone,country,en,onChange,inputRef}:{phone:string;country?:string;en:boolean;onChange:(value:string)=>void;inputRef?:Ref<HTMLInputElement>}){
 const id=useId(),number=customerWhatsAppNumber(phone,country);
 return <div className="formStack" translate="no">
  <label htmlFor={id}>{en?'Restaurant WhatsApp number':'Número de WhatsApp del restaurante'}</label>
  <input ref={inputRef} id={id} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={40} value={phone} onChange={e=>onChange(e.target.value)} placeholder="+502 5555 4444" aria-describedby={`${id}-help`} aria-invalid={!!phone.trim()&&!number}/>
  <small id={`${id}-help`}>{en?'Local numbers use the restaurant’s country code. Save changes to keep this number.':'Los números locales usan el código del país del restaurante. Pulse Guardar cambios para conservar este número.'}{number&&<> {en?'Full number':'Número completo'}: +{number}.</>}</small>
  {phone.trim()&&!number&&<small role="alert">{en?'Check the number and country code.':'Revise el número y el código de país.'}</small>}
  <p>{en?'This number identifies the account your team should use. Messages are sent from the WhatsApp account open on each device; saving a number does not sign in or change that account.':'Este número identifica la cuenta que debe usar su equipo. Los mensajes salen de la cuenta de WhatsApp abierta en cada dispositivo; guardar el número no inicia sesión ni cambia esa cuenta.'}</p>
  <div><ContactLink className="secondary" href="https://web.whatsapp.com/">{en?'Link or open WhatsApp Web':'Vincular o abrir WhatsApp Web'}</ContactLink></div>
  <small>{en?'If asked, link the restaurant’s account using the QR code or phone-number option in WhatsApp Web.':'Si se lo solicita, vincule la cuenta del restaurante con el QR o la opción de número de teléfono de WhatsApp Web.'}</small>
 </div>;
}
