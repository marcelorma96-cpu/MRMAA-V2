const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const m = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/public-turnstile.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require,AbortController,setTimeout,clearTimeout,fetch});
const {verifyPublicTurnstile,PublicTurnstileError} = m.exports;
const valid = {success:true,hostname:'www.unomesa.com'};
function fixture(responses,extra={}) {
  const calls=[];
  const options={secret:'  private-fixture\n',siteKey:'public-fixture',token:'token-fixture',hostname:'www.unomesa.com',...extra,fetchImpl:async(url,init)=>{
    calls.push({url,init});const reply=responses[Math.min(calls.length-1,responses.length-1)];
    if(reply instanceof Error)throw reply;
    return typeof reply==='function'?reply(init):Response.json(reply.data??valid,{status:reply.status??200});
  }};
  return {calls,run:()=>verifyPublicTurnstile(options)};
}
test('valid validation trims secret and sends uncached JSON to Siteverify',async()=>{
  const f=fixture([{}]);await f.run();assert.equal(f.calls.length,1);
  const {url,init}=f.calls[0];assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(init.headers['Content-Type'],'application/json');assert.equal(init.cache,'no-store');
  const body=JSON.parse(init.body);assert.equal(body.secret,'private-fixture');assert.equal(body.response,'token-fixture');assert.match(body.idempotency_key,/^[a-f0-9-]{36}$/);
});
test('HTTP 400 invalid secret preserves provider reason instead of losing it',async()=>{
  const f=fixture([{status:400,data:{success:false,'error-codes':['invalid-input-secret','private-fixture']}}]);
  await assert.rejects(f.run(),e=>{assert.equal(e.status,503);assert.equal(e.reason,'invalid-secret');assert.equal(e.httpStatus,400);assert.equal(e.providerCodes.join(','),'invalid-input-secret');assert(!JSON.stringify(e.diagnostic()).includes('private-fixture'));return true});assert.equal(f.calls.length,1);
});
test('missing or accidentally duplicated public key fails closed before calling provider',async()=>{
  for(const [secret,reason] of [['','missing-secret'],['public-fixture','site-key-used-as-secret']]){
    const f=fixture([],{secret});await assert.rejects(f.run(),e=>e.status===503&&e.reason===reason);assert.equal(f.calls.length,0);
  }
});
test('unconfigured installations preserve behavior; blank/oversized tokens cannot bypass configured validation',async()=>{
  const disabled=fixture([],{secret:'',siteKey:''});await disabled.run();assert.equal(disabled.calls.length,0);
  for(const token of ['',null,{},'x'.repeat(2049)]){const f=fixture([],{token});await assert.rejects(f.run(),e=>e.status===400);assert.equal(f.calls.length,0)}
});
test('single-use or expired tokens are rejected without automatic replay',async()=>{
  for(const status of [200,400]){const f=fixture([{status,data:{success:false,'error-codes':['timeout-or-duplicate']}}]);await assert.rejects(f.run(),e=>e.status===400&&e.reason==='token-rejected');assert.equal(f.calls.length,1)}
});
test('transient provider failure retries exactly once using identical idempotency key and token',async()=>{
  for(const reply of [{status:503},{status:429},{data:{success:false,'error-codes':['internal-error']}},new TypeError('network details token-fixture')]){
    const f=fixture([reply,{}]);await f.run();assert.equal(f.calls.length,2);assert.equal(f.calls[0].init.body,f.calls[1].init.body);
  }
});
test('persistent provider failures stop after two attempts',async()=>{
  const f=fixture([{status:503}]);await assert.rejects(f.run(),e=>e.status===503&&e.attempts===2);assert.equal(f.calls.length,2);
});
test('network diagnostics do not leak exception text or credentials',async()=>{
  const err=new TypeError('private-fixture token-fixture guest@example.com');err.cause={code:'ECONNRESET'};
  const f=fixture([err]);await assert.rejects(f.run(),e=>{assert.equal(e.reason,'verification-network');assert.equal(e.networkCode,'ECONNRESET');assert(!JSON.stringify(e).includes('fixture'));return true});
});
test('timeout is bounded and cannot authorize intake',async()=>{
  const f=fixture([init=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true}))],{timeoutMs:5});
  await assert.rejects(f.run(),e=>e.reason==='verification-timeout'&&e.attempts===2);
});
test('success must be boolean true with matching hostname',async()=>{
  for(const data of [{success:true,hostname:'other.test'},{success:true},{success:'true',hostname:'www.unomesa.com'},{success:false}]){
    const f=fixture([{data}]);await assert.rejects(f.run(),PublicTurnstileError);
  }
});
test('HTML/non-JSON upstream and malformed requests have distinct bounded diagnostics',async()=>{
  const f=fixture([()=>new Response('<html>private-fixture</html>',{status:403})]);await assert.rejects(f.run(),e=>e.reason==='provider-http-error'&&e.httpStatus===403);
  const b=fixture([{status:400,data:{success:false,'error-codes':['bad-request']}}]);await assert.rejects(b.run(),e=>e.reason==='provider-bad-request');
});
