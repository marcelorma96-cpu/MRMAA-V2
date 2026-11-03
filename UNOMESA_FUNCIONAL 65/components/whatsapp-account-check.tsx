'use client';
import {WhatsAppWebButton} from './whatsapp-web-button';
import s from './customer-phone.module.css';
export type AccountChoice=''|'confirmed'|'mismatch';
export function WhatsAppAccountCheck({number,value,onChange,onConfigure,en=false,channel}:{number?:string;value:AccountChoice;onChange:(value:AccountChoice)=>void;onConfigure?:()=>void;en?:boolean;channel:string}){
 if(!number)return <div className={s.notice} role="status">
  <p>{en?'Save the restaurant’s WhatsApp number in Settings → General → WhatsApp first.':'Primero guarde el WhatsApp del restaurante en Configuración → General → WhatsApp.'}</p>
  {onConfigure?<button type="button" className={s.appAlternative} onClick={onConfigure}>{en?'Go to Settings':'Ir a Configuración'}</button>:<small>{en?'Ask your administrator to set it up.':'Solicite la configuración a su administrador.'}</small>}
 </div>;
 return <div className={s.accountCheck}>
  <label className={s.checkLabel}><input type="checkbox" checked={value==='confirmed'} onChange={e=>onChange(e.target.checked?'confirmed':'')}/><span>{en?'I confirm I will use':'Confirmo que usaré'} <strong dir="ltr">+{number}</strong> {en?'in':'en'} {channel}.</span></label>
  <button type="button" className={s.appAlternative} onClick={()=>onChange('mismatch')}>{en?'Another number or no access':'Otro número o sin acceso'}</button>
  <small>{en?'Manual check: UnoMesa cannot read the account signed in to WhatsApp.':'Verificación manual: UnoMesa no puede consultar la cuenta abierta en WhatsApp.'}</small>
  {value==='mismatch'&&<div className={s.notice} role="alert">
   <strong>{en?'Device not connected to the configured number':'Dispositivo no conectado al número configurado'}</strong>
   <p>{en?`You indicated another account or no access to +${number}. Link that account, then return and confirm it above.`:`Indicó que usa otra cuenta o no tiene acceso a +${number}. Vincule esa cuenta y después regrese para confirmarla arriba.`}</p>
   <WhatsAppWebButton href="https://web.whatsapp.com/" en={en} linkAccount/>
   {onConfigure&&<button type="button" className={s.appAlternative} onClick={onConfigure}>{en?'Review configured number':'Revisar número configurado'}</button>}
  </div>}
 </div>;
}
