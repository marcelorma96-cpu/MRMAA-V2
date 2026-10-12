const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache=new Map();function load(name){const file=path.resolve(__dirname,'../lib',name+'.ts');if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:p=>load(p.replace('./',''))});return module.exports;}
const {floorWithCatalog}=load('floor-area-sync'),{floorAreaAvailability,floorDayBookings,conflicts}=load('floor-plan');
const reservation={id:'old',client_name:'Cliente existente',phone:'+502 5555 0000',event_date:'2026-10-03',event_time:'12:00',guests:20,area:'Salón Azul',status:'confirmada'};
const catalog=[{id:'azul',name:'Salón Azul'}];
test('existing area-only booking occupies its whole room at its time, even before tables exist, without writes',()=>{
 const raw={revision:0,layout:{areas:[],tables:[],defaultDurationMinutes:120},seatings:[],reservations:[reservation]};const before=JSON.stringify(raw);
 const data=floorWithCatalog(raw,catalog),room=data.layout.areas[0];assert.equal(data.seatings.length,1);assert.equal(data.seatings[0].whole_area_id,room.id);assert.equal(data.seatings[0].revision,0);
 assert.equal(floorAreaAvailability(data,room.id,'2026-10-03','12:30',30).full,true);assert.equal(floorAreaAvailability(data,room.id,'2026-10-03','14:00',30).full,false);assert.equal(floorAreaAvailability(data,room.id,'2026-10-04','12:30',30).full,false);
 assert.equal(floorDayBookings(data,'2026-10-03',undefined,room.id).length,1);assert.equal(JSON.stringify(raw),before);assert.equal(floorWithCatalog(data,catalog),data);
 const withTables=floorWithCatalog({...raw,layout:{...data.layout,tables:[{id:'t1',areaId:room.id,name:'M1',shape:'round',seats:4,x:20,y:20,rotation:0}]}},catalog);assert.equal(conflicts(withTables,['t1'],'2026-10-03','12:00',30).length,1);assert.equal(withTables.seatings[0].table_ids[0],'t1');assert.equal(JSON.stringify(raw),before);
});
test('explicit assignments, cancellation, no area/time and overnight boundaries keep their meaning',()=>{
 const seat={reservation_id:'explicit',table_ids:['t1'],whole_area_id:null,duration_minutes:60,service_status:'finished',source_date:reservation.event_date,source_time:'12:00',source_guests:20,revision:2};
 const raw={revision:1,layout:{areas:[{id:'a',name:'Salón Azul'}],tables:[]},seatings:[seat],reservations:[{...reservation,id:'explicit'},{...reservation,id:'canceled',status:'cancelada'},{...reservation,id:'noarea',area:''},{...reservation,id:'notime',event_time:null},{...reservation,id:'overnight',event_time:'23:30'}]};
 const data=floorWithCatalog(raw,catalog);assert.equal(data.seatings.length,2);assert.equal(data.seatings[0],seat);assert.equal(floorAreaAvailability(data,'a','2026-10-03','12:30',30).full,false);
 assert.equal(floorAreaAvailability(data,'a','2026-10-04','01:00',30).full,true);assert.equal(floorAreaAvailability(data,'a','2026-10-04','02:30',30).full,false);assert.equal(floorDayBookings(data,'2026-10-04',undefined,'a').length,1);
});
