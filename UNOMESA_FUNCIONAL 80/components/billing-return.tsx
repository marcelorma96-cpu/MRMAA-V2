'use client';
import {useEffect,useState} from 'react';
import {BILLING_RETURN_CHANNEL} from '@/lib/billing-navigation';
import styles from './billing-return.module.css';

export function BillingReturn(){
 const [en,setEn]=useState(false),[ios,setIos]=useState(false);
 useEffect(()=>{
  const lang=new URLSearchParams(location.search).get('lang');
  setEn(lang==='en'||(!lang&&navigator.language.startsWith('en')));
  setIos(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  // Same-origin notification carries no identity, payment status or credentials.
  try {const channel=new BroadcastChannel(BILLING_RETURN_CHANNEL);channel.postMessage('refresh');channel.close()}catch{}
 },[]);
 function returnWeb(){
  window.close();
  // Manual fallback when a browser does not let this tab close. Original tab is
  // still available and retains its own sessionStorage session.
  setTimeout(()=>location.assign('/login?billing=return'),200);
 }
 return <main className={styles.page}><section className={styles.card}>
  <img src="/mobile-app-icon.png" width="76" height="76" alt="UnoMesa"/>
  <p className={styles.eyebrow}>UNOMESA</p>
  <h1>{en?'Return to your restaurant':'Regrese a su restaurante'}</h1>
  <p>{en?'You can return to UnoMesa. Your subscription status will update after payment confirmation is received.':'Ya puede volver a UnoMesa. El estado de su suscripción se actualizará cuando recibamos la confirmación del pago.'}</p>
  {ios&&<a className={styles.primary} href="com.unomesa.app://billing/return" onClick={e=>{e.currentTarget.href='com.unomesa.app://billing/return?request='+crypto.randomUUID()}}>{en?'Return to the UnoMesa app':'Volver a la app UnoMesa'}</a>}
  <button className={ios?styles.secondary:styles.primary} type="button" onClick={returnWeb}>{en?'Return to UnoMesa on the web':'Volver a UnoMesa web'}</button>
  <small>{en?'You can also close this tab. On iPhone or iPad, tap Done to return to the app. If a charge already appears, do not pay again while confirmation is pending.':'También puede cerrar esta pestaña. En iPhone o iPad, pulse Listo para regresar a la app. Si ya aparece el cobro, no pague otra vez mientras se confirma.'}</small>
 </section></main>;
}
