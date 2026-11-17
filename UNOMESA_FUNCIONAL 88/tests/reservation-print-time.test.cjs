const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(name){const file=path.resolve(__dirname,'..',name),module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,Date,Set,Map,Number,JSON,Error,require:id=>id.startsWith('@/')?load(id.slice(2)+'.ts'):id.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),id))+(/graphic$/.test(id)?'.tsx':'.ts')):require(id)});return module.exports;}
const time=load('lib/reservation-print-time.ts'),floor=load('lib/floor-plan.ts'),print=load('lib/floor-print.ts'),schedule=load('lib/floor-table-schedule.ts');
const range={mode:'range',from:'12:00',to:'15:00'},all=time.allReservationPrintTimes,day='2026-10-18';
function fixture(){const data=floor.demoFloor(day),r=data.reservations[0],s=data.seatings[0];const values=[['early','11:59:59',day],['start','12:00',day],['middle','14:30',day],['end','15:00:59.999999',day],['late','15:01',day],['night','23:00','2026-10-17'],['unknown',null,day],['cancelled','13:00',day],['unassigned','12:30',day]];data.reservations=values.map(([id,event_time,event_date])=>({...r,id,client_name:id,event_time,event_date,status:id==='cancelled'?'cancelada':'confirmada'}));data.seatings=data.reservations.filter(r=>r.id!=='unassigned').map(r=>({...s,reservation_id:r.id,source_time:r.event_time||'12:00',source_date:r.event_date,duration_minutes:180}));return data;}
test('inclusive endpoint minutes, missing times, midnight and invalid selections',()=>{
 for(const value of ['12:00','12:00:00','14:59:59','15:00:59.999999'])assert.equal(time.matchesReservationPrintTime(value,range),true,value);
 for(const value of ['11:59:59','15:01',null,'','25:00'])assert.equal(time.matchesReservationPrintTime(value,range),false,String(value));
 assert.equal(time.matchesReservationPrintTime(null,all),true);
 assert.equal(time.matchesReservationPrintTime('23:59:59.999999',{...range,from:'00:00',to:'23:59'}),true);
 for(const selection of [{...range,from:''},{...range,to:'11:00'},{...range,to:'24:00'}]){assert.ok(time.reservationPrintTimeError(selection));assert.equal(time.matchesReservationPrintTime('13:00',selection),false);}
 assert.equal(time.matchesReservationPrintTime('12:00:59',{...range,to:'12:00'}),true);
});
test('Postgres time filtering matches the floor for fractional seconds and keeps tenant/date/deleted constraints',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();try{
 await db.exec('create table reservations(id text, event_time time, restaurant_id text, event_date date, deleted boolean default false)');
 const values=[['start','12:00','owner',day,false],['end','15:00:59.999999','owner',day,false],['late','15:01','owner',day,false],['missing',null,'owner',day,false],['other','13:00','other',day,false],['deleted','13:00','owner',day,true],['other-day','13:00','owner','2026-10-19',false]];
 for(const row of values)await db.query('insert into reservations values ($1,$2,$3,$4,$5)',row);
 const filters=[],query={gte:(key,value)=>{filters.push([key,'>=',value]);return query},lte:(key,value)=>{filters.push([key,'<=',value]);return query}};
 assert.equal(time.applyReservationPrintTime(query,range),query);
 const result=await db.query(`select id from reservations where restaurant_id=$1 and event_date=$2 and deleted=false and ${filters.map(([key,op],i)=>`${key}${op}$${i+3}::time`).join(' and ')} order by event_time`,['owner',day,...filters.map(x=>x[2])]);
 assert.deepEqual(result.rows.map(r=>r.id),['start','end']);
 const before=filters.length;assert.equal(time.applyReservationPrintTime(query,all),query);assert.equal(filters.length,before);
 }finally{await db.close()}
});
test('floor range selects arrivals on the selected day, ordered and with area/cancellation choices intact',()=>{
 const data=fixture(),before=JSON.stringify(data);
 const ids=selection=>Array.from(print.floorPrintBookings(data,day,[],null,false,selection),b=>b.reservation.id);
 assert.deepEqual(ids(range),['start','unassigned','middle','end']);
 assert(ids(all).includes('night'));assert(ids(all).includes('unknown'));assert(!ids(all).includes('cancelled'));
 assert(print.floorPrintBookings(data,day,[],null,true,range).some(b=>b.reservation.id==='cancelled'));
 assert.equal(print.floorPrintBookings(data,day,[],['missing-area'],false,range).length,0);
 assert.equal(JSON.stringify(data),before);
});
test('printed table schedules and room SVG exclude times outside the range without changing saved data',()=>{
 const data=fixture(),before=JSON.stringify(data),selected=print.floorPrintData(data,day,range),lines=schedule.tableDaySchedules(selected,day,'24h');
 for(const rows of lines.values())assert.deepEqual(Array.from(rows,r=>r.id),['start','middle','end']);
 const {FloorPrintArea}=load('components/floor-print-area.tsx'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const html=renderToStaticMarkup(React.createElement(FloorPrintArea,{data:selected,areaId:data.layout.tables[0].areaId,date:day,timeFormat:'24h',en:false,states:new Map()}));
 assert.match(html,/data-booking-id="start"/);assert.match(html,/data-booking-id="end"/);assert.doesNotMatch(html,/data-booking-id="(early|late|night|cancelled|unknown)"/);
 assert.equal(selected.layout,data.layout);assert.equal(JSON.stringify(data),before);
});
test('report and PDF input carry the selected interval, chronological rows and empty selections',()=>{
 const data=fixture(),bookings=print.floorPrintBookings(data,day,[],null,false,range),args={restaurant:'Fixture',date:day,mode:'reservations',map:{svg:'<svg/>',title:'Room',areaIds:[]},data,bookings,en:true,timeFormat:'12h',showDeposits:false,money:String,scope:'All rooms',includeCancelled:false,demo:true,timeSelection:range};
 const report=print.floorPrintReport(args);assert.match(report.context,/From 12:00 PM to 03:00 PM/);assert.deepEqual(Array.from(report.rows,r=>r[3]),['start','unassigned','middle','end']);
 const html=print.floorPrintHtml({...args,bookings:[]});assert.match(html,/No reservations for this selection/);
 assert.match(time.reservationPrintTimeLabel(range,false,'24h'),/Desde 12:00 hasta 15:00/);
});
