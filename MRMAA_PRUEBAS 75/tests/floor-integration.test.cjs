const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const {database,rpc,save,quote,expected,snapshot,rid,other,id,layout,floor,payload}=require('./helpers/floor-database.cjs');
test('SQL 44 is repeatable, preserves existing records, columns and original functions',async()=>{const db=await database();try{
 await save(db,1);await quote(db,null);
 const before=await snapshot(db),columns=await db.query("select table_name,column_name,data_type from information_schema.columns where table_name in ('v2_reservations','v2_quotes','v2_clients') order by table_name,ordinal_position"),funcs=await db.query("select proname,prosrc from pg_proc where proname in ('v2_save_quote_once','v2_save_reservation_quote','v2_link_reservation_quote') order by proname");
 await db.exec(fs.readFileSync(path.join(root,'44_PLANO_FORMULARIOS_COTIZACIONES.sql'),'utf8'));
 assert.deepEqual(await snapshot(db),before);assert.deepEqual(await db.query("select table_name,column_name,data_type from information_schema.columns where table_name in ('v2_reservations','v2_quotes','v2_clients') order by table_name,ordinal_position"),columns);assert.deepEqual(await db.query("select proname,prosrc from pg_proc where proname in ('v2_save_quote_once','v2_save_reservation_quote','v2_link_reservation_quote') order by proname"),funcs);
 assert.equal((await rpc(db,'v2_floor_read',[rid,'2026-09-30'])).integration_version,2);
}finally{await db.close()}});
test('reservation form saves event and seating atomically; conflicts/capacity roll back and money survives edits',async()=>{const db=await database();try{
 await save(db,1);let before=await snapshot(db);await assert.rejects(save(db,2),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await assert.rejects(save(db,2,payload({guests:5}),floor(['t2'])),/FLOOR_CAPACITY/);assert.deepEqual(await snapshot(db),before);
 await save(db,2,payload({event_time:'15:00'}));await db.exec(`update v2_reservations set total=500,subtotal=450,balance=400 where id='${id(2)}'`);
 const form=await rpc(db,'v2_floor_form',[rid,id(2),null]);before=await snapshot(db);
 await assert.rejects(save(db,2,payload({event_time:'14:00'}),{...form.selection,source:form.source},false),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 const updated=await save(db,2,payload({event_time:'16:00',total:0}),{...form.selection,source:form.source},false);assert.equal(updated.total,500);assert.equal(updated.balance,400);
 await assert.rejects(save(db,2,payload({event_time:'17:00'}),{...form.selection,source:form.source},false),/FLOOR_STALE/);
 await save(db,3,payload({event_time:null}),floor([]));assert.equal((await rpc(db,'v2_floor_form',[rid,id(3),null])).selection.revision,0);
}finally{await db.close()}});
test('quote proposals do not block; conversion transfers all tables and conflicting conversion rolls back',async()=>{const db=await database();try{
 const q=await quote(db,null,floor(['t1','t2'],{whole_area_id:'salon'}));assert.equal((await rpc(db,'v2_floor_read',[rid,'2026-09-30'])).seatings.length,0);
 const request=(await db.query('select request_id from v2_quotes where id=$1',[q.id])).rows[0].request_id;const prior=await snapshot(db);const replay=await rpc(db,'v2_floor_save_quote',[rid,null,request,payload(),[{name:'Menú',quantity:2}],null,floor(['t1','t2'],{whole_area_id:'salon'})]);assert.equal(replay.id,q.id);assert.deepEqual(await snapshot(db),prior);
 await save(db,1);const before=await snapshot(db);
 await assert.rejects(rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await save(db,1,payload({status:'cancelada'}),floor(['t1'],{revision:1}),false);
 const r=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]);assert.equal(r.quote_id,q.id);assert.equal(r.menu,'Menú × 2');
 const form=await rpc(db,'v2_floor_form',[rid,null,q.id]);assert.equal(form.proposal,false);assert.equal(form.reservation_id,r.id);assert.equal(form.selection.whole_area_id,'salon');assert.deepEqual(form.selection.table_ids,['t1','t2']);
 await assert.rejects(rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]),/FLOOR_ALREADY_SAVED/);
}finally{await db.close()}});
test('quote edits preserve item and event atomicity; linking uses proposal or keeps existing assigned tables',async()=>{const db=await database();try{
 await save(db,1);const q=await quote(db,null,floor(['t2']));await save(db,2,payload({event_time:'13:00'}),floor([]));
 await rpc(db,'v2_floor_link_quote',[rid,id(2),q.id]);let form=await rpc(db,'v2_floor_form',[rid,null,q.id]);assert.deepEqual(form.selection.table_ids,['t2']);
 const before=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload(),[{name:'Changed',quantity:9}],null,{...form.selection,table_ids:['t1'],source:form.source}]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 const q2=await quote(db,null,floor(['t2']));await rpc(db,'v2_floor_link_quote',[rid,id(1),q2.id]);form=await rpc(db,'v2_floor_form',[rid,null,q2.id]);assert.deepEqual(form.selection.table_ids,['t1']);
 await save(db,3,payload(),floor([]));const q3=await quote(db,null);const beforeLink=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_link_quote',[rid,id(3),q3.id]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),beforeLink);
 // Existing reservation -> new quote handles a scalar JSONB result, versus table result above.
 await save(db,4,payload({event_time:'18:00'}),floor(['t1']));form=await rpc(db,'v2_floor_form',[rid,id(4),null]);const created=await quote(db,null,{...form.selection,source:form.source},payload({event_time:'18:00'}),id(4));assert(created.id);assert.equal((await rpc(db,'v2_floor_form',[rid,null,created.id])).reservation_id,id(4));
}finally{await db.close()}});
test('proposal stale edits, cross-tenant references and read-only/direct access are rejected',async()=>{const db=await database();try{
 const q=await quote(db,null);const before=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload({client_name:'Overwrite'}),[],null,floor()]),/FLOOR_STALE/);assert.deepEqual(await snapshot(db),before);
 await assert.rejects(rpc(db,'v2_floor_convert_quote',[rid,q.id,expected({guests:5})]),/FLOOR_STALE/);
 await db.exec(`insert into v2_clients(id,restaurant_id) values('${id(20)}','${other}');insert into v2_reservation_areas values('${id(21)}','${other}');insert into v2_quotes(id,restaurant_id) values('${id(22)}','${other}');`);
 await assert.rejects(save(db,1,payload({client_id:id(20)})),/FLOOR_RESERVATION/);await assert.rejects(save(db,1,payload({area_id:id(21)})),/FLOOR_RESERVATION/);await assert.rejects(rpc(db,'v2_floor_form',[rid,null,id(22)]),/FLOOR_QUOTE/);
 await db.exec("set test.role='lectura'");await rpc(db,'v2_floor_form',[rid,null,q.id]);await assert.rejects(save(db,1),/FLOOR_ACCESS/);await assert.rejects(quote(db,null),/FLOOR_ACCESS/);await assert.rejects(rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]),/FLOOR_ACCESS/);await assert.rejects(rpc(db,'v2_floor_link_quote',[rid,id(1),q.id]),/FLOOR_ACCESS/);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from v2_floor_quote_plans'),/permission denied/);await assert.rejects(rpc(db,'v2_floor_selection',[rid,floor(),4]),/permission denied/);
}finally{await db.close()}});
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,Date,Set,Number,JSON,require:n=>load(n.replace('./',''))});return module.exports;}
test('table/day agenda includes sequential and overnight bookings; full-room markers honor finished/canceled events',()=>{
 const lib=load('floor-plan'),d=lib.demoFloor('2026-09-30');d.layout=layout;d.reservations=d.reservations.slice(0,1);d.seatings=d.seatings.slice(0,1);d.seatings[0].table_ids=['t1'];
 d.reservations.push({...d.reservations[0],id:'late',event_time:'16:00'},{...d.reservations[0],id:'night',event_date:'2026-09-29',event_time:'23:30'},{...d.reservations[0],id:'room',event_time:'19:00'});
 for(const r of d.reservations.slice(1))d.seatings.push({...d.seatings[0],reservation_id:r.id,source_date:r.event_date,source_time:r.event_time,whole_area_id:r.id==='room'?'salon':null});
 assert.deepEqual(Array.from(lib.floorDayBookings(d,'2026-09-30','t1'),b=>b.reservation.id),['night','demo-r1','late','room']);assert.equal(lib.floorDayBookings(d,'2026-09-30','t2').length,1);assert.equal(lib.floorAreaAvailability(d,'salon','2026-09-30','19:00',60).full,true);
 d.seatings.at(-1).service_status='finished';assert.equal(lib.floorAreaAvailability(d,'salon','2026-09-30','19:00',60).full,false);assert.equal(lib.floorDayBookings(d,'2026-09-30','t2').length,1);
 d.reservations.at(-1).status='cancelada';assert.equal(lib.floorDayBookings(d,'2026-09-30','t2').length,0);assert.equal(lib.floorEndTime('2026-09-30','23:30',120).time,'01:30');assert.equal(lib.floorEndTime('2026-09-30','23:30',120).nextDay,true);
});

test('shared room/table selection keeps both views consistent and retains legacy sizes',()=>{
 const lib=load('floor-plan'),d=lib.demoFloor('2026-09-30'),areas=[{id:id(30),name:'Salón principal'},{id:id(31),name:'Terraza'}];
 assert.equal(lib.floorEventArea({id:'old',name:'  SALON   PRINCIPAL '},areas).id,id(30));
 assert.equal(lib.floorEventArea({id:'old',name:'Other',eventAreaId:id(31)},areas).id,id(31));
 let s=lib.selectFloorArea(lib.defaultFloorSelection(4),d.layout,'salon',true);assert.equal(s.whole_area_id,'salon');assert.equal(s.table_ids.length,6);
 s=lib.toggleFloorTable(s,d.layout,'demo-t1');assert.equal(s.whole_area_id,null);assert.equal(s.table_ids.length,5);
 s=lib.selectFloorArea(s,d.layout,'terraza',true);assert.equal(s.whole_area_id,'terraza');assert.deepEqual(Array.from(s.table_ids),['demo-t7','demo-t8']);
 s=lib.toggleFloorTable(s,d.layout,'demo-t1');assert.deepEqual(Array.from(s.table_ids),['demo-t1']);assert.equal(lib.selectionArea(s,d.layout).id,'salon');assert.equal(s.plan_revision,4);
 assert.equal(lib.floorTableScale({}),1);assert.equal(lib.floorTableScale({size:40}),.4);assert.equal(lib.floorTableScale({size:NaN}),1);
});
test('existing SQL stores size and atomic area-only edits preserve other event fields',async()=>{const db=await database();try{
 await save(db,1,payload({deposit:100,notes:'Keep notes',menu:'Keep menu',phone:'555',area:'Previous'}));
 const before=(await db.query('select * from v2_reservations where id=$1',[id(1)])).rows[0];
 const next={...layout,areas:[{...layout.areas[0],eventAreaId:id(30)}],tables:layout.tables.map((t,i)=>({...t,size:i?100:40}))};
 await rpc(db,'v2_floor_save_layout',[rid,1,next]);const read=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.equal(read.layout.tables[0].size,40);assert.equal(read.layout.tables[0].seats,4);assert.deepEqual((await db.query('select * from v2_reservations where id=$1',[id(1)])).rows[0],before);
 await db.exec(`insert into v2_reservation_areas(id,restaurant_id) values('${id(30)}','${rid}')`);
 const f=await rpc(db,'v2_floor_form',[rid,id(1),null]);const result=await rpc(db,'v2_floor_save_reservation',[rid,id(1),false,{area:'Salón',area_id:id(30)},{...f.selection,source:f.source,table_ids:['t1','t2'],whole_area_id:'salon'}]);
 assert.equal(result.area,'Salón');assert.equal(result.area_id,id(30));for(const key of ['client_name','phone','notes','menu','status'])assert.equal(result[key],before[key]);for(const key of ['deposit','subtotal','total','balance'])assert.equal(Number(result[key]),Number(before[key]));
 const seat=(await rpc(db,'v2_floor_form',[rid,id(1),null])).selection;assert.equal(seat.whole_area_id,'salon');assert.deepEqual(seat.table_ids,['t1','t2']);
 const current=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_save_reservation',[rid,id(1),false,{area:'Wrong'},{...f.selection,source:f.source,table_ids:['t2']}]),/FLOOR_STALE/);assert.deepEqual(await snapshot(db),current);
}finally{await db.close()}});

test('quote-origin whole room changes to three tables and back through shared saved seating without rewriting event data',async()=>{const db=await database();try{
 const expanded={...layout,tables:[1,2,3,4].map(n=>({...layout.tables[0],id:'t'+n,name:'M'+n,x:15+n*15}))};
 await rpc(db,'v2_floor_save_layout',[rid,1,expanded]);
 const q=await quote(db,null,floor(['t1','t2','t3','t4'],{whole_area_id:'salon',plan_revision:2}));
 const r=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]);
 await db.exec(`update v2_reservations set total=500,subtotal=500,deposit=100,balance=400,notes='Keep allergy',menu='Keep menu' where id='${r.id}'`);
 const before=await snapshot(db),original=before.reservations.find(v=>v.id===r.id),stale=await rpc(db,'v2_floor_form',[rid,r.id,null]);
 const three={...stale.selection,source:stale.source,table_ids:['t1','t2','t3'],whole_area_id:null};
 await rpc(db,'v2_floor_save_reservation',[rid,r.id,false,{},three]);
 for(const args of [[rid,r.id,null],[rid,null,q.id]]){
  const form=await rpc(db,'v2_floor_form',args);assert.equal(form.selection.whole_area_id,null);assert.deepEqual(form.selection.table_ids,['t1','t2','t3']);assert.equal(form.reservation_id,r.id);
 }
 const day=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.deepEqual(day.seatings[0].table_ids,['t1','t2','t3']);assert.equal(day.seatings[0].whole_area_id,null);
 assert.deepEqual((await snapshot(db)).reservations.find(v=>v.id===r.id),original);
 for(const key of ['quotes','items','clients'])assert.deepEqual((await snapshot(db))[key],before[key]);
 await assert.rejects(rpc(db,'v2_floor_save_reservation',[rid,r.id,false,{},{...stale.selection,source:stale.source}]),/FLOOR_STALE/);
 const current=await rpc(db,'v2_floor_form',[rid,null,q.id]);
 await rpc(db,'v2_floor_save_reservation',[rid,r.id,false,{},{...current.selection,source:current.source,table_ids:['t1','t2','t3','t4'],whole_area_id:'salon'}]);
 assert.equal((await rpc(db,'v2_floor_form',[rid,null,q.id])).selection.whole_area_id,'salon');
 assert.deepEqual((await snapshot(db)).reservations.find(v=>v.id===r.id),original);
}finally{await db.close()}});

test('a reservation in trash stops occupying tables without deleting its seating history or changing the plan',async()=>{const db=await database();try{
 await save(db,1);const plan=await db.query('select * from v2_floor_plans'),seatings=await db.query('select * from v2_floor_seatings');
 assert.equal((await rpc(db,'v2_floor_read',[rid,'2026-09-30'])).seatings.length,1);
 // Exercise the existing floor read against the soft-delete marker used by the list's trash RPC.
 await db.query('update v2_reservations set deleted_at=now() where id=$1',[id(1)]);
 const read=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.equal(read.reservations.length,0);assert.equal(read.seatings.length,0);
 assert.deepEqual(await db.query('select * from v2_floor_plans'),plan);assert.deepEqual(await db.query('select * from v2_floor_seatings'),seatings);
 await save(db,2);assert.equal((await rpc(db,'v2_floor_read',[rid,'2026-09-30'])).reservations[0].id,id(2));
 assert.equal((await db.query('select count(*)::int n from v2_reservations')).rows[0].n,2);
}finally{await db.close()}});
