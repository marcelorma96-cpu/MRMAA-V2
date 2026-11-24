const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const Module = require('node:module');

// This is an actual React/DOM test. Auth transports alone are simulated; no
// credentials, real users, restaurants, database or external services are used.
// This DOM test does not claim native-browser focus, inert or top-layer behavior.
test('real React retains drafts through connection recovery and discards them when identity or access changes', async t => {
  const root = process.env.UNOMESA_AUTH_TEST_ROOT || path.resolve(__dirname, '..');
  const requireApp = Module.createRequire(path.join(root, 'package.json'));
  let esbuild, JSDOM;
  try { esbuild = requireApp('esbuild'); ({JSDOM}=require(process.env.UNOMESA_JSDOM_MODULE || 'jsdom')); }
  catch { t.skip('Requires esbuild and jsdom; UNOMESA_JSDOM_MODULE may select an installed module'); return; }
  const base = process.env.UNOMESA_BROWSER_TEST_TMP || os.tmpdir();
  fs.mkdirSync(base, { recursive:true });
  const temp = fs.mkdtempSync(path.join(base, 'session-recovery-'));
  const write = (name, value) => { const file=path.join(temp,name); fs.writeFileSync(file,value); return file; };
  const network = write('network.ts', `
const listeners = new Set<any>();
export const metrics = { mounts:0, unmounts:0, saves:0, closedForms:0, closedCalendars:0, rpc:0, mfa:0 };
const session = (id:string) => ({ user:{id}, access_token:'x.'+btoa(JSON.stringify({session_id:'session-'+id}))+'.x' });
export const state:any = { session:session('first-user'), mode:'ok', hold:[], online:true, mfaAllowed:true };
export const emit = (event:string) => { for(const fn of [...listeners]) fn(event,state.session); };
const client:any = {
 auth:{
  getSession:async()=>({data:{session:state.session},error:null}),
  onAuthStateChange:(fn:any)=>{listeners.add(fn);return{data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}},
  signOut:async()=>{state.session=null;emit('SIGNED_OUT');return{error:null}}
 },
 rpc(name:string){
  metrics.rpc++;
  const promise:any=(async()=>{
   if(name==='v2_session_close') return{data:true,error:null,status:200};
   if(name==='v2_session_remember_device') return{data:true,error:null,status:200};
   if(name==='v2_session_touch_active'){
    if(state.mode==='hold') return new Promise(resolve=>state.hold.push(resolve));
    if(state.mode==='retry') return{data:null,error:{message:'Temporary network failure'},status:503};
    return{data:state.mode!=='revoked',error:null,status:200};
   }
   if(name==='v2_mfa_session_allowed'){metrics.mfa++;return{data:state.mfaAllowed,error:null,status:200}}
   throw new Error('Unexpected RPC '+name);
  })();
  // Deliberately permit late completions to exercise the real generation guard.
  promise.abortSignal=()=>promise;
  return promise;
 }
};
export const createClient=()=>client;
export const mockClient=client;
Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>state.online});
(window as any).qa={
 metrics,state,
 connection(online:boolean){state.online=online;window.dispatchEvent(new Event(online?'online':'offline'))},
 mode(value:string){state.mode=value},
 focus(){window.dispatchEvent(new Event('focus'))},
 release(){const waiting=state.hold.splice(0);for(const done of waiting)done({data:true,error:null,status:200})},
 user(id:string){state.session=session(id);emit('SIGNED_IN')}
};
`);
  const appMode=write('app-mode.ts', `export const isAppMode=()=>false;export const APP_IDLE_LIMIT=2592000000;export const sessionActivityStorage=()=>window.sessionStorage;export const accountEntryPath=()=> '/?login=1';`);
  const preferences=write('preferences.ts', `export const useAppPreferences=()=>({language:'es',t:(v:any)=>v});export const formatAppMoney=(v:any)=>String(v);`);
  const appLaunch=write('app-launch.tsx', `export const AccessLoading=({text}:{text:string})=><div role="status">{text}</div>;`);
  const securityCenter=write('security-center.tsx', `export const SessionManager=()=>null;`);
  const fixture=write('fixture.tsx', `
import React,{useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {MfaSessionGate} from '@/components/mfa-settings';
import {Modal} from '@/components/dashboard-ui';
import {metrics,state,mockClient} from './network';
import {signOutCurrentSession} from '@/lib/supabase';
import '@/app/globals.css';
function Calendar({close}:{close:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close()},[]);
 return createPortal(<dialog ref={ref} data-testid="underlying-calendar" onKeyDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();close()}}><label>Fecha temporal<input aria-label="Fecha temporal" defaultValue="2026-11-24"/></label><button onClick={close}>Cerrar calendario de prueba</button></dialog>,document.body);
}
function PrivateSurface({owner}:{owner:string}){
 const [draft,setDraft]=useState(''),[open,setOpen]=useState(true),[calendar,setCalendar]=useState(false);
 useEffect(()=>{metrics.mounts++;return()=>{metrics.unmounts++}},[]);
 const close=()=>{metrics.closedForms++;setOpen(false)};
 return <main data-testid="private-surface"><h1>Cuenta {owner}</h1><button onClick={()=>setOpen(true)}>Abrir formulario</button>{open&&<Modal title="Formulario de prueba" close={close}><label>Borrador de cotización<input aria-label="Borrador de cotización" value={draft} onChange={e=>setDraft(e.target.value)}/></label><button onClick={()=>metrics.saves++}>Guardar prueba</button><button onClick={()=>setCalendar(true)}>Abrir calendario de prueba</button></Modal>}{calendar&&<Calendar close={()=>{metrics.closedCalendars++;setCalendar(false)}}/>}</main>;
}
function App(){
 const [user,setUser]=useState(state.session?.user.id);
 useEffect(()=>{const {data}=mockClient.auth.onAuthStateChange((_event:any,session:any)=>setUser(session?.user.id));return()=>data.subscription.unsubscribe()},[]);
 return <MfaSessionGate>{user?<PrivateSurface owner={user}/>:<div data-testid="login">Ingreso de prueba</div>}</MfaSessionGate>;
}
(window as any).qa.logout=()=>signOutCurrentSession();
createRoot(document.getElementById('root')!).render(<App/>);
`);
  const stubs=new Map([
    [path.join(root,'lib/app-mode.ts'),appMode],
    [path.join(root,'components/app-preferences.tsx'),preferences],
    [path.join(root,'components/app-launch.tsx'),appLaunch],
    [path.join(root,'components/security-center.tsx'),securityCenter]
  ]);
  const candidates=file=>[file,file+'.ts',file+'.tsx',file+'.js'].find(f=>fs.existsSync(f));
  await esbuild.build({entryPoints:[fixture],bundle:true,outdir:temp,entryNames:'bundle',format:'iife',platform:'browser',jsx:'automatic',nodePaths:[path.join(root,'node_modules')],define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://test.invalid"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"test-key"','process.env':'{}'},loader:{'.woff':'file','.woff2':'file','.ttf':'file'},logLevel:'silent',plugins:[{name:'isolated-test',setup(build){
    build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:network}));
    build.onResolve({filter:/^@\//},args=>{const file=candidates(path.join(root,args.path.slice(2)));return file?{path:stubs.get(file)||file}:undefined});
    build.onResolve({filter:/^\.\//},args=>{const file=candidates(path.resolve(args.resolveDir,args.path));return file&&stubs.has(file)?{path:stubs.get(file)}:undefined});
  }}]});
  write('index.html','<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="bundle.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
  const dom = new JSDOM('<!doctype html><html lang="es"><body><div id="root"></div></body></html>', {url:'https://test.invalid/',pretendToBeVisual:true,runScripts:'outside-only'});
  const w=dom.window, errors=[], calls={showModal:0,close:0,documentKeys:0};
  // jsdom lacks the browser's native modal/top layer. These shims test only the
  // component contract (showModal/cancel/key propagation), not its visual effect.
  w.HTMLDialogElement.prototype.showModal=function(){calls.showModal++;this.setAttribute('open','')};
  w.HTMLDialogElement.prototype.close=function(){calls.close++;this.removeAttribute('open')};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.fetch=async(input)=>{assert.equal(input,'/api/security/email');return{ok:true,json:async()=>({enabled:true,configured:true,password:true,primary:true})}};
  w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
  w.console.warn=()=>{};
  const originalTimer=w.setTimeout.bind(w);
  w.setTimeout=(fn,delay,...args)=>originalTimer(fn,delay===12000?40:delay,...args);
  t.after(()=>{w.close();fs.rmSync(temp,{recursive:true,force:true})});
  w.eval(fs.readFileSync(path.join(temp,'bundle.js'),'utf8'));
  const waitFor=async(check,label)=>{for(let count=0;count<200;count++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5))}throw Error('Timed out: '+label+'; '+w.document.body.textContent)};
  const input=()=>w.document.querySelector('[aria-label="Borrador de cotización"]');
  const recovery=()=>w.document.querySelector('.sessionConnectionDialog');
  const button=text=>[...w.document.querySelectorAll('button')].find(el=>el.textContent===text);
  const inputValue=(node,value)=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new w.Event('input',{bubbles:true}))};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
  await waitFor(()=>input()&&w.qa.metrics.mounts===1,'initial authorized form');
  inputValue(input(),'Anticipo y menú todavía sin guardar');await settle();
  const original=input(),initialCloses=w.qa.metrics.closedForms;
  w.document.addEventListener('keydown',()=>calls.documentKeys++);
  w.qa.connection(false);await waitFor(()=>recovery(),'offline modal');
  assert.equal(input(),original,'offline must keep the identical input DOM node');
  assert.equal(w.qa.metrics.mounts,1);assert.equal(w.qa.metrics.unmounts,0);
  assert.equal(recovery().hasAttribute('open'),true);assert.equal(calls.showModal,1);
  const cancel=new w.Event('cancel',{bubbles:true,cancelable:true});recovery().dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented,true,'native cancel contract is prevented');
  recovery().dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(w.qa.metrics.closedForms,initialCloses,'Escape is not delivered to the underlying real Modal');
  assert.equal(calls.documentKeys,0,'keyboard events stop before document handlers');
  w.qa.connection(true);await waitFor(()=>!recovery(),'connection recovery');
  assert.equal(input(),original);assert.equal(input().value,'Anticipo y menú todavía sin guardar');
  assert.equal(w.qa.metrics.mounts,1);assert.equal(w.qa.metrics.unmounts,0);

  button('Abrir calendario de prueba').click();await waitFor(()=>w.document.querySelector('[data-testid="underlying-calendar"][open]'),'calendar opens');
  const calendar=w.document.querySelector('[data-testid="underlying-calendar"]');
  w.qa.connection(false);await waitFor(()=>recovery(),'recovery over existing native calendar');
  recovery().dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(w.qa.metrics.closedCalendars,0);
  assert.equal(calendar.hasAttribute('open'),true);
  w.qa.connection(true);await waitFor(()=>!recovery(),'calendar recovery');
  assert.equal(w.document.querySelector('[data-testid="underlying-calendar"]'),calendar);
  button('Cerrar calendario de prueba').click();await settle();

  w.qa.mode('retry');w.qa.focus();await waitFor(()=>recovery()?.textContent.includes('Reconectando'),'temporary server failure');
  assert.equal(input(),original);assert.equal(w.qa.metrics.unmounts,0);
  w.qa.mode('ok');button('Reintentar ahora').click();await waitFor(()=>!recovery(),'manual retry recovery');
  assert.equal(input().value,'Anticipo y menú todavía sin guardar');
  w.qa.mode('hold');w.qa.focus();await waitFor(()=>w.qa.state.hold.length,'held verification');
  await waitFor(()=>recovery()?.textContent.includes('Reconectando'),'verification timeout');
  w.qa.release();await settle();
  assert.ok(recovery(),'late success cannot release a timed-out access check');
  assert.equal(input(),original);assert.equal(w.qa.metrics.unmounts,0);
  w.qa.mode('ok');button('Reintentar ahora').click();await waitFor(()=>!recovery(),'timeout recovery');
  assert.equal(input().value,'Anticipo y menú todavía sin guardar');
  assert.equal(w.qa.metrics.mounts,1);

  w.qa.mode('hold');w.qa.user('second-user');await waitFor(()=>w.qa.metrics.unmounts===1,'old user unmount');
  assert.equal(input(),null,'old account draft is not retained during new identity verification');
  await waitFor(()=>w.qa.state.hold.length,'new user check');w.qa.mode('ok');w.qa.release();
  await waitFor(()=>input()&&w.qa.metrics.mounts===2,'second user form');
  assert.equal(input().value,'');assert.notEqual(input(),original);
  w.qa.state.mfaAllowed=false;w.qa.focus();await waitFor(()=>w.qa.metrics.unmounts===2,'MFA denial unmount');
  assert.equal(input(),null);assert.match(w.document.body.textContent,/Verificación en dos pasos/);
  w.qa.state.mfaAllowed=true;w.qa.focus();await waitFor(()=>input()&&w.qa.metrics.mounts===3,'MFA success');
  w.qa.mode('revoked');w.qa.focus();await waitFor(()=>w.document.querySelector('[data-testid="login"]'),'revocation reaches login');
  assert.equal(input(),null);assert.equal(w.qa.metrics.unmounts,3);
  w.qa.mode('ok');w.qa.user('third-user');await waitFor(()=>input()&&w.qa.metrics.mounts===4,'fresh login');
  await w.qa.logout();await waitFor(()=>w.document.querySelector('[data-testid="login"]'),'explicit logout');
  assert.equal(input(),null);assert.equal(w.qa.metrics.unmounts,4);
  const css=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
  assert.match(css,/\.sessionConnectionDialog\s*\{[^}]*position:\s*fixed;[^}]*background:\s*var\(--paper\)/);
  assert.match(css,/\.sessionConnectionDialog::backdrop\s*\{\s*background:\s*var\(--paper\)/);
  assert.deepEqual(errors,[]);
});
