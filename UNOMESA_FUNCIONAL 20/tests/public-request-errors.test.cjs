const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest}=require('next/server');
function fixture(){
 const state={rpcError:null,verify:{success:true,hostname:'www.unomesa.com'},verifyStatus:200,calls:[],logs:[],env:{NEXT_PUBLIC_TURNSTILE_SITE_KEY:'fixture-public',TURNSTILE_SECRET_KEY:'fixture-private'}};
 class RequestSafetyError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const admin={rpc:async(name,data)=>{state.calls.push({name,data});return {error:state.rpcError}}};
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;
  const req=n=>{
   if(n==='@/lib/public-server')return {publicAdmin:()=>admin,sameOrigin:r=>{if(r.headers.get('origin')!==new URL(r.url).origin)throw new RequestSafetyError('INVALID_ORIGIN',403)}};
   if(n==='@/lib/server-scale')return {RequestSafetyError,readBoundedJson:r=>r.json(),takeDistributedRateLimit:async()=>{}};
   if(n.startsWith('@/'))return load(n.slice(2)+'.ts');if(n.startsWith('.'))return load(path.resolve(path.dirname(file),n+'.ts'));return require(n);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,require:req,process:{env:state.env},URL,URLSearchParams,AbortSignal,console:{error:(...args)=>state.logs.push(args)},fetch:async()=>Response.json(state.verify,{status:state.verifyStatus})});return m.exports;
 }
 const {POST}=load('app/api/public-restaurant/route.ts');state.feedback=load('lib/public-request-feedback.ts').publicRequestFeedback;
 const payload={slug:'example',id:'11111111-1111-4111-8111-111111111111',name:'Test Guest',phone:'+50255554444',email:'guest@example.test',event_date:'2026-10-16',event_time:'12:30',guests:'20',menu:'Menu',area:'Garden',notes:'Private guest note',preference:'whatsapp',captchaToken:'fixture-token'};
 state.send=async(p={},origin='https://www.unomesa.com')=>{const r=await POST(new NextRequest('https://www.unomesa.com/api/public-restaurant',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({...payload,...p})}));return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')}};
 return state;
}
test('valid requests retain their request ID and selected data',async()=>{const f=fixture(),r=await f.send();assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].data.p_id,'11111111-1111-4111-8111-111111111111');assert.equal(f.calls[0].data.p_data.phone,'50255554444');assert.equal(f.logs.length,0)});
test('SQL service errors are not reported as invalid guest data; diagnostics exclude private content',async()=>{const f=fixture();f.rpcError={message:'function missing: guest@example.test fixture-private'};const r=await f.send();assert.equal(r.status,503);assert.equal(r.body.error,'SERVICE_UNAVAILABLE');assert.match(r.body.reference,/^[a-f0-9-]{36}$/);assert.equal(r.cache,'no-store');const log=JSON.stringify(f.logs);assert(log.includes('intake'));for(const secret of ['guest@example.test','fixture-private','fixture-token','Private guest note','55554444'])assert(!log.includes(secret));assert.match(f.feedback(r.status,r.body.error),/servicio/)});
test('known business validation and unavailable pages remain distinct',async()=>{for(const [message,status] of [['PUBLIC_INPUT',400],['PUBLIC_NOT_FOUND',404]]){const f=fixture();f.rpcError={message};const r=await f.send();assert.equal(r.status,status);assert.equal(r.body.error,message);assert.equal(r.body.ok,undefined);assert.equal(f.logs.length,0)}});
test('verification rejection, wrong host and missing secret never reach intake',async()=>{for(const mode of ['rejected','host','missing','upstream']){const f=fixture();if(mode==='rejected')f.verify.success=false;if(mode==='host')f.verify.hostname='untrusted.test';if(mode==='missing')delete f.env.TURNSTILE_SECRET_KEY;if(mode==='upstream')f.verifyStatus=503;const r=await f.send();assert.equal(r.status,['missing','upstream'].includes(mode)?503:400);assert.equal(f.calls.length,0)}});
test('origin protection and required input remain enforced',async()=>{const f=fixture();assert.equal((await f.send({},'https://other.test')).status,403);assert.equal((await f.send({phone:'123'})).status,400);assert.equal(f.calls.length,0)});
test('retry feedback distinguishes captcha, rate limits, network and service failures in both languages',()=>{const f=fixture();for(const en of [false,true]){const messages=[[400,'CAPTCHA'],[429,'rate'],[0,'NETWORK'],[503,'SERVICE_UNAVAILABLE'],[403,'INVALID_ORIGIN'],[404,'PUBLIC_NOT_FOUND'],[400,'PUBLIC_INPUT']].map(([status,code])=>f.feedback(status,code,en));assert.equal(new Set(messages).size,messages.length);assert(messages.every(s=>s.length>30))}});
