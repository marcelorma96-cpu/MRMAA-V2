// Navigation hints only: only signed, verified webhooks can activate paid access.
export const BILLING_RETURN_EVENT = 'unomesa:billing-return';
export const BILLING_RETURN_CHANNEL = 'unomesa-billing-return';
type BillingWindow = Window & { __unomesaNativeBilling?: number; webkit?: {messageHandlers?: {unomesa?: {postMessage:(body:unknown)=>void}}} };
export function paymentURL(value: unknown) {
 const url = new URL(String(value));
 const allowed = ['pay.unomesa.com','pay.mrmaa.com'].includes(url.hostname) || /^(?:[a-z0-9-]+\.)?lemonsqueezy\.com$/.test(url.hostname);
 if(url.protocol !== 'https:' || url.username || url.password || url.port || !allowed) throw new Error('No se pudo abrir el pago. Intente nuevamente.');
 return url.href;
}
export function hasNativeBilling() { return (window as BillingWindow).__unomesaNativeBilling === 1; }
/** Reserve while the user gesture is active. No payment URL or token in storage. */
export function reserveBillingWindow(en: boolean): Window | null {
 if(hasNativeBilling() || /UnoMesa-(iOS|Android)\//.test(navigator.userAgent)) return null;
 const tab = window.open('about:blank','_blank');
 if(tab) {
  tab.opener = null;
  tab.document.title = 'UnoMesa';
  const p = tab.document.createElement('p');
  p.textContent = en ? 'Opening secure billing… You can close this tab to return to UnoMesa.' : 'Abriendo pagos seguros… Puede cerrar esta pestaña para volver a UnoMesa.';
  p.style.cssText='font:18px system-ui;padding:32px;line-height:1.5';
  tab.document.body.append(p);
 }
 return tab;
}
export async function openBilling(value: unknown, tab: Window | null): Promise<'native'|'tab'|'blocked'|'legacy'> {
 const url = paymentURL(value), host = window as BillingWindow;
 if(hasNativeBilling()) {
  await new Promise<void>((resolve,reject)=>{
   const requestId=crypto.randomUUID();
   const cleanup=()=>{clearTimeout(timer);window.removeEventListener('unomesa:billing-open',received)};
   const received=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.requestId!==requestId)return;cleanup();detail.status==='opened'?resolve():reject(new Error('No se pudo abrir el pago. Intente nuevamente.'))};
   const timer=setTimeout(()=>{cleanup();reject(new Error('No se pudo abrir el pago. Intente nuevamente.'))},8000);
   window.addEventListener('unomesa:billing-open',received);
   try { const bridge=host.webkit?.messageHandlers?.unomesa;if(!bridge)throw new Error();bridge.postMessage({type:'billingOpen',url,requestId}); }
   catch {cleanup();reject(new Error('No se pudo abrir el pago. Intente nuevamente.'))}
  });
  return 'native';
 }
 // Earlier native builds intercept this external navigation; the main app stays open.
 if(/UnoMesa-(iOS|Android)\//.test(navigator.userAgent)) {window.location.assign(url);return 'legacy'}
 if(!tab || tab.closed) return 'blocked';
 tab.location.replace(url);
 return 'tab';
}
