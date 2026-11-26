import type { StoreProvider } from './store-catalog';
export function nativeStore():StoreProvider|null {if(typeof window==='undefined')return null;const p=(window as any).__unomesaStoreBilling;return p==='apple'||p==='google_play'?p:null;}
export function nativeShell() {return !!nativeStore() || /UnoMesa/i.test(navigator.userAgent) || document.documentElement.dataset.unomesaApp==='true';}
export async function storeRequest(action:string,values:Record<string,unknown>={}) :Promise<any> {
 if(!nativeStore())throw new Error('Actualice la aplicación para usar las compras de la tienda.');
 const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
  const end=()=>{clearTimeout(timer);window.removeEventListener('unomesa:store-result',listener);};
  const listener=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.requestId!==requestId)return;end();d.error?reject(new Error(d.error)):resolve(d);};
  const timer=setTimeout(()=>{end();reject(new Error('La tienda no respondió. Use Restaurar compras antes de volver a pagar.'));},180000);
  window.addEventListener('unomesa:store-result',listener);
  try{(window as any).webkit.messageHandlers.unomesa.postMessage({type:'storeBilling',action,requestId,...values});}catch(e){end();reject(e);}
 });
}
