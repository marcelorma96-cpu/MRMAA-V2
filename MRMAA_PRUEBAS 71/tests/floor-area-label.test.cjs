const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>load(id.replace('./','')),Date,Set,Map,Number,JSON});return module.exports;}
const lib=load('floor-area-label'),floor=load('floor-plan');
test('display names use the requested area/table format without modifying stored names or selections',()=>{
 const d=floor.demoFloor('2026-09-30'),original=JSON.stringify(d);
 assert.equal(lib.floorAreaLabel('Salón principal',d.seatings[0],d.layout),'Salón principal - Mesa 2');
 assert.equal(lib.floorAreaLabel('Salón principal',{table_ids:['demo-t2','demo-t5'],whole_area_id:null},d.layout),'Salón principal - Mesa 2 + Mesa 5');
 assert.equal(lib.floorAreaLabel('Salón principal',{table_ids:[],whole_area_id:'salon'},d.layout),'Salón principal - Salón completo');
 assert.equal(lib.floorAreaLabel('Salón principal',d.seatings[0],d.layout,true),'Salón principal - Table 2');
 assert.equal(lib.floorAreaLabel('Salón principal',null,d.layout),'Salón principal');assert.equal(JSON.stringify(d),original);
});
test('labels share adjacent-day reads, keep existing assignment before quote proposal, and propagate real read failures',async()=>{
 const d=floor.demoFloor('2026-09-30');d.reservations[0].quote_id='quote-linked';let calls=[];
 const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:name==='v2_floor_read'?d:{selection:{table_ids:['demo-t7'],whole_area_id:'terraza'}}})}}};
 const signal=new AbortController().signal;
 const labels=await lib.readEventAreaLabels(client,'tenant','reservation',[...d.reservations,{id:'none',area:'Terraza',event_date:'2026-10-01'}],false,signal);
 assert.equal(calls.length,1);assert(calls.every(c=>c.args.p_restaurant_id==='tenant'));assert.equal(labels['demo-r1'],'Salón principal - Mesa 2');assert.equal(labels.none,'Terraza - Salón completo');
 calls=[];const quotes=await lib.readEventAreaLabels(client,'tenant','quote',[{id:'quote-linked',area:'Salón principal',event_date:'2026-09-30'},{id:'proposal',area:'Terraza',event_date:'2026-09-30'}],false,signal);
 assert.equal(calls.length,2);assert.equal(calls[1].args.p_quote,'proposal');assert.equal(quotes['quote-linked'],'Salón principal - Mesa 2');assert.equal(quotes.proposal,'Terraza - Salón completo');
 const missing={rpc(){return {abortSignal:async()=>({error:{code:'PGRST202',message:'v2_floor_read not found'}})}}};assert.equal(Object.keys(await lib.readEventAreaLabels(missing,'tenant','reservation',d.reservations,false,signal)).length,0);
 const denied={rpc(){return {abortSignal:async()=>({error:{code:'42501',message:'FLOOR_ACCESS'}})}}};await assert.rejects(lib.readEventAreaLabels(denied,'tenant','reservation',d.reservations,false,signal),e=>e.message==='FLOOR_ACCESS');
});

test('linked quote labels follow the saved reservation area instead of its old quote area',async()=>{
 const d=floor.demoFloor('2026-09-30');d.reservations[0].quote_id='linked';d.reservations[0].area='Terraza';d.seatings[0].table_ids=['demo-t7'];d.seatings[0].whole_area_id=null;
 const original=JSON.stringify(d),client={rpc(name){return {abortSignal:async()=>({data:name==='v2_floor_read'?d:{reservation_id:'demo-r1',selection:{table_ids:['demo-t7','demo-t8'],whole_area_id:'terraza'}}})}}};
 const events=[{id:'linked',area:'Salón principal',event_date:'2026-09-30'}];
 assert.equal((await lib.readEventAreaLabels(client,'tenant','quote',events,false,new AbortController().signal)).linked,'Terraza - Mesa 7');assert.equal(JSON.stringify(d),original);
 // A linked reservation moved beyond the date window is resolved by the existing form RPC.
 d.reservations=[];assert.equal((await lib.readEventAreaLabels(client,'tenant','quote',events,false,new AbortController().signal)).linked,'Terraza - Salón completo');
});
