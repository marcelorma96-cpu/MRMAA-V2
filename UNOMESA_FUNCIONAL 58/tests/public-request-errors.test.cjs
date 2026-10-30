const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest}=require('next/server');
function fixture(databaseRpc){
 const state={rpcError:null,page:{content:{quotes:true,channels:['whatsapp'],menus:[{name:'Menu'}],areas:[{name:'Garden'}]}},verify:{success:true,hostname:'www.unomesa.com'},verifyStatus:200,calls:[],logs:[],env:{NEXT_PUBLIC_TURNSTILE_SITE_KEY:'fixture-public',TURNSTILE_SECRET_KEY:'fixture-private'}};
 class RequestSafetyError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const admin={rpc:async(name,data)=>{state.calls.push({name,data});return databaseRpc?databaseRpc(name,data):name==='v2_public_page'?{data:state.page,error:state.pageError}:{error:state.rpcError}}};
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;
  const req=n=>{
   if(n==='@/lib/public-server')return {publicAdmin:()=>admin,sameOrigin:r=>{if(r.headers.get('origin')!==new URL(r.url).origin)throw new RequestSafetyError('INVALID_ORIGIN',403)}};
   if(n==='@/lib/server-scale')return {RequestSafetyError,readBoundedJson:r=>r.json(),takeDistributedRateLimit:async()=>{}};
   if(n.startsWith('@/'))return load(n.slice(2)+'.ts');if(n.startsWith('.'))return load(path.resolve(path.dirname(file),n+'.ts'));return require(n);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,require:req,process:{env:state.env},URL,URLSearchParams,AbortSignal,AbortController,setTimeout,clearTimeout,console:{error:(...args)=>state.logs.push(args)},fetch:async()=>Response.json(state.verify,{status:state.verifyStatus})});return m.exports;
 }
 const {POST}=load('app/api/public-restaurant/route.ts');state.feedback=load('lib/public-request-feedback.ts').publicRequestFeedback;
 const payload={slug:'example',id:'11111111-1111-4111-8111-111111111111',name:'Test Guest',phone:'+50255554444',email:'guest@example.test',event_date:new Date(Date.now()+86400000).toISOString().slice(0,10),event_time:'12:30',guests:'20',menu:'Menu',area:'Garden',notes:'Private guest note',preference:'whatsapp',captchaToken:'fixture-token'};
 state.send=async(p={},origin='https://www.unomesa.com')=>{const r=await POST(new NextRequest('https://www.unomesa.com/api/public-restaurant',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({...payload,...p})}));return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')}};
 return state;
}
test('valid requests retain their request ID and selected data',async()=>{const f=fixture(),r=await f.send();assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].data.p_id,'11111111-1111-4111-8111-111111111111');assert.equal(f.calls[0].data.p_data.phone,'50255554444');assert.equal(f.logs.length,0)});
test('SQL service errors are not reported as invalid guest data; diagnostics exclude private content',async()=>{const f=fixture();f.rpcError={message:'function missing: guest@example.test fixture-private'};const r=await f.send();assert.equal(r.status,503);assert.equal(r.body.error,'SERVICE_UNAVAILABLE');assert.match(r.body.reference,/^[a-f0-9-]{36}$/);assert.equal(r.cache,'no-store');const log=JSON.stringify(f.logs);assert(log.includes('intake'));for(const secret of ['guest@example.test','fixture-private','fixture-token','Private guest note','55554444'])assert(!log.includes(secret));assert.match(f.feedback(r.status,r.body.error),/servicio/)});
test('known business validation and unavailable pages remain distinct',async()=>{for(const [message,status] of [['PUBLIC_INPUT',400],['PUBLIC_NOT_FOUND',404]]){const f=fixture();f.rpcError={message};const r=await f.send();assert.equal(r.status,status);assert.equal(r.body.error,message);assert.equal(r.body.ok,undefined);assert.equal(f.logs.length,message==='PUBLIC_INPUT'?1:0)}});
test('verification rejection, wrong host and missing secret never reach intake',async()=>{for(const mode of ['rejected','host','missing','upstream']){const f=fixture();if(mode==='rejected')f.verify.success=false;if(mode==='host')f.verify.hostname='untrusted.test';if(mode==='missing')delete f.env.TURNSTILE_SECRET_KEY;if(mode==='upstream')f.verifyStatus=503;const r=await f.send();assert.equal(r.status,['missing','upstream'].includes(mode)?503:400);assert.equal(f.calls.length,0)}});
test('origin protection and required input remain enforced',async()=>{const f=fixture();assert.equal((await f.send({},'https://other.test')).status,403);assert.equal((await f.send({phone:'123'})).status,400);assert.equal(f.calls.length,0)});
test('retry feedback distinguishes captcha, rate limits, network and service failures in both languages',()=>{const f=fixture();for(const en of [false,true]){const messages=[[400,'CAPTCHA'],[429,'rate'],[0,'NETWORK'],[503,'SERVICE_UNAVAILABLE'],[403,'INVALID_ORIGIN'],[404,'PUBLIC_NOT_FOUND'],[400,'PUBLIC_INPUT']].map(([status,code])=>f.feedback(status,code,en));assert.equal(new Set(messages).size,messages.length);assert(messages.every(s=>s.length>30))}});

test('invalid server secret returns safe diagnostics and never creates a request',async()=>{const f=fixture();f.verifyStatus=400;f.verify={success:false,'error-codes':['invalid-input-secret']};const r=await f.send();assert.equal(r.status,503);assert.equal(r.body.error,'CAPTCHA_UNAVAILABLE');assert.equal(f.calls.length,0);const log=JSON.stringify(f.logs);assert(log.includes('invalid-input-secret'));for(const value of ['fixture-private','fixture-token','guest@example.test'])assert(!log.includes(value));assert(!JSON.stringify(r.body).includes('invalid-input-secret'));assert.match(f.feedback(r.status,r.body.error),/verificación/)});

test('display formatting does not reject a complete request',async()=>{
 const f=fixture();const r=await f.send({phone:'\u200e+502 5555–4444\u200f',email:' guest@example.test ',event_time:'12:30:00'});
 assert.equal(r.status,200);const data=f.calls[0].data.p_data;
 assert.equal(data.phone,'50255554444');assert.equal(data.email,'guest@example.test');assert.equal(data.event_time,'12:30');
});
test('each invalid field is identified before verification or database intake',async()=>{
 const f=fixture();
 for(const [patch,code] of [[{name:' '},'PUBLIC_NAME'],[{phone:'abc'},'PUBLIC_PHONE'],[{email:'bad'},'PUBLIC_EMAIL'],[{event_date:'2028-02-30'},'PUBLIC_DATE'],[{event_date:'2020-01-01'},'PUBLIC_DATE_RANGE'],[{event_time:'24:00'},'PUBLIC_TIME'],[{event_time:'12:30:15'},'PUBLIC_TIME'],[{guests:'2.5'},'PUBLIC_GUESTS'],[{menu:''},'PUBLIC_MENU'],[{area:[]},'PUBLIC_AREA'],[{preference:'sms'},'PUBLIC_PREFERENCE'],[{notes:'x'.repeat(2001)},'PUBLIC_NOTES']]){
  const r=await f.send(patch);assert.equal(r.status,400);assert.equal(r.body.error,code);assert.equal(r.body.ok,undefined);
  for(const en of [false,true])assert.notEqual(f.feedback(400,code,en),f.feedback(400,'PUBLIC_INPUT',en));
 }
 assert.equal(f.calls.length,0);assert.equal(f.logs.length,0);
});
test('catalog changes identify the stale selection without accepting an invalid request',async()=>{
 for(const [patch,code] of [[{menu:'Removed menu'},'PUBLIC_MENU'],[{area:'Removed space'},'PUBLIC_AREA'],[{preference:'phone'},'PUBLIC_PREFERENCE']]){
  const f=fixture();f.rpcError={message:'PUBLIC_INPUT'};const r=await f.send(patch);assert.equal(r.status,400);assert.equal(r.body.error,code);assert.equal(r.body.ok,undefined);
  assert.deepEqual(f.calls.map(x=>x.name),['v2_public_submit','v2_public_page']);
 }
 const f=fixture();f.rpcError={message:'PUBLIC_INPUT'};f.page=null;assert.equal((await f.send()).status,404);
});
test('an unavailable diagnostic read preserves the original rejection and provides a safe reference',async()=>{
 const f=fixture();f.rpcError={message:'PUBLIC_INPUT'};f.pageError={message:'unavailable'};
 const r=await f.send();assert.equal(r.status,400);assert.equal(r.body.error,'PUBLIC_INPUT');assert.match(r.body.reference,/^[a-f0-9-]{36}$/);
 assert(!JSON.stringify(f.logs).includes('guest@example.test'));
});
test('normalized HTTP requests reach the real SQL intake once; stale choices can be corrected',async()=>{
 const {database,rpc,rid}=require('./helpers/floor-database.cjs');const db=await database();
 try{
  await db.exec('create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
  await db.exec(fs.readFileSync('50_PAGINA_PUBLICA.sql','utf8'));
  const content={name:'Fixture restaurant',quotes:true,channels:['whatsapp'],whatsapp:'50255554444',menus:[{name:'Menu'}],areas:[{name:'Garden'}],pdfs:[]};
  const page=await rpc(db,'v2_public_save',[rid,'example',content,true,0]);
  const f=fixture(async(name,params)=>{try{return {data:await rpc(db,name,Object.values(params)),error:null};}catch(e){return {error:{message:e.message}};}});
  const data={phone:'+502 5555-4444',email:' guest@example.test ',event_time:'12:30:00'};
  assert.equal((await f.send(data)).status,200);assert.equal((await f.send(data)).status,200);
  let rows=(await db.query('select * from v2_public_requests')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].restaurant_id,rid);assert.equal(rows[0].email,'guest@example.test');assert.equal(rows[0].phone,'50255554444');assert.equal(rows[0].event_time,'12:30:00');
  assert.equal((await db.query('select count(*)::int n from v2_reservations')).rows[0].n,0);
  await rpc(db,'v2_public_save',[rid,'example',{...content,menus:[{name:'New menu'}]},true,page.revision]);
  const id='22222222-2222-4222-8222-222222222222';
  const rejected=await f.send({id});assert.equal(rejected.status,400);assert.equal(rejected.body.error,'PUBLIC_MENU');
  assert.equal((await f.send({id,menu:'advice'})).status,200);
  rows=(await db.query('select * from v2_public_requests')).rows;assert.equal(rows.length,2);assert.equal(rows.find(x=>x.id===id).menu,'advice');
 }finally{await db.close();}
});
