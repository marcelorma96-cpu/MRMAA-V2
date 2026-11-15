const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,cache={}) {
 file=path.resolve(file);if(cache[file])return cache[file].exports;
 const module={exports:{}};cache[file]=module;
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,Date,TextEncoder,AbortController,require:name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts'),cache):require(name)});
 return module.exports;
}
const report=load('lib/report-data.ts'),presentation=load('lib/report-presentation.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const query={restaurantId:'restaurant-a',kind:'pending',from:'2026-09-01',to:'2026-09-30',search:'',timezone:'America/Guatemala'};
const shift={id:'day',name:'Día',start_time:'09:00',end_time:'17:00',break_minutes:60};
const schedule=(options={})=>({id:'s1',employee_id:'e1',area_id:'a1',shift_id:'day',work_date:'2026-09-01',entry_type:'work',break_start:null,break_end:null,notes:'',...options});

test('hours use auxiliary times, midnight and assignment meals without double subtraction',()=>{
 assert.deepEqual(plain(report.scheduledMinutes(schedule(),shift)),{net:420,meal:60});
 assert.deepEqual(plain(report.scheduledMinutes(schedule({break_start:'00:00',break_end:'00:30'}),{...shift,start_time:'22:00',end_time:'06:00'})),{net:450,meal:30});
 assert.deepEqual(plain(report.scheduledMinutes(schedule(),{...shift,end_time:null,end_text:'CIERRE',calculation_end_time:'16:30'})),{net:390,meal:60});
 assert.equal(report.scheduledMinutes(schedule(),{...shift,end_time:null,end_text:'CIERRE'}),null);
 assert.equal(report.scheduledMinutes(schedule({break_start:'13:00'}),shift),null);
 assert.equal(report.scheduledMinutes(schedule({break_start:'16:30',break_end:'18:00'}),shift),null);
 assert.equal(report.scheduledMinutes(schedule(),{...shift,break_minutes:900}),null);
 assert.equal(report.scheduledMinutes(schedule({entry_type:'vacation'}),shift),null);
});
test('employee totals use types, all areas and inactive employees; notes do not change totals',()=>{
 const rows=[schedule({notes:'Sin permiso especial; comida y descanso normales'}),schedule({id:'s2',work_date:'2026-09-02',area_id:'a2',entry_type:'rest'}),schedule({id:'s3',work_date:'2026-09-03',entry_type:'permission'}),schedule({id:'s4',work_date:'2026-09-04',entry_type:'vacation'}),schedule({id:'s5',work_date:'2026-09-05',shift_id:null})];
 const result=plain(report.employeeReport([{id:'e1',name:'Ana',employee_code:'01',area_id:'a1'},{id:'e2',name:'Luis',employee_code:'02',area_id:'a1',active:false}],rows,[shift],[{id:'a1',name:'Cocina'},{id:'a2',name:'Terraza'}]));
 assert.deepEqual(result[0],{Empleado:'Ana',Codigo:'01',Area:'Cocina, Terraza',Dias:2,HorasNetas:7,SinCalculo:1,HorasComida:1,Descansos:1,Permisos:1,Vacaciones:1});
 assert.equal(result[1].Dias,0);assert.equal(result[1].HorasNetas,0);
});
test('frequent customers exclude cancellations and merge only unambiguous historical identities',()=>{
 const base={client_id:'c1',client_name:'José Pérez',phone:'+502 1234',event_date:'2026-09-01',guests:3,status:'confirmada'};
 const rows=[{...base,id:'1'},{...base,id:'2',event_date:'2026-09-03',client_id:null,client_name:'JOSE PEREZ',phone:'5021234'},{...base,id:'3',status:'CANCELADA',guests:100},{...base,id:'4',client_id:'c2',client_name:'Otro',phone:'888',guests:2}];
 const result=plain(report.frequentReport(rows));assert.equal(result[0].Reservaciones,2);assert.equal(result[0].Invitados,6);assert.equal(result[0].Ultima,'03/09/2026');assert.equal(result.length,2);
 rows.push({...base,id:'5',client_id:'c3'});const ambiguous=plain(report.frequentReport(rows));assert.equal(ambiguous.length,4);
});
test('search matches values, accents and literal punctuation, never JSON field names',()=>{
 const rows=[{Cliente:'José',Telefono:'123',Numero:'#2001'},{Cliente:'Ana',Telefono:'50%'}];
 assert.equal(report.filterReport(rows,'jose').length,1);assert.equal(report.filterReport(rows,'Cliente').length,0);assert.equal(report.filterReport(rows,'%').length,1);assert.equal(report.filterReport([{Estado:'pendiente'}],'Pending',(key,value)=>presentation.reportCell(key,value,'en','24h')).length,1);
});
test('invalid/reversed dates and overlong operational periods are rejected',()=>{
 for(const dates of [{from:'2026-02-30'},{from:'2026-10-01'},{to:''}])assert.throws(()=>report.validateReportQuery({...query,...dates}));
 assert.throws(()=>report.validateReportQuery({...query,kind:'comparison',from:'2025-01-01'}));
 assert.doesNotThrow(()=>report.validateReportQuery({...query,kind:'comparison',from:'2024-01-01',to:'2024-12-31'}));
});
test('source paging honors actual batch sizes and refuses incomplete, changing or excessive data',async()=>{
 const data=Array.from({length:7},(_,i)=>({id:String(i)})),offsets=[];
 const result=await report.readReportSource(async offset=>{offsets.push(offset);return{data:data.slice(offset,offset+2),count:7,error:null}});
 assert.equal(result.length,7);assert.deepEqual(offsets,[0,2,4,6]);
 await assert.rejects(report.readReportSource(async()=>({data:[],count:2,error:null})),/completo/);
 await assert.rejects(report.readReportSource(async()=>({data:[],count:10001,error:null})),/10,000/);
 let calls=0;await assert.rejects(report.readReportSource(async()=>({data:[{id:String(calls)}],count:++calls===1?2:3,error:null})),/cambiaron/);
});

function databaseClient(db,state={role:'administrador',plan:'advanced',reads:0}) {
 return {auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},rpc:async name=>({data:name==='v2_effective_membership'?{role:state.role,status:'activo'}:{plan_code:state.plan},error:null}),from(table){
  state.reads++;const values=[],where=[],order=[];let columns,first=0,size=500,signal;
  const bind=value=>{values.push(value);return '$'+values.length};
  const builder={select(value,options){columns=value;assert.equal(options.count,'exact');return this},eq(key,value){where.push(key+'='+bind(value));return this},gte(key,value){where.push(key+'>='+bind(value));return this},lte(key,value){where.push(key+'<='+bind(value));return this},is(key,value){assert.equal(value,null);where.push(key+' is null');return this},order(key){order.push(key);return this},range(start,end){first=start;size=Math.min(end-start+1,2);return this},abortSignal(value){signal=value;return this},async then(resolve,reject){try{
   signal?.throwIfAborted();assert.equal(values[0],query.restaurantId);assert(order.includes('id'));
   const count=Number((await db.query('select count(*) from '+table+' where '+where.join(' and '),values)).rows[0].count);
   const rows=(await db.query('select '+columns+' from '+table+' where '+where.join(' and ')+' order by '+order.join(',')+' offset '+first+' limit '+size,values)).rows;
   return resolve({data:rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Date?value.toISOString().slice(0,10):key==='total'?Number(value):value]))),count,error:null});
  }catch(error){return reject(error)}}};return builder;
 }};
}
test('pending reader against PostgreSQL excludes trash, other tenants, dates and all nonpending states',async()=>{
 const db=new PGlite();try{
 await db.exec(`create table v2_quotes(id text,restaurant_id text,quote_number int,event_date date,client_name text,client_phone text,total numeric,status text,deleted_at timestamptz);
 insert into v2_quotes values ('1','restaurant-a',1,'2026-09-01','Ana','123',120.50,'pendiente',null),('2','restaurant-a',2,'2026-09-02','Luis','456',300,'pendiente',null),('3','restaurant-a',3,'2026-09-03','Marta','789',400,'pendiente',null),('4','restaurant-a',4,'2026-09-01','Cancelada','',0,'cancelada',null),('5','restaurant-b',5,'2026-09-01','Otro negocio','',0,'pendiente',null),('6','restaurant-a',6,'2026-10-01','Fuera','',0,'pendiente',null),('7','restaurant-a',7,'2026-09-01','Papelera','',0,'pendiente',now()),('8','restaurant-a',8,'2026-09-01','Aprobada','',0,'aprobada',null),('9','restaurant-a',9,'2026-09-01','Convertida','',0,'convertida',null);`);
 const rows=plain(await report.readLocalReport(databaseClient(db),query));assert.deepEqual(rows.map(row=>row.Numero),['#3','#2','#1']);assert.equal(Number(rows[2].Total),120.5);
 assert.equal((await db.query('select count(*) from v2_quotes')).rows[0].count,9);
 }finally{await db.close()}
});
test('new report readers verify administrator and Advanced before table access',async()=>{
 for(const state of [{role:'lectura',plan:'advanced',reads:0},{role:'administrador',plan:'basic',reads:0}]){
  await assert.rejects(report.readLocalReport(databaseClient(null,state),query));assert.equal(state.reads,0);
 }
});
function rpcClient(rows,calls,cap=120){return{rpc(name,args){calls.push({name,args});return Promise.resolve({error:null,data:rows.slice(args.p_offset,args.p_offset+Math.min(args.p_limit,cap)).map(row_data=>({row_data,total_count:rows.length}))})}}}
test('all-row exports follow total count under lower service limits and preserve numeric values',async()=>{
 const rows=Array.from({length:1204},(_,i)=>({Numero:'#'+i,Total:100.25,Anticipo:20.5,Saldo:79.75})),calls=[];
 const output=await report.readReportExport(rpcClient(rows,calls),{...query,kind:'allquotes'});assert.equal(output.length,1204);assert.equal(output[1203].Total,100.25);assert.equal(calls.at(-1).args.p_offset,1120);
 await assert.rejects(report.readReportExport(rpcClient(rows,[]),{...query,kind:'allquotes'},1000),/supera/);
});
test('RPC routing preserves timezone, period, tenant and total; search is against displayed data values',async()=>{
 for(const kind of ['allquotes','reserved','approved','deposits','conversion','cancellations','demand','balances','leadtime','comparison']){
  const calls=[],client=rpcClient([{Cliente:'Ana',Total:10}],calls);
  await report.readReportPage(client,{...query,kind},0,50);assert.equal(calls[0].args.p_restaurant_id,query.restaurantId);assert.equal(calls[0].args.p_from,query.from);
  assert.equal(calls[0].args.p_timezone,['balances','leadtime','comparison'].includes(kind)?query.timezone:undefined);
 }
 assert.equal((await report.readReportExport(rpcClient([{Cliente:'Ana'}],[]),{...query,kind:'allquotes',search:'Cliente'})).length,0);
});
test('missing values are not changed to zero and event hours follow 12/24-hour preferences',()=>{
 assert.equal(presentation.reportCell('Actual',null,'es','24h'),'—');assert.equal(presentation.reportCell('Hora','19:30:00','es','12h'),'07:30 PM');assert.equal(presentation.reportCell('Hora','19:30:00','en','24h'),'19:30');
 assert.equal(presentation.reportCell('Cliente','Pendiente','en','24h'),'Pendiente');assert.equal(presentation.reportCell('Total',0,'en','24h'),0);assert(presentation.reportColumns.employees.includes('Vacaciones'));
});
