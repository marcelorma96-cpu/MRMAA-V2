const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/subscription-management.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
const {subscriptionManagement:manage}=exportsObject;

test('web purchases always lead to the web account, including both native apps',()=>{
 for(const device of [null,'apple','google_play']){
  const action=manage('lemon_squeezy',device);
  assert.equal(action.kind,'link');assert.equal(action.href,'https://www.unomesa.com/login?billing=manage');
 }
});
test('store purchases use native management on the matching device and their original store elsewhere',()=>{
 for(const provider of ['apple','google_play'])for(const device of [null,'apple','google_play']){
  const action=manage(provider,device);
  assert.equal(action.provider,provider);
  if(provider===device)assert.equal(action.kind,'native');
  else {assert.equal(action.kind,'link');assert.equal(new URL(action.href).host,provider==='apple'?'apps.apple.com':'play.google.com');}
 }
});
test('missing or unknown purchase origin never invents a store or a management destination',()=>{
 for(const provider of [null,'','unknown','javascript:alert(1)'])for(const device of [null,'apple','google_play'])assert.equal(manage(provider,device),null);
});

function renderPanel(provider,device,account={}) {
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const local=file=>{const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out,process});return out;};
 const modules={
  react:React,'react/jsx-runtime':require('react/jsx-runtime'),
  '@/lib/supabase':{supabase:{}},'./app-preferences':{useAppPreferences:()=>({language:'es'})},
  '@/lib/plans':local('lib/plans.ts'),'@/lib/billing-presentation':local('lib/billing-presentation.ts'),
  '@/lib/store-native':{nativeStore:()=>device,nativeShell:()=>!!device},
  '@/lib/store-catalog':{},'@/lib/subscription-management':exportsObject,
  './store-billing.module.css':{default:new Proxy({},{get:(_,key)=>key})},
 };
 const out={};const source=fs.readFileSync('components/store-billing-panel.tsx','utf8')+'\nexport {StoreBillingPanel};';
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out,require:id=>{assert.ok(id in modules,id);return modules[id];}});
 return renderToStaticMarkup(React.createElement(out.StoreBillingPanel,{restaurantId:'fixture',provider,mode:'live',canCheckout:false,reload:async()=>{},account:{is_owner:true,trial_exempt:false,can_write:true,plan_code:'basic',...account}}));
}
test('the real subscription panel renders the web link on both native platforms',()=>{
 for(const device of ['apple','google_play']){
  const html=renderPanel('lemon_squeezy',device);
  assert.match(html,/href="https:\/\/www\.unomesa\.com\/login\?billing=manage"/);
  assert.match(html,/Gestionar en la web/);assert.doesNotMatch(html,/Restaurar compras|>Suscribirse</);
 }
});
test('the real panel uses native management only for the original store on that platform',()=>{
 for(const provider of ['apple','google_play'])for(const device of [null,'apple','google_play']){
  const html=renderPanel(provider,device);
  if(provider===device)assert.match(html,/<button[^>]*>Gestionar suscripción<\/button>/);
  else assert.match(html,new RegExp('href="'+(provider==='apple'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions')+'"'));
 }
});
test('non-owners and complimentary accounts cannot see billing actions',()=>{
 for(const provider of ['lemon_squeezy','apple','google_play'])for(const account of [{is_owner:false},{trial_exempt:true}]){
  const html=renderPanel(provider,'apple',account);
  assert.doesNotMatch(html,/Gestionar en la web|Gestionar suscripción|Gestionar con|Restaurar compras|Actualizar estado/);
 }
});
