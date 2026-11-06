const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {database,rpc,save,quote,expected,snapshot,rid,id,layout,floor,payload}=require('./helpers/floor-database.cjs');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'47_PERMISOS_EDITAR_PLANO.sql'),'utf8');
test('SQL 47 changes only floor authorization, keeps data and schema, and allows layout writes only for Admin and Manager',async()=>{
 const db=await database();try{
  await save(db,10);await quote(db,null);const before=await snapshot(db);
  const schema=async()=>({columns:(await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows,policies:(await db.query('select * from pg_policies order by tablename,policyname')).rows,functions:(await db.query("select proname,pg_get_functiondef(p.oid) as definition,proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'v2_%' and proname<>'v2_floor_authorize' order by proname")).rows});
  const existing=await schema();await db.exec(sql);assert.deepEqual(await snapshot(db),before);assert.deepEqual(await schema(),existing);await db.exec(sql);assert.deepEqual(await snapshot(db),before);
  const beforeLayout=(await db.query('select * from v2_floor_plans order by restaurant_id')).rows;
  for(const role of ['operacion','lectura','soporte_editor','soporte_lectura']){
   await db.exec(`set test.role='${role}'`);await rpc(db,'v2_floor_read',[rid,'2026-09-30']);
   await assert.rejects(rpc(db,'v2_floor_save_layout',[rid,1,{...layout,defaultDurationMinutes:180}]),/FLOOR_ACCESS/);
  }
  assert.deepEqual((await db.query('select * from v2_floor_plans order by restaurant_id')).rows,beforeLayout);
  let revision=1;for(const role of ['administrador','admin','gerente']){await db.exec(`set test.role='${role}'`);revision=await rpc(db,'v2_floor_save_layout',[rid,revision,{...layout,defaultDurationMinutes:180}]);}
  assert.equal(revision,4);assert.deepEqual(await snapshot(db),before);
  await db.exec("set test.role='operacion'");await save(db,20,payload({area:'',area_id:null}),floor([],{plan_revision:4}));
  await db.exec("set test.role='lectura'");await assert.rejects(save(db,21,payload({area:'',area_id:null}),floor([],{plan_revision:4})),/FLOOR_ACCESS/);
 }finally{await db.close()}
});
test('unassigned reservations and quotes can save, convert and clear only the chosen seating with unchanged SQL 43–46',async()=>{
 const db=await database();try{
  for(const name of ['45_CRUCES_HORARIO_CONFIRMADOS.sql','46_ASIENTOS_ADICIONALES.sql'])await db.exec(fs.readFileSync(path.join(root,name),'utf8'));
  await db.exec(sql);await save(db,1,payload({area:'Salón',deposit:200,notes:'Conservar',menu:'Menú'}));
  await save(db,2,payload({area:'',area_id:null}),floor([]));const original=(await snapshot(db)).reservations.find(r=>r.id===id(2));assert.equal(original.area,'');assert.equal(original.area_id,null);
  const q=await quote(db,null,floor([]),payload({area:'',area_id:null}));const converted=await rpc(db,'v2_floor_convert_quote',[rid,q.id,expected()]);assert.equal(converted.area_id,null);
  const form=await rpc(db,'v2_floor_form',[rid,id(1),null]);const cleared=await rpc(db,'v2_floor_save_reservation',[rid,id(1),false,{area:'',area_id:null},{...form.selection,source:form.source,table_ids:[],whole_area_id:null}]);
  assert.equal(cleared.area,'');assert.equal(cleared.area_id,null);assert.equal(Number(cleared.deposit),200);assert.equal(cleared.notes,'Conservar');assert.equal(cleared.menu,'Menú');
  const after=await snapshot(db);assert.deepEqual(after.reservations.find(r=>r.id===id(2)),original);assert(!after.seats?.some(s=>s.reservation_id===id(1)));
 }finally{await db.close()}
});
test('client permissions use the same explicit layout roles without broadening schedule or operational access',()=>{
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/permissions.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
 const {permissionsFor}=module.exports;
 for(const role of ['administrador','admin','gerente','operacion','lectura','soporte_editor','soporte_lectura']){assert.equal(permissionsFor(role,'activo').canManageFloorPlan,['administrador','admin','gerente'].includes(role));assert.equal(permissionsFor(role,'inactivo').canManageFloorPlan,false);}
 assert.equal(permissionsFor('operacion','activo').canOperate,true);assert.equal(permissionsFor('soporte_editor','activo').canManageSchedules,true);
});
