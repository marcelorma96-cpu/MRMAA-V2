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

export async function launchGoogleAuthorization(url:string) {
  if(!validGoogleAuthorizationURL(url,process.env.NEXT_PUBLIC_SUPABASE_URL||''))throw new Error('GOOGLE_URL');
  const host=window as NativeGoogleWindow,bridge=host.webkit?.messageHandlers?.unomesa;
  if(host.__unomesaNativeGoogle===1) {
    if(!bridge)throw new Error('GOOGLE_NATIVE_MISSING');
    const requestId=crypto.randomUUID();
    // A missing/broken native bridge must never silently fall back to Safari.
    await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{window.clearTimeout(timeout);window.removeEventListener('unomesa:google-auth',receive)};
      const receive=(event:Event)=>{
        const detail=(event as CustomEvent).detail;
        if(detail?.requestId!==requestId)return;
        cleanup();detail.status==='started'?resolve():reject(new Error('GOOGLE_NATIVE'));
      };
      const timeout=window.setTimeout(()=>{cleanup();reject(new Error('GOOGLE_NATIVE_TIMEOUT'))},5000);
      window.addEventListener('unomesa:google-auth',receive);
      try { bridge.postMessage({type:'googleSignIn',url,requestId}); }
      catch(error){cleanup();reject(error)}
    });
    return;
  }
  // Browsers and older installed builds retain their existing navigation path.
  window.location.assign(url);
}
