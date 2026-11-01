const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>load(id.replace('./','')),Date,Set,Map,Number,JSON});return module.exports;}
const lib=load('floor-area-label'),floor=load('floor-plan');
test('display names use the requested area/table format without modifying stored names or selections',()=>{
 const d=floor.demoFloor('2026-09-30'),original=JSON.stringify(d);
 assert.equal(lib.floorAreaLabel('Salón principal',d.seatings[0],d.layout),'Salón principal - Mesa 2');
 assert.equal(lib.floorAreaLabel('Salón principal',{table_ids:['demo-t2','demo-t5'],whole_area_id:null},d.layout),'Salón principal - Mesa 2 + Mesa 5');
 assert.equal(lib.floorAreaLabel('Salón principal',{table_ids:[],whole_area_id:'salon'},d.layout),'Salón principal - Área completa');
 assert.equal(lib.floorAreaLabel('Salón principal',d.seatings[0],d.layout,true),'Salón principal - Table 2');
 assert.equal(lib.floorAreaLabel('Salón principal',null,d.layout),'Salón principal');assert.equal(JSON.stringify(d),original);
});
test('labels share adjacent-day reads, keep existing assignment before quote proposal, and propagate real read failures',async()=>{
 const d=floor.demoFloor('2026-09-30');d.reservations[0].quote_id='quote-linked';let calls=[];
 const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:name==='v2_floor_read'?d:{selection:{table_ids:['demo-t7'],whole_area_id:'terraza'}}})}}};
 const signal=new AbortController().signal;
 const labels=await lib.readLegacyEventAreaLabels(client,'tenant','reservation',[...d.reservations,{id:'none',area:'Terraza',event_date:'2026-10-01'}],false,signal);
 assert.equal(calls.length,1);assert(calls.every(c=>c.args.p_restaurant_id==='tenant'));assert.equal(labels['demo-r1'],'Salón principal - Mesa 2');assert.equal(labels.none,'Terraza - Área completa');
 calls=[];const quotes=await lib.readLegacyEventAreaLabels(client,'tenant','quote',[{id:'quote-linked',area:'Salón principal',event_date:'2026-09-30'},{id:'proposal',area:'Terraza',event_date:'2026-09-30'}],false,signal);
 assert.equal(calls.length,2);assert.equal(calls[1].args.p_quote,'proposal');assert.equal(quotes['quote-linked'],'Salón principal - Mesa 2');assert.equal(quotes.proposal,'Terraza - Área completa');
 const missing={rpc(){return {abortSignal:async()=>({error:{code:'PGRST202',message:'v2_floor_read not found'}})}}};assert.equal(Object.keys(await lib.readLegacyEventAreaLabels(missing,'tenant','reservation',d.reservations,false,signal)).length,0);
 const denied={rpc(){return {abortSignal:async()=>({error:{code:'42501',message:'FLOOR_ACCESS'}})}}};await assert.rejects(lib.readLegacyEventAreaLabels(denied,'tenant','reservation',d.reservations,false,signal),e=>e.message==='FLOOR_ACCESS');
});

test('linked quote labels follow the saved reservation area instead of its old quote area',async()=>{
 const d=floor.demoFloor('2026-09-30');d.reservations[0].quote_id='linked';d.reservations[0].area='Terraza';d.seatings[0].table_ids=['demo-t7'];d.seatings[0].whole_area_id=null;
 const original=JSON.stringify(d),client={rpc(name){return {abortSignal:async()=>({data:name==='v2_floor_read'?d:{reservation_id:'demo-r1',selection:{table_ids:['demo-t7','demo-t8'],whole_area_id:'terraza'}}})}}};
 const events=[{id:'linked',area:'Salón principal',event_date:'2026-09-30'}];
 assert.equal((await lib.readLegacyEventAreaLabels(client,'tenant','quote',events,false,new AbortController().signal)).linked,'Terraza - Mesa 7');assert.equal(JSON.stringify(d),original);
 // A linked reservation moved beyond the date window is resolved by the existing form RPC.
 d.reservations=[];assert.equal((await lib.readLegacyEventAreaLabels(client,'tenant','quote',events,false,new AbortController().signal)).linked,'Terraza - Área completa');
});


test('legacy quotes with revision-only selection do not break a page containing configured tables',async()=>{
 const d=floor.demoFloor('2026-09-30');d.reservations=[];d.seatings=[];
 const before=JSON.stringify(d);
 const responses={legacy:{selection:{plan_revision:4,revision:0},reservation_id:null},linked:{selection:{plan_revision:4,revision:0},reservation_id:'old-reservation'},none:{selection:{table_ids:[],whole_area_id:null}},table:{selection:{table_ids:['demo-t2'],whole_area_id:null}},whole:{selection:{whole_area_id:'salon'}},empty:{selection:null}};
 const client={rpc(name,args){return {abortSignal:async()=>({data:name==='v2_floor_read'?d:responses[args.p_quote]})}}};
 const events=Object.keys(responses).map(id=>({id,area:id==='none'?'':'Salón principal',event_date:'2026-09-30'}));
 const labels=await lib.readLegacyEventAreaLabels(client,'tenant','quote',events,false,new AbortController().signal);
 for(const id of ['legacy','linked','whole','empty'])assert.equal(labels[id],'Salón principal - Área completa');
 assert.equal(labels.none,'');assert.equal(labels.table,'Salón principal - Mesa 2');
 const english=await lib.readLegacyEventAreaLabels(client,'tenant','quote',events,true,new AbortController().signal);
 assert.equal(english.legacy,'Salón principal - Entire area');assert.equal(english.table,'Salón principal - Table 2');
 assert.equal(JSON.stringify(d),before);
 assert.equal(lib.floorAreaLabel('Salón principal',{revision:0},d.layout),'Salón principal');
});


test('all individual tables in one room display as entire area without changing assignments',async()=>{
 const d=floor.demoFloor('2026-09-30'),ids=d.layout.tables.filter(t=>t.areaId==='salon').map(t=>t.id);
 const selection={table_ids:ids,whole_area_id:null},before=JSON.stringify({d,selection});
 assert.equal(lib.floorAreaLabel('Salón principal',selection,d.layout),'Salón principal - Área completa');
 assert.equal(lib.floorAreaLabel('Salón principal',selection,d.layout,true),'Salón principal - Entire area');
 assert.equal(lib.floorAreaLabel('',selection,d.layout),'Salón principal - Área completa');
 assert(!lib.floorAreaLabel('Salón principal',{...selection,table_ids:ids.slice(1)},d.layout).includes('Área completa'));
 for(const extra of ['demo-t7','unknown'])assert(!lib.floorAreaLabel('Salón principal',{...selection,table_ids:[...ids,extra]},d.layout).includes('Área completa'));
 assert.equal(lib.floorAreaLabel('Salón principal',{...selection,table_ids:[...ids,ids[0]]},d.layout),'Salón principal - Área completa');
 const client={rpc(name){return {abortSignal:async()=>({data:name==='v2_floor_read'?{...d,reservations:[],seatings:[]}:{selection}})}}};
 const labels=await lib.readLegacyEventAreaLabels(client,'tenant','quote',[{id:'all',area:'Salón principal',event_date:'2026-09-30'}],false,new AbortController().signal);
 assert.equal(labels.all,'Salón principal - Área completa');
 assert.equal(JSON.stringify({d,selection}),before);
 const single={areas:[{id:'only',name:'Privado'}],tables:[{...d.layout.tables[0],id:'single',areaId:'only'}]};
 assert.equal(lib.floorAreaLabel('Privado',{table_ids:['single']},single),'Privado - Área completa');
});
