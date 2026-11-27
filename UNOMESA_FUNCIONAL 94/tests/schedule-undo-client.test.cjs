require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const undo=require('../lib/schedule-undo.ts');
const row=(patch={})=>({id:'row-1',employee_id:'employee-1',work_date:'2026-11-27',area_id:'area-1',shift_id:'shift-1',entry_type:'work',color:null,break_start:'12:00:00',break_end:'13:00:00',notes:'Keep this note',...patch});
const change={before:row(),after:row({notes:'Changed'})};
const action={id:'action-1',count:1,label:'edit'};
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('schedule snapshots exclude tenant/metadata, normalize minute times and do not mutate source',()=>{
 const before=row({restaurant_id:'tenant',created_at:'2026-01-01',color:undefined,break_start:'12:00'});
 const normalized=undo.normalizeSchedule(before);
 assert.equal(normalized.break_start,'12:00:00');assert.equal(normalized.color,null);
 assert.equal(normalized.restaurant_id,undefined);assert.equal(normalized.created_at,undefined);
 assert.equal(before.break_start,'12:00');
 const {id,...payload}=before;
 assert.deepEqual(undo.scheduleChanges([payload],[row()]),[]);
});
test('upsert changes preserve existing IDs, allocate only new rows and reject duplicate targets or excess',()=>{
 let created=0;const make=()=>`new-${++created}`;
 const {id,...first}=row({notes:'Updated'}),second={...first,work_date:'2026-11-28'};
 const changes=undo.scheduleChanges([first,second],[row()],make);
 assert.equal(changes[0].before.id,'row-1');assert.equal(changes[0].after.id,'row-1');
 assert.equal(changes[1].before,null);assert.equal(changes[1].after.id,'new-1');assert.equal(created,1);
 assert.throws(()=>undo.scheduleChanges([first,first],[row()],make),/repetidas/);
 assert.throws(()=>undo.scheduleChanges(Array(5001).fill(first),[],make),/5000/);
});
test('grid edits restore distinct originals, clear work-only fields and keep move order and row identity',()=>{
 const employees=[{id:'employee-1',area_id:'area-1'},{id:'employee-2',area_id:'area-2'}];
 const ops=[row({id:'b',work_date:'2026-11-28'}),row()].map(expected=>({employee_id:expected.employee_id,work_date:expected.work_date,expected,to:{employee_id:'employee-1',work_date:expected.work_date}}));
 const changes=undo.scheduleGridChanges('edit',ops,{entry_type:'rest'},employees);
 assert.equal(changes[0].before.shift_id,'shift-1');assert.equal(changes[0].after.shift_id,null);
 assert.equal(changes[0].after.break_start,null);assert.equal(changes[0].after.break_end,null);assert.equal(changes[0].after.notes,'Keep this note');
 const move=undo.scheduleGridChanges('move',ops.map(op=>({...op,to:{employee_id:'employee-2',work_date:op.work_date}})),{},employees);
 assert.deepEqual(move.map(c=>c.after.id),['b','row-1']);assert(move.every(c=>c.after.area_id==='area-2'));
 const same=undo.scheduleGridChanges('move',[{...ops[1],to:{employee_id:'employee-1',work_date:'2026-11-29'}}],{},[{id:'employee-1',area_id:'new-area'}]);
 assert.equal(same[0].after.area_id,'area-1');
 const empty={employee_id:'employee-1',work_date:'2026-11-30',expected:null,to:{employee_id:'employee-1',work_date:'2026-11-30'}};
 assert.throws(()=>undo.scheduleGridChanges('edit',[empty],{notes:'note'},employees),/asignación/);
 const created=undo.scheduleGridChanges('edit',[empty],{entry_type:'vacation'},employees,()=> 'new-row');
 assert.equal(created[0].after.id,'new-row');assert.equal(created[0].after.area_id,'area-1');
});
test('network retry uses exactly the same UUID and content and cannot duplicate a committed save',async()=>{
 const calls=[];let saved=0;
 const transport=undo.createScheduleUndoTransport({rpc:async(name,args)=>{calls.push({name,args:structuredClone(args)});if(calls.length===1){saved++;throw new TypeError('Failed to fetch')}return{data:action,error:null}}},'restaurant-a',()=> 'request-a');
 assert.deepEqual(await transport.apply([change],'edit'),action);
 assert.equal(saved,1);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 assert.equal(calls[0].args.p_restaurant,'restaurant-a');assert.equal(calls[0].args.p_request,'request-a');assert.equal(transport.hasPending(),false);
});
test('unresolved request blocks a different operation until recovery is reviewed',async()=>{
 const calls=[];let offline=true;
 const transport=undo.createScheduleUndoTransport({rpc:async(name,args)=>{calls.push({name,args:structuredClone(args)});if(offline)throw new TypeError('Network error');return{data:action,error:null}}},'restaurant-a',()=> 'request-a');
 await assert.rejects(transport.apply([change],'edit'),/Network/);assert.equal(transport.hasPending(),true);
 offline=false;
 await assert.rejects(transport.apply([{before:row(),after:row({notes:'Different request'})}],'edit'),error=>error instanceof undo.ScheduleRecoveryError&&error.receipt.id==='action-1');
 assert.equal(calls.length,3);assert.deepEqual(calls[2],calls[0]);assert.equal(transport.hasPending(),false);
});
test('definitive conflict is never retried, zero-change keeps history and transport is serial',async()=>{
 let count=0;const transport=undo.createScheduleUndoTransport({rpc:async()=>{count++;return{data:null,error:{code:'40001',message:'SCHEDULE_CHANGED'}}}},'restaurant-a',()=> 'id');
 await assert.rejects(transport.apply([change],'edit'),e=>e.code==='40001');assert.equal(count,1);assert.equal(transport.hasPending(),false);
 assert.deepEqual(await transport.apply([],'assign'),{id:null,count:0,label:'assign'});assert.equal(count,1);
 const gate=defer(),serial=undo.createScheduleUndoTransport({rpc:()=>gate.promise},'restaurant-a',()=> 'id');
 const first=serial.apply([change],'edit');await assert.rejects(serial.undo('action-1'),/SCHEDULE_BUSY/);
 gate.resolve({data:action,error:null});await first;
});
test('latest action is tenant-scoped and ignores already undone receipts',async()=>{
 const calls=[];const transport=undo.createScheduleUndoTransport({rpc:async(name,args)=>{calls.push({name,args});return{data:{...action,undone:true},error:null}}},'restaurant-b');
 assert.equal(await transport.last(),null);assert.deepEqual(calls[0],{name:'v2_last_schedule_change',args:{p_restaurant:'restaurant-b'}});
 assert.match(undo.scheduleUndoMessage({code:'PGRST202'},false),/actualización 72/);
 assert.match(undo.scheduleUndoMessage({code:'40001',message:'SCHEDULE_UNDO_CHANGED'},true),/nothing was overwritten/);
 assert.match(undo.scheduleUndoMessage({code:'40P01',message:'deadlock detected'},false),/Actualiza/);
});

function hookHarness(lastRpc) {
 const state=[],refs=[],effects=[],pendingEffects=[];let cursor=0,listener,authUser='user-a';
 const rpcCalls=[];const client={rpc(name,args){rpcCalls.push({name,args});return lastRpc(name,args)},auth:{getSession:async()=>({data:{session:{user:{id:authUser}}},error:null}),onAuthStateChange(callback){listener=callback;return{data:{subscription:{unsubscribe(){listener=null}}}}}}};
 const React={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next}]},useRef(value){const i=cursor++;return refs[i]||(refs[i]={current:value})},useCallback(fn){cursor++;return fn},useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j]))pendingEffects.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()}})}};
 const modules={'react':React,'@/lib/supabase':{supabase:client,SESSION_SIGN_OUT_EVENT:'signout',isSigningOut:()=>false},'@/lib/permissions':{requirePermission:async()=>{},ACCESS_DENIED:'Denied'},'@/lib/user-message':{userMessage:e=>typeof e==='string'?e:e.message},'@/lib/schedule-undo':undo};
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../components/use-schedule-undo.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,console,Promise,Error,require:name=>modules[name]||require(name)});
 let props={restaurantId:'restaurant-a',enabled:true,en:false,onChanged:async()=>{}};
 return {render(next={}){props={...props,...next};cursor=0;const result=module.exports.useScheduleUndo(props);while(pendingEffects.length)pendingEffects.shift()();return result},signIn(user){authUser=user;listener?.('SIGNED_IN',{user:{id:user}})},rpcCalls};
}
test('late latest-action responses cannot leak into another restaurant or user',async()=>{
 const pending=[];const harness=hookHarness((name,args)=>{const request=defer();pending.push({name,args,...request});return request.promise});
 harness.render();await tick();assert.equal(pending.length,1);
 harness.render({restaurantId:'restaurant-b'});await tick();assert.equal(pending.length,2);
 pending[1].resolve({data:{...action,id:'action-b'},error:null});await tick();assert.equal(harness.render().last.id,'action-b');
 pending[0].resolve({data:{...action,id:'action-a'},error:null});await tick();assert.equal(harness.render().last.id,'action-b');
 harness.signIn('user-b');await tick();assert.equal(harness.render().last,null);assert.equal(pending.length,3);
 pending[2].resolve({data:{...action,id:'other-user-action'},error:null});await tick();assert.equal(harness.render().last.id,'other-user-action');
});
test('a committed old-scope mutation never publishes its receipt in the new scope',async()=>{
 const gate=defer();const harness=hookHarness((name,args)=>name==='v2_apply_schedule_change'?gate.promise:Promise.resolve({data:null,error:null}));
 harness.render();await tick();const first=harness.render();assert.equal(first.ready,true);
 const saving=first.apply([change],'edit');await tick();
 harness.render({restaurantId:'restaurant-b'});await tick();
 gate.resolve({data:action,error:null});await assert.rejects(saving,/sesión o restaurante/);
 assert.equal(harness.render().last,null);
});
test('an idempotent response for an already undone action cannot reactivate Undo or masquerade as a new save',async()=>{
 const harness=hookHarness(name=>Promise.resolve({data:name==='v2_apply_schedule_change'?{...action,undone:true}:null,error:null}));
 harness.render();await tick();
 await assert.rejects(harness.render().apply([change],'edit'),/recuperó la acción anterior/);
 await tick();const result=harness.render();assert.equal(result.last,null);assert.match(result.error,/recuperó/);
});
test('action validation and permission failures show recoverable product messages in both languages',()=>{
 for(const en of [false,true]){
  const invalid=undo.scheduleUndoMessage({code:'22023',message:'SCHEDULE_ACTION_INVALID'},en);
  const reused=undo.scheduleUndoMessage({code:'22023',message:'SCHEDULE_REQUEST_REUSED'},en);
  const denied=undo.scheduleUndoMessage({code:'42501',message:'backend policy detail'},en);
  const constraint=undo.scheduleUndoMessage({code:'23514',message:'constraint internal detail'},en);
  assert(![invalid,reused,denied,constraint].some(text=>/SCHEDULE_|backend|constraint/.test(text)));
  assert.match(invalid,en?/employees, dates and shifts/:/empleados, las fechas y los turnos/);
  assert.match(reused,en?/Reopen the calendar/:/Vuelve a abrir el calendario/);
  assert.match(denied,en?/administrator/:/administrador/);
 }
});
test('a delayed old-restaurant handler cannot start a new write in the selected restaurant',async()=>{
 const harness=hookHarness(()=>Promise.resolve({data:null,error:null}));
 harness.render();await tick();const old=harness.render();
 harness.render({restaurantId:'restaurant-b'});await tick();
 await assert.rejects(old.apply([change],'edit'),/sesión o restaurante/);
 assert.equal(harness.rpcCalls.filter(call=>call.name==='v2_apply_schedule_change').length,0);
});
