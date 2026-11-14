// Only a second, independent read of the same filter may confirm a sudden drop to zero or one.
// Real removals still take effect; never merge back reservations that have been moved or deleted.
export async function confirmReservationPage<T extends {rows:unknown[];total:number;page:number}>(
 read:(signal:AbortSignal)=>Promise<T>,previousSize:number,size:number,signal:AbortSignal
):Promise<T>{
 const complete=async()=>{
  signal.throwIfAborted();
  const attempt=new AbortController(),cancel=()=>attempt.abort();
  signal.addEventListener('abort',cancel,{once:true});
  // A stalled GET must not block later focus, online or timer retries in the queue.
  const timer=setTimeout(cancel,20000);
  let value:T;
  try{value=await read(attempt.signal);signal.throwIfAborted();attempt.signal.throwIfAborted()}
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel)}
  const expected=Math.max(0,Math.min(size,value.total-(value.page-1)*size));
  return {value,valid:value.rows.length===expected};
 };
 const first=await complete();
 if(first.valid&&!(previousSize>1&&first.value.rows.length<=1))return first.value;
 const second=await complete();
 if(!second.valid)throw new Error('No se recibió la página completa de reservaciones.');
 return second.value;
}
export function watchReservationView(refresh:()=>void,win:Window,doc:Document){
 let last=-Infinity;
 const wake=()=>{if(doc.visibilityState==='hidden'||win.navigator.onLine===false||Date.now()-last<1500)return;
  last=Date.now();refresh()};
 const resume=()=>{if(doc.visibilityState==='hidden'){last=-Infinity;return}wake()};
 const offline=()=>{last=-Infinity};
 const timer=win.setInterval(wake,45_000);
 win.addEventListener('online',wake);win.addEventListener('offline',offline);win.addEventListener('pageshow',wake);win.addEventListener('focus',wake);doc.addEventListener('visibilitychange',resume);
 return ()=>{win.clearInterval(timer);win.removeEventListener('online',wake);win.removeEventListener('offline',offline);win.removeEventListener('pageshow',wake);win.removeEventListener('focus',wake);doc.removeEventListener('visibilitychange',resume)};
}

// The list and its confirmation must go to the server even when a browser has a cached GET.
export const fetchFreshReservationRows:typeof fetch=(input,init)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const method=(init?.method||(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')).toUpperCase();
 return fetch(input,method==='GET'&&url.split('?')[0].endsWith('/rest/v1/v2_reservations')?{...init,cache:'no-store'}:init);
};
