'use client';
import styles from './branches.module.css';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';
import {branchPrice} from '@/lib/branches';
import {useAppPreferences,confirmApp} from './app-preferences';
import {reserveBillingWindow,openBilling} from '@/lib/billing-navigation';
export function BranchPackage({account,restaurantId,refresh}:{account:any;restaurantId:string;refresh:()=>Promise<any>}){
 const {language}=useAppPreferences(),en=language==='en';const [count,setCount]=useState(String(Math.max(2,account.branch_capacity||1))),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[link,setLink]=useState('');
 if(!account.is_owner||account.trial_exempt)return null;
 const n=Number(count),valid=Number.isSafeInteger(n)&&n>=1&&n<=10000,active=account.subscription_status==='active'&&!!account.billing_current_period_end;
 const total=valid?new Intl.NumberFormat(en?'en-US':'es-GT',{style:'currency',currency:'USD'}).format(branchPrice(n)/100):'—';
 async function submit(){if(!valid||busy)return;
  if(!confirmApp(en?`Advanced for ${n} locations: ${total}/month before taxes. Changes can include prorated charges now. Continue?`:`Advanced para ${n} sucursales: ${total}/mes antes de impuestos. El cambio puede incluir un cobro proporcional ahora. ¿Continuar?`))return;
  const reserved=!active?reserveBillingWindow(en):null;setBusy(true);setMessage('');
  try{const s=await supabase.auth.getSession();const r=await fetch(active?'/api/billing/branches':'/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.data.session?.access_token}`},body:JSON.stringify({restaurant_id:restaurantId,plan:'advanced',interval:'month',branches:n,expected_capacity:account.branch_capacity||1,confirmed:true,language})});const b=await r.json();if(!r.ok)throw new Error(b.error);
   if(b.url){const opened=await openBilling(b.url,reserved);if(opened==='blocked')setLink(b.url);}else{reserved?.close();setMessage(en?'Change requested. Refresh status to verify the payment and available locations.':'Cambio solicitado. Actualice el estado para verificar el pago y las sucursales disponibles.');}
   await refresh();
  }catch(e){reserved?.close();setMessage(e instanceof Error?e.message:'No se pudo completar el cambio.');}finally{setBusy(false);}
 }
 return <section className={`moduleCard ${styles.body}`} style={{padding:20,marginTop:20,borderRadius:20}}>
  <h3>{en?'Advanced · Multiple locations':'Advanced · Multisucursal'}</h3>
  <p>{en?'One principal account. Independent data and up to 15 users per location.':'Una cuenta principal. Datos independientes y hasta 15 usuarios por sucursal.'}</p>
  <label>{en?'Total locations, including the principal location':'Total de sucursales, incluida la principal'}<input type="number" min={1} max={10000} step={1} value={count} onChange={e=>setCount(e.target.value)} style={{maxWidth:160,display:'block'}}/></label>
  <p><strong>{total} / {en?'month':'mes'}</strong> · {en?'1 location: $55. From 2: $45 each.':'1 sucursal: $55. Desde 2: $45 cada una.'}</p>
  {active&&(account.plan_code!=='advanced'||account.billing_cycle!=='month')&&<p>{en?'Select Advanced monthly below first, then increase your location package here.':'Primero seleccione Advanced mensual abajo y luego amplíe aquí el paquete.'}</p>}
  <button className="primary" disabled={!valid||busy||(active&&(account.plan_code!=='advanced'||account.billing_cycle!=='month'||n===(account.branch_capacity||1)))} onClick={()=>void submit()}>{busy?(en?'Processing…':'Procesando…'):active?(en?'Confirm package change':'Confirmar cambio de paquete'):(en?'Subscribe to this package':'Contratar este paquete')}</button>
  {message&&<p role="status">{message}</p>}{link&&<a href={link} target="_blank" rel="noopener noreferrer">{en?"Open secure billing":"Abrir pago seguro"}</a>}
  <p style={{fontSize:12}}>{en?'Archive unused locations before reducing the package. Records are retained. Your trial does not restart.':'Archive las sucursales que ya no utilice antes de reducir el paquete. Sus registros se conservan y la prueba no se reinicia.'}</p>
 </section>;
}
