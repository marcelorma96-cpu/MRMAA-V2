const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function setup(overrides={}) {
 const env={APPLE_BILLING_MODE:'test',APPLE_BILLING_ENABLED:'true',STORE_TEST_RESTAURANT_IDS:'test-restaurant',APPLE_PRIVATE_KEY:'PRIVATE-KEY-MUST-NOT-LEAK',APPLE_KEY_ID:'KEY-ID-MUST-NOT-LEAK',APPLE_ISSUER_ID:'ISSUER-MUST-NOT-LEAK',APPLE_APP_ID:'123456789',GOOGLE_PLAY_BILLING_MODE:'live',GOOGLE_PLAY_BILLING_ENABLED:'true',GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:'{"private_key":"GOOGLE-MUST-NOT-LEAK"}',...overrides};
 const logs=[],writes=[];
 class BillingError extends Error {constructor(message,status=400,code='BILLING_ERROR'){super(message);this.status=status;this.code=code;}}
 const admin={from(){const q={select(){return q;},eq(){return q;},in:async()=>({count:1,error:null}),maybeSingle:async()=>({data:null,error:null})};return q;},rpc:async(name,args)=>{writes.push({name,args});return {data:'account-token',error:null};}};
 const cache={},stubs={
  './branch-server':{assertBranchDowngrade:async()=>{}},
  './billing-server':{BillingError,requestBody:async r=>r.body,billingContext:async()=>({admin,client:{rpc:async()=>({data:false,error:null})},user:{id:'owner'},restaurant:{id:'test-restaurant'}}),strictRateLimit:async()=>{},acquireBilling:async()=>({lease_token:'lease'}),releaseBilling:async()=>{}},
  './server-scale':{},
 };
 function load(file) {
  file=path.resolve(file);if(cache[file])return cache[file];const out={};cache[file]=out;
  vm.runInNewContext(compile(fs.readFileSync(file,'utf8')),{exports:out,require:id=>id in stubs?stubs[id]:id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),process:{env,cwd:process.cwd},Buffer,Date,console:{error:(...args)=>logs.push(args)}});return out;
 }
 const verification=load('lib/store-verification.ts'),server=load('lib/store-billing-server.ts');
 return {env,logs,writes,verification,async request(action='prepare',provider='apple'){const response=await server.storeAction({body:{action,provider,plan:'basic',cycle:'month',branches:1,restaurant_id:'test-restaurant'}});return {status:response.status,body:await response.json()};}};
}

for(const [name,reference] of [
 ['APPLE_BILLING_MODE','UM-S01'],['STORE_TEST_RESTAURANT_IDS','UM-S02'],['APPLE_PRIVATE_KEY','UM-S03'],['APPLE_KEY_ID','UM-S04'],['APPLE_ISSUER_ID','UM-S05'],
])test(`missing ${name} is identifiable before preparing any purchase`,async()=>{
 const f=setup({[name]:undefined}),r=await f.request();assert.equal(r.status,503);assert.equal(r.body.code,'STORE_NOT_CONFIGURED');assert.match(r.body.error,new RegExp(reference));assert.equal(f.writes.length,0);
 assert.equal(f.logs.length,1);assert.equal(f.logs[0][1].setting,name);assert.equal(f.logs[0][1].reason,'missing');
 const output=JSON.stringify({logs:f.logs,response:r});for(const secret of ['PRIVATE-KEY-MUST-NOT-LEAK','KEY-ID-MUST-NOT-LEAK','ISSUER-MUST-NOT-LEAK','GOOGLE-MUST-NOT-LEAK','test-restaurant'])assert.equal(output.includes(secret),false);
 assert.equal(r.body.error.includes(name),false);
});
test('Apple test purchases do not require an app ID; live purchases do',async()=>{
 const sandbox=setup({APPLE_APP_ID:undefined});assert.equal((await sandbox.request()).status,200);assert.equal(sandbox.writes.length,1);
 for(const value of [undefined,'','com.unomesa.app','0']){
  const f=setup({APPLE_BILLING_MODE:'live',APPLE_APP_ID:value,STORE_TEST_RESTAURANT_IDS:undefined}),r=await f.request();assert.equal(r.status,503);assert.match(r.body.error,/UM-S06/);assert.equal(f.writes.length,0);
 }
 const live=setup({APPLE_BILLING_MODE:'live',STORE_TEST_RESTAURANT_IDS:undefined});assert.equal((await live.request()).status,200);assert.equal(live.writes.length,1);
});
test('accidental whitespace in mode/enablement is accepted, invalid modes remain blocked',async()=>{
 const f=setup({APPLE_BILLING_MODE:' test\n',APPLE_BILLING_ENABLED:'true\n'});assert.equal((await f.request()).status,200);
 const wrong=setup({APPLE_BILLING_MODE:'sandbox'}),r=await wrong.request();assert.equal(r.status,503);assert.match(r.body.error,/UM-S01/);assert.equal(wrong.logs[0][1].reason,'invalid');assert.equal(wrong.writes.length,0);
});
test('blank credentials are diagnosed and key contents are preserved unchanged',async()=>{
 const blank=setup({APPLE_PRIVATE_KEY:' \n\t'});assert.match((await blank.request()).body.error,/UM-S03/);assert.equal(blank.writes.length,0);
 const pem='-----BEGIN PRIVATE KEY-----\n  ORIGINAL\n-----END PRIVATE KEY-----\n',f=setup({APPLE_PRIVATE_KEY:pem});assert.equal(f.verification.setting('APPLE_PRIVATE_KEY'),pem);assert.deepEqual(f.logs,[]);
});
test('catalog stays accessible without payment settings; this never starts a purchase',async()=>{
 const f=setup();for(const key of Object.keys(f.env))delete f.env[key];const r=await f.request('catalog');assert.equal(r.status,200);assert.equal(r.body.products.length,6);assert.deepEqual(f.writes,[]);assert.deepEqual(f.logs,[]);
});
test('sandbox authorisation and disabled purchasing cannot be bypassed by diagnostics',async()=>{
 for(const values of [{STORE_TEST_RESTAURANT_IDS:'different-restaurant'},{APPLE_BILLING_ENABLED:'false'}]){
  const f=setup(values),r=await f.request();assert.ok(r.status>=400);assert.equal(f.writes.length,0);assert.doesNotMatch(r.body.error,/UM-S02/);
 }
});
test('Google diagnoses its own mode and credentials, without requiring Apple settings',async()=>{
 for(const [key,reference] of [['GOOGLE_PLAY_BILLING_MODE','UM-S07'],['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON','UM-S08']]){
  const f=setup({[key]:undefined}),r=await f.request('prepare','google_play');assert.equal(r.status,503);assert.match(r.body.error,new RegExp(reference));assert.equal(f.writes.length,0);
 }
 const f=setup();for(const key of Object.keys(f.env))if(key.startsWith('APPLE_'))delete f.env[key];assert.equal((await f.request('prepare','google_play')).status,200);
});
