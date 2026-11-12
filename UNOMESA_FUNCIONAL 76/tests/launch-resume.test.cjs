const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function harness({pending=false,completed=false,native=false}={}){
 const effects=[],states=[],refs=[],events=new Map(),jobs=new Map(),messages=[];let cursor=0,id=0;
 const schedule=fn=>{jobs.set(++id,fn);return id},cancel=id=>jobs.delete(id);
 const listen=(type,fn)=>{if(!events.has(type))events.set(type,new Set());events.get(type).add(fn)};
 const unlisten=(type,fn)=>events.get(type)?.delete(fn);
 const doc={visibilityState:'visible',documentElement:{dataset:{unomesaNativeLaunch:String(native)}}};
 const fakeReact={useState:value=>{const slot=cursor++;if(!(slot in states))states[slot]=value;return[states[slot],v=>states[slot]=v]},useRef:value=>{const slot=cursor++;return refs[slot]??(refs[slot]={current:value})},useEffect:fn=>effects.push(fn),useContext:()=>({pending})};
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(root+'/components/app-launch.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require:name=>name==='react'?fakeReact:name==='react/jsx-runtime'?require(name):name==='./app-context'?{useAppMode:()=>true}:name==='./presentation-loading'?{StartupLoadingContext:{},useStartupPending:()=>{}}:name==='@/lib/app-mode'?{nativeAppMessage:type=>messages.push(type)}:name==='@/lib/launch-session'?{launchCompleted:()=>completed,completeLaunch:()=>{completed=true}}:null,
  document:Object.assign(doc,{addEventListener:listen,removeEventListener:unlisten}),window:{addEventListener:listen,removeEventListener:unlisten,setTimeout:schedule},clearTimeout:cancel,requestAnimationFrame:schedule,cancelAnimationFrame:cancel,performance:{now:()=>100},innerWidth:393,innerHeight:852,matchMedia:()=>({matches:false})});
 module.exports.AppLaunch({enabled:true});effects.forEach(fn=>fn());
 return{phase:()=>states[0],messages,emit:type=>events.get(type)?.forEach(fn=>fn()),hide:()=>{doc.visibilityState='hidden';events.get('visibilitychange')?.forEach(fn=>fn())},step:()=>{const batch=[...jobs.values()];jobs.clear();batch.forEach(fn=>fn())}};
}
test('backgrounding during completed launch settles artwork; a warm return cannot replay it',()=>{
 const h=harness();assert.equal(h.phase(),'waiting');h.step();h.step();h.step();assert.equal(h.phase(),'leaving');
 h.hide();assert.equal(h.phase(),'done');h.emit('pageshow');h.step();assert.equal(h.phase(),'done');
});
test('BFCache pagehide settles a completed launch',()=>{
 const h=harness();h.step();h.step();h.step();h.emit('pagehide');assert.equal(h.phase(),'done');h.emit('pageshow');assert.equal(h.phase(),'done');
});
test('background/foreground does not bypass an access gate that is still pending',()=>{
 const h=harness({pending:true});h.hide();h.emit('pageshow');h.step();assert.equal(h.phase(),'waiting');assert.ok(!h.messages.includes('appContentReady'));
});
test('a warm remount suppresses artwork while still reporting pending access',()=>{
 const h=harness({pending:true,completed:true,native:true});assert.equal(h.phase(),'done');assert.deepEqual(h.messages,['appContentPending']);
});
