const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,rpc,save,quote,expected,snapshot,rid,other,id,floor}=require('./helpers/floor-database.cjs');
const sql=fs.readFileSync(path.join(__dirname,'../49_SEGUIMIENTO_EVENTOS.sql'),'utf8');
const read=(db,kind,event)=>rpc(db,'v2_event_read',[rid,kind,event]);
const steps=(db,kind,event)=>rpc(db,'v2_event_add_steps',[rid,kind,event,false]);
const task=(db,kind,event,taskId,revision,payload)=>rpc(db,'v2_event_save_task',[rid,kind,event,taskId,revision,payload]);
test('event follow-up: additive migration, real quote/reservation flows, access and conflicts',async t=>{
 const db=await database();
 try{
  const q=await quote(db,null,floor([]));await save(db,1,undefined,floor([]));
  let before=await snapshot(db);
  const structure=()=>db.query("select table_name,column_name,data_type from information_schema.columns where table_name like 'v2_%' and table_name not like 'v2_event_%' order by table_name,ordinal_position");
  const functions=()=>db.query("select proname,prosrc,prosecdef,proacl::text from pg_proc where proname like 'v2_%' and proname not like 'v2_event_%' order by proname");
  const columns=await structure(),funcs=await functions();
  await t.test('install and reinstall preserve all original records, columns and RPCs',async()=>{
   await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(db),before);assert.deepEqual(await structure(),columns);assert.deepEqual(await functions(),funcs);
   assert.deepEqual((await read(db,'quote',q.id)).tasks,[]);assert.deepEqual(await snapshot(db),before);
  });
  let baseTasks,converted;
  await t.test('template is idempotent; private notes and amounts remain separate',async()=>{
   baseTasks=(await steps(db,'quote',q.id)).tasks;assert.equal(baseTasks.length,5);await steps(db,'quote',q.id);assert.equal((await read(db,'quote',q.id)).tasks.length,5);
   const x=baseTasks[1];await task(db,'quote',q.id,x.id,x.revision,{...x,status:'done',assignee:'María',notes:'Confirmado por llamada. NO exportar.',due_date:'2026-10-20'});
   assert.deepEqual(await snapshot(db),before);
  });
  await t.test('real conversion shares IDs; reservation edits are visible from quote',async()=>{
   converted=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]);const after=await snapshot(db);
   const data=await read(db,'reservation',converted.id);assert.deepEqual(data.tasks.map(x=>x.id),baseTasks.map(x=>x.id));assert.equal(data.tasks[1].notes,'Confirmado por llamada. NO exportar.');
   const x=data.tasks[2];await task(db,'reservation',converted.id,x.id,x.revision,{...x,status:'waiting',notes:'Menú vegetariano',assignee:'Ana'});
   assert.equal((await read(db,'quote',q.id)).tasks[2].status,'waiting');assert.deepEqual(await snapshot(db),after);
  });
  await t.test('real linking combines both sets; unlink and trash/restore retain task origins',async()=>{
   const separate=await task(db,'reservation',id(1),id(80),0,{title:'Acordar montaje',notes:'Plano aprobado'});
   const q2=await quote(db,null,floor([]));await steps(db,'quote',q2.id);
   await rpc(db,'v2_floor_link_quote',[rid,id(1),q2.id]);assert.equal((await read(db,'reservation',id(1))).tasks.length,6);assert.equal((await read(db,'quote',q2.id)).tasks.length,6);
   await steps(db,'reservation',id(1));assert.equal((await read(db,'quote',q2.id)).tasks.length,6);
   await db.query('update v2_reservations set quote_id=null where id=$1',[id(1)]);
   assert.deepEqual((await read(db,'reservation',id(1))).tasks.map(t=>t.id),[separate.id]);assert.equal((await read(db,'quote',q2.id)).tasks.length,5);
   await db.query('update v2_reservations set deleted_at=now() where id=$1',[id(1)]);await assert.rejects(read(db,'reservation',id(1)),/EVENT_NOT_FOUND/);
   assert.ok(!(await rpc(db,'v2_event_inbox',[rid,0])).rows.some(t=>t.id===separate.id));
   await db.query('update v2_reservations set deleted_at=null where id=$1',[id(1)]);assert.equal((await read(db,'reservation',id(1))).tasks[0].notes,'Plano aprobado');
  });
  await t.test('stale writes rejected; retries never duplicate or overwrite tasks',async()=>{
   const x=(await read(db,'quote',q.id)).tasks[0];await task(db,'quote',q.id,x.id,x.revision,{...x,notes:'Actualización A'});
   await assert.rejects(task(db,'reservation',converted.id,x.id,x.revision,{...x,notes:'Actualización B'}),/EVENT_STALE/);
   assert.equal((await read(db,'quote',q.id)).tasks[0].notes,'Actualización A');
   const a=await task(db,'reservation',converted.id,id(81),0,{title:'Llamar al cliente'});const b=await task(db,'reservation',converted.id,id(81),0,{title:'No debe sobrescribir'});assert.equal(a.id,b.id);assert.equal(b.title,'Llamar al cliente');
   await assert.rejects(task(db,'reservation',id(1),x.id,0,{title:'Evento incorrecto'}),/EVENT_NOT_FOUND/);
  });
  await t.test('cross-tenant, anonymous, expired, read-only and direct table access are rejected',async()=>{
   await db.query('insert into v2_quotes(id,restaurant_id,client_name) values($1,$2,$3)',[id(90),other,'Privado']);
   await assert.rejects(rpc(db,'v2_event_read',[other,'quote',id(90)]),/EVENT_ACCESS/);await assert.rejects(read(db,'quote',id(90)),/EVENT_NOT_FOUND/);
   await db.exec("set test.role='lectura'");await read(db,'quote',q.id);await assert.rejects(steps(db,'quote',q.id),/EVENT_ACCESS/);await assert.rejects(task(db,'quote',q.id,id(85),0,{title:'No'}),/EVENT_ACCESS/);
   await db.exec("set test.role='operacion'");await task(db,'quote',q.id,id(85),0,{title:'Operación permitida'});
   await db.exec("create or replace function v2_account_billing(p uuid) returns jsonb language sql as $$select jsonb_build_object('can_write',false)$$");await read(db,'quote',q.id);await assert.rejects(steps(db,'quote',q.id),/EVENT_READ_ONLY/);
   await db.exec('set role authenticated');await read(db,'quote',q.id);await assert.rejects(db.query('select * from v2_event_tasks'),/permission denied/);await assert.rejects(rpc(db,'v2_event_context',[rid,'quote',q.id]),/permission denied/);await db.exec('reset role');
   await db.exec('set role anon');await assert.rejects(read(db,'quote',q.id),/permission denied/);await db.exec('reset role');
   await db.exec('create or replace function v2_session_alive() returns boolean language sql as $$select false$$');await assert.rejects(read(db,'quote',q.id),/EVENT_ACCESS/);
  });
 }finally{await db.close();}
});
