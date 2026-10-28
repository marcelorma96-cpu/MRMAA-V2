const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function local(file,overrides={},cache={}){
 file=path.resolve(file);if(cache[file])return cache[file];const out={};cache[file]=out;
 vm.runInNewContext(transpile(fs.readFileSync(file,'utf8')),{exports:out,process,require:id=>id in overrides?overrides[id]:id.startsWith('.')?local(path.resolve(path.dirname(file),id+'.ts'),overrides,cache):require(id)});return out;
}
const plans=local('lib/plans.ts'),catalog=local('lib/store-catalog.ts');

function panel({device='apple',provider=null,account={},language='es',fail=false,empty=false}={}){
 const slots=[],effects=[],calls=[];let cursor=0,tree,sourceFail=fail,sourceEmpty=empty;
 const hooks={...React,
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
  useRef(initial){const i=cursor++;return slots[i]??=( {current:initial} );},
  useCallback(fn){cursor++;return fn;},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j]))){old?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}},
 };
 const forbidden=()=>{throw new Error('Catalog browsing must not call a billing API or the database');};
 const modules={react:hooks,'react/jsx-runtime':require('react/jsx-runtime'),'@/lib/supabase':{supabase:{rpc:forbidden,auth:{getSession:forbidden}}},
  './app-preferences':{useAppPreferences:()=>({language})},'@/lib/plans':plans,'@/lib/store-catalog':catalog,
  '@/lib/billing-presentation':local('lib/billing-presentation.ts'),'@/lib/subscription-management':local('lib/subscription-management.ts'),
  '@/lib/store-native':{nativeStore:()=>device,nativeShell:()=>!!device,storeRequest:async(action,args)=>{calls.push({action,args});assert.equal(action,'catalog');if(sourceFail)throw new Error('Store temporarily unavailable');return {products:sourceEmpty?[]:args.products.map(p=>({...p,price:'$25.00'}))};}},
  './store-billing.module.css':{default:new Proxy({},{get:(_,key)=>key})},
 };
 const out={};vm.runInNewContext(transpile(fs.readFileSync('components/store-billing-panel.tsx','utf8')+'\nexport {StoreBillingPanel};'),{exports:out,require:id=>{assert.ok(id in modules,id);return modules[id];},fetch:forbidden,window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}}});
 function render(){cursor=0;tree=out.StoreBillingPanel({restaurantId:'real-restaurant',provider,mode:'live',canCheckout:true,reload:async()=>{},account:{is_owner:true,trial_exempt:false,can_write:true,plan_code:'advanced',...account}});while(effects.length)effects.shift()();}
 async function settle(){render();await new Promise(setImmediate);render();return renderToStaticMarkup(tree);}
 function walk(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(walk);return [node,...walk(node.props?.children)];}
 return {calls,settle,nodes:()=>walk(tree),get tree(){return tree;},recover(){sourceFail=false;sourceEmpty=false;},cleanup(){slots.forEach(s=>s?.cleanup?.());}};
}

for(const device of ['apple','google_play'])for(const variant of [
 {name:'ordinary owner',account:{},buy:true},
 {name:'complimentary owner',account:{trial_exempt:true},buy:false},
 {name:'employee',account:{is_owner:false},buy:false},
 {name:'web subscriber',provider:'lemon_squeezy',account:{},buy:false},
 {name:'other store subscriber',provider:device==='apple'?'google_play':'apple',account:{},buy:false},
])test(`${device}: ${variant.name} sees store plans without billing writes`,async()=>{
 const f=panel({device,...variant});const html=await f.settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.products.length,6);
 assert.match(html,/Planes disponibles/);assert.match(html,/Basic/);assert.match(html,/Intermediate/);assert.match(html,/\$25.00/);
 assert.equal(html.includes('>Suscribirse</button>'),variant.buy);f.cleanup();
});
test('retry recovers failed or empty catalogs without reopening or restoring purchases',async()=>{
 for(const options of [{fail:true},{empty:true}]){
  const f=panel(options);assert.match(await f.settle(),/Volver a cargar planes/);f.recover();
  f.nodes().find(n=>n.type==='button'&&n.props.children==='Volver a cargar planes').props.onClick();
  const html=await f.settle();assert.equal(f.calls.length,2);assert.match(html,/\$25.00/);assert.doesNotMatch(html,/role="alert"/);f.cleanup();
 }
});
test('changing locations requests the exact platform IDs/base plans and annual switches do not purchase',async()=>{
 for(const device of ['apple','google_play']){
  const f=panel({device});await f.settle();f.nodes().find(n=>n.type==='button'&&n.props.children==='Anual').props.onClick();
  assert.match(await f.settle(),/año/);assert.equal(f.calls.length,1);
  f.nodes().find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'4'}});
  const html=await f.settle(),last=f.calls.at(-1).args.products;assert.equal(last.length,1);assert.equal(last[0].branches,4);
  assert.equal(last[0].productId,device==='apple'?'com.unomesa.advanced.branches4.month':'multiple_locations');assert.equal(last[0].basePlan,'4-branches');
  assert.match(html,/4 sucursales/);assert.doesNotMatch(html,/>Anual</);f.cleanup();
 }
});
test('English catalog and non-native management remain available',async()=>{
 const en=panel({language:'en'});assert.match(await en.settle(),/Available plans/);en.cleanup();
 const web=panel({device:null,provider:'apple'});const html=await web.settle();assert.equal(web.calls.length,0);assert.match(html,/Gestionar con Apple/);web.cleanup();
});

function server({mode='test',enabled=true,exempt=false,source=null,authorized=false,owner=true}={}){
 const writes=[],checks=[],calls=[];class BillingError extends Error{constructor(m,status=400,code='BILLING_ERROR'){super(m);this.status=status;this.code=code;}}
 const admin={from(table){calls.push(table);const q={select(){return q;},eq(){return q;},in(){return Promise.resolve({count:1,error:null});},maybeSingle:async()=>({data:source,error:null})};return q;},rpc:async(name,args)=>{writes.push({name,args});return {data:'test-token',error:null};}};
 const client={rpc:async()=>({data:exempt,error:null})};
 const modules={
  './branch-server':{assertBranchDowngrade:async()=>{}},'./branches':local('lib/branches.ts'),
  './billing-server':{BillingError,requestBody:async req=>req.body,billingContext:async()=>{if(!owner)throw new BillingError('owner',403);return {admin,client,user:{id:'owner'},restaurant:{id:'real-restaurant'}};},strictRateLimit:async()=>{},acquireBilling:async()=>({lease_token:'lease'}),releaseBilling:async()=>{}},
  './store-catalog':catalog,'./plans':plans,'./server-scale':{},
  './store-verification':{storeMode(){checks.push('mode');if(!mode)throw new BillingError('not configured',503);return mode;},assertStoreEnabled(){checks.push('enabled');if(!enabled)throw new BillingError('disabled',503);},assertTestRestaurant(m){checks.push('sandbox');if(m==='test'&&!authorized)throw new BillingError('sandbox not allowed',403);}},
 };
 const out={};vm.runInNewContext(transpile(fs.readFileSync('lib/store-billing-server.ts','utf8')),{exports:out,require:id=>id in modules?modules[id]:require(id),Date,Buffer,process});
 return {writes,checks,calls,async run(action,extra={}){const r=await out.storeAction({body:{action,provider:'apple',plan:'basic',cycle:'month',branches:1,...extra}});return {status:r.status,body:await r.json()};}};
}
test('catalog endpoint works without billing configuration, sandbox UUID or payment eligibility and performs no writes',async()=>{
 for(const options of [{mode:null,enabled:false},{exempt:true},{source:{provider:'lemon_squeezy',mode:'live'}},{}]){
  const f=server(options),r=await f.run('catalog');assert.equal(r.status,200);assert.equal(r.body.products.length,6);assert.deepEqual(f.writes,[]);assert.deepEqual(f.checks,[]);assert.deepEqual(f.calls,[]);
 }
});
test('a real restaurant cannot prepare a sandbox purchase after browsing the catalog',async()=>{
 const f=server();assert.equal((await f.run('catalog')).status,200);assert.equal((await f.run('prepare')).status,403);assert.deepEqual(f.writes,[]);
});
test('live purchases work without a UUID list; explicit test restaurants can still test',async()=>{
 for(const options of [{mode:'live'},{mode:'test',authorized:true}]){
  const f=server(options),r=await f.run('prepare');assert.equal(r.status,200);assert.equal(r.body.accountToken,'test-token');assert.equal(f.writes.length,1);assert.equal(f.writes[0].name,'v2_store_prepare');
 }
});
test('catalog access never bypasses purchase ownership, exemptions, enablement or original provider',async()=>{
 for(const options of [{mode:'live',exempt:true},{mode:'live',enabled:false},{mode:'live',owner:false},{mode:'live',source:{provider:'lemon_squeezy',mode:'live'}},{mode:'live',source:{provider:'apple',mode:'test'}}]){
  const f=server(options),r=await f.run('prepare');assert.ok(r.status>=400);assert.deepEqual(f.writes,[]);
 }
});
