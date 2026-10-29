const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,context){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{...context,module,exports:module.exports});return module.exports;}
function session(items=new Map(),id){const context={window:{__unomesaLaunchSession:id},document:{documentElement:{dataset:{}}},sessionStorage:{getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)}};return{context,api:load('lib/launch-session.ts',context)}}
test('completed presentation survives remount/reload but a new native process has a new launch',()=>{
 const values=new Map(),first=session(values,'native-A');assert.equal(first.api.launchCompleted(),false);first.api.completeLaunch();assert.equal(first.api.launchCompleted(),true);
 assert.equal(session(values,'native-A').api.launchCompleted(),true);assert.equal(session(values,'native-B').api.launchCompleted(),false);
 assert.equal(session().api.launchCompleted(),false);
});
test('web completion is tab-scoped; storage denial retains in-document completion',()=>{
 const values=new Map(),web=session(values);web.api.completeLaunch();assert.equal(session(values).api.launchCompleted(),true);assert.equal(session().api.launchCompleted(),false);
 const denied=session();denied.context.sessionStorage.getItem=()=>{throw Error('denied')};denied.context.sessionStorage.setItem=()=>{throw Error('denied')};assert.equal(denied.api.launchCompleted(),false);denied.api.completeLaunch();assert.equal(denied.api.launchCompleted(),true);
});
test('a recreated native view can skip artwork while retaining the access cover',()=>{
 const s=session();s.context.window.__unomesaLaunchFinished=true;assert.equal(s.api.launchCompleted(),true);
 const script=load('lib/entry-presentation.ts',{}).ENTRY_PRESENTATION_SCRIPT;
 vm.runInNewContext(script,{...s.context,location:{pathname:'/login'},localStorage:s.context.sessionStorage,URLSearchParams});
 assert.equal(s.context.document.documentElement.dataset.unomesaLaunchComplete,'true');assert.equal(s.context.document.documentElement.dataset.unomesaEntryPending,'true');
});
