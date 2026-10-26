const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,rpc,save,quote,snapshot,rid,other,id,floor,payload,expected}=require('./helpers/floor-database.cjs');
const sql=fs.readFileSync('61_RESERVAS_VARIAS_AREAS.sql','utf8');
const a=id(30),b=id(31),c=id(32);
async function setup(){const db=await database();
 await db.exec('alter table v2_reservation_areas add column name text');
 await db.query('insert into v2_reservation_areas values($1,$2,$3),($4,$2,$5),($6,$2,$7),($8,$9,$10)',[a,rid,'Salón',b,'Terraza',c,'Jardín',id(33),other,'Otro']);
 const def=(await db.query("select pg_get_functiondef('v2_save_quote_once(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure) as source")).rows[0].source;
 const fields=['client_id','client_name','client_phone','client_email','event_date','event_time','area','area_id','guests','subtotal','discount_pct','tip_pct','total','deposit','payment_method','balance','internal_notes'];
 await db.exec(def.replace('client_name=q.client_name,event_date=q.event_date,event_time=q.event_time,guests=q.guests',fields.map(f=>`${f}=q.${f}`).join(',')));
 for(const name of ['45_CRUCES_HORARIO_CONFIRMADOS.sql','46_ASIENTOS_ADICIONALES.sql','54_LECTURA_RAPIDA_ETIQUETAS_MESAS.sql','60_VINCULAR_RESERVAS_COTIZACIONES.sql'])await db.exec(fs.readFileSync(name,'utf8'));
 const layout={areas:[{id:'salon',name:'Salón',eventAreaId:a},{id:'terraza',name:'Terraza',eventAreaId:b},{id:'jardin',name:'Jardín',eventAreaId:c}],tables:[{id:'t1',areaId:'salon',name:'M1',seats:10,shape:'square',x:30,y:50,rotation:0},{id:'t2',areaId:'terraza',name:'M1',seats:10,shape:'square',x:30,y:50,rotation:0}]};
 await rpc(db,'v2_floor_save_layout',[rid,1,layout]);await db.exec(sql);return db;
}
const sf=(extra={})=>floor([],{plan_revision:2,...extra});
const form=async(db,n)=>{const f=await rpc(db,'v2_floor_form',[rid,id(n),null]);return {...f.selection,source:f.source}};
test('multi-area migration is repeatable and retains prior data and amounts',async()=>{const db=await setup();try{
 await save(db,1,payload({area_ids:[a],deposit:100,notes:'keep'}),sf());await db.exec(`update v2_reservations set subtotal=600,total=700,balance=600 where id='${id(1)}'`);const before=await snapshot(db);await db.exec(sql);assert.deepEqual(await snapshot(db),before);
 const r=await save(db,1,{area_ids:[a,b]},await form(db,1),false);assert.equal(r.area,'Salón + Terraza');assert.deepEqual(r.area_ids,[a,b]);assert.equal(r.area_id,a);assert.equal(r.total,700);assert.equal(r.deposit,100);assert.equal(r.notes,'keep');
 const f=await rpc(db,'v2_floor_form',[rid,id(1),null]);assert.deepEqual(f.area_ids,[a,b]);assert.equal(f.multi_area_version,1);assert.deepEqual(f.selection.whole_area_ids,['salon','terraza']);assert.deepEqual(f.selection.table_ids,['t1','t2']);
 const read=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.deepEqual(read.reservations[0].area_ids,[a,b]);assert.equal(read.reservations.length,1);
 const labels=await rpc(db,'v2_event_area_labels',[rid,'reservation','{'+id(1)+'}']);assert.deepEqual(labels.rows[0].selection.whole_area_ids,['salon','terraza']);
 const old=await form(db,1);await save(db,1,{area_ids:[b]},{...old,table_ids:[],whole_area_id:null},false);assert.equal(((await rpc(db,'v2_floor_form',[rid,id(1),null])).selection.whole_area_ids||[]).length,0);
 await save(db,2,payload({area_ids:[a]}),sf());
 await assert.rejects(save(db,3,payload({area_ids:[b]}),sf()),/FLOOR_CONFLICT/);
 await assert.rejects(save(db,1,{area_ids:[a,b]},old,false),/FLOOR_STALE/);
 }finally{await db.close()}});
test('conflicts include second areas, no-table rooms, overnight and explicit confirmation; tenant isolation',async()=>{const db=await setup();try{
 await save(db,1,payload({area_ids:[a,b]}),sf());let before=await snapshot(db);
 assert.equal((await rpc(db,'v2_nearby_reservations_for_areas',[rid,'{'+b+'}','2026-09-30','15:00',null])).length,1);
 await assert.rejects(save(db,2,payload({area_ids:[b,c]}),sf()),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await save(db,2,payload({area_ids:[b,c]}),sf({allow_conflict:true}));
 await assert.rejects(save(db,3,payload({area_ids:[c]}),sf()),/FLOOR_CONFLICT/);
 await save(db,3,payload({area_ids:[c],event_time:'15:00'}),sf());
 await assert.rejects(save(db,4,payload({area_ids:[a,id(33)]}),sf()),/EVENT_AREAS/);
 await db.exec("set test.role='lectura'");await assert.rejects(save(db,5,payload({area_ids:[a,b]}),sf()),/FLOOR_ACCESS/);await db.exec("set test.role='administrador'");
 await save(db,6,payload({area_ids:[a,c],event_time:'23:00'}),sf({duration_minutes:180}));
 await assert.rejects(save(db,7,payload({area_ids:[b,c],event_date:'2026-10-01',event_time:'01:00'}),sf()),/FLOOR_CONFLICT/);
 await save(db,6,{status:'cancelada'},await form(db,6),false);
 await save(db,7,payload({area_ids:[b,c],event_date:'2026-10-01',event_time:'01:00'}),sf());
 await db.exec('set role authenticated');await assert.rejects(rpc(db,'v2_event_area_payload',[rid,{area_ids:[a,b]},null]),/permission denied/);
 }finally{await db.close()}});
test('multi-area quote transfers all areas on conversion/link and linked edits preserve money and area selection',async()=>{const db=await setup();try{
 const q=await quote(db,null,sf({event_area_ids:[a,b]}),payload({area_ids:[a,b],deposit:80,total:500}));
 let f=await rpc(db,'v2_floor_form',[rid,null,q.id]);assert.deepEqual(f.area_ids,[a,b]);assert.equal((await rpc(db,'v2_floor_read',[rid,'2026-09-30'])).seatings.length,0);
 const r=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]);assert.deepEqual(r.area_ids,[a,b]);assert.equal(r.deposit,80);
 f=await rpc(db,'v2_floor_form',[rid,null,q.id]);assert.deepEqual(f.selection.whole_area_ids,['salon','terraza']);
 await rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload({area_ids:[b,c],deposit:80,total:500}),[{name:'Menu',quantity:2}],null,{...f.selection,source:f.source}]);
 const after=(await snapshot(db)).reservations[0];assert.deepEqual(after.area_ids,[b,c]);assert.equal(after.area,'Terraza + Jardín');assert.equal(after.deposit,80);
 await save(db,8,payload({event_time:'18:00'}),sf());
 const q2=await quote(db,null,sf(),payload({area_ids:[a,c],event_time:'18:00'}));
 const linked=await rpc(db,'v2_link_existing_events',[rid,id(8),q2.id,false,false]);assert.deepEqual(linked.area_ids,[a,c]);assert.equal((await form(db,8)).whole_area_ids.length,2);
 }finally{await db.close()}});
test('empty layouts and canceled reservations retain multi-area identity without requiring any table',async()=>{const db=await setup();try{
 // A room with no tables and a second catalog-only room.
 await db.query('insert into v2_reservation_areas values($1,$2,$3)',[id(34),rid,'Nuevo']);
 const r=await save(db,1,payload({area_ids:[c,id(34)],status:'cancelada'}),sf());assert.deepEqual(r.area_ids,[c,id(34)]);
 let f=await form(db,1);assert.deepEqual(f.whole_area_ids,['jardin','catalog-'+id(34)]);
 await save(db,1,{status:'confirmada'},f,false);
 await assert.rejects(save(db,2,payload({area_ids:[a,id(34)]}),sf()),/FLOOR_CONFLICT/);
 }finally{await db.close()}});
test('new tables inherit whole-room occupancy and occupied empty rooms cannot be removed',async()=>{const db=await setup();try{
 await save(db,1,payload({area_ids:[a,b]}),sf());await save(db,2,payload(),sf());
 const data=await rpc(db,'v2_floor_read',[rid,'2026-09-30']),layout=data.layout;
 layout.tables.push({...layout.tables[1],id:'t3',name:'M2',x:65});await rpc(db,'v2_floor_save_layout',[rid,2,layout]);
 await assert.rejects(rpc(db,'v2_floor_assign',[rid,id(2),0,3,'{t3}',null,120,'reserved','2026-09-30','13:00',4]),/FLOOR_CONFLICT/);
 await save(db,3,payload({area_ids:[a,c],event_time:'18:00'}),sf({plan_revision:3}));
 const without={...layout,areas:layout.areas.filter(x=>x.id!=='jardin')};await assert.rejects(rpc(db,'v2_floor_save_layout',[rid,3,without]),/FLOOR_IN_USE/);
 }finally{await db.close()}});
