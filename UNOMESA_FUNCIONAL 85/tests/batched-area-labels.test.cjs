const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {database,rpc:baseRpc,snapshot,rid,other,id,layout}=require('./helpers/floor-database.cjs');
// The shared fixture serializes objects for JSONB RPCs; this new RPC takes uuid[].
const rpc=(db,name,args)=>baseRpc(db,name,name==='v2_event_area_labels'
 ? [args[0],args[1],args[2]===null?null:'{'+args[2].join(',')+'}'] : args);
const migration=fs.readFileSync('54_LECTURA_RAPIDA_ETIQUETAS_MESAS.sql','utf8');
function load(name,cache={}){if(cache[name])return cache[name];const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join('lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>load(n.replace('./',''),cache),Date,Set,Map,Number,JSON});return cache[name]=module.exports;}
const labels=load('floor-area-label');
function clientFor(db,calls=[]){return{rpc(name,args){calls.push({name,args});return{abortSignal:async(signal)=>{signal.throwIfAborted();try{return{data:await rpc(db,name,Object.values(args)),error:null}}catch(e){return{data:null,error:{message:e.message,code:e.code}}}}}}};}
const read=(db,kind,events,en=false,calls=[])=>labels.readEventAreaLabels(clientFor(db,calls),rid,kind,events,en,new AbortController().signal);
async function fixture(){const db=await database();
 await db.exec(`insert into v2_quotes(id,restaurant_id,client_name,event_date,event_time,area) select ('11111111-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,'${rid}','Private customer','2026-10-01'::date+n*3,'13:00','Salón' from generate_series(1,25) n;
 insert into v2_quotes(id,restaurant_id,client_name,event_date,area) values('${id(90)}','${other}','Other customer','2026-10-01','Other room');
 insert into v2_reservations(id,restaurant_id,quote_id,client_name,event_date,event_time,area,guests,status) values('${id(70)}','${rid}','${id(4)}','Private linked customer','2027-10-01','13:00','Salón nuevo',4,'confirmada');
 insert into v2_floor_seatings(reservation_id,restaurant_id,table_ids,duration_minutes,source_date,source_time,source_guests) values('${id(70)}','${rid}',array['t1'],180,'2027-10-01','13:00',4);
 insert into v2_floor_quote_plans(quote_id,restaurant_id,selection) values
 ('${id(1)}','${rid}','{"table_ids":["t1"],"whole_area_id":null}'),
 ('${id(2)}','${rid}','{"table_ids":["t1","t2"],"whole_area_id":null}'),
 ('${id(3)}','${rid}','{"whole_area_id":"salon"}'),
 ('${id(4)}','${rid}','{"table_ids":["t1","t2"],"whole_area_id":"salon"}'),
 ('${id(5)}','${rid}','{"table_ids":[],"whole_area_id":null}'),
 ('${id(6)}','${rid}','{"revision":0}');
 update v2_quotes set area='' where id='${id(5)}';
 update v2_floor_plans set layout=jsonb_set(layout,'{areas,0,background}','{"image":"data:image/png;private-large-image"}') where restaurant_id='${rid}';
`);return db;}
async function events(db){return(await db.query(`select id,area,event_date::text from v2_quotes where restaurant_id=$1 and deleted_at is null order by id`,[rid])).rows;}
test('SQL 54 is repeatable and preserves rows, table permissions, policies and installed functions',async()=>{const db=await fixture();try{
 const before=await snapshot(db),plan=await db.query('select * from v2_floor_plans order by restaurant_id');
 const catalog=()=>db.query(`select c.relname,c.relrowsecurity,c.relacl from pg_class c where c.relnamespace='public'::regnamespace order by c.relname`);
 const bodies=()=>db.query(`select proname,prosrc,proacl,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname<>'v2_event_area_labels' order by oid`);
 const priorCatalog=await catalog(),priorFunctions=await bodies();await db.exec(migration);await db.exec(migration);
 assert.deepEqual(await snapshot(db),before);assert.deepEqual(await db.query('select * from v2_floor_plans order by restaurant_id'),plan);assert.deepEqual(await catalog(),priorCatalog);assert.deepEqual(await bodies(),priorFunctions);
 const permissions=(await db.query(`select has_function_privilege('anon','v2_event_area_labels(uuid,text,uuid[])','execute') anon,has_function_privilege('authenticated','v2_event_area_labels(uuid,text,uuid[])','execute') member`)).rows[0];assert.deepEqual(permissions,{anon:false,member:true});
 await db.exec(`begin read only;select v2_event_area_labels('${rid}','quote',array['${id(1)}'::uuid]);rollback;`);
}finally{await db.close()}});
test('25 quotes on 25 separated dates use one compact call with correct legacy, full-room and linked-reservation labels',async()=>{const db=await fixture();try{
 await db.exec(migration);const e=await events(db),calls=[],before=await snapshot(db),result=await read(db,'quote',e,false,calls);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'v2_event_area_labels');assert.equal(calls[0].args.p_ids.length,25);
 assert.equal(result[id(1)],'Salón - Mesa 1');assert.equal(result[id(2)],'Salón - Área completa');assert.equal(result[id(3)],'Salón - Área completa');assert.equal(result[id(4)],'Salón nuevo - Mesa 1');assert.equal(result[id(5)],'');assert.equal(result[id(6)],'Salón - Área completa');assert.equal(result[id(7)],'Salón - Área completa');
 const english=await read(db,'quote',e,true);assert.equal(english[id(1)],'Salón - Table 1');assert.equal(english[id(2)],'Salón - Entire area');
 const reservations=await read(db,'reservation',[{id:id(70),area:'Salón nuevo',event_date:'2027-10-01'}]);assert.equal(reservations[id(70)],'Salón nuevo - Mesa 1');
 const raw=await rpc(db,'v2_event_area_labels',[rid,'quote',e.map(x=>x.id)]),serialized=JSON.stringify(raw);
 for(const privateField of ['Private customer','Private linked customer','private-large-image','client_name','phone','source_date','revision','background'])assert(!serialized.includes(privateField));
 assert.deepEqual(await snapshot(db),before);
}finally{await db.close()}});
test('access checks, batch limit, trash and tenant isolation remain enforced',async()=>{const db=await fixture();try{
 await db.exec(migration);
 await assert.rejects(rpc(db,'v2_event_area_labels',[other,'quote',[id(90)]]),/FLOOR_ACCESS/);
 assert.equal((await rpc(db,'v2_event_area_labels',[rid,'quote',[id(90)]])).rows.length,0);
 await assert.rejects(rpc(db,'v2_event_area_labels',[rid,'quote',Array(51).fill(id(1))]),/FLOOR_LABEL_INPUT/);
 for(const kind of ['invalid',null])await assert.rejects(rpc(db,'v2_event_area_labels',[rid,kind,[id(1)]]),/FLOOR_LABEL_INPUT/);
 await assert.rejects(rpc(db,'v2_event_area_labels',[rid,'quote',null]),/FLOOR_LABEL_INPUT/);
 assert.equal((await rpc(db,'v2_event_area_labels',[rid,'quote',[]])).rows.length,0);
 await db.exec(`update v2_quotes set deleted_at=now() where id='${id(1)}';update v2_reservations set deleted_at=now() where id='${id(70)}';`);
 const result=await rpc(db,'v2_event_area_labels',[rid,'quote',[id(1),id(4)]]);assert.equal(result.rows.length,1);assert.equal(result.rows[0].selection.whole_area_id,'salon');
 assert.equal((await rpc(db,'v2_event_area_labels',[rid,'reservation',[id(70)]])).rows.length,0);
 await db.exec("set test.role='lectura'");await rpc(db,'v2_event_area_labels',[rid,'quote',[id(2)]]);
 await db.exec("set test.role='unauthorized'");await assert.rejects(rpc(db,'v2_event_area_labels',[rid,'quote',[id(2)]]),/FLOOR_ACCESS/);
 await db.exec("set test.role='administrador';create or replace function v2_session_alive() returns boolean language sql as $$select false$$;");await assert.rejects(rpc(db,'v2_event_area_labels',[rid,'quote',[id(2)]]),/FLOOR_ACCESS/);
}finally{await db.close()}});
test('reader splits large exports into bounded batches and only falls back for the missing new RPC',async()=>{
 const e=Array.from({length:125},(_,n)=>({id:id(n+1),area:'Salón',event_date:'2026-10-01'})),calls=[];
 const client={rpc(name,args){calls.push({name,args});return{abortSignal:async()=>({data:{layout,rows:args.p_ids.map(id=>({id,area:'Salón',selection:null}))},error:null})}}};
 const result=await labels.readEventAreaLabels(client,rid,'quote',e,false,new AbortController().signal);assert.equal(Object.keys(result).length,125);assert.deepEqual(calls.map(x=>x.args.p_ids.length),[50,50,25]);
 const fallbackCalls=[],missing={rpc(name,args){fallbackCalls.push(name);return{abortSignal:async()=>name==='v2_event_area_labels'?{error:{code:'PGRST202',message:'v2_event_area_labels is missing'}}:{data:name==='v2_floor_read'?{layout,seatings:[],reservations:[]}:{selection:{table_ids:['t1']}}}}}};
 const fallback=await labels.readEventAreaLabels(missing,rid,'quote',[e[0]],false,new AbortController().signal);assert.equal(fallback[e[0].id],'Salón - Mesa 1');assert.deepEqual(fallbackCalls,['v2_event_area_labels','v2_floor_read','v2_floor_form']);
 for(const error of [{code:'42501',message:'FLOOR_ACCESS'},{code:'57014',message:'timeout'}]){let n=0;const rejected={rpc(){n++;return{abortSignal:async()=>({error})}}};await assert.rejects(labels.readEventAreaLabels(rejected,rid,'quote',e,false,new AbortController().signal),e=>e.message===error.message);assert.equal(n,1)}
 const aborted=new AbortController();aborted.abort();let count=0;await assert.rejects(labels.readEventAreaLabels({rpc(){count++}},rid,'quote',e,false,aborted.signal));assert.equal(count,0);
});
