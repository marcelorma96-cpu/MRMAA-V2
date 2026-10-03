const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>load('lib/'+id.replace('./','')+'.ts'),Date,Set,Number,JSON});return module.exports;}
const lib=load('lib/floor-plan.ts'),rid='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const ids=[1,2,3,4,5].map(i=>`11111111-1111-4111-8111-11111111111${i}`);
const layout={areas:[{id:'salon',name:'Salón'},{id:'terraza',name:'Terraza'}],tables:[{id:'t1',areaId:'salon',name:'M1',seats:4,shape:'round',x:25,y:35,rotation:0},{id:'t2',areaId:'salon',name:'M2',seats:4,shape:'square',x:60,y:35,rotation:0},{id:'t3',areaId:'terraza',name:'M3',seats:8,shape:'rectangle',x:50,y:50,rotation:90}]};
test('wall-clock overlap across midnight, adjacency, cancellation and completed service',()=>{
 const minute=lib.floorMinute;assert.equal(minute('2026-09-30','23:00'),minute('2026-10-01','00:00')-60);assert(!lib.overlaps(0,60,60,60));assert(lib.overlaps(0,61,60,60));assert(Number.isNaN(minute('2026-09-30',null)));assert(Number.isNaN(minute('2026-09-30','25:00')));
 const d=lib.demoFloor('2026-09-30');assert.equal(lib.conflicts(d,['demo-t2'],'2026-09-30','14:59',60).length,1);assert.equal(lib.conflicts(d,['demo-t2'],'2026-09-30','15:00',60).length,0);
 d.reservations[0].status='cancelada';assert.equal(lib.conflicts(d,['demo-t2'],'2026-09-30','13:30',60).length,0);d.reservations[0].status='confirmada';d.seatings[0].service_status='finished';assert.equal(lib.conflicts(d,['demo-t2'],'2026-09-30','13:30',60).length,0);
});
test('whole area includes new tables; changed reservation and capacity flag review',()=>{
 const d=lib.demoFloor('2026-09-30'),r=d.reservations[0],s=d.seatings[0];assert(!lib.needsReview(d,r,s));r.event_time='14:00';assert(lib.needsReview(d,r,s));r.event_time='13:00';r.guests=99;assert(lib.needsReview(d,r,s));s.whole_area_id='salon';d.layout.tables.push({id:'added',areaId:'salon'});assert(lib.seatingTables(s,d.layout).includes('added'));assert.equal(lib.conflicts(d,['added'],'2026-09-30','13:30',30).length,1);
});
async function database(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '99999999-9999-4999-8999-999999999999'::uuid$$;
 create function public.v2_session_alive() returns boolean language sql as $$select coalesce(current_setting('test.session',true),'true')::boolean$$;
 create function public.v2_can_read(p uuid) returns boolean language sql as $$select p='${rid}'::uuid$$;
 create function public.v2_effective_membership(p uuid) returns jsonb language sql as $$select jsonb_build_object('role',coalesce(nullif(current_setting('test.role',true),''),'administrador'),'status','activo')$$;
 create function public.v2_account_billing(p uuid) returns jsonb language sql as $$select jsonb_build_object('can_write',coalesce(current_setting('test.write',true),'true')::boolean)$$;
 create table v2_restaurants(id uuid primary key,name text);
 create table v2_reservations(id uuid primary key,restaurant_id uuid references v2_restaurants(id),client_name text,phone text,event_date date,event_time time,guests int,area text,status text,deleted_at timestamptz);
 insert into v2_restaurants values('${rid}','Test'),('${other}','Other');
 insert into v2_reservations(id,restaurant_id,client_name,event_date,event_time,guests,status) values
 ('${ids[0]}','${rid}','Ana','2026-09-30','23:00',4,'confirmada'),('${ids[1]}','${rid}','Beto','2026-10-01','00:00',4,'confirmada'),
 ('${ids[2]}','${rid}','Carla','2026-10-01','01:00',8,'confirmada'),('${ids[3]}','${other}','Other','2026-10-01','00:00',4,'confirmada'),('${ids[4]}','${rid}','No time','2026-10-01',null,4,'confirmada');
 `);await db.exec(fs.readFileSync(path.join(root,'43_PLANO_MESAS.sql'),'utf8'));return db;}
async function saveLayout(db,rev,value=layout){return (await db.query('select v2_floor_save_layout($1,$2,$3::jsonb) as n',[rid,rev,JSON.stringify(value)])).rows[0].n;}
async function assign(db,index,{revision=0,planRevision=1,tables=['t1'],area=null,duration=120,status='reserved',date,time,guests}={}){
 const r=(await db.query('select * from v2_reservations where id=$1',[ids[index]])).rows[0];return db.query('select v2_floor_assign($1,$2,$3,$4,$5::text[],$6,$7,$8,$9::date,$10::time,$11) as n',[rid,ids[index],revision,planRevision,tables,area,duration,status,date??r.event_date,time??r.event_time,guests??r.guests]);
}
test('new SQL preserves existing records and columns and is repeatable',async()=>{const db=await database();try{
 const before=await db.query('select * from v2_reservations order by id');const columns=await db.query("select column_name,data_type from information_schema.columns where table_name='v2_reservations' order by ordinal_position");
 await db.exec(fs.readFileSync(path.join(root,'43_PLANO_MESAS.sql'),'utf8'));assert.deepEqual(await db.query('select * from v2_reservations order by id'),before);assert.deepEqual(await db.query("select column_name,data_type from information_schema.columns where table_name='v2_reservations' order by ordinal_position"),columns);
 const read=(await db.query('select v2_floor_read($1,$2) as d',[rid,'2026-10-01'])).rows[0].d;assert.equal(read.revision,0);assert.equal(read.reservations.length,4);assert(!read.reservations.some(r=>r.client_name==='Other'));
}finally{await db.close()}});
test('SQL conflicts across midnight, adjacent times, capacity, cancellation and release',async()=>{const db=await database();try{
 await saveLayout(db,0);await assign(db,0);await assert.rejects(assign(db,1),/FLOOR_CONFLICT/);await db.exec(`update v2_reservations set event_time=null where id='${ids[0]}'`);await assert.rejects(assign(db,1),/FLOOR_CONFLICT/);await db.exec(`update v2_reservations set event_time='23:00' where id='${ids[0]}'`);await assign(db,2,{tables:['t1','t2']});
 await assert.rejects(assign(db,1,{tables:['t1'],guests:20}),/FLOOR_STALE/);await assert.rejects(assign(db,2,{revision:1,tables:['t1']}),/FLOOR_CAPACITY/);
 await assign(db,0,{revision:1,status:'finished'});await assign(db,1,{duration:60});await db.exec(`update v2_reservations set status='cancelada' where id='${ids[1]}'`);await assign(db,0,{revision:2});
 await assert.rejects(assign(db,4),/FLOOR_RESERVATION/);await assert.rejects(assign(db,3),/FLOOR_RESERVATION/);
}finally{await db.close()}});
test('SQL prevents stale overwrites, whole area conflicts and removing assigned tables',async()=>{const db=await database();try{
 await saveLayout(db,0);await assign(db,0,{tables:['t1','t2'],area:'salon'});await assert.rejects(assign(db,1,{tables:['t2']}),/FLOOR_CONFLICT/);await assert.rejects(assign(db,0,{revision:0}),/FLOOR_STALE/);await assert.rejects(saveLayout(db,0),/FLOOR_STALE/);
 await assert.rejects(saveLayout(db,1,{...layout,tables:layout.tables.filter(t=>t.id!=='t1')}),/FLOOR_IN_USE/);await assert.rejects(saveLayout(db,1,{...layout,tables:layout.tables.map(t=>t.id==='t1'?{...t,areaId:'terraza'}:t)}),/FLOOR_IN_USE/);
 await saveLayout(db,1,{...layout,tables:[...layout.tables,{...layout.tables[0],id:'t4',name:'M4'}]});await assert.rejects(assign(db,1,{planRevision:2,tables:['t4']}),/FLOOR_CONFLICT/);await assert.rejects(assign(db,1,{tables:['t3']}),/FLOOR_STALE/);
 await assign(db,0,{planRevision:2,revision:1,tables:[]});assert.equal((await db.query('select count(*)::int n from v2_reservations')).rows[0].n,5);
 await assert.rejects(saveLayout(db,2,{...layout,tables:[...layout.tables,layout.tables[0]]}),/FLOOR_LAYOUT/);
}finally{await db.close()}});
test('database denies cross-tenant, read-only, operator layout, revoked sessions, expired billing and direct writes',async()=>{const db=await database();try{
 await saveLayout(db,0);await assert.rejects(db.query('select v2_floor_read($1,$2)',[other,'2026-10-01']),/FLOOR_ACCESS/);
 await db.exec("set test.role='lectura'");await db.query('select v2_floor_read($1,$2)',[rid,'2026-10-01']);await assert.rejects(assign(db,0),/FLOOR_ACCESS/);
 await db.exec("set test.role='operacion'");await assign(db,0);await assert.rejects(saveLayout(db,1),/FLOOR_ACCESS/);
 await db.exec("set test.role='gerente'");await saveLayout(db,1);await db.exec("set test.write='false'");await assert.rejects(assign(db,1,{planRevision:2,tables:['t3']}),/FLOOR_ACCESS/);
 await db.exec("set test.session='false'");await assert.rejects(db.query('select v2_floor_read($1,$2)',[rid,'2026-10-01']),/FLOOR_ACCESS/);
 await db.exec("set test.session='true';set role authenticated");await db.query('select v2_floor_read($1,$2)',[rid,'2026-10-01']);await assert.rejects(db.query('select * from v2_floor_seatings'),/permission denied/);await assert.rejects(db.query('delete from v2_floor_plans'),/permission denied/);await assert.rejects(db.query("select v2_floor_authorize($1,'read')",[rid]),/permission denied/);
}finally{await db.close()}});

test('levels, area placement and default duration persist without changing any saved booking or table identity',async()=>{const db=await database();try{
 await saveLayout(db,0);await assign(db,0);
 const reservations=await db.query('select * from v2_reservations order by id'),seatings=await db.query('select * from v2_floor_seatings order by reservation_id');
 const next={...layout,levels:[{id:'l1',name:'Primer nivel'},{id:'l2',name:'Segundo nivel'},{id:'l3',name:'Tercer nivel'}],defaultDurationMinutes:180,areas:layout.areas.map((a,i)=>({...a,levelId:i?'l3':'l2',background:'transparent',showBorder:false,placement:{x:10,y:20,width:45,height:35}}))};
 await saveLayout(db,1,next);next.defaultDurationMinutes=120;await saveLayout(db,2,next);
 const saved=(await db.query('select v2_floor_read($1,$2) as d',[rid,'2026-10-01'])).rows[0].d;
 assert.equal(saved.layout.areas[0].background,'transparent');assert.equal(saved.layout.areas[0].showBorder,false);assert.equal(saved.layout.defaultDurationMinutes,120);assert.equal(saved.layout.areas[1].levelId,'l3');assert.deepEqual(saved.layout.tables,layout.tables);
 assert.deepEqual(await db.query('select * from v2_reservations order by id'),reservations);assert.deepEqual(await db.query('select * from v2_floor_seatings order by reservation_id'),seatings);
 await assert.rejects(saveLayout(db,1,next),/FLOOR_STALE/);
}finally{await db.close()}});

test('legacy map is read without mutation; placements stay inside restaurant footprint',()=>{
 const map=load('lib/restaurant-map.ts'),original=JSON.stringify(layout);
 assert.equal(map.floorLevels(layout)[0].id,'level-1');assert.equal(map.floorDefaultDuration(layout),180);assert.equal(lib.defaultFloorSelection().duration_minutes,180);
 const placement=map.areaPlacement(layout,layout.areas[0]);assert(placement.x>=2&&placement.y>=2);assert.equal(JSON.stringify(layout),original);
 const next=map.positionArea(layout,'salon',{x:99,y:-20,width:90,height:60,levelId:'l2'});const p=next.areas[0].placement;assert(p.x+p.width<=98&&p.y>=2);assert.equal(JSON.stringify(next.tables),JSON.stringify(layout.tables));assert.equal(JSON.stringify(layout),original);
 const linked=map.attachCatalogArea(layout,{id:'catalog',name:'Salón'},'new');assert.equal(linked.areas.length,2);assert.equal(linked.areas[0].id,'salon');assert.equal(linked.areas[0].eventAreaId,'catalog');
});


test('complete map agenda includes all levels, unassigned and canceled day records, and only overlapping overnight bookings',()=>{
 const map=load('lib/restaurant-map.ts'),d=lib.demoFloor('2026-09-30');
 d.reservations.push({...d.reservations[0],id:'cancel',status:'cancelada'}, {...d.reservations[0],id:'overnight',event_date:'2026-09-29',event_time:'23:00'}, {...d.reservations[0],id:'tomorrow',event_date:'2026-10-01',event_time:'10:00'}, {...d.reservations[0],id:'no-time',event_time:null});
 d.seatings.push({...d.seatings[0],reservation_id:'overnight',table_ids:[],whole_area_id:'terraza',source_date:'2026-09-29',source_time:'23:00',duration_minutes:180});
 d.layout.areas[1].levelId='upstairs';d.layout.levels=[{id:'ground',name:'Ground'},{id:'upstairs',name:'Upstairs'}];
 const original=JSON.stringify(d),rows=map.restaurantDayReservations(d,'2026-09-30');
 assert.equal(rows.length,7);assert(!rows.some(b=>b.reservation.id==='tomorrow'));assert(rows.some(b=>b.reservation.id==='cancel'));assert(rows.some(b=>b.reservation.id==='no-time'));
 const overnight=rows.find(b=>b.reservation.id==='overnight');assert(overnight.continued);assert.equal(overnight.areaIds.join(','),'terraza');assert.equal(overnight.tableIds.join(','),'demo-t7,demo-t8');
 const unassigned=rows.find(b=>b.reservation.id==='demo-r3');assert.equal(unassigned.tableIds.length,0);assert.equal(unassigned.areaIds[0],'terraza');assert.equal(JSON.stringify(d),original);
 assert.equal(map.restaurantDayReservations(d,'2026-10-01').length,1);
});
