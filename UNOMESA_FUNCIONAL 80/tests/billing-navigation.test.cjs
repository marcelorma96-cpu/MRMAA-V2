const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup(native=false){
 const target=new EventTarget(),sent=[],navigations=[],timers=new Map(),tabs=[];let timer=0;
 const tab={closed:false,opener:target,document:{title:'',createElement:()=>({style:{}}),body:{append:()=>{}}},location:{replace:url=>tabs.push(url)}};
 Object.assign(target,{location:{assign:url=>navigations.push(url)},open:()=>tab});
 if(native)Object.assign(target,{__unomesaNativeBilling:1,webkit:{messageHandlers:{unomesa:{postMessage:body=>sent.push(body)}}}});
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/billing-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window:target,navigator:{userAgent:native?'UnoMesa-iOS/1.0.14':'test-browser'},URL,crypto:require('node:crypto').webcrypto,setTimeout:fn=>{timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id),Error,Promise});
 return {...exports,target,sent,navigations,timers,tabs,tab,event:(status,id)=>target.dispatchEvent(new CustomEvent('unomesa:billing-open',{detail:{status,requestId:id}}))};
}
test('only configured HTTPS billing domains can be opened, never credential-bearing or lookalike URLs',()=>{
 const x=setup();for(const host of ['pay.unomesa.com','pay.mrmaa.com','unomesa.lemonsqueezy.com','app.lemonsqueezy.com'])assert(x.paymentURL('https://'+host+'/billing?signature=fixture'));
 for(const url of ['http://pay.unomesa.com','https://pay.unomesa.com.evil.test','https://a.b.lemonsqueezy.com','https://user:pass@pay.unomesa.com','https://pay.unomesa.com:444','javascript:alert(1)'])assert.throws(()=>x.paymentURL(url));
});
test('browser keeps its original page and disowns the reserved tab before opening external billing',async()=>{
 const x=setup();assert.equal(x.reserveBillingWindow(false),x.tab);assert.equal(x.tab.opener,null);
 assert.equal(await x.openBilling('https://pay.unomesa.com/billing',x.tab),'tab');assert.deepEqual(x.tabs,['https://pay.unomesa.com/billing']);assert.deepEqual(x.navigations,[]);
});
test('blocked or already closed tabs never replace the authenticated page',async()=>{
 const x=setup();assert.equal(await x.openBilling('https://pay.unomesa.com/billing',null),'blocked');x.tab.closed=true;assert.equal(await x.openBilling('https://pay.unomesa.com/billing',x.tab),'blocked');assert.deepEqual(x.navigations,[]);
});
test('native waits for its own acknowledgement and sends no account data or credentials',async()=>{
 const x=setup(true);assert.equal(x.reserveBillingWindow(false),null);const job=x.openBilling('https://pay.unomesa.com/billing',null);
 assert.deepEqual(Object.keys(x.sent[0]).sort(),['requestId','type','url']);x.event('opened','unrelated');assert.equal(x.timers.size,1);
 x.event('opened',x.sent[0].requestId);assert.equal(await job,'native');assert.equal(x.timers.size,0);assert.deepEqual(x.navigations,[]);
});
test('native rejection, missing bridge or timeout never silently send the user to another browser',async()=>{
 const x=setup(true),job=x.openBilling('https://pay.unomesa.com/billing',null);x.event('failed',x.sent[0].requestId);await assert.rejects(job);assert.equal(x.timers.size,0);
 const y=setup(true);delete y.target.webkit;await assert.rejects(y.openBilling('https://pay.unomesa.com/billing',null));assert.deepEqual(y.navigations,[]);
 const z=setup(true),timeout=z.openBilling('https://pay.unomesa.com/billing',null);[...z.timers.values()][0]();await assert.rejects(timeout);assert.deepEqual(z.navigations,[]);
});
