const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {database,rpc,rid,other,id}=require('./helpers/floor-database.cjs');
const root=path.resolve(__dirname,'..');
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>load(id.replace('./','')),Date,Set,Map,Number,JSON});return module.exports;}
const {floorWithCatalog}=load('floor-area-sync');
const plain=value=>JSON.parse(JSON.stringify(value));
async function legacySnapshot(db){
 const tables=['v2_restaurants','v2_clients','v2_reservation_areas','v2_quotes','v2_quote_items','v2_reservations'];
 const records={};for(const table of tables)records[table]=(await db.query(`select to_jsonb(t) as row from ${table} t order by id`)).rows;
 return {records,columns:(await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name not like 'v2_floor_%' order by table_name,ordinal_position")).rows,policies:(await db.query("select * from pg_policies where tablename not like 'v2_floor_%' order by tablename,policyname")).rows,functions:(await db.query("select proname,pg_get_functiondef(p.oid) as definition,proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'v2_%' and proname not like 'v2_floor_%' order by proname")).rows};
}
test('first activation of SQL 43–46 preserves existing customers, areas, quotes, reservations, account settings and access functions',async()=>{
 let before;
 const db=await database({beforeInstall:async(db)=>{
  await db.exec(`alter table v2_restaurants add column settings jsonb; alter table v2_restaurants add column sin_suscripcion boolean; alter table v2_restaurants add column plan_code text;
   update v2_restaurants set settings='{"keep":"unchanged","time_format":"12h"}',sin_suscripcion=true,plan_code='advanced' where id='${rid}';
   insert into v2_clients(id,restaurant_id,name) values('${id(1)}','${rid}','Cliente anterior');
   insert into v2_reservation_areas(id,restaurant_id) values('${id(2)}','${rid}'),('${id(3)}','${rid}'),('${id(4)}','${other}');
   insert into v2_quotes(id,restaurant_id,client_id,client_name,event_date,event_time,area,area_id,guests,total,deposit,balance,internal_notes,status) values('${id(5)}','${rid}','${id(1)}','Cliente anterior','2026-09-30','13:00','Salón principal','${id(2)}',12,500,100,400,'Conservar nota','convertida');
   insert into v2_quote_items(id,quote_id,name,quantity,position) values('${id(6)}','${id(5)}','Menú anterior',12,1);
   insert into v2_reservations(id,restaurant_id,quote_id,client_id,client_name,phone,event_date,event_time,area,area_id,guests,total,deposit,balance,menu,notes,status) values('${id(7)}','${rid}','${id(5)}','${id(1)}','Cliente anterior','555','2026-09-30','13:00','Salón principal','${id(2)}',12,500,100,400,'Menú anterior','Sin cambios','confirmada');`);
  before=await legacySnapshot(db);
 }});
 try{
  assert.deepEqual(await legacySnapshot(db),before);
  for(const file of ['45_CRUCES_HORARIO_CONFIRMADOS.sql','46_ASIENTOS_ADICIONALES.sql']){await db.exec(fs.readFileSync(path.join(root,file),'utf8'));assert.deepEqual(await legacySnapshot(db),before);}
  // Remove only the helper's synthetic layout to model a restaurant opening its first floor plan.
  await db.query('delete from v2_floor_plans where restaurant_id=$1',[rid]);
  const raw=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.equal(raw.revision,0);assert.equal(raw.layout.areas.length,0);assert.equal(raw.seatings.length,0);assert.equal(raw.reservations.length,1);
  const catalog=[{id:id(2),name:'Salón principal'},{id:id(3),name:'Terraza'}],next=floorWithCatalog(raw,catalog);
  assert.deepEqual(plain(next.layout.areas.map(a=>({id:a.eventAreaId,name:a.name}))),catalog);assert.equal(next.layout.tables.length,0);assert.equal(next.reservations,raw.reservations);assert.equal(raw.seatings.length,0);assert.equal(next.seatings.length,1);assert.equal(next.seatings[0].whole_area_id,next.layout.areas[0].id);assert.equal(next.seatings[0].inferred_from_area,true);assert.equal(floorWithCatalog(next,catalog),next);
  assert.equal((await db.query('select count(*)::int n from v2_floor_plans')).rows[0].n,0);assert.deepEqual(await legacySnapshot(db),before);
  await rpc(db,'v2_floor_save_layout',[rid,0,next.layout]);assert.deepEqual(await legacySnapshot(db),before);
  const saved=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.equal(saved.layout.areas.length,2);assert.equal(saved.layout.tables.length,0);assert.equal(saved.seatings.length,0);
 }finally{await db.close()}
});
