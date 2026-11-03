const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

function loader(overrides={}) {
 const cache={};
 function load(file) {
  file=path.resolve(file);if(cache[file])return cache[file].exports;
  const module={exports:{}};cache[file]=module;
  const requireLocal=name=>name in overrides?overrides[name]:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:module.exports,module,require:requireLocal,process,Date,Buffer,Response});return module.exports;
 }
 return load;
}
const catalog=loader()('lib/store-catalog.ts');
const selected=n=>catalog.selectedStoreProduct('advanced','month',n);

test('2–5 locations use the exact grouped Play product and base plans; Apple IDs stay unchanged',()=>{
 for(let n=2;n<=5;n++) {
  const p=selected(n);assert.equal(p.google_play,'multiple_locations');assert.equal(p.basePlan,`${n}-branches`);
  assert.equal(p.apple,`com.unomesa.advanced.branches${n}.month`);
  assert.equal(catalog.storeProduct('google_play','multiple_locations',`${n}-branches`).branches,n);
  assert.equal(catalog.storeProduct('apple',p.apple).branches,n);
  assert.equal(catalog.STORE_CATALOG.filter(p=>p.branches===n).length,1);
 }
});
test('standard monthly/annual and future larger packages preserve their IDs',()=>{
 for(const plan of ['basic','intermediate','advanced'])for(const cycle of ['month','year']) {
  const p=catalog.selectedStoreProduct(plan,cycle,1);
  assert.equal(p.google_play,`unomesa_${plan}`);assert.equal(p.basePlan,cycle==='month'?'monthly':'anual');
  assert.equal(p.apple,`com.unomesa.${plan}.${cycle}`);
  assert.equal(catalog.storeProduct('google_play',`unomesa_${plan}`,'anual').cycle,'year');
  assert.equal(catalog.storeProduct('google_play',`unomesa_${plan}`,'annual').cycle,'year');
  assert.throws(()=>catalog.storeProduct('google_play',`unomesa_${plan}`,'unomesa-intermediate'));
 }
 for(const n of [6,10,85,95]){assert.equal(selected(n).google_play,`unomesa_branches_${n}`);assert.equal(selected(n).basePlan,'monthly');}
});
test('legacy receipts remain valid without adding duplicate products to the sales catalog',()=>{
 for(let n=2;n<=5;n++) {
  assert.equal(catalog.storeProduct('google_play',`unomesa_branches_${n}`,'monthly').branches,n);
  assert.equal(catalog.STORE_CATALOG.some(p=>p.google_play===`unomesa_branches_${n}`),false);
 }
});
test('unconfigured grouped base plans and unsupported intervals fail closed',()=>{
 for(const base of [undefined,'monthly','annual','1-branches','6-branches','95-branches','2-branches-annual','02-branches'])assert.throws(()=>catalog.storeProduct('google_play','multiple_locations',base),/STORE_PRODUCT_NOT_ALLOWED/);
 for(let n=2;n<=5;n++)assert.throws(()=>catalog.storeProduct('google_play',`unomesa_branches_${n}`,'annual'));
 assert.throws(()=>catalog.selectedStoreProduct('advanced','year',2));
});
test('same-product changes use supported modes and only an identical entitlement is current',()=>{
 for(let before=2;before<=5;before++)for(let after=2;after<=5;after++) {
  const old={...selected(before),product:'multiple_locations'};
  assert.equal(catalog.storeReplacementMode('google_play',old,selected(after)),before===after?'current':after<before?'without_proration':'immediate');
 }
 const legacy={...selected(2),product:'unomesa_branches_2'};
 assert.equal(catalog.storeReplacementMode('google_play',legacy,selected(2)),'current');
 assert.equal(catalog.storeReplacementMode('google_play',{...selected(5),product:'unomesa_branches_5'},selected(2)),'deferred');
 assert.equal(catalog.storeReplacementMode('google_play',{...selected(85),product:'unomesa_branches_85'},selected(2)),'deferred');
 assert.equal(catalog.storeReplacementMode('apple',{...selected(5),product:selected(5).apple},selected(2)),'deferred');
});

function prepareFixture(before,after,{active=true,occupied=1,legacy=false}={}) {
 const state={capacity:before,locked:false,prepared:0};
 const proof={provider:'google_play',mode:'live',external:'saved',reference:'receipt',accountToken:'bound',product:legacy?`unomesa_branches_${before}`:'multiple_locations',plan:'advanced',cycle:'month',branches:before,active,ended:false,until:new Date(Date.now()+86400000).toISOString()};
 const account={provider:'google_play',mode:'live',external_subscription_id:'saved'};
 const admin={from(table){const q={select(){return q},eq(){return q},in:async()=>({count:1}),single:async()=>({data:table==='v2_store_identity'?{account_token:'bound'}:{purchase_reference:'receipt'}}),maybeSingle:async()=>({data:account})};return q;},async rpc(name,args){
  assert.equal(state.locked,true);
  if(name==='v2_branch_apply_capacity'){state.capacity=args.p_capacity;return {data:true};}
  if(name==='v2_store_apply')return {data:true};
  assert.equal(name,'v2_store_prepare');state.prepared++;return {data:'bound'};
 }};
 class BillingError extends Error {constructor(message,status=400){super(message);this.status=status;}}
 const load=loader({
  './billing-server':{BillingError,requestBody:async req=>req.json(),billingContext:async()=>({admin,client:{rpc:async()=>({data:false})},user:{id:'owner'},restaurant:{id:'restaurant'}}),strictRateLimit:async()=>{},acquireBilling:async()=>{assert.equal(state.locked,false);state.locked=true;return {lease_token:'lease'}},releaseBilling:async()=>{state.locked=false}},
  './branch-server':{assertBranchDowngrade:async(_admin,_rid,capacity)=>{if(capacity<occupied)throw new BillingError('Archive los locales sobrantes.',409);}},
  './store-verification':{assertStoreCredentials:()=>{},storeMode:()=> 'live',assertStoreEnabled:()=>{},assertTestRestaurant:()=>{},verifyStore:async()=>({...proof})},
  './server-scale':{},'next/server':{NextResponse:{json:(body,options)=>new Response(JSON.stringify(body),options)}},
 });
 const server=load('lib/store-billing-server.ts');
 return {state,run:()=>server.storeAction(new Request('https://example.invalid/store',{method:'POST',body:JSON.stringify({restaurant_id:'restaurant',provider:'google_play',action:'prepare',plan:'advanced',cycle:'month',branches:after})}))};
}
test('actual prepare endpoint permits grouped upgrades and downgrades with the old purchase token',async()=>{
 for(const [before,after,mode] of [[2,5,'immediate'],[5,2,'without_proration'],[3,4,'immediate'],[4,3,'without_proration']]) {
  const x=prepareFixture(before,after),res=await x.run(),body=await res.json();
  assert.equal(res.status,200);assert.equal(body.productId,'multiple_locations');assert.equal(body.basePlan,`${after}-branches`);
  assert.equal(body.replacement,'receipt');assert.equal(body.replacementMode,mode);assert.equal(x.state.capacity,before,'preparing a change does not grant the target capacity');assert.equal(x.state.locked,false);
 }
});
test('prepare rejects duplicate packages, payment hold and reductions below occupied capacity',async()=>{
 for(const [before,after,options] of [[2,2,{}],[2,2,{legacy:true}],[2,5,{active:false}],[5,2,{occupied:4}]]) {
  const x=prepareFixture(before,after,options),res=await x.run();assert.equal(res.status,409);assert.equal(x.state.prepared,0);assert.equal(x.state.locked,false);
 }
});
