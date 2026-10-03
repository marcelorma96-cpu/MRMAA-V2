const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>load(id.replace('./','')),Date,Set,Map,Number,JSON});return module.exports;}
const {syncCatalogAreas,floorWithCatalog}=load('floor-area-sync'),{areaPlacement}=load('restaurant-map');
const {database,rpc,save,quote,snapshot,rid,id,floor,payload}=require('./helpers/floor-database.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
test('configured areas appear without tables, reuse legacy identity and preserve every existing placement and record',()=>{
 const data=load('floor-plan').demoFloor('2026-09-30');data.layout.areas[1].placement={x:53,y:5,width:41,height:60};
 const before=JSON.stringify(data),placements=plain(data.layout.areas.map(a=>areaPlacement(data.layout,a)));
 const catalog=[{id:id(1),name:'Salón principal'},{id:id(2),name:'Terraza'},{id:id(3),name:'Privado'}];
 const next=floorWithCatalog(data,catalog);assert.equal(JSON.stringify(data),before);assert.equal(next.layout.tables,data.layout.tables);assert.equal(next.reservations,data.reservations);assert.equal(next.seatings,data.seatings);assert.equal(next.revision,data.revision);
 assert.equal(next.layout.areas.length,3);assert.equal(next.layout.areas[0].id,'salon');assert.equal(next.layout.areas[0].eventAreaId,id(1));
 assert.deepEqual(plain(next.layout.areas.slice(0,2).map(a=>areaPlacement(next.layout,a))),placements);
 const empty=next.layout.areas.find(a=>a.eventAreaId===id(3));assert.equal(next.layout.tables.filter(t=>t.areaId===empty.id).length,0);
 assert.equal(syncCatalogAreas(next.layout,catalog),next.layout);assert.deepEqual(plain(syncCatalogAreas(data.layout,catalog)),plain(next.layout));
});
test('empty plans, linked renames and archived catalog entries preserve shared identities without inventing tables',()=>{
 const catalog=[{id:id(1),name:'Salón'},{id:id(2),name:'Jardín'}],empty={areas:[],tables:[],defaultDurationMinutes:120};
 const next=syncCatalogAreas(empty,catalog);assert.equal(next.areas.length,2);assert.equal(next.tables,empty.tables);assert.equal(next.defaultDurationMinutes,120);
 const rename=syncCatalogAreas(next,[{...catalog[0],name:'Salón principal'},catalog[1]]);assert.equal(rename.areas[0].id,next.areas[0].id);assert.equal(rename.areas[0].name,'Salón principal');assert.deepEqual(plain(rename.areas[0].placement),plain(next.areas[0].placement));
 const archived=syncCatalogAreas(rename,[catalog[1]]);assert.equal(archived.areas.length,2);assert.equal(archived.areas[0].id,next.areas[0].id);
 const crowded=syncCatalogAreas(empty,Array.from({length:21},(_,n)=>({id:id(n),name:'Área '+n})));assert.equal(crowded.areas.length,21);assert.equal(crowded.tables.length,0);
});
test('saving a synced layout with existing SQL preserves reservations, quotes, customers and assignments',async()=>{
 const db=await database();try{
  await save(db,10);await quote(db,null,floor(['t2']),payload({event_time:'17:00'}));
  const before=await snapshot(db),data=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);
  const catalog=[{id:id(30),name:'Salón'},{id:id(31),name:'Privado'}],next=syncCatalogAreas(data.layout,catalog);
  await rpc(db,'v2_floor_save_layout',[rid,data.revision,next]);assert.deepEqual(await snapshot(db),before);
  const saved=await rpc(db,'v2_floor_read',[rid,'2026-09-30']);assert.equal(saved.layout.areas.length,2);assert.equal(saved.layout.tables.length,data.layout.tables.length);assert.deepEqual(saved.layout.tables,data.layout.tables);
  assert.equal(syncCatalogAreas(saved.layout,catalog),saved.layout);
 }finally{await db.close()}
});
