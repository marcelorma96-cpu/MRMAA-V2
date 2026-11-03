'use client';
import {useState} from 'react';
import {ContactLink} from './contact-link';
import {useCustomerContactSetup} from './customer-contact-country';
import {WhatsAppAccountCheck,type AccountChoice} from './whatsapp-account-check';
import {WhatsAppWebButton} from './whatsapp-web-button';
import {customerWhatsAppLink,customerWhatsAppWebLink,customerWhatsAppNumber} from '@/lib/customer-whatsapp';
import s from './customer-phone.module.css';

type Props={phone?:string|null;message:string;country?:string;en?:boolean};
/** Explicit choices only: no session probing, timed redirects or automatic sends. */
export function WhatsAppOpenOptions(props:Props){
 const setup=useCustomerContactSetup();
 return <Options key={JSON.stringify([setup.number,props.phone,props.country])} {...props} number={setup.number} onConfigure={setup.onConfigure}/>;
}
function Options({phone,message,country,en=false,number,onConfigure}:Props&{number?:string;onConfigure?:()=>void}){
 const [channel,setChannel]=useState<'web'|'app'>('web'),[account,setAccount]=useState<AccountChoice>(''),[alreadyOpen,setAlreadyOpen]=useState(false),[copied,setCopied]=useState('');
 const web=customerWhatsAppWebLink(phone,message,country),app=customerWhatsAppLink(phone,message,country),allowed=!!number&&account==='confirmed';
 async function copy(value:string){try{await navigator.clipboard.writeText(value);setCopied(en?'Copied. Switch to your WhatsApp tab and paste.':'Copiado. Cambie a su pestaña de WhatsApp y péguelo.')}catch{setCopied(en?'Could not copy. Select the number or message above and copy it.':'No se pudo copiar. Seleccione el número o mensaje de arriba y cópielo.')}}
 return <div className={s.openOptions} translate="no">
  <label>{en?'Where do you want to open it?':'¿Dónde desea abrirlo?'}<select value={channel} onChange={e=>{setChannel(e.target.value as 'web'|'app');setAccount('');setCopied('')}}><option value="web">WhatsApp Web</option><option value="app">{en?'WhatsApp app':'Aplicación WhatsApp'}</option></select></label>
  <WhatsAppAccountCheck number={number} value={account} onChange={setAccount} onConfigure={onConfigure} en={en} channel={channel==='web'?'WhatsApp Web':(en?'the WhatsApp app':'la aplicación WhatsApp')}/>
  {channel==='web'&&<label className={s.checkLabel}><input type="checkbox" checked={alreadyOpen} onChange={e=>setAlreadyOpen(e.target.checked)}/><span>{en?'I already have WhatsApp Web open outside UnoMesa':'Ya tengo WhatsApp Web abierto fuera de UnoMesa'}</span></label>}
  {channel==='web'&&alreadyOpen?<p>{en?'Switch to that tab and use the customer’s number and message. UnoMesa cannot control tabs opened outside this page.':'Cambie a esa pestaña y use el número y mensaje del cliente. UnoMesa no puede controlar pestañas abiertas fuera de esta página.'}</p>:channel==='web'?<WhatsAppWebButton href={web||'https://web.whatsapp.com/'} disabled={!web||!allowed} en={en}/>:allowed&&app?<ContactLink className={s.button} href={app}>{en?'Open app':'Abrir aplicación'}</ContactLink>:<button type="button" className={s.button} disabled>{en?'Open app':'Abrir aplicación'}</button>}
  {channel==='web'&&<div className={s.actions}><button className={s.appAlternative} type="button" disabled={!web||!allowed} onClick={()=>void copy('+'+customerWhatsAppNumber(phone,country))}>{en?'Copy customer number':'Copiar número del cliente'}</button><button className={s.appAlternative} type="button" disabled={!web||!allowed} onClick={()=>void copy(message)}>{en?'Copy message':'Copiar mensaje'}</button></div>}
  {copied&&<small role="status">{copied}</small>}
  <small>{en?'If Web does not open, select the WhatsApp app above. Review the account and recipient before sending. Opening a chat does not attach a PDF.':'Si Web no abre, seleccione la aplicación WhatsApp arriba. Revise la cuenta y el destinatario antes de enviar. Abrir el chat no adjunta un PDF.'}</small>
 </div>;
}
