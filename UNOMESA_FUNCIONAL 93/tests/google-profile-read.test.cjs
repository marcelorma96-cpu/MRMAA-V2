const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

// Exercise the real request helper and cancellation boundary with transport
// fixtures. No token, account or network service outside this process is used.
function setup(){
 const root=process.env.UNOMESA_AUTH_TEST_ROOT||path.resolve(__dirname,'..');
 const options={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020};
 const source=fs.readFileSync(path.join(root,'components/google-registration.tsx'),'utf8');
 const parsed=ts.createSourceFile('google-registration.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const node=parsed.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text==='googleProfileRequest');
 assert.ok(node);
 const initial={exports:{},Promise,AbortController,DOMException,setTimeout,clearTimeout};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/initial-read.ts'),'utf8'),{compilerOptions:options}).outputText,initial);
 const state={session:{access_token:'fixture-only'},authError:null,sessionPromise:null,status:200,result:{state:'ready'},invalidJSON:false,calls:[]};
 const exports={};
 const context={exports,Error,Object,JSON,Promise,AbortController,DOMException,abortableRead:initial.exports.abortableRead,
  supabase:{auth:{getSession:()=>state.sessionPromise||Promise.resolve({data:{session:state.session},error:state.authError})}},
  fetch:async(url,options)=>{state.calls.push({url,options});return{ok:state.status>=200&&state.status<300,status:state.status,json:async()=>{if(state.invalidJSON)throw Error('Invalid JSON');return state.result}}}
 };
 vm.runInNewContext(ts.transpileModule(source.slice(node.getStart(parsed),node.end),{compilerOptions:options}).outputText,context);
 return{state,request:exports.googleProfileRequest};
}

test('profile reads preserve authentication failures and explicit absence of a session',async()=>{
 const h=setup(),network=Object.assign(new Error('network failed'),{name:'AuthRetryableFetchError',status:0});
 h.state.authError=network;
 await assert.rejects(h.request(),error=>error===network);assert.equal(h.state.calls.length,0);
 h.state.authError=null;h.state.session=null;
 await assert.rejects(h.request(),error=>error.code==='GOOGLE_SESSION'&&error.status===401);assert.equal(h.state.calls.length,0);
});

test('profile HTTP failures retain response status even when the body is invalid JSON',async()=>{
 const h=setup();h.state.status=503;h.state.invalidJSON=true;
 await assert.rejects(h.request(),error=>error.code==='GOOGLE_UNAVAILABLE'&&error.status===503);
 h.state.status=403;h.state.invalidJSON=false;h.state.result={code:'GOOGLE_SECURITY'};
 await assert.rejects(h.request(),error=>error.code==='GOOGLE_SECURITY'&&error.status===403);
});

test('successful responses require a recognized profile state or explicit POST success',async()=>{
 const h=setup();
 for(const result of [null,{}, {state:'unexpected'}]){
  h.state.result=result;await assert.rejects(h.request(),error=>error.code==='GOOGLE_RESPONSE_INVALID'&&error.status===200);
 }
 h.state.result={state:'ready'};assert.equal((await h.request()).state,'ready');
 h.state.result={ok:false};await assert.rejects(h.request({accepted:true}),error=>error.code==='GOOGLE_RESPONSE_INVALID');
 h.state.result={ok:true,created:false};assert.equal((await h.request({accepted:true})).ok,true);
 assert.equal(h.state.calls.at(-1).options.method,'POST');
});

test('profile cancellation interrupts a pending session read and forwards the signal to fetch',async()=>{
 const h=setup(),controller=new AbortController();h.state.sessionPromise=new Promise(()=>{});
 const pending=h.request(undefined,controller.signal);controller.abort(new DOMException('Cancelled','AbortError'));
 await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(h.state.calls.length,0);
 const active=new AbortController();h.state.sessionPromise=null;
 await h.request(undefined,active.signal);assert.equal(h.state.calls[0].options.signal,active.signal);
});
