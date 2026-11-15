const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {rpc,save,quote,snapshot,rid,other,id,floor,payload}=require('./helpers/floor-database.cjs');
const {setup,a,b,c}=require('./helpers/event-area-database.cjs');
const sql=fs.readFileSync('66_VINCULACION_REVISADA.sql','utf8'),sel=(tables=[],v={})=>floor(tables,{plan_revision:2,...v});
const review=(db,r,q,token=null,conflict=false,extra=false)=>rpc(db,'v2_review_event_link',[rid,r,q,token,conflict,extra]);
const available=(db,ids)=>rpc(db,'v2_event_link_candidates',[rid,'{'+ids.join(',')+'}']);
test('preview has no side effects; stale confirmation rejected; differences and single whole-room without tables; duplicate, trash, team boundaries',async()=>{
 const db=await setup();try{
 await save(db,1,payload({area_ids:[a],deposit:55,client_name:'Reservante'}),sel(['t1']));
 const q=await quote(db,null,sel(),payload({area_ids:[c],guests:40,deposit:95,total:1900,client_name:'Solicitante'}));
 await db.query("update v2_floor_quote_plans set selection=selection||jsonb_build_object('whole_area_id','jardin') where quote_id=$1",[q.id]);
 await db.query("update v2_quotes set status='convertida' where id=$1",[q.id]);
 const initial=await snapshot(db);await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(db),initial);
 const x=await review(db,id(1),q.id);assert.deepEqual(await snapshot(db),initial);
 assert.deepEqual([x.before.area,x.after.area,x.before.guests,x.after.guests,x.before.deposit,x.after.deposit],['Salón','Jardín',4,40,55,95]);assert.ok(x.before.tables[0].includes('M1'));assert.deepEqual(x.after.tables,[]);
 assert.deepEqual(await available(db,[q.id]),[q.id]);
 await db.query("update v2_quotes set deposit=115 where id=$1",[q.id]);const changed=await snapshot(db);
 await assert.rejects(review(db,id(1),q.id,x.token),/EVENT_LINK_REVIEW_STALE/);assert.deepEqual(await snapshot(db),changed);
 const y=await review(db,id(1),q.id);assert.equal(y.after.deposit,115);assert.ok((await review(db,id(1),q.id,y.token)).linked);
 const linked=await snapshot(db),r=linked.reservations[0];assert.deepEqual([r.id,r.quote_id,r.area,r.area_id,r.guests,r.deposit,r.total,r.status],[id(1),q.id,'Jardín',c,40,115,1900,'confirmada']);assert.deepEqual(await available(db,[q.id]),[]);
 await review(db,id(1),q.id,y.token);assert.deepEqual(await snapshot(db),linked);
 const q2=await quote(db,null,sel(),payload());await assert.rejects(review(db,id(1),q2.id),/RESERVATION_USED/);
 await save(db,2,payload({event_time:'20:00'}),sel());await assert.rejects(review(db,id(2),q.id),/QUOTE_USED/);
 await db.query('update v2_reservations set deleted_at=now() where id=$1',[id(1)]);
 assert.deepEqual(await available(db,[q.id]),[]);await assert.rejects(review(db,id(2),q.id),/QUOTE_USED/);
 await assert.rejects(rpc(db,'v2_review_event_link',[other,id(2),q2.id,null,false,false]),/FLOOR_ACCESS/);
 await db.exec("set test.role='lectura'");await assert.rejects(review(db,id(2),q2.id),/FLOOR_ACCESS/);
 }finally{await db.close()}
});
test('unspecified quote preserves multiple areas and seating; competing quote cannot take the reservation',async()=>{
 const db=await setup();try{await db.exec(sql);
 await save(db,2,payload({area_ids:[a,b]}),sel());const q=await quote(db,null,sel(),payload({guests:8}));
 const q2=await quote(db,null,sel(),payload());const competing=await review(db,id(2),q2.id);
 const x=await review(db,id(2),q.id);assert.ok(x.keeps_place);assert.equal(x.after.area,'Salón + Terraza');assert.deepEqual(x.before.tables,x.after.tables);
 await review(db,id(2),q.id,x.token);const done=await snapshot(db);assert.deepEqual(done.reservations[0].area_ids,[a,b]);assert.equal(done.reservations[0].guests,8);
 assert.deepEqual(done.seats[0].table_ids.sort(),['t1','t2']);assert.deepEqual(done.quotes.find(v=>v.id===q.id).area_ids,[a,b]);
 await assert.rejects(review(db,id(2),q2.id,competing.token),/RESERVATION_USED/);assert.deepEqual(await snapshot(db),done);
 }finally{await db.close()}
});
test('legacy text-only quote resolves to current catalog, room overlap needs explicit consent; floor tables and real capacity still checked',async()=>{
 const db=await setup();try{await db.exec(sql);
 await save(db,1,payload({area_ids:[c]}),sel());await save(db,2,payload({event_time:'19:00'}),sel());
 const q=await quote(db,null,sel(),payload());await db.query("update v2_quotes set area='Jardín',area_id=null,area_ids='{}' where id=$1",[q.id]);
 const x=await review(db,id(2),q.id);assert.equal(x.after.area,'Jardín');const before=await snapshot(db);
 await assert.rejects(review(db,id(2),q.id,x.token),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await review(db,id(2),q.id,x.token,true);assert.deepEqual((await snapshot(db)).reservations[1].area_ids,[c]);
 const q2=await quote(db,null,sel(['t2']),payload({event_time:'22:00'}));await db.query('update v2_quotes set guests=40 where id=$1',[q2.id]);
 await save(db,3,payload({event_time:'23:00'}),sel());const y=await review(db,id(3),q2.id);
 assert.equal(y.after.area,'Terraza');assert.ok(y.after.tables[0].includes('M1'));
 await assert.rejects(review(db,id(3),q2.id,y.token),/FLOOR_CAPACITY/);await review(db,id(3),q2.id,y.token,false,true);
 }finally{await db.close()}
});

test('multi-area floor selection outranks a single legacy field; missing quote time preserves reservation time; invalid branch areas cannot be linked',async()=>{
 const db=await setup();try{await db.exec(sql);
 await save(db,1,payload({event_time:'17:30',area_ids:[c]}),sel());
 const q=await quote(db,null,sel(),payload({area_ids:[a,b],event_time:null}));
 await db.query('update v2_quotes set area_ids=$1,area_id=$2,area=$3 where id=$4',['{'+a+'}',a,'Salón',q.id]);
 const x=await review(db,id(1),q.id);assert.equal(x.after.area,'Salón + Terraza');assert.equal(x.after.time,'17:30:00');assert.equal(x.keeps_time,true);
 await review(db,id(1),q.id,x.token);const s=await snapshot(db);assert.deepEqual(s.reservations[0].area_ids,[a,b]);assert.equal(s.quotes[0].event_time,'17:30:00');
 const bad=await quote(db,null,sel(),payload());await save(db,2,payload({event_time:'21:00'}),sel());
 await db.query('update v2_quotes set area_ids=$1 where id=$2',['{'+id(33)+'}',bad.id]);
 const before=await snapshot(db);await assert.rejects(review(db,id(2),bad.id),/EVENT_AREAS/);assert.deepEqual(await snapshot(db),before);
 }finally{await db.close()}
});
