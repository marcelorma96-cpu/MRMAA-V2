const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

// Execute HomeContent's real hooks and retry/timeout flow in React. Only its
// transport and leaf screens are fixtures; no production services are called.
async function setup(t, initial = {}) {
  const root = process.env.UNOMESA_AUTH_TEST_ROOT || path.resolve(__dirname, '..');
  const requireApp = Module.createRequire(path.join(root, 'package.json'));
  let esbuild, ts, JSDOM;
  try { esbuild = requireApp('esbuild'); ts = requireApp('typescript'); ({ JSDOM } = require(process.env.UNOMESA_JSDOM_MODULE || 'jsdom')); }
  catch { t.skip('Requires esbuild and jsdom; UNOMESA_JSDOM_MODULE may select an installed module'); return; }
  const source = fs.readFileSync(path.join(root, 'components/home-entry.tsx'), 'utf8');
  const parsed = ts.createSourceFile('home-entry.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'HomeContent');
  assert.ok(declaration, 'HomeContent must be tested directly');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'home-startup-'));
  const fixture = path.join(temp, 'fixture.tsx');
  fs.writeFileSync(fixture, `
import React,{useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {runSessionVerification} from '${path.join(root, 'lib/session-verification.ts')}';
import {isTransientReadError} from '${path.join(root, 'lib/initial-read.ts')}';
const state:any = {social:false, profileError:null, profileCalls:0, initMode:'ok', sessionMode:'ok', supportMode:'ok', accountMode:'ok', heldInit:[], heldAccounts:[], initCalls:0, sessionCalls:0, supportCalls:0, accountCalls:0, mounts:0, unmounts:0, logouts:0, ...${JSON.stringify(initial)}};
const session = {user:{id:'fixture-user'},access_token:'fixture'};
const account = {restaurantId:'fixture-restaurant',restaurantName:'Ready restaurant',trialExempt:true,canWrite:true,isOwner:true,planCode:'advanced',trialEndsAt:'2099-01-01',paidUntil:null,graceEndsAt:null};
const listeners = new Set<any>();
let initializeResult:Promise<any>|undefined;
const supabase = {
 auth:{
  initialize(){state.initCalls++;if(!initializeResult)initializeResult=state.initMode==='hold'?new Promise(resolve=>state.heldInit.push(resolve)):Promise.resolve(state.initMode==='fail'?{error:{name:'AuthRetryableFetchError',status:503}}:{error:null});return initializeResult},
  async getSession(){state.sessionCalls++;return state.sessionMode==='fail'?{data:{session:null},error:{name:'AuthRetryableFetchError',status:503}}:{data:{session},error:null}},
  onAuthStateChange(fn:any){listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}}}
 },
 rpc(name:string){if(name!=='v2_is_support_agent')throw Error('Unexpected RPC '+name);state.supportCalls++;const pending:any=Promise.resolve(state.supportMode==='fail'?{data:null,error:{status:503},status:503}:{data:false,error:null,status:200});pending.abortSignal=()=>pending;return pending;}
};
async function readVerifiedAccount(_client:any,_user:string,_branch?:string,_signal?:AbortSignal){state.accountCalls++;if(state.accountMode==='hold')return new Promise(resolve=>state.heldAccounts.push(resolve));return {...account}}
class AccountAccessError extends Error {constructor(public kind:string,message:string){super(message)}}
const LOAD_RETRY_MESSAGE='fixture transient failure';
const isInvalidSessionError=()=>false,enabledSocialProvider=()=>state.social,hasOAuthMethod=()=>state.social;
const googleProfileRequest=async()=>{state.profileCalls++;if(state.profileError)throw Object.assign(new Error(state.profileError.code||'GOOGLE_UNAVAILABLE'),state.profileError);return {state:'ready'}},clearGoogleRegistrationIntent=()=>{},rememberBranch=()=>{};
const isAppMode=()=>true,sessionActivityStorage=()=>sessionStorage,remainingIdleTime=()=>2592000000;
const ACTIVITY_KEY='fixture-activity',ACTIVITY_EVENT='fixture-activity-event',APP_IDLE_LIMIT=2592000000,INACTIVITY_LIMIT_MS=2592000000;
const PUBLIC_SIGNUP_ENABLED=false,confirmDiscardChanges=()=>true,userMessage=(message:any)=>String(message),clearLoginOpening=()=>{};
const signOutCurrentSession=async()=>{state.logouts++;for(const fn of listeners)fn('SIGNED_OUT',null)};
const AccessLoading=({text}:{text:string})=><main role="status" data-testid="loading">{text}</main>;
const AccessForm=()=> <main data-testid="login">Login</main>;
const SessionConnectionDialog=({children}:{children:any})=>createPortal(<section data-testid="suspended">{children}</section>,document.body);
const BranchSwitcher=()=>null,SignedInOpening=()=>null,RestrictedAccount=()=> <main data-testid="restricted"/>;
const SetInvitedPassword=()=>null,GoogleRegistration=()=>null,SupportWorkspace=()=>null,BillingPanel=()=>null;
const BranchReadOnlyNotice=()=>null,ExpiryBanner=()=>null,TrialBanner=()=>null,PublicLanguage=({children}:{children:any})=>children,Landing=()=>null;
function Dashboard({initialRestaurantName}:{initialRestaurantName:string}){
 const [draft,setDraft]=useState('');
 useEffect(()=>{state.mounts++;return()=>{state.unmounts++}},[]);
 return <main data-testid="dashboard"><h1>{initialRestaurantName}</h1><input aria-label="Unsaved quotation" value={draft} onChange={event=>setDraft(event.target.value)}/></main>;
}
${source.slice(declaration.getStart(parsed), declaration.end)}
(window as any).qa={state,account,refresh(){window.dispatchEvent(new Event('mrmaa:billing-updated'))},focus(){window.dispatchEvent(new Event('focus'))},releaseInit(){for(const resolve of state.heldInit.splice(0))resolve({error:null})},releaseAccounts(name='Late restaurant'){for(const resolve of state.heldAccounts.splice(0))resolve({...account,restaurantName:name})}};
const appRoot=createRoot(document.getElementById('root')!);(window as any).qa.unmount=()=>appRoot.unmount();appRoot.render(<HomeContent/>);
`);
  const result = await esbuild.build({entryPoints:[fixture],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',nodePaths:[path.join(root,'node_modules')],define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
  const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', {url:'https://fixture.invalid/mobile',pretendToBeVisual:true,runScripts:'outside-only'});
  const w=dom.window, timers=new Map(), errors=[];
  let nextTimer=100000;
  const originalTimeout=w.setTimeout.bind(w),originalClear=w.clearTimeout.bind(w);
  w.setTimeout=(fn,delay=0,...args)=>{if(delay===0)return originalTimeout(fn,delay,...args);const id=++nextTimer;timers.set(id,{fn:()=>fn(...args),delay});return id};
  w.clearTimeout=id=>timers.has(id)?timers.delete(id):originalClear(id);
  w.scrollTo=()=>{};
  w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
  w.eval(result.outputFiles[0].text);
  const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
  const waitFor=async(check,label)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5))}throw Error('Timed out: '+label+'; '+w.document.body.textContent+'; timers='+JSON.stringify([...timers.values()].map(x=>x.delay)))};
  t.after(()=>{w.qa?.unmount();w.close();fs.rmSync(temp,{recursive:true,force:true});assert.deepEqual(errors,[])});
  return {
    w,state:w.qa.state,timers,settle,waitFor,
    loading:()=>w.document.querySelector('[data-testid="loading"]'),
    dashboard:()=>w.document.querySelector('[data-testid="dashboard"]'),
    suspended:()=>w.document.querySelector('[data-testid="suspended"]'),
    fire(delay){const pair=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(pair,'Missing timer '+delay);timers.delete(pair[0]);pair[1].fn()},
    delays:()=>[...timers.values()].map(timer=>timer.delay)
  };
}

test('cached initialization failure retries the current session and recovers without opening login',async t=>{
 const h=await setup(t,{initMode:'fail',sessionMode:'fail'});if(!h)return;
 await h.waitFor(()=>h.delays().includes(3000),'Auth retry scheduled');
 assert.ok(h.loading());assert.equal(h.dashboard(),null);assert.equal(h.w.document.querySelector('[data-testid="login"]'),null);
 assert.doesNotMatch(h.w.document.body.textContent,/fixture transient failure|servidor|Reintentar/);
 h.fire(3000);
 await h.waitFor(()=>h.state.sessionCalls===1&&h.delays().includes(3000),'session transport retry scheduled');
 assert.ok(h.loading());assert.equal(h.dashboard(),null);
 assert.equal(h.state.initCalls,1,'the SDK caches initialize errors; retries must use getSession');
 h.state.sessionMode='ok';h.fire(3000);
 await h.waitFor(()=>h.dashboard()&&h.state.mounts===1,'automatic Auth recovery');
 assert.equal(h.state.initCalls,1);assert.equal(h.state.sessionCalls,2);assert.equal(h.state.logouts,0);assert.equal(h.loading(),null);
});

test('a stalled Auth restore retries after its timeout and discards the old completion',async t=>{
 const h=await setup(t,{initMode:'hold'});if(!h)return;
 await h.waitFor(()=>h.state.heldInit.length===1&&h.delays().includes(30000),'Auth restore pending');
 h.fire(30000);await h.waitFor(()=>h.delays().includes(3000),'timed-out Auth retry scheduled');
 h.w.qa.releaseInit();await h.settle();
 assert.ok(h.loading());assert.equal(h.dashboard(),null);assert.equal(h.state.accountCalls,0);
 h.fire(3000);
 await h.waitFor(()=>h.dashboard(),'fresh Auth retry succeeds using the cached initialization promise');
 assert.equal(h.state.initCalls,2);assert.equal(h.state.logouts,0);
});

test('account failure retries only after completion and ignores a late timed-out response',async t=>{
 const h=await setup(t,{supportMode:'fail'});if(!h)return;
 await h.waitFor(()=>h.delays().includes(3000),'account retry scheduled');
 assert.ok(h.loading());assert.equal(h.dashboard(),null);
 h.state.supportMode='ok';h.state.accountMode='hold';h.fire(3000);
 await h.waitFor(()=>h.state.heldAccounts.length===1,'account request pending');
 h.w.qa.focus();h.w.qa.focus();await h.settle();
 assert.equal(h.state.accountCalls,1,'focus bursts cannot overlap the pending account read');
 assert.equal(h.delays().includes(3000),false,'backoff starts after completion');
 h.fire(30000);await h.waitFor(()=>h.delays().includes(3000),'timed-out read scheduled for retry');
 h.w.qa.releaseAccounts();await h.settle();
 assert.equal(h.dashboard(),null,'late result from a timed-out read cannot open the dashboard');
 h.state.accountMode='ok';h.fire(3000);
 await h.waitFor(()=>h.dashboard(),'next account attempt succeeds');
 assert.equal(h.dashboard().querySelector('h1').textContent,'Ready restaurant');assert.equal(h.state.logouts,0);
});

test('background account recovery keeps the dashboard and unsaved form mounted behind loading',async t=>{
 const h=await setup(t);if(!h)return;
 await h.waitFor(()=>h.dashboard()&&h.state.mounts===1,'first dashboard');
 const input=h.w.document.querySelector('[aria-label="Unsaved quotation"]');
 Object.getOwnPropertyDescriptor(h.w.HTMLInputElement.prototype,'value').set.call(input,'Unsaved menu and deposit');
 input.dispatchEvent(new h.w.Event('input',{bubbles:true}));await h.settle();
 h.state.supportMode='fail';h.w.qa.refresh();
 await h.waitFor(()=>h.suspended()&&h.delays().includes(3000),'background suspension');
 assert.equal(h.w.document.querySelector('[aria-label="Unsaved quotation"]'),input);assert.equal(h.state.unmounts,0);
 h.state.supportMode='ok';h.state.accountMode='hold';h.fire(3000);
 await h.waitFor(()=>h.state.heldAccounts.length===1,'background retry pending');
 assert.ok(h.suspended(),'loading remains throughout the retry');
 h.w.qa.releaseAccounts('Fresh restaurant');
 await h.waitFor(()=>!h.suspended(),'background recovery complete');
 assert.equal(h.w.document.querySelector('[aria-label="Unsaved quotation"]'),input);assert.equal(input.value,'Unsaved menu and deposit');
 assert.equal(h.state.mounts,1);assert.equal(h.state.unmounts,0);assert.equal(h.dashboard().querySelector('h1').textContent,'Fresh restaurant');
});


test('temporary social profile failure keeps loading and recovers automatically',async t=>{
 const h=await setup(t,{social:true,profileError:{code:'GOOGLE_UNAVAILABLE',status:503}});if(!h)return;
 await h.waitFor(()=>h.delays().includes(3000),'profile retry scheduled');
 assert.ok(h.loading());assert.equal(h.dashboard(),null);assert.equal(h.state.logouts,0);
 h.state.profileError=null;h.fire(3000);
 await h.waitFor(()=>h.dashboard(),'social profile recovery');
 assert.equal(h.state.profileCalls,2);assert.equal(h.state.logouts,0);
});

test('social profile permission or malformed responses offer retry without automatic loops or sign-out',async t=>{
 for(const profileError of [{code:'GOOGLE_SECURITY',status:403},{code:'GOOGLE_RESPONSE_INVALID',status:200},{code:'GOOGLE_UNAVAILABLE',status:403}]){
  const h=await setup(t,{social:true,profileError});if(!h)return;
  await h.waitFor(()=>h.w.document.querySelector('[role="alert"]'),'actionable profile error');
  assert.equal(h.dashboard(),null);assert.equal(h.loading(),null);assert.equal(h.state.logouts,0);
  assert.equal(h.delays().includes(3000),false);assert.equal(h.state.profileCalls,1);
  const retry=[...h.w.document.querySelectorAll('button')].find(el=>el.textContent==='Reintentar');
  assert.ok(retry);
  h.state.profileError=null;retry.click();
  await h.waitFor(()=>h.dashboard(),'manual profile recovery');
  assert.equal(h.state.profileCalls,2);assert.equal(h.state.logouts,0);
 }
});

test('an explicitly invalid social profile session returns to login',async t=>{
 const h=await setup(t,{social:true,profileError:{code:'GOOGLE_SESSION',status:401}});if(!h)return;
 await h.waitFor(()=>h.w.document.querySelector('[data-testid="login"]'),'invalid social session returns to login');
 assert.equal(h.state.logouts,1);assert.equal(h.dashboard(),null);assert.equal(h.delays().includes(3000),false);
});
