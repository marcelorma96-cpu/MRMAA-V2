require('tsx/cjs');
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const {historyFields,historyLabel}=require('../lib/security-history.ts');
const {watchReservationView,confirmReservationPage}=require('../lib/reservation-revalidation.ts');
test('one-row responses do not replace a full window until confirmed; genuine removals and true final pages work',async()=>{
 const sig=new AbortController().signal,page=(n,total=n,p=1)=>({rows:Array.from({length:n},(_,i)=>i),page:p,total});
 async function run(previous,expected,responses){let calls=0;const result=await confirmReservationPage(async()=>responses[calls++],previous,50,sig);a.equal(calls,responses.length);a.equal(result.rows.length,expected)}
 await run(5,5,[page(1,5),page(5)]);await run(5,5,[page(1),page(5)]);await run(5,1,[page(1),page(1)]);
 await run(5,0,[page(0),page(0)]);await run(0,1,[page(1,51,2)]);await run(2,2,[page(2)]);
 await a.rejects(confirmReservationPage(async()=>page(1,5),5,50,sig),/completa/);
 const ctl=new AbortController();let calls=0;await a.rejects(confirmReservationPage(async()=>{calls++;ctl.abort();return page(1)},5,50,ctl.signal));a.equal(calls,1);
});
test('a visible computer checks for missed changes even without a broadcast; background, offline and unmounted views do not',t=>{
 t.mock.timers.enable({apis:['Date'],now:10000});
 const win=new EventTarget(),doc=new EventTarget();let periodic,active=true,hits=0;
 Object.assign(win,{navigator:{onLine:true},setInterval:(f,ms)=>{a.equal(ms,45000);periodic=f;return 42},clearInterval:(id)=>{a.equal(id,42);active=false}});
 doc.visibilityState='hidden';const stop=watchReservationView(()=>hits++,win,doc);
 periodic();a.equal(hits,0);doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('focus'));a.equal(hits,1);
 t.mock.timers.tick(45000);periodic();a.equal(hits,2);win.navigator.onLine=false;win.dispatchEvent(new Event('offline'));periodic();a.equal(hits,2);
 win.navigator.onLine=true;win.dispatchEvent(new Event('online'));a.equal(hits,3);stop();a.equal(active,false);t.mock.timers.tick(5000);win.dispatchEvent(new Event('focus'));a.equal(hits,3);
});
test('history search follows rename and trash across pages, separates recreation and tenants and denies non-admins',async()=>{
 const db=new PGlite(),restaurant='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',one='00000000-0000-4000-8000-000000000003',two='00000000-0000-4000-8000-000000000004',user='00000000-0000-4000-8000-000000000005';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth; create function auth.uid() returns uuid language sql stable as $$select '${user}'::uuid$$;
 create function v2_can_read(uuid) returns boolean language sql stable as $$select true$$;
 create table v2_members(restaurant_id uuid,user_id uuid,status text,role text);create table v2_reservations(id uuid primary key,restaurant_id uuid,client_name text,event_date date,event_time time,status text,deleted_at timestamptz);
 create table v2_audit_log(id bigserial primary key,restaurant_id uuid,record_id uuid,table_name text,action text,changed_by uuid,actor_name text,actor_role text,changed_at timestamptz default now(),old_data jsonb,new_data jsonb);
 insert into v2_members values('${restaurant}','${user}','activo','administrador');
 insert into v2_reservations values('${one}','${restaurant}','Nombre final','2026-12-11','14:00','confirmada',now()),('${two}','${restaurant}','Nombre original','2026-12-11','13:00','confirmada',null);
 grant usage on schema auth to authenticated;grant select on v2_members,v2_reservations,v2_audit_log to authenticated;
 alter table v2_audit_log enable row level security;create policy test_tenant on v2_audit_log for select using(restaurant_id='${restaurant}'::uuid);`);
 const insert=(tenant,id,action,before,after)=>db.query("insert into v2_audit_log(restaurant_id, record_id,table_name,action,changed_by,actor_name,actor_role,old_data,new_data) values($1,$2,'v2_reservations',$3,$4,'Caja','gerente',$5::jsonb,$6::jsonb)",[tenant,id,action,user,JSON.stringify(before),JSON.stringify(after)]);
 const old={client_name:'Nombre original',event_time:'13:00',private_key:'never send'},next={client_name:'Nombre final',event_time:'14:00'};
 await insert(restaurant,one,'creado',null,old);await insert(restaurant,one,'modificado',old,next);await insert(restaurant,one,'enviado_papelera',next,{...next,deleted_at:'2026-11-11T12:00:00Z'});
 await insert(restaurant,two,'creado',null,old);for(let i=0;i<12;i++)await insert(restaurant,null,'impresion',null,{label:'Otros'});
 await insert(other,one,'prohibido',null,old);
 const sql=fs.readFileSync('65_HISTORIAL_SEGURIDAD.sql','utf8');await db.exec(sql);await db.exec(sql);await db.exec('set role authenticated');
 const find=async(s,p=1,r=restaurant)=>(await db.query('select v2_security_history($1,$2,$3) as h',[r,s,p])).rows[0].h;
 const searched=await find('NOMBRE ORIGINAL');a.equal(searched.total,4);a.equal(searched.rows[0].entity_id,two);a.equal(searched.rows[0].current_location,'present');a.equal(searched.rows[1].current_location,'trash');
 a.equal(searched.rows[1].current_name,'Nombre final');a.equal(searched.rows[1].current_time_of_event,'14:00:00');a.deepEqual(searched.rows.map(x=>x.action),['creado','enviado_papelera','modificado','creado']);a.ok(!JSON.stringify(searched).includes('never send'));
 const rename=searched.rows[2];a.equal(historyLabel(rename),'Nombre original → Nombre final');a.deepEqual(historyFields(rename,false).map(x=>[x.label,x.before,x.after]),[['Nombre','Nombre original','Nombre final'],['Hora de la reserva','13:00','14:00']]);
 a.equal((await find(one)).total,3);a.equal((await find('Nombre final')).total,3);a.equal((await find('enviado papelera')).total,1);a.equal((await find('%')).total,0);
 a.equal((await find('Caja',9)).page,2);a.equal((await find('',2)).rows.length,6);await a.rejects(find('',1,other),/restringido/);
 await db.exec("reset role;update v2_members set role='gerente';set role authenticated");await a.rejects(find('original'),/restringido/);
 }finally{await db.close()}
});
test('a stalled page read is cancelled so a later check can succeed',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const sig=new AbortController().signal;
 const pending=confirmReservationPage(attempt=>new Promise((_,reject)=>attempt.addEventListener('abort',()=>reject(new Error('timeout')))),5,50,sig);
 t.mock.timers.tick(20000);await a.rejects(pending,/timeout/);
 const value=await confirmReservationPage(async()=>({rows:[1,2],total:2,page:1}),5,50,sig);a.equal(value.rows.length,2);
});
test('only GETs of reservation rows bypass the browser cache; credentials, headers and signal are preserved',async t=>{
 const seen=[];t.mock.method(global,'fetch',async(url,init)=>{seen.push(init);return new Response('[]')});
 const {fetchFreshReservationRows}=require('../lib/reservation-revalidation.ts'),url='https://example.test/rest/v1/v2_reservations',init={headers:{Range:'0-49'},signal:new AbortController().signal};
 await fetchFreshReservationRows(url+'?select=*',init);await fetchFreshReservationRows(url,{...init,method:'POST'});await fetchFreshReservationRows(url+'_other',init);
 a.equal(seen[0].cache,'no-store');a.equal(seen[0].signal,init.signal);a.equal(seen[0].headers,init.headers);a.equal(seen[1].cache,undefined);a.equal(seen[2],init);
});
