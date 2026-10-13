const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
function load(name){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>load(id.replace(/^@\/lib\//,'').replace(/^\.\//,'')),Date,Set,Map,Number,JSON,Error});return module.exports;}
const f=load('floor-plan'),schedule=load('floor-table-schedule'),print=load('floor-print'),confirmation=load('floor-conflict-confirmation');
test('table schedules show ordered day and overnight events, entire rooms and group extra seats without changing input',()=>{
 const d=f.demoFloor('2026-10-02');d.reservations.push({...d.reservations[0],id:'late',event_time:'16:00',guests:6},{...d.reservations[0],id:'night',event_date:'2026-10-01',event_time:'23:00'},{...d.reservations[0],id:'cancelled',status:'cancelada'});d.seatings.push({...d.seatings[0],reservation_id:'late',source_time:'16:00',source_guests:6},{...d.seatings[0],reservation_id:'night',source_time:'23:00',duration_minutes:180},{...d.seatings[0],reservation_id:'cancelled'});
 const before=JSON.stringify(d),lines=schedule.tableDaySchedules(d,'2026-10-02','12h').get('demo-t2');assert.deepEqual(Array.from(lines,l=>l.id),['night','demo-r1','late']);assert.equal(lines[0].continued,true);assert.equal(lines[2].extraSeats,2);assert.equal(lines[2].time,'4 PM');assert.equal(JSON.stringify(d),before);
 const whole={...d.seatings[0],whole_area_id:'salon'};assert.equal(f.floorAddedSeats(30,whole,d.layout),6);assert.match(f.floorAddedSeatsLabel(30,whole,d.layout,true),/6 added seats for the group/);assert.equal(f.floorAddedSeats(10,null,d.layout),0);
});
test('print escapes private text, honors details/deposit choice and refuses missing or stale details',async()=>{
 const d=f.demoFloor('2026-10-02'),bookings=print.floorPrintBookings(d,'2026-10-02',[],null);d.reservations[0].client_name='<img onerror=bad>';
 const args={restaurant:'Test',date:'2026-10-02',mode:'details',map:{svg:'<svg></svg>',title:'Room',areaIds:[]},data:d,bookings,details:d.reservations.map(r=>({...r,menu:'Private menu',notes:'<script>bad</script>',deposit:123})),en:true,showDeposits:false,money:String,scope:'All',includeCancelled:false,demo:false};
 const html=print.floorPrintHtml(args);assert(html.includes('&lt;img'));assert(html.includes('&lt;script&gt;'));assert(html.includes('Private menu'));assert(!html.includes('123'));assert(!html.includes('<svg>'));
 const client=rows=>({from(name){assert.equal(name,'v2_reservations');return {select(){return this},eq(k,v){assert.equal(k,'restaurant_id');assert.equal(v,'tenant');return this},in(){return this},is(){return this},abortSignal:async()=>({data:rows})}}});
 await assert.rejects(print.readFloorPrintDetails(client([]),'tenant',d.reservations,new AbortController().signal),/FLOOR_PRINT_STALE/);
 await assert.rejects(print.readFloorPrintDetails(client(d.reservations.map(r=>({...r,guests:100}))),'tenant',d.reservations,new AbortController().signal),/FLOOR_PRINT_STALE/);
});
test('capacity and overlap confirmations are separate, each occurs once and neither survives another save',async()=>{
 const writes=[],prompts=[];const result=await confirmation.saveWithFloorConfirmation(async(conflict,extra)=>{writes.push([conflict,extra]);return {data:conflict&&extra?'saved':null,error:!extra?{message:'FLOOR_CAPACITY'}:!conflict?{message:'FLOOR_CONFLICT'}:null}},async kind=>{prompts.push(kind);return true});assert.equal(result.data,'saved');assert.deepEqual(prompts,['capacity','conflict']);assert.deepEqual(writes,[[false,false],[false,true],[true,true]]);
 assert.equal(await confirmation.saveWithFloorConfirmation(async()=>({data:null,error:{message:'FLOOR_CAPACITY'}}),async()=>false),null);
 const old=await confirmation.saveWithFloorConfirmation(async()=>({data:null,error:{message:'FLOOR_CAPACITY'}}),async()=>true);assert.equal(old.error.message,'FLOOR_EXTRA_SEATS_REQUIRED');
});
