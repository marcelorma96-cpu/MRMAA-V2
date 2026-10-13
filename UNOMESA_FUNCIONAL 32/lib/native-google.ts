type NativeGoogleWindow = Window & {
  __unomesaNativeGoogle?: number;
  webkit?: {messageHandlers?: {unomesa?: {postMessage:(body:unknown)=>void}}};
};

/** The bridge receives only the provider URL and PKCE challenge, never credentials. */
export function validGoogleAuthorizationURL(value:string,backend:string) {
  try {
    const url=new URL(value),base=new URL(backend),q=url.searchParams;
    return url.protocol==='https:' && url.origin===base.origin && !url.username && !url.password
      && url.pathname==='/auth/v1/authorize' && !url.hash
      && q.getAll('provider').length===1 && q.get('provider')==='google'
      && q.getAll('code_challenge').length===1 && /^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge')||'')
      && q.getAll('code_challenge_method').length===1 && q.get('code_challenge_method')?.toLowerCase()==='s256';
  } catch { return false; }
}

export async function launchGoogleAuthorization(url:string,flowId?:string) {
  if(!validGoogleAuthorizationURL(url,process.env.NEXT_PUBLIC_SUPABASE_URL||''))throw new Error('GOOGLE_URL');
  const host=window as NativeGoogleWindow,bridge=host.webkit?.messageHandlers?.unomesa;
  if([1,2,3].includes(host.__unomesaNativeGoogle||0)) {
    if(!bridge)throw new Error('GOOGLE_NATIVE_MISSING');
    const completesInPlace=(host.__unomesaNativeGoogle||0)>=2;
    const requestId=crypto.randomUUID();
    // A missing/broken native bridge must never silently fall back to Safari.
    return await new Promise<string | null>((resolve,reject)=>{
      const cleanup=()=>{window.clearTimeout(timeout);window.removeEventListener('unomesa:google-auth',receive)};
      const receive=(event:Event)=>{
        const detail=(event as CustomEvent).detail;
        if(detail?.requestId!==requestId)return;
        // Native Build 13 checks this acknowledgement before discarding its result.
        // A lost/recreated document instead uses the same-origin callback route.
        event.preventDefault();
        if(detail.status==='started') {
          window.clearTimeout(timeout);
          if(!completesInPlace){cleanup();resolve(null)}
          return;
        }
        if(detail.status==='completed' && completesInPlace && typeof detail.code==='string' && detail.code.length>0 && detail.code.length<=2048) {
          cleanup();resolve(detail.code);return;
        }
        const reason=['GOOGLE_CALLBACK_INVALID','GOOGLE_PROVIDER','GOOGLE_ATTEMPT_EXPIRED'].includes(detail.reason)?detail.reason:'GOOGLE_NATIVE';
        cleanup();reject(new Error(detail.status==='cancelled'?'GOOGLE_CANCELLED':reason));
      };
      const timeout=window.setTimeout(()=>{cleanup();reject(new Error('GOOGLE_NATIVE_TIMEOUT'))},5000);
      window.addEventListener('unomesa:google-auth',receive);
      try { bridge.postMessage({type:'googleSignIn',url,requestId,...(flowId?{flowId}:{})}); }
      catch(error){cleanup();reject(error)}
    });
  }
  // Browsers and older installed builds retain their existing navigation path.
  window.location.assign(url);
  return null;
}
