const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const {database,rpc,save,quote,expected,snapshot,rid,other,id,layout,floor,payload}=require('./helpers/floor-database.cjs');

const sql=fs.readFileSync(path.join(root,'45_CRUCES_HORARIO_CONFIRMADOS.sql'),'utf8');
const upgraded=async()=>{const db=await database();await db.exec(sql);return db;};
test('SQL 45 preserves rows, table structure, policies, roles and billing functions, including repeated installation',async()=>{const db=await database();try{
 await save(db,1);await quote(db,null);const before=await snapshot(db);
 const metadata=async()=>({columns:await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position"),policies:await db.query('select * from pg_policies order by tablename,policyname'),functions:await db.query("select proname,prosrc,proacl from pg_proc where proname in ('v2_account_billing','v2_floor_authorize','v2_effective_membership','v2_floor_assign','v2_save_quote_once','v2_link_reservation_quote') order by proname")});const schema=await metadata();
 await db.exec(sql);assert.deepEqual(await snapshot(db),before);assert.deepEqual(await metadata(),schema);await db.exec(sql);assert.deepEqual(await snapshot(db),before);assert.deepEqual(await metadata(),schema);
}finally{await db.close()}});
test('only an explicitly confirmed reservation save permits a time overlap and preserves the other reservation',async()=>{const db=await upgraded();try{
 await save(db,1,payload({deposit:100,notes:'Preserve'}));const before=await snapshot(db);await assert.rejects(save(db,2),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await save(db,2,payload({client_name:'Segundo cliente'}),floor(['t1'],{allow_conflict:true}));const after=await snapshot(db);assert.equal(after.reservations.length,2);assert.equal(after.seats.length,2);assert.deepEqual(after.reservations.find(r=>r.id===id(1)),before.reservations[0]);assert.deepEqual(after.seats.find(s=>s.reservation_id===id(1)),before.seats[0]);
 await assert.rejects(save(db,3),/FLOOR_CONFLICT/);const saved=await snapshot(db);await assert.rejects(save(db,3,payload({guests:5}),floor(['t1'],{allow_conflict:true})),/FLOOR_CAPACITY/);await assert.rejects(save(db,3,payload(),floor(['t1'],{allow_conflict:true,plan_revision:0})),/FLOOR_STALE/);assert.deepEqual(await snapshot(db),saved);
 const form=await rpc(db,'v2_floor_form',[rid,id(2),null]);assert.equal(form.selection.allow_conflict,undefined);await assert.rejects(save(db,2,payload({event_time:'14:00'}),{...form.selection,source:form.source},false),/FLOOR_CONFLICT/);await save(db,2,payload({event_time:'14:00'}),{...form.selection,source:form.source,allow_conflict:true},false);
}finally{await db.close()}});
test('quote conversion, quote edits and linking use fresh confirmations and remain atomic',async()=>{const db=await upgraded();try{
 await save(db,1);const q=await quote(db,null,floor(['t1'],{allow_conflict:true}));let before=await snapshot(db);
 await assert.rejects(rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 const r=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected({allow_conflict:true})]);assert.equal(r.quote_id,q.id);let form=await rpc(db,'v2_floor_form',[rid,null,q.id]);before=await snapshot(db);
 await assert.rejects(rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload(),[{name:'Changed',quantity:9}],null,{...form.selection,source:form.source}]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload(),[{name:'Changed',quantity:9}],null,{...form.selection,source:form.source,allow_conflict:true}]);
 await save(db,3,payload(),floor([]));const q2=await quote(db,null);before=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_link_quote',[rid,id(3),q2.id]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await rpc(db,'v2_floor_link_quote_confirmed',[rid,id(3),q2.id]);form=await rpc(db,'v2_floor_form',[rid,id(3),null]);assert.deepEqual(form.selection.table_ids,['t1']);assert.equal((await snapshot(db)).reservations.length,3);
}finally{await db.close()}});
test('confirmation cannot bypass tenant, permission, revision or capacity validation',async()=>{const db=await upgraded();try{
 await save(db,1);const q=await quote(db,null),before=await snapshot(db);
 await assert.rejects(rpc(db,'v2_floor_convert_quote',[other,q.id,expected({allow_conflict:true})]),/FLOOR_ACCESS/);await assert.rejects(rpc(db,'v2_floor_link_quote_confirmed',[other,id(1),q.id]),/FLOOR_ACCESS/);
 await db.exec("set test.role='lectura'");await assert.rejects(save(db,2,payload(),floor(['t1'],{allow_conflict:true})),/FLOOR_ACCESS/);await assert.rejects(rpc(db,'v2_floor_assign_confirmed',[rid,id(1),1,1,'{t1}',null,120,'reserved','2026-09-30','13:00',4]),/FLOOR_ACCESS/);assert.deepEqual(await snapshot(db),before);
 await db.exec('set role authenticated');await assert.rejects(rpc(db,'v2_floor_transfer_confirmed',[rid,id(1),q.id,true]),/permission denied/);
}finally{await db.close()}});
function loadHelper(){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/floor-conflict-confirmation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});return module.exports;}
test('UI confirmation retries once, cancels without writing, does not bypass other errors and reports an old server',async()=>{const {saveWithFloorConfirmation:run}=loadHelper();let calls=[],prompts=0;const write=async yes=>{calls.push(yes);return yes?{data:'saved',error:null}:{data:null,error:{message:'FLOOR_CONFLICT'}}};
 assert.equal((await run(write,async()=>{prompts++;return true})).data,'saved');assert.deepEqual(calls,[false,true]);assert.equal(prompts,1);calls=[];assert.equal(await run(write,async()=>false),null);assert.deepEqual(calls,[false]);calls=[];await run(write,async()=>{throw Error('Already confirmed')},true);assert.deepEqual(calls,[true]);
 const failure=await run(async()=>({data:null,error:{message:'FLOOR_STALE'}}),async()=>{throw Error('Not an exception')});assert.equal(failure.error.message,'FLOOR_STALE');
 const old=await run(async()=>({data:null,error:{message:'FLOOR_CONFLICT'}}),async()=>true);assert.equal(old.error.message,'FLOOR_OVERRIDE_REQUIRED');
});
