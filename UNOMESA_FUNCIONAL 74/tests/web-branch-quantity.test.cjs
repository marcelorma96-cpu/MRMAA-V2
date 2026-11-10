const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react');

// Exercise the real controlled UI and billing event handlers with no network or charges.
function setup(account={}){
 const cells=[],effects=[],requests=[],confirmations=[];let cursor=0,effectCursor=0,consent=true;
 const hooks={...React,useId:()=> 'quantity',useState(initial){const key=cursor++;if(!(key in cells))cells[key]=typeof initial==='function'?initial():initial;return [cells[key],value=>{cells[key]=typeof value==='function'?value(cells[key]):value}];},useEffect(callback,deps){const key=effectCursor++;if(!effects[key]||deps.some((d,i)=>d!==effects[key][i])){effects[key]=deps;callback();}}};
 const modules={react:hooks,'./app-preferences':{useAppPreferences:()=>({language:'es'}),confirmApp:text=>{confirmations.push(text);return consent;}},'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}}},'@/lib/billing-navigation':{reserveBillingWindow:()=>({close(){}}),openBilling:async()=> 'tab'}};
 const cache={};
 function load(file){file=path.resolve(file);if(cache[file])return cache[file];const out={};cache[file]=out;
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports:out,require:name=>{
   if(modules[name])return modules[name];
   if(name.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>key})};
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
   if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.tsx');
   return require(name);
  },fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({})};}});
  return out;
 }
 const {BranchPackage}=load('components/branch-package.tsx'),{BranchQuantitySelector}=load('components/branch-quantity-selector.tsx'),branches=load('lib/branches.ts');
 const props={restaurantId:'fixture',account:{is_owner:true,branch_capacity:1,plan_code:'advanced',billing_cycle:'month',subscription_status:'active',billing_current_period_end:'2026-12-01',...account},refresh:async()=>{}};
 const render=()=>{cursor=effectCursor=0;return BranchPackage(props)};
 return {render,props,selector:BranchQuantitySelector,branches,requests,confirmations,setConsent:v=>{consent=v}};
}
function nodes(root){if(!root||typeof root!=='object')return [];return [root,...React.Children.toArray(root.props?.children).flatMap(nodes)];}
const picker=root=>nodes(root).find(n=>n.type?.name==='BranchQuantitySelector');
const submit=root=>nodes(root).find(n=>n.type==='button'&&n.props.className==='primary');
const text=root=>React.Children.toArray(root?.props?.children).map(n=>typeof n==='string'||typeof n==='number'?n:text(n)).join('');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('quantity text can be cleared and replaced; only whole supported quantities are billable',()=>{
 const {branches}=setup();
 for(const value of ['',' ','0','-1','1.5','1e2','1,000','10001','Infinity','five'])assert.equal(branches.parseBranchQuantity(value),null,value);
 for(const n of [1,2,3,4,5,12,100,10000])assert.equal(branches.parseBranchQuantity(String(n)),n);
 for(const [n,cents] of [[1,5500],[2,9000],[3,13500],[4,18000],[12,54000]])assert.equal(branches.branchPrice(n),cents);
});
test('quick choices, typed values and one-step controls update the same quantity',()=>{
 const s=setup();let value='1';const render=()=>s.selector({value,onChange:v=>{value=v},en:false});
 assert.equal(nodes(render()).find(n=>n.props['aria-label']==='Una sucursal menos').props.disabled,true);
 for(const n of [2,3,4]){nodes(render()).find(v=>v.props['aria-label']==='Una sucursal más').props.onClick();assert.equal(value,String(n));}
 nodes(render()).find(n=>n.type==='input').props.onChange({target:{value:''}});assert.equal(value,'');
 nodes(render()).find(n=>n.type==='input').props.onChange({target:{value:'12'}});
 nodes(render()).find(n=>n.props['aria-label']==='Una sucursal menos').props.onClick();assert.equal(value,'11');
 nodes(render()).find(n=>n.props['aria-label']==='3 sucursales').props.onClick();assert.equal(value,'3');
 value='10000';assert.equal(nodes(render()).find(n=>n.props['aria-label']==='Una sucursal más').props.disabled,true);
 assert(nodes(render()).filter(n=>n.type==='button').every(n=>n.props.type==='button'));
});
test('editing never charges; invalid and unchanged quantities cannot be submitted',async()=>{
 const s=setup();assert.equal(picker(s.render()).props.value,'1');assert.equal(submit(s.render()).props.disabled,true);
 for(const value of ['','0','1.5','1e2','10001']){
  picker(s.render()).props.onChange(value);assert.equal(picker(s.render()).props.value,value);assert.equal(submit(s.render()).props.disabled,true);
  submit(s.render()).props.onClick();await tick();
 }
 assert.equal(s.requests.length,0);assert.equal(s.confirmations.length,0);
 picker(s.render()).props.onChange('7');assert.equal(submit(s.render()).props.disabled,false);assert.match(text(s.render()),/315\.00/);assert.equal(s.requests.length,0);
});
test('only confirmation sends the chosen total and preserves the existing capacity guard',async()=>{
 const s=setup({branch_capacity:2});picker(s.render()).props.onChange('7');s.setConsent(false);
 submit(s.render()).props.onClick();await tick();assert.equal(s.requests.length,0);
 s.setConsent(true);submit(s.render()).props.onClick();await tick();
 assert.equal(s.requests.length,1);const r=s.requests[0];assert.equal(r.url,'/api/billing/branches');assert.equal(r.body.branches,7);assert.equal(r.body.expected_capacity,2);assert.equal(r.body.confirmed,true);
 assert.match(s.confirmations.at(-1),/7 sucursales/);assert.match(s.confirmations.at(-1),/315\.00/);
});
test('new subscriptions use checkout; protected plans and non-owners retain existing restrictions',async()=>{
 const s=setup({subscription_status:'trial',billing_current_period_end:null});picker(s.render()).props.onChange('12');submit(s.render()).props.onClick();await tick();
 assert.equal(s.requests[0].url,'/api/billing/checkout');assert.equal(s.requests[0].body.branches,12);
 for(const account of [{plan_code:'basic'},{billing_cycle:'year'}])assert.equal(submit(setup(account).render()).props.disabled,true);
 for(const account of [{is_owner:false},{trial_exempt:true}])assert.equal(setup(account).render(),null);
});
test('verified capacity changes update the displayed quantity, ordinary refreshes keep drafts',()=>{
 const s=setup({branch_capacity:3});assert.equal(picker(s.render()).props.value,'3');picker(s.render()).props.onChange('12');assert.equal(picker(s.render()).props.value,'12');
 s.props.account={...s.props.account,branch_capacity:6};s.render();assert.equal(picker(s.render()).props.value,'6');
});
