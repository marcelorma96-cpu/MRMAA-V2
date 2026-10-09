const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const backend='https://fixture.supabase.co';
const authorize=()=>`${backend}/auth/v1/authorize?provider=google&code_challenge=${'A'.repeat(43)}&code_challenge_method=s256&redirect_to=https%3A%2F%2Fwww.unomesa.com%2Fauth%2Fgoogle`;
function setup(native=false){
 const target=new EventTarget(),sent=[],navigations=[],timers=new Map();let timer=0;
 Object.assign(target,{location:{assign:url=>navigations.push(url)},setTimeout:fn=>{timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id)});
 if(native)Object.assign(target,{__unomesaNativeGoogle:1,webkit:{messageHandlers:{unomesa:{postMessage:body=>sent.push(body)}}}});
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/native-google.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window:target,URL,crypto:require('node:crypto').webcrypto,process:{env:{NEXT_PUBLIC_SUPABASE_URL:backend}},Error,Promise});
 return{...exports,target,sent,navigations,timers,event:(status,requestId)=>target.dispatchEvent(new CustomEvent('unomesa:google-auth',{detail:{status,requestId}}))};
}
test('Google handoff only accepts this backend, Google and unambiguous S256 PKCE',()=>{
 const x=setup(),valid=authorize();assert.equal(x.validGoogleAuthorizationURL(valid,backend),true);
 for(const url of [valid.replace('https:','http:'),valid.replace('fixture.supabase.co','outside.example'),valid.replace('fixture.supabase.co','fixture.supabase.co.outside.example'),valid.replace('https://','https://user:pass@'),valid+'#access_token=x',valid+'&provider=google',valid+'&code_challenge=B',valid.replace('s256','plain'),valid.replace('provider=google','provider=github'),valid.replace('/authorize','/token')])assert.equal(x.validGoogleAuthorizationURL(url,backend),false,url);
});
test('browser retains normal OAuth navigation',async()=>{const x=setup();await x.launchGoogleAuthorization(authorize());assert.deepEqual(x.navigations,[authorize()]);});
test('native handoff stays in app, acknowledges only its own request, and cleans listeners',async()=>{
 const x=setup(true),job=x.launchGoogleAuthorization(authorize());assert.equal(x.sent.length,1);assert.equal(x.sent[0].type,'googleSignIn');assert.equal(x.navigations.length,0);
 x.event('started','unrelated');assert.equal(x.timers.size,1);x.event('started',x.sent[0].requestId);await job;assert.equal(x.timers.size,0);assert.equal(x.navigations.length,0);
});
test('native bridge failure and timeout never fall back to Safari',async()=>{
 const missing=setup(true);delete missing.target.webkit;await assert.rejects(missing.launchGoogleAuthorization(authorize()));assert.equal(missing.navigations.length,0);
 const x=setup(true),job=x.launchGoogleAuthorization(authorize());x.event('failed',x.sent[0].requestId);await assert.rejects(job);assert.equal(x.navigations.length,0);
 const y=setup(true),timeout=y.launchGoogleAuthorization(authorize());[...y.timers.values()][0]();await assert.rejects(timeout);assert.equal(y.navigations.length,0);assert.equal(y.timers.size,0);
});
test('invalid URL is rejected before messaging the native app',async()=>{const x=setup(true);await assert.rejects(x.launchGoogleAuthorization('https://outside.example'));assert.equal(x.sent.length,0);assert.equal(x.navigations.length,0)});
