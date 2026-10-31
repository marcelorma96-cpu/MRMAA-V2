const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {database,rpc,save,quote,snapshot,rid,other,id,floor,payload}=require('./helpers/floor-database.cjs');
const sql=fs.readFileSync('60_VINCULAR_RESERVAS_COTIZACIONES.sql','utf8');
async function upgraded(){const db=await database();
 // Model the established quote writer accepting all event fields, not only the date fixture.
 const def=(await db.query("select pg_get_functiondef('v2_save_quote_once(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure) as source")).rows[0].source;
 const fields=['client_id','client_name','client_phone','client_email','event_date','event_time','area','area_id','guests','subtotal','discount_pct','tip_pct','total','deposit','payment_method','balance','internal_notes'];
 await db.exec(def.replace('client_name=q.client_name,event_date=q.event_date,event_time=q.event_time,guests=q.guests',fields.map(f=>`${f}=q.${f}`).join(',')));
 for(const name of ['45_CRUCES_HORARIO_CONFIRMADOS.sql','46_ASIENTOS_ADICIONALES.sql','47_PERMISOS_EDITAR_PLANO.sql'])await db.exec(fs.readFileSync(name,'utf8'));await db.exec(sql);return db;}
const link=(db,r,q,conflict=false,extra=false)=>rpc(db,'v2_link_existing_events',[rid,r,q,conflict,extra]);
test('SQL60 is repeatable and installs without changing any saved event or existing authorization/function',async()=>{const db=await upgraded();try{await save(db,1);await quote(db,null);const before=await snapshot(db);const get=()=>db.query("select proname,prosrc,proacl from pg_proc where proname in ('v2_floor_authorize','v2_link_reservation_quote','v2_account_billing','v2_floor_link_quote') order by proname");const funcs=await get();await db.exec(sql);assert.deepEqual(await snapshot(db),before);assert.deepEqual(await get(),funcs);await db.exec(sql);assert.deepEqual(await snapshot(db),before);}finally{await db.close()}});
test('links any status and guest count using quote details, same reservation ID; retry is idempotent',async()=>{const db=await upgraded();try{
 await save(db,1,payload({client_name:'Reservation client',guests:83,status:'cancelada',event_date:'2026-10-15',event_time:null,deposit:250,notes:'Keep me',area:'Garden'}),floor([]));
 await db.query('insert into v2_clients(id,restaurant_id,name) values($1,$2,$3)',[id(80),rid,'Quote client']);
 const q=await quote(db,null,floor([]),payload({client_id:id(80),client_name:'Quote client',client_phone:'12345678',client_email:'test@example.com',guests:2,event_date:'2026-11-20',event_time:'20:00',area:'Room',subtotal:1000,discount_pct:10,tip_pct:5,payment_method:'Efectivo',balance:885}));
 await db.exec(`update v2_quotes set status='rechazada',total=955,deposit=70,internal_notes='Quote note' where id='${q.id}'`);
 const before=await snapshot(db),result=await link(db,id(1),q.id);assert.equal(result.quote_id,q.id);assert.equal(result.status,'confirmada');const after=await snapshot(db);
 const expected={...before.reservations[0],quote_id:q.id,status:'confirmada',phone:before.quotes[0].client_phone,menu:'Menú × 2',notes:'Quote note'};
 for(const f of ['client_id','client_name','event_date','event_time','area','area_id','guests','subtotal','discount_pct','tip_pct','total','deposit','payment_method','balance'])expected[f]=before.quotes[0][f];
 assert.deepEqual(after.reservations[0],expected);assert.deepEqual(after.quotes[0],{...before.quotes[0],status:'convertida'});assert.deepEqual(after.clients,before.clients);assert.deepEqual(after.items,before.items);
 await link(db,id(1),q.id);assert.deepEqual(await snapshot(db),after);
 await save(db,2,payload(),floor([]));const prior=await snapshot(db);await assert.rejects(link(db,id(2),q.id),/EVENT_LINK_QUOTE_USED/);assert.deepEqual(await snapshot(db),prior);
 const q2=await quote(db,null,floor([]));await assert.rejects(link(db,id(1),q2.id),/EVENT_LINK_RESERVATION_USED/);
}finally{await db.close()}});
test('quote picker covers all states over multiple pages, excludes other branches, trash and actual relationships',async()=>{const db=await upgraded();try{
 for(let n=1;n<=64;n++)await db.query('insert into v2_quotes(id,restaurant_id,quote_number,client_name,event_date,status,deleted_at) values($1,$2,$3,$4,$5,$6,$7)',[id(100+n),n===63?other:rid,2000+Math.floor(n/3),'Cliente '+n,'2026-10-15',['pendiente','confirmada','rechazada','convertida'][n%4],n===64?'2026-10-15':null]);
 await db.query('insert into v2_reservations(id,restaurant_id,quote_id,status,deleted_at) values($1,$2,$3,$4,$5)',[id(70),rid,id(102),'cancelada','2026-10-15']);
 let cursor=null,ids=[];for(let page=0;page<5;page++){const r=await rpc(db,'v2_linkable_quote_page',[rid,'',cursor]);assert(r.rows.length<=25);ids.push(...r.rows.map(q=>q.id));if(!r.has_more)break;cursor=r.next;}
 const expected=(await db.query('select id from v2_quotes where restaurant_id=$1 and deleted_at is null and id<>$2 order by quote_number desc,id desc',[rid,id(102)])).rows.map(r=>r.id);assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,ids.length);
 const filtered=await rpc(db,'v2_linkable_quote_page',[rid,'Cliente 10',null]);assert.deepEqual(filtered.rows.map(r=>r.id),[id(110)]);assert.equal((await rpc(db,'v2_linkable_quote_page',[rid,'%',null])).rows.length,0);
 await assert.rejects(rpc(db,'v2_linkable_quote_page',[other,'',null]),/FLOOR_ACCESS/);
}finally{await db.close()}});
test('tenant, read-only, deleted, duplicate and anonymous constraints remain enforced',async()=>{const db=await upgraded();try{
 await save(db,1,payload(),floor([]));const q=await quote(db,null,floor([]));await db.query('insert into v2_quotes(id,restaurant_id) values($1,$2)',[id(10),other]);let before=await snapshot(db);
 await assert.rejects(link(db,id(1),id(10)),/EVENT_LINK_QUOTE/);await assert.rejects(rpc(db,'v2_link_existing_events',[other,id(1),q.id,false,false]),/FLOOR_ACCESS/);assert.deepEqual(await snapshot(db),before);
 await db.exec("set test.role='lectura'");await assert.rejects(link(db,id(1),q.id),/FLOOR_ACCESS/);assert.equal((await rpc(db,'v2_linkable_quote_page',[rid,'',null])).rows.length,1);await db.exec("set test.role='administrador'");
 await db.query('update v2_reservations set deleted_at=now() where id=$1',[id(1)]);before=await snapshot(db);await assert.rejects(link(db,id(1),q.id),/EVENT_LINK_RESERVATION/);assert.deepEqual(await snapshot(db),before);
 await db.exec('set role anon');await assert.rejects(link(db,id(1),q.id),/permission denied/);await assert.rejects(rpc(db,'v2_linkable_quote_page',[rid,'',null]),/permission denied/);
}finally{await db.close()}});
test('quote seating wins; current date/capacity conflicts require explicit confirmation with atomic rollback',async()=>{const db=await upgraded();try{
 await save(db,1);await save(db,2,payload({guests:2,status:'cancelada',event_date:'2026-11-20'}),floor([]));const q=await quote(db,null,floor(['t1'],{allow_extra_seats:true}),payload({guests:10}));let before=await snapshot(db);
 await assert.rejects(link(db,id(2),q.id),/FLOOR_CAPACITY/);assert.deepEqual(await snapshot(db),before);
 await assert.rejects(link(db,id(2),q.id,false,true),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await link(db,id(2),q.id,true,true);const form=await rpc(db,'v2_floor_form',[rid,id(2),null]);assert.deepEqual(form.selection.table_ids,['t1']);
 const q2=await quote(db,null,floor(['t2'],{duration_minutes:180}),payload({event_date:'2026-11-21',event_time:'18:30',guests:3}));await link(db,id(1),q2.id);const seatAfter=(await snapshot(db)).seats.find(s=>s.reservation_id===id(1));assert.deepEqual(seatAfter.table_ids,['t2']);assert.equal(seatAfter.duration_minutes,180);assert.equal(seatAfter.source_date,'2026-11-21');assert.equal(seatAfter.source_time,'18:30:00');assert.equal(seatAfter.source_guests,3);
}finally{await db.close()}});

test('later quote edits update the linked event, menu, amounts and seating; a stale/conflicting edit saves nothing',async()=>{const db=await upgraded();try{
 await save(db,1,payload(),floor(['t1']));const q=await quote(db,null,floor(['t2']));await link(db,id(1),q.id);
 const form=await rpc(db,'v2_floor_form',[rid,null,q.id]);
 const data=payload({client_name:'Edited client',client_phone:'999',event_date:'2026-12-12',event_time:'19:15',area:'Salón',guests:6,subtotal:1200,total:1300,deposit:500,balance:800,payment_method:'Tarjeta',internal_notes:'Updated note'});
 const selection={...form.selection,source:form.source,table_ids:['t1','t2'],whole_area_id:'salon',allow_extra_seats:true};
 await rpc(db,'v2_floor_save_quote',[rid,q.id,null,data,[{name:'Graduación',quantity:6}],null,selection]);
 const after=await snapshot(db),r=after.reservations[0],s=after.seats[0];
 assert.equal(r.id,id(1));assert.equal(r.client_name,'Edited client');assert.equal(r.phone,'999');assert.equal(r.event_date,'2026-12-12');assert.equal(r.event_time,'19:15:00');assert.equal(r.area,'Salón');assert.equal(r.guests,6);assert.equal(r.menu,'Graduación × 6');assert.equal(r.total,1300);assert.equal(r.deposit,500);assert.equal(r.balance,800);assert.equal(r.notes,'Updated note');assert.equal(s.source_date,r.event_date);assert.equal(s.whole_area_id,'salon');assert.deepEqual(s.table_ids,['t1','t2']);
 await assert.rejects(rpc(db,'v2_floor_save_quote',[rid,q.id,null,{...data,total:0},[],null,selection]),/FLOOR_STALE/);assert.deepEqual(await snapshot(db),after);
 await save(db,2,payload({event_date:'2026-12-13',event_time:'19:15'}));const current=await rpc(db,'v2_floor_form',[rid,null,q.id]),before=await snapshot(db);
 const next={...current.selection,source:current.source,table_ids:['t1'],whole_area_id:null};
 await assert.rejects(rpc(db,'v2_floor_save_quote',[rid,q.id,null,{...data,event_date:'2026-12-13',guests:4,total:99},[{name:'Nuevo',quantity:4}],null,next]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
}finally{await db.close()}});

test('empty and legacy area-only quote assignments clear old reservation tables; unrelated events survive',async()=>{const db=await upgraded();try{
 await save(db,1);await save(db,2,payload({event_date:'2026-11-01'}),floor(['t2']));const original=(await snapshot(db)).reservations.find(r=>r.id===id(2));
 const q=await quote(db,null,floor([]),payload({area:'Garden'}));await link(db,id(1),q.id);let after=await snapshot(db);assert.equal(after.reservations.find(r=>r.id===id(1)).area,'Garden');assert(!after.seats?.some(s=>s.reservation_id===id(1)));assert.deepEqual(after.reservations.find(r=>r.id===id(2)),original);
 const legacy=await quote(db,null,floor([]),payload({area:'Patio'}));await db.query('delete from v2_floor_quote_plans where quote_id=$1',[legacy.id]);await link(db,id(2),legacy.id);after=await snapshot(db);assert.equal(after.reservations.find(r=>r.id===id(2)).area,'Patio');assert.equal(after.seats,null);
 // A subsequent non-floor caller changing area cannot retain tables in the old area.
 const draft=await rpc(db,'v2_floor_form',[rid,null,q.id]);await rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload({area:'Salón'}),[],null,{...draft.selection,...floor(['t1']),source:draft.source}]);
 await rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload({area:'Garden'}),[],null,null]);assert.equal((await snapshot(db)).seats,null);
}finally{await db.close()}});

test('canceling then editing a linked quote retains cancellation; private helper cannot be called directly',async()=>{const db=await upgraded();try{
 await save(db,1,payload(),floor([]));const q=await quote(db,null,floor([]));await link(db,id(1),q.id);await db.query("update v2_reservations set status='cancelada' where id=$1",[id(1)]);
 const f=await rpc(db,'v2_floor_form',[rid,null,q.id]);await rpc(db,'v2_floor_save_quote',[rid,q.id,null,payload({total:42}),[],null,{...floor([]),...f.selection,source:f.source}]);const r=(await snapshot(db)).reservations[0];assert.equal(r.status,'cancelada');assert.equal(r.total,42);
 await db.exec('set role authenticated');await assert.rejects(rpc(db,'v2_event_quote_to_reservation',[rid,id(1),q.id]),/permission denied/);
}finally{await db.close()}});

test('creating a quote from a reservation retains its ID and request deduplication while copying the final quote',async()=>{const db=await upgraded();try{
 await save(db,1,payload(),floor([]));
 const request=require('node:crypto').randomUUID(),args=[rid,null,request,payload({client_name:'Final client',total:550,deposit:150,balance:400}),[{name:'Cena',quantity:4}],id(1),floor(['t2'])];
 const created=await rpc(db,'v2_floor_save_quote',args),after=await snapshot(db);assert.equal(after.reservations.length,1);assert.equal(after.reservations[0].id,id(1));assert.equal(after.reservations[0].quote_id,created.id);assert.equal(after.reservations[0].client_name,'Final client');assert.equal(after.reservations[0].total,550);assert.equal(after.reservations[0].menu,'Cena × 4');assert.deepEqual(after.seats[0].table_ids,['t2']);
 const again=await rpc(db,'v2_floor_save_quote',args);assert.equal(again.id,created.id);assert.deepEqual(await snapshot(db),after);
}finally{await db.close()}});
