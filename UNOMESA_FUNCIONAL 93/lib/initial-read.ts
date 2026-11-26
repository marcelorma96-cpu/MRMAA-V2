/** Read-only startup recovery. A failed attempt never authorizes a screen. */
export class ReadTimeoutError extends Error {
  constructor(){super('The read timed out.');this.name='ReadTimeoutError';}
}

export function isTransientReadError(error:unknown):boolean {
  if(!error||typeof error!=='object')return false;
  const value=error as {kind?:string;name?:string;code?:string;status?:number;message?:string};
  if(value.kind)return value.kind==='retry';
  if(['AbortError','TimeoutError','ReadTimeoutError','AuthRetryableFetchError'].includes(value.name||''))return true;
  if(value.status!==undefined&&value.status>=400)return value.status===408||value.status===429||(value.status>=500&&value.status<=599);
  if(value.status===0)return true;
  if(['PGRST000','PGRST001','PGRST002','PGRST003','53300','53400','57P01','57P02','57P03','57014'].includes(value.code||''))return true;
  return /failed to fetch|fetch failed|network|load failed|timeout|timed out|connection|aborted/i.test(value.message||'');
}

export function abortableRead<T>(read:PromiseLike<T>,signal?:AbortSignal):Promise<T>{
  if(!signal)return Promise.resolve(read);
  return new Promise((resolve,reject)=>{
    const aborted=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));
    if(signal.aborted){aborted();return;}
    signal.addEventListener('abort',aborted,{once:true});
    Promise.resolve(read).then(resolve,reject).finally(()=>signal.removeEventListener('abort',aborted));
  });
}

export async function boundedRead<T>(read:(signal:AbortSignal)=>PromiseLike<T>,signal:AbortSignal,timeoutMs=30000):Promise<T>{
  signal.throwIfAborted();
  const attempt=new AbortController(),cancel=()=>attempt.abort(signal.reason);
  signal.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>attempt.abort(new ReadTimeoutError()),timeoutMs);
  try{return await abortableRead(Promise.resolve().then(()=>read(attempt.signal)),attempt.signal);}
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
}

async function waitForVisibleConnection(signal:AbortSignal){
  if(typeof document==='undefined'||typeof window==='undefined')return;
  const paused=()=>document.visibilityState==='hidden'||window.navigator.onLine===false;
  if(!paused())return;
  await new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);signal.removeEventListener('abort',cancel);};
    const wake=()=>{if(!paused()){cleanup();resolve();}};
    const cancel=()=>{cleanup();reject(signal.reason||new DOMException('Aborted','AbortError'));};
    document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);signal.addEventListener('abort',cancel,{once:true});
    if(signal.aborted)cancel();else wake();
  });
}

/** Retry only temporary transport/service failures, after the prior attempt ends. */
export async function initialRead<T>(read:(signal:AbortSignal)=>PromiseLike<T>,signal:AbortSignal,options:{delayMs?:number;timeoutMs?:number}={}):Promise<T>{
  for(;;){
    await waitForVisibleConnection(signal);
    try{return await boundedRead(read,signal,options.timeoutMs);}
    catch(error){signal.throwIfAborted();if(!isTransientReadError(error))throw error;}
    await new Promise<void>((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);reject(signal.reason||new DOMException('Aborted','AbortError'));};
      const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},options.delayMs??3000);
      signal.addEventListener('abort',cancel,{once:true});
      if(signal.aborted)cancel();
    });
  }
}
