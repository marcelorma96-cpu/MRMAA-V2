const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const Module = require('node:module');

// This is an actual React/DOM test. Auth transports alone are simulated; no
// credentials, real users, restaurants, database or external services are used.
// Run with Playwright + Chromium installed. CI can set UNOMESA_BROWSER_EXECUTABLE.
test('connection recovery preserves live drafts and blocks all portal layers', async t => {
  if(process.env.UNOMESA_RUN_BROWSER_TESTS!=='1'){t.skip('Opt in with UNOMESA_RUN_BROWSER_TESTS=1 in an environment permitting Chromium');return;}
  const root = process.env.UNOMESA_AUTH_TEST_ROOT || path.resolve(__dirname, '..');
  const requireApp = Module.createRequire(path.join(root, 'package.json'));
  let esbuild, playwright;
  try { esbuild = requireApp('esbuild'); playwright = require('playwright'); }
  catch { t.skip('Requires esbuild and Playwright for real-browser verification'); return; }
  const executablePath = process.env.UNOMESA_BROWSER_EXECUTABLE || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : playwright.chromium.executablePath());
  if (!fs.existsSync(executablePath)) { t.skip('Chromium executable is unavailable'); return; }
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
  const server=http.createServer((request,response)=>{
    const name=new URL(request.url,'http://localhost').pathname.slice(1)||'index.html';
    const file=path.join(temp,path.basename(name));
    if(!fs.existsSync(file)){response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  let browser;
  t.after(async()=>{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});});
  try { browser=await playwright.chromium.launch({executablePath,headless:true,args:['--no-sandbox']}); }
  catch(error){if(/Operation not permitted/.test(String(error))){t.skip('Chromium launch blocked by environment socket permissions');return;}throw error;}
  const errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  const draft=page.getByRole('textbox',{name:'Borrador de cotización'});
  await draft.fill('Anticipo y menú todavía sin guardar');
  await page.evaluate(()=>{window.qa.original=document.querySelector('[aria-label="Borrador de cotización"]');});
  const baseline=await page.evaluate(()=>({...window.qa.metrics}));
  assert.equal(baseline.mounts,1);
  await page.evaluate(()=>window.qa.connection(false));
  const recovery=page.locator('.sessionConnectionDialog');
  await recovery.waitFor({state:'visible'});
  assert.equal(await recovery.evaluate(el=>el.matches(':modal')),true);
  assert.equal(await recovery.innerText(),'Cargando UnoMesa…');
  assert.equal(await recovery.getByRole('button').count(),0);
  assert.equal(await page.evaluate(()=>window.qa.metrics.mounts),1);
  assert.equal(await page.evaluate(()=>window.qa.metrics.unmounts),0);
  assert.equal(await page.evaluate(()=>window.qa.original===document.querySelector('[aria-label="Borrador de cotización"]')),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.qa.metrics.closedForms),0);
  await page.evaluate(()=>window.qa.original.focus());
  assert.equal(await recovery.evaluate(el=>el.contains(document.activeElement)),true,'background portal cannot steal focus');
  await page.keyboard.press('Tab');
  assert.equal(await recovery.evaluate(el=>el.contains(document.activeElement)),true);
  const saveBox=await page.getByRole('button',{name:'Guardar prueba',includeHidden:true}).boundingBox();
  if(saveBox)await page.mouse.click(saveBox.x+saveBox.width/2,saveBox.y+saveBox.height/2);
  assert.equal(await page.evaluate(()=>window.qa.metrics.saves),0,'clicks cannot activate background save');
  await page.evaluate(()=>window.qa.connection(true));
  await recovery.waitFor({state:'hidden'});
  assert.equal(await draft.inputValue(),'Anticipo y menú todavía sin guardar');
  assert.equal(await page.evaluate(()=>window.qa.metrics.mounts),1);

  // A calendar already in the browser top layer must remain underneath the
  // new security dialog, with no Escape/keyboard leaking into its close handler.
  await page.getByRole('button',{name:'Abrir calendario de prueba'}).click();
  const calendar=page.getByTestId('underlying-calendar');
  await calendar.waitFor({state:'visible'});
  await page.evaluate(()=>window.qa.connection(false));
  await recovery.waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.qa.metrics.closedCalendars),0);
  await page.getByRole('textbox',{name:'Fecha temporal',includeHidden:true}).evaluate(el=>el.focus());
  assert.equal(await recovery.evaluate(el=>el.contains(document.activeElement)),true);
  await page.evaluate(()=>window.qa.connection(true));
  await recovery.waitFor({state:'hidden'});
  assert.equal(await calendar.evaluate(el=>el.matches(':modal')),true);
  await page.getByRole('button',{name:'Cerrar calendario de prueba'}).click();
  assert.equal(await draft.inputValue(),'Anticipo y menú todavía sin guardar');

  // Temporary errors, timeouts, and discarded late successes preserve the same
  // component and input rather than returning a new empty form.
  await page.evaluate(()=>{window.qa.mode('retry');window.qa.focus()});
  const retrying=page.locator('.sessionConnectionDialog');
  await retrying.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.qa.metrics.unmounts),0);
  await page.evaluate(()=>window.qa.mode('ok'));
  await retrying.waitFor({state:'hidden'});
  assert.equal(await draft.inputValue(),'Anticipo y menú todavía sin guardar');
  await page.clock.install();
  await page.evaluate(()=>{window.qa.mode('hold');window.qa.focus()});
  await page.clock.fastForward(12010);
  await retrying.waitFor({state:'visible'});
  await page.evaluate(()=>window.qa.release());
  assert.equal(await retrying.isVisible(),true,'late success after timeout must not release access');
  await page.evaluate(()=>window.qa.mode('ok'));
  await page.clock.runFor(1010);
  await retrying.waitFor({state:'hidden'});
  assert.equal(await draft.inputValue(),'Anticipo y menú todavía sin guardar');
  assert.equal(await page.evaluate(()=>window.qa.metrics.mounts),1);

  // Changing user invalidates the old private tree and its unsaved form.
  await page.evaluate(()=>{window.qa.mode('hold');window.qa.user('second-user')});
  await page.clock.runFor(30);
  await page.waitForFunction(()=>window.qa.metrics.unmounts===1);
  assert.equal(await page.locator('[aria-label="Borrador de cotización"]').count(),0);
  await page.evaluate(()=>{window.qa.mode('ok');window.qa.release()});
  await page.clock.runFor(30);
  await draft.waitFor({state:'visible'});
  assert.equal(await draft.inputValue(),'');
  assert.equal(await page.evaluate(()=>window.qa.metrics.mounts),2);
  await page.evaluate(()=>{window.qa.mode('revoked');window.qa.focus()});
  await page.clock.runFor(30);
  await page.getByTestId('login').waitFor({state:'visible'});
  assert.equal(await page.locator('[aria-label="Borrador de cotización"]').count(),0);
  assert.equal(await page.evaluate(()=>window.qa.metrics.unmounts),2);
  await page.evaluate(()=>{window.qa.mode('ok');window.qa.user('third-user')});
  await page.clock.runFor(30);
  await draft.waitFor({state:'visible'});
  await page.evaluate(()=>window.qa.logout());
  await page.clock.runFor(30);
  await page.getByTestId('login').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.qa.metrics.unmounts),3);
  assert.deepEqual(errors,[]);
});
