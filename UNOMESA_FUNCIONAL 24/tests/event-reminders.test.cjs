const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleValue={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/event-reminders.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleValue,exports:moduleValue.exports,Error,Number,Set,require:name=>{if(name==='./local-date')return {localDateISO:()=> '2026-10-09'};throw Error(name)},crypto:require('node:crypto').webcrypto});
const api=moduleValue.exports,target={kind:'quote',id:'q1'},base={id:'t1',quote_id:'q1',reservation_id:null,title:'Falta confirmar menú',status:'waiting',category:'menu',assignee:'Ana',due_date:'2026-10-20',notes:'Acuerdo privado',revision:4,updated_at:'2026-10-08T10:00:00Z'};
function client(task=base){const calls=[];return{calls,rpc(name,args){calls.push({name,args});if(name==='v2_event_read')return Promise.resolve({data:{event:target,tasks:task?[task]:[]}});if(name==='v2_event_save_task')return Promise.resolve({data:args.p_payload});throw Error(name)}}}
test('editing the title preserves previous status, owner, due date and internal notes',async()=>{
 const c=client(),draft=api.pendingDraft(base);draft.title='  Confirmar menú vegetariano  ';await api.saveEventPending(c,'r1',target,draft);
 const args=c.calls[0].args;assert.equal(args.p_revision,4);assert.equal(args.p_restaurant_id,'r1');assert.equal(args.p_payload.title,'Confirmar menú vegetariano');
 for(const key of ['status','category','assignee','due_date','notes'])assert.equal(args.p_payload[key],base[key]);
 assert.equal(base.title,'Falta confirmar menú');
});
test('dismiss reads the current task, preserves metadata and changes only its state',async()=>{
 const c=client();await api.dismissEventPending(c,'r1',target,base.id,base.updated_at);
 assert.deepEqual(c.calls.map(x=>x.name),['v2_event_read','v2_event_save_task']);const p=c.calls[1].args;
 assert.equal(p.p_revision,4);assert.equal(p.p_payload.status,'not_needed');assert.equal(p.p_payload.notes,base.notes);assert.equal(p.p_payload.title,base.title);
});
test('a concurrent modification is never overwritten by dismissing a stale reminder',async()=>{
 const c=client({...base,updated_at:'2026-10-08T10:01:00Z',revision:5});await assert.rejects(api.dismissEventPending(c,'r1',target,base.id,base.updated_at),/EVENT_STALE/);assert.equal(c.calls.length,1);
 const done=client({...base,status:'done'});await api.dismissEventPending(done,'r1',target,base.id);assert.equal(done.calls.length,1);
 const missing=client(null);await assert.rejects(api.dismissEventPending(missing,'r1',target,base.id),/EVENT_NOT_FOUND/);assert.equal(missing.calls.length,1);
});
test('new manual pending items need only a title, keep one retry ID, and propagate permission/network failures',async()=>{
 const d=api.pendingDraft();assert.equal(d.revision,0);assert.equal(d.status,'pending');assert.equal(d.assignee,'');assert.equal(d.due_date,null);
 const c=client();await assert.rejects(api.saveEventPending(c,'r1',target,d),/EVENT_INPUT/);assert.equal(c.calls.length,0);
 d.title='Confirmar invitados';await api.saveEventPending(c,'r1',target,d);await api.saveEventPending(c,'r1',target,d);assert.equal(c.calls[0].args.p_task_id,c.calls[1].args.p_task_id);
 await assert.rejects(api.saveEventPending({rpc:async()=>({error:Error('EVENT_ACCESS')})},'r1',target,d),/EVENT_ACCESS/);
});
