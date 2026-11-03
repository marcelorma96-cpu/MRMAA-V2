'use client';
import {useState} from 'react';
import {openWhatsAppWeb,type WhatsAppWindowResult} from '@/lib/whatsapp-window';
import s from './customer-phone.module.css';
export function WhatsAppWebButton({href,en=false,disabled=false,linkAccount=false}:{href:string;en?:boolean;disabled?:boolean;linkAccount?:boolean}){
 const [result,setResult]=useState<WhatsAppWindowResult>();
 return <div className={s.openOptions}>
  <button type="button" className={s.button} disabled={disabled} onClick={()=>setResult(openWhatsAppWeb(href))}>{linkAccount?(en?'Link restaurant account in WhatsApp Web':'Vincular cuenta del restaurante en WhatsApp Web'):(en?'Open WhatsApp Web':'Abrir WhatsApp Web')}</button>
  {(result==='unavailable'||result==='blocked')&&<div className={s.notice} role="status">
   <p>{result==='unavailable'?(en?'WhatsApp Web was already opened from UnoMesa, but this browser cannot reuse that tab. Switch to it. Open another only if you need one.':'Ya se abrió WhatsApp Web desde UnoMesa, pero el navegador no permite reutilizar esa pestaña. Cambie a ella. Abra otra solo si la necesita.'):(en?'The browser blocked the window. Allow popups for UnoMesa or choose the WhatsApp app.':'El navegador bloqueó la ventana. Permita las ventanas emergentes de UnoMesa o elija la aplicación WhatsApp.')}</p>
   <button type="button" className={s.appAlternative} disabled={disabled} onClick={()=>setResult(openWhatsAppWeb(href,true))}>{result==='unavailable'?(en?'Open another window':'Abrir otra ventana'):(en?'Try opening again':'Reintentar apertura')}</button>
  </div>}
 </div>;
}
