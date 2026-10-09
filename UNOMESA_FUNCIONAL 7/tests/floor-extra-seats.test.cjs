const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,rpc,save,quote,expected,snapshot,rid,other,id,layout,floor,payload}=require('./helpers/floor-database.cjs');
const sql=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),upgrade=async()=>{const db=await database();await db.exec(sql('45_CRUCES_HORARIO_CONFIRMADOS.sql'));return db;};
const extra=floor(['t1'],{allow_extra_seats:true}),large=payload({guests:6});
test('SQL46 installation preserves existing records, columns, policies and usual capacities; is repeatable',async()=>{const db=await upgrade();try{
 await save(db,1);await quote(db,null);const before=await snapshot(db),meta=async()=>({columns:await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position"),policies:await db.query('select * from pg_policies order by tablename,policyname'),plans:await db.query('select * from v2_floor_plans'),billing:await db.query("select prosrc,proacl from pg_proc where proname in ('v2_floor_authorize','v2_account_billing') order by proname")}),metadata=await meta();
 for(let i=0;i<2;i++){await db.exec(sql('46_ASIENTOS_ADICIONALES.sql'));assert.deepEqual(await snapshot(db),before);assert.deepEqual(await meta(),metadata);}
}finally{await db.close()}});
test('extra seats require a strict separate confirmation and preserve capacities and other reservations',async()=>{const db=await upgrade();try{await db.exec(sql('46_ASIENTOS_ADICIONALES.sql'));
 await save(db,1);const before=await snapshot(db);
 for(const value of [undefined,false,'true']){await assert.rejects(save(db,2,large,floor(['t1'],{allow_conflict:true,allow_extra_seats:value})),/FLOOR_CAPACITY/);assert.deepEqual(await snapshot(db),before);}
 await assert.rejects(save(db,2,large,extra),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),before);
 await save(db,2,large,{...extra,allow_conflict:true});const after=await snapshot(db);assert.equal(after.reservations.length,2);assert.deepEqual(after.reservations.find(r=>r.id===id(1)),before.reservations[0]);assert.deepEqual(after.seats.find(s=>s.reservation_id===id(1)),before.seats[0]);
 const current=(await db.query('select layout from v2_floor_plans')).rows[0].layout;assert.deepEqual(current.tables,layout.tables);
 const form=await rpc(db,'v2_floor_form',[rid,id(2),null]);assert.equal(form.selection.allow_extra_seats,undefined);await assert.rejects(save(db,2,large,{...form.selection,source:form.source,allow_conflict:true},false),/FLOOR_CAPACITY/);
}finally{await db.close()}});
test('proposal confirmation is not reused on conversion or linking; failed operations remain atomic',async()=>{const db=await upgrade();try{await db.exec(sql('46_ASIENTOS_ADICIONALES.sql'));
 const q=await quote(db,null,extra,large);const before=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_convert_quote',[rid,q.id,expected({guests:6})]),/FLOOR_CAPACITY/);assert.deepEqual(await snapshot(db),before);
 const r=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected({guests:6,allow_extra_seats:true})]);assert.equal(r.guests,6);
 const q2=await quote(db,null,extra,large);await save(db,3,large,floor([]));const saved=await snapshot(db);await assert.rejects(rpc(db,'v2_floor_link_quote_confirmed',[rid,id(3),q2.id]),/FLOOR_CAPACITY/);await assert.rejects(rpc(db,'v2_floor_link_quote_extra_seats',[rid,id(3),q2.id,false]),/FLOOR_CONFLICT/);assert.deepEqual(await snapshot(db),saved);
 await rpc(db,'v2_floor_link_quote_extra_seats',[rid,id(3),q2.id,true]);assert.equal((await snapshot(db)).reservations.find(r=>r.id===id(3)).quote_id,q2.id);
}finally{await db.close()}});
test('extra-seat route keeps tenant, revision, role and helper access checks',async()=>{const db=await upgrade();try{await db.exec(sql('46_ASIENTOS_ADICIONALES.sql'));
 const before=await snapshot(db);await assert.rejects(save(db,1,large,{...extra,plan_revision:0}),/FLOOR_STALE/);await assert.rejects(rpc(db,'v2_floor_save_reservation',[other,id(1),true,large,extra]),/FLOOR_ACCESS/);await assert.rejects(save(db,1,large,{...extra,table_ids:['unknown']}),/FLOOR_ASSIGNMENT/);
 await db.exec("set test.role='lectura'");await assert.rejects(save(db,1,large,extra),/FLOOR_ACCESS/);assert.deepEqual(await snapshot(db),before);
 await db.exec('set role authenticated');await assert.rejects(rpc(db,'v2_floor_transfer_exceptions',[rid,id(1),id(2),true,true]),/permission denied/);
}finally{await db.close()}});
