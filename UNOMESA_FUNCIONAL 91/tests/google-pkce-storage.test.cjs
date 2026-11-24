const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function memory(){const o={};for(const [name,fn] of Object.entries({getItem:k=>o[k]??null,setItem:(k,v)=>o[k]=String(v),removeItem:k=>delete o[k],clear:()=>{for(const k of Object.keys(o))delete o[k]}}))Object.defineProperty(o,name,{value:fn});return o}
function setup(native=true){
 const localStorage=memory(),sessionStorage=memory();let now=1000000;
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/google-pkce-storage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,localStorage,sessionStorage,navigator:{userAgent:native?'UnoMesa-iOS/1.0.13':'Mozilla/5.0'},Date:{now:()=>now}});
 return {...exports,localStorage,sessionStorage,advance:ms=>now+=ms};
}
const key='unomesa-google-oauth-flow-1234567890abcdef1234567890abcdef-code-verifier';
test('only native PKCE survives destruction of sessionStorage; tokens do not',()=>{
 const x=setup();x.googlePKCEStorage.setItem(key,'synthetic-verifier');x.googlePKCEStorage.setItem('unomesa-google-oauth','synthetic-tokens');
 assert(!JSON.stringify(x.localStorage).includes('synthetic-tokens'));x.sessionStorage.clear();assert.equal(x.googlePKCEStorage.getItem(key),'synthetic-verifier');assert.equal(x.googlePKCEStorage.getItem('unomesa-google-oauth'),null);
});
test('native verifier expires, completed/canceled attempts clear it, unrelated credentials survive',()=>{
 const x=setup();x.googlePKCEStorage.setItem(key,'synthetic-verifier');x.advance(900001);assert.equal(x.googlePKCEStorage.getItem(key),null);assert.equal(Object.keys(x.localStorage).length,0);
 x.localStorage.setItem('unomesa-app:session','keep');x.googlePKCEStorage.setItem(key,'another-verifier');x.clearStoredGooglePKCE();assert.equal(x.googlePKCEStorage.getItem(key),null);assert.equal(x.localStorage.getItem('unomesa-app:session'),'keep');
});
test('ordinary web flow stays in its original tab and supports previous in-flight verifier',()=>{
 const web=setup(false);web.googlePKCEStorage.setItem(key,'web-verifier');assert.equal(Object.keys(web.localStorage).length,0);assert.equal(web.sessionStorage.getItem(key),'web-verifier');
 const old=setup();old.sessionStorage.setItem(key,'old-verifier');assert.equal(old.googlePKCEStorage.getItem(key),'old-verifier');old.googlePKCEStorage.removeItem(key);assert.equal(old.googlePKCEStorage.getItem(key),null);
});
