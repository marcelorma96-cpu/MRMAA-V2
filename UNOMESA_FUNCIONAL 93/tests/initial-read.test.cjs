const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/initial-read.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(extra={}){const context={exports:{},AbortController,DOMException,setTimeout,clearTimeout,...extra};vm.runInNewContext(code,context);return context.exports;}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('temporary startup failures retry sequentially and settle only with complete data',async()=>{
 const {initialRead}=load();let attempts=0,active=0,maxActive=0;
 const value=await initialRead(async()=>{maxActive=Math.max(maxActive,++active);await delay(6);active--;if(++attempts<3)throw {status:503};return {rows:['verified']};},new AbortController().signal,{delayMs:1,timeoutMs:40});
 assert.deepEqual(value,{rows:['verified']});assert.equal(attempts,3);assert.equal(maxActive,1);
});
test('a stalled attempt is cancelled and a late completion cannot win over its retry',async()=>{
 const {initialRead}=load();let attempts=0,firstSignal,late;
 const value=await initialRead(signal=>{if(++attempts===1){firstSignal=signal;return new Promise(resolve=>late=resolve);}return Promise.resolve('current');},new AbortController().signal,{delayMs:1,timeoutMs:5});
 assert.equal(value,'current');assert.equal(firstSignal.aborted,true);late('stale');assert.equal(attempts,2);
});
test('permission, expired-session and missing-function errors stay actionable',async()=>{
 const {initialRead}=load();
 for(const failure of [{code:'42501'},{kind:'revoked'},{kind:'invalid_session'},{code:'PGRST202'},{status:401}]){
  let attempts=0;await assert.rejects(initialRead(async()=>{attempts++;throw failure},new AbortController().signal,{delayMs:1}),error=>error===failure);assert.equal(attempts,1);
 }
});
test('unmount cancels a pending attempt and its scheduled retries',async()=>{
 const {initialRead}=load(),controller=new AbortController();let attempts=0,activeSignal;
 const pending=initialRead(signal=>{attempts++;activeSignal=signal;return new Promise(()=>{})},controller.signal,{delayMs:1,timeoutMs:100});
 await delay(1);controller.abort();await assert.rejects(pending);await delay(8);assert.equal(attempts,1);assert.equal(activeSignal.aborted,true);
 const next=new AbortController();let retries=0;const waiting=initialRead(async()=>{retries++;throw {status:503}},next.signal,{delayMs:20});await delay(2);next.abort();await assert.rejects(waiting);await delay(25);assert.equal(retries,1);
});
test('startup reads wait while hidden or offline and resume without losing the pending read',async()=>{
 const doc=new EventTarget(),win=new EventTarget();doc.visibilityState='hidden';win.navigator={onLine:true};
 const {initialRead}=load({document:doc,window:win});let attempts=0;
 const pending=initialRead(async()=>{attempts++;return 'ready'},new AbortController().signal,{delayMs:1});
 await delay(3);assert.equal(attempts,0);win.navigator.onLine=false;doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));await delay(3);assert.equal(attempts,0);win.navigator.onLine=true;win.dispatchEvent(new Event('online'));assert.equal(await pending,'ready');assert.equal(attempts,1);
});

test('the first verified list result reveals while newer queued refreshes are still running',async()=>{
 const effects=[],pending=[],results=[],reads=[];let refresh;
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('lib/list-query.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,AbortController,require:id=>{
  if(id==='react')return {useEffect:fn=>effects.push(fn),useRef:value=>({current:value}),useState:value=>[value,next=>pending.push(next)]};
  if(id==='./initial-read')return load();
  if(id==='@/components/pull-refresh')return {useRefreshTask:fn=>{refresh=fn}};
  if(id==='@/components/presentation-loading')return {useModulePending:()=>{}};
  throw Error(id);
 }});
 module.exports.useListQuery({queryKey:'restaurant:today',version:'1',read:()=>new Promise(resolve=>reads.push(resolve)),onData:value=>results.push(value),onError:error=>{throw error},onLoading:()=>{}});
 const cleanups=effects.map(fn=>fn());await delay(1);assert.equal(reads.length,1);
 const refreshing=refresh();reads.shift()(['first verified page']);await delay(1);
 assert.deepEqual(results,[['first verified page']]);assert.equal(reads.length,1,'queued refresh is still pending');assert.equal(pending.at(-1),false,'first page must release startup without waiting for an empty refresh queue');
 const again=refresh();reads.shift()(['updated page']);await delay(1);assert.equal(reads.length,1);assert.equal(pending.at(-1),false);
 for(const cleanup of cleanups)cleanup?.();await Promise.all([refreshing,again]);
});

test('floor refresh invalidations coalesce without aborting a slow first snapshot; scope cleanup cancels it',async()=>{
 const module={exports:{}},source=ts.transpileModule(fs.readFileSync('lib/list-query.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,AbortController,require:()=>({})});
 const waiting=[],snapshots=[],signals=[];
 const queue=module.exports.createReadQueue({read:signal=>{signals.push(signal);return new Promise(resolve=>waiting.push(resolve))},onData:value=>snapshots.push(value),onError:error=>{throw error},onLoading:()=>{}});
 queue.refresh();for(let i=0;i<20;i++)queue.refresh();assert.equal(waiting.length,1);assert.equal(signals[0].aborted,false);
 waiting.shift()('first snapshot');await delay(1);assert.deepEqual(snapshots,['first snapshot']);assert.equal(waiting.length,1);assert.equal(signals[0].aborted,false);
 queue.stop();assert.equal(signals[1].aborted,true);waiting.shift()('old date late response');await delay(1);assert.deepEqual(snapshots,['first snapshot']);
});
