require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {createWhatsAppWebWindow}=require('../lib/whatsapp-window.ts');
const web=number=>'https://web.whatsapp.com/send?phone='+number+'&text=Hola%20Ana';
function fixture(){
 const events=[],targets=[];let remembered=false;
 const host={wasOpened:()=>remembered,remember:()=>{remembered=true},open:(url,name)=>{events.push(['open',url,name]);const target={closed:false,opener:{},focus:()=>events.push(['focus']),location:{_url:'',set href(value){assert.equal(target.opener,null);events.push(['navigate',value]);this._url=value},get href(){return this._url}}};targets.push(target);return target}};
 return {host,events,targets,open:createWhatsAppWebWindow(host)};
}
test('same WhatsApp handle is disowned then reused and navigated to the newly selected customer',()=>{
 const f=fixture();assert.equal(f.open(web('50255554444')),'opened');
 assert.equal(f.open(web('50255553333')),'reused');assert.equal(f.events.filter(x=>x[0]==='open').length,1);
 assert.equal(f.targets[0].location.href,web('50255553333'));assert.equal(f.targets[0].opener,null);
 assert.equal(f.events[0][2],'UnoMesaWhatsAppWeb');
});
test('closed, COOP-severed and refreshed handles do not silently create another window',()=>{
 const f=fixture();f.open(web('50255554444'));f.targets[0].closed=true;
 assert.equal(f.open(web('50255553333')),'unavailable');assert.equal(f.targets.length,1);
 const afterReload=createWhatsAppWebWindow(f.host);assert.equal(afterReload(web('50255553333')),'unavailable');assert.equal(f.targets.length,1);
 assert.equal(afterReload(web('50255553333'),true),'opened');assert.equal(f.targets.length,2);
});
test('navigation denied or focus denied never opens a duplicate automatically',()=>{
 const f=fixture();f.open(web('50255554444'));
 f.targets[0].focus=()=>{throw new Error('focus denied')};assert.equal(f.open(web('50255553333')),'reused');
 Object.defineProperty(f.targets[0].location,'href',{set(){throw new Error('navigation denied')}});
 assert.equal(f.open(web('50255552222')),'unavailable');assert.equal(f.targets.length,1);
});
test('popup blocked can be retried, and unsafe destinations never open',()=>{
 let calls=0;const open=createWhatsAppWebWindow({open:()=>{calls++;return null},wasOpened:()=>false,remember:()=>assert.fail('blocked popup should not be remembered')});
 assert.equal(open(web('50255554444')),'blocked');assert.equal(open(web('50255554444'),true),'blocked');assert.equal(calls,2);
 for(const href of ['javascript:alert(1)','https://web.whatsapp.com.evil.test/send','http://web.whatsapp.com/send','https://evil.test','https://u:p@web.whatsapp.com/send','https://web.whatsapp.com/unknown'])assert.throws(()=>open(href));
 assert.equal(calls,2);
});
