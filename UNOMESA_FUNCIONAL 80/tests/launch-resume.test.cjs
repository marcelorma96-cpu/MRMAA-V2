const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,ctx){const code=ts.transpileModule(fs.readFileSync('lib/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,ctx);return ctx.exports}
function start({mobile=false,android=false,cached=false,reduced=false,shared}={}){
 const root={dataset:{},style:{setProperty(){}}},doc=new EventTarget(),win=new EventTarget(),frames=new Map(),timers=new Map(),state={user:null,ticket:false,clock:5000},listeners=[];
 const store=shared||{length:cached?1:0,key:()=>mobile?'unomesa-app:sb-test-auth-token':'sb-test-auth-token',getItem:k=>k.endsWith('-auth-token')&&cached?'{"access_token":"synthetic"}':null};
 let id=0;doc.documentElement=root;doc.visibilityState='visible';doc.querySelector=()=>state.user?{dataset:{unoGatedSurface:state.user}}:null;
 const ctx={exports:{},window:win,document:doc,Event,CustomEvent,navigator:{userAgent:mobile?(android?'UnoMesa-Android/1.0':'UnoMesa-iOS/1.0'):'Browser'},location:{pathname:'/login',search:'',hash:''},localStorage:store,sessionStorage:mobile?{length:0,getItem:()=>null}:store,URLSearchParams,performance:{now:()=>state.clock},matchMedia:k=>({matches:reduced&&k.includes('reduced-motion')}),requestAnimationFrame:f=>(frames.set(++id,f),id),cancelAnimationFrame:id=>frames.delete(id),clearTimeout:id=>timers.delete(id),require:k=>k==='./launch-session'?{OPENING_EVENT:'login',takeLoginOpening:()=>{const t=state.ticket;state.ticket=false;return t}}:{isAppMode:()=>mobile,nativeAppMessage(){}}};win.setTimeout=f=>(timers.set(++id,f),id);
 vm.runInNewContext(load('entry-presentation',ctx).ENTRY_PRESENTATION_SCRIPT,ctx);ctx.exports={};
 const api=load('opening-lifecycle',ctx);api.watchOpenings();
 function flush(){for(let k=0;k<2;k++){const c=[...frames.values()];frames.clear();c.forEach(f=>f())}}
 return {phase:()=>root.dataset.unoOpening,store,state,api,flush,control:t=>{state.user=t;api.setOpeningBusy(false);flush()},finish:()=>{const c=[...timers.values()];timers.clear();c.forEach(f=>f());state.clock+=2000},vis:v=>{doc.visibilityState=v;doc.dispatchEvent(new Event('visibilitychange'))},login:()=>{state.ticket=true;win.dispatchEvent(new Event('login'))},focus:()=>win.dispatchEvent(new Event('focus')),pagehide:()=>win.dispatchEvent(new Event('pagehide')),pageshow:()=>{const e=new Event('pageshow');e.persisted=true;win.dispatchEvent(e)}};
}
test('restored session on /login shows the symbol before hydration; expired access never reveals a dashboard',()=>{let x=start({cached:true});assert.equal(x.phase(),'hold');x.api.setOpeningBusy(true);x.flush();assert.equal(x.phase(),'hold');x.control(null);assert.equal(x.phase(),undefined);x=start({cached:true});x.control('u');assert.equal(x.phase(),'reveal')});
test('anonymous access stays plain; login, challenge, and verified entry work without a second login',()=>{let x=start();x.control(null);assert.equal(x.phase(),undefined);x.login();assert.equal(x.phase(),'hold');x.control(null);assert.equal(x.phase(),undefined);x.control('u');assert.equal(x.phase(),'reveal');assert.equal(x.state.ticket,false)});
for(const android of [false,true])test((android?'Android':'iOS')+': switching apps preserves the work surface; destroying the document reopens the same saved user',()=>{
 const x=start({mobile:true,android,cached:true});x.control('u');assert.equal(x.phase(),'reveal');x.finish();
 x.vis('hidden');x.vis('visible');x.focus();x.flush();assert.equal(x.phase(),undefined);
 x.pagehide();x.pageshow();x.flush();assert.equal(x.phase(),undefined);
 x.api.setOpeningBusy(true);x.api.setOpeningBusy(false);x.flush();assert.equal(x.phase(),undefined);
 // Requesting MFA on this live document must not be mistaken for a new process.
 x.control(null);x.control('u');assert.equal(x.phase(),undefined);
 const reopened=start({mobile:true,android,shared:x.store});assert.equal(reopened.phase(),'hold');
 reopened.api.setOpeningBusy(true);reopened.flush();assert.equal(reopened.phase(),'hold');
 reopened.control('u');assert.equal(reopened.phase(),'reveal');
 const loggedOut=start({mobile:true,android,cached:false});loggedOut.control(null);assert.equal(loggedOut.phase(),undefined);
});
test('desktop tab switching and back/forward restore do not replay',()=>{const x=start({cached:true});x.control('u');x.finish();x.vis('hidden');x.vis('visible');x.focus();x.pagehide();x.pageshow();x.flush();assert.equal(x.phase(),undefined)});
test('reduced motion skips the moving reveal',()=>{const x=start({mobile:true,cached:true,reduced:true});x.control('u');assert.equal(x.phase(),undefined)});
