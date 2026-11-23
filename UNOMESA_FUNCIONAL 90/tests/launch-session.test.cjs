const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('lib/launch-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function open(storage=new Map(),clock={time:6000000},denied=false){
 const o={exports:{},Date:{now:()=>clock.time},Event:class{},window:{dispatchEvent(){},sessionStorage:{getItem:k=>{if(denied)throw Error();return storage.get(k)},setItem:(k,v)=>{if(denied)throw Error();storage.set(k,v)},removeItem:k=>storage.delete(k)}}};vm.runInNewContext(source,o);return o.exports;
}
test('a confirmed login survives one OAuth redirect, is scoped to its user, and cannot replay on reload',()=>{
 const stored=new Map(),a=open(stored);assert.equal(a.takeLoginOpening('u'),false);a.markLoginOpening('u');
 const dest=open(stored);assert.equal(dest.takeLoginOpening('another'),false);assert.equal(dest.takeLoginOpening('u'),true);
 assert.equal(open(stored).takeLoginOpening('u'),false);
});
test('sign-out cancels the pending opening; a fresh sign-in of the same account arms it again',()=>{
 const s=open();s.markLoginOpening('u');s.clearLoginOpening();assert.equal(s.takeLoginOpening('u'),false);s.markLoginOpening('u');assert.equal(s.takeLoginOpening('u'),true);
});
test('stale flags expire, and in-document login works when storage is unavailable',()=>{
 const clock={time:800},s=open(new Map(),clock);s.markLoginOpening('u');clock.time+=1800001;assert.equal(s.takeLoginOpening('u'),false);
 const local=open(new Map(),clock,true);local.markLoginOpening('u');assert.ok(local.takeLoginOpening('u'));assert.equal(local.takeLoginOpening('u'),false);
});
