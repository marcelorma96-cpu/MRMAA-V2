const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n)},console,URL});return m.exports;}
const {registrationHistory}=load('lib/registration-guard.ts');
function db(tables={},error=false){return {from(table){let filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},ilike(k,v){filters.push(r=>String(r[k]).toLowerCase()===v.replace(/\\([\\%_])/g,'$1'));return q},limit(){return Promise.resolve({data:(tables[table]||[]).filter(r=>filters.every(f=>f(r))),error:error?{message:'unavailable'}:null})}};return q}}}
test('existing, inactive, cross-provider and historical accounts never qualify for another trial',async()=>{
 assert.equal(await registrationHistory(db(),'new@example.test','new'),'new');
 assert.equal(await registrationHistory(db({v2_members:[{user_id:'u',status:'activo'}]}),'x@example.test','u'),'ready');
 assert.equal(await registrationHistory(db({v2_members:[{user_id:'u',status:'inactivo'}]}),'x@example.test','u'),'blocked');
 assert.equal(await registrationHistory(db({v2_members:[{user_id:'other',email:'Owner@Example.Test'}]}),' OWNER@example.test ','new'),'blocked');
 assert.equal(await registrationHistory(db({v2_restaurants:[{id:'r',owner_id:'u'}]}),'x@example.test','u'),'blocked');
 assert.equal(await registrationHistory(db({v2_legal_acceptances:[{user_id:'u'}]}),'x@example.test','u'),'blocked');
 assert.equal(await registrationHistory(db({v2_members:[{email:'a_b@example.test'}]}),'a_b@example.test'),'blocked');
 await assert.rejects(registrationHistory(db({},true),'x@example.test','u'));
});
test('password signup stops before intent or Auth for existing email, rejects duplicate Auth responses',async()=>{
 let history='blocked',calls=[],identities=[{provider:'email'}];
 class BillingError extends Error{constructor(message,status=400,code='ERROR'){super(message);this.status=status;this.code=code}}
 const admin={rpc:async()=>{calls.push('intent');return {data:'token'}}};
 const client={auth:{signUp:async()=>{calls.push('signup');return {data:{user:{identities},session:null}}}}};
 const api=load('app/api/register/route.ts',{
  'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},
  '@/lib/registration-guard':{registrationHistory:async()=>history},
  '@/lib/billing-server':{BillingError,requestBody:async()=>({email:'existing@example.test',password:'Strong123!',accepted:true,language:'es',currency:'GTQ',full_name:'Owner',plan_code:'advanced',billing_cycle:'month'}),strictRateLimit:async()=>{},serverClients:()=>({admin,client})},
  '@/lib/plans':{isPlan:()=>true,isBillingInterval:()=>true,PUBLIC_SIGNUP_ENABLED:true},
  '@/lib/site-origin':{siteOrigin:()=>''}
 });
 const req={url:'https://unomesa.test/api/register'};
 const first=await api.POST(req);assert.equal(first.status,409);assert.equal(first.body.code,'ACCOUNT_EXISTS');assert.equal(calls.length,0);
 history='new';identities=[];assert.equal((await api.POST(req)).body.code,'ACCOUNT_EXISTS');
 identities=[{provider:'email'}];assert.equal((await api.POST(req)).body.ok,true);
});

test('returning accounts read original billing without running provisioning functions',async()=>{
 const {readVerifiedAccount}=load('lib/account-access.ts',{'./export-limits':{exportBudget:()=>({})},'@/lib/permissions':{permissionsFor:(_r,s)=>({canRead:s==='activo'})}});
 for(const status of ['trialing','active','expired'])for(const exempt of [false,true]){
  const billing={id:'r',name:'Existing',plan_code:'basic',trial_ends_at:'2026-01-01',subscription_status:status,can_write:status!=='expired',trial_exempt:exempt};
  const before=JSON.stringify(billing),calls=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from(){const q={select(){return q},eq(){return q},order(){return q},limit:async()=>({data:[{restaurant_id:'r',status:'activo'}]}),maybeSingle:async()=>({data:{role:'admin',status:'activo'}})};return q},rpc:async(name)=>{calls.push(name);assert.equal(name,'v2_account_billing');return {data:billing}}};
  const result=await readVerifiedAccount(client,'u');assert.equal(result.trialEndsAt,billing.trial_ends_at);assert.equal(result.planCode,'basic');assert.equal(result.trialExempt,exempt);assert.equal(JSON.stringify(billing),before);assert.equal(calls.length,1);
 }
});
