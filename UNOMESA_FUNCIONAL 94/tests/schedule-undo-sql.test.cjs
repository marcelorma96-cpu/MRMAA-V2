const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const restaurant=id(1),foreign=id(2),actor=id(3),otherActor=id(4),employee=id(10),secondEmployee=id(11),area=id(20),shift=id(30),otherShift=id(31);
const sql=fs.readFileSync(path.join(__dirname,'../72_DESHACER_HORARIOS.sql'),'utf8');
const date=n=>'2026-11-'+String(n).padStart(2,'0');
const row=(n,day,extra={})=>({id:id(n),employee_id:employee,work_date:date(day),area_id:area,shift_id:shift,entry_type:'work',color:null,break_start:null,break_end:null,notes:'Original '+n,...extra});
const snapshot=r=>Object.fromEntries(['id','employee_id','work_date','area_id','shift_id','entry_type','color','break_start','break_end','notes'].map(key=>[key,r[key]??null]));
async function fixture(){
 const db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.v2_effective_membership(uuid) returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('test.role',true),'status',current_setting('test.status',true))$$;
 create function public.v2_session_alive() returns boolean language sql stable as $$select current_setting('test.session',true)='yes'$$;
 create function public.v2_mfa_session_allowed() returns boolean language sql stable as $$select current_setting('test.mfa',true)='yes'$$;
 create function public.v2_can_read(uuid) returns boolean language sql stable as $$select $1='${restaurant}'::uuid$$;
 create function public.v2_plan_has_schedules(uuid) returns boolean language sql stable as $$select current_setting('test.plan',true)='yes'$$;
 create function public.v2_account_billing(uuid) returns jsonb language sql stable as $$select jsonb_build_object('can_write',current_setting('test.paid',true)='yes')$$;
 create table v2_restaurants(id uuid primary key);
 insert into v2_restaurants values('${restaurant}'),('${foreign}');
 create table v2_areas(id uuid primary key,restaurant_id uuid,active boolean default true);
 create table v2_employees(id uuid primary key,restaurant_id uuid,area_id uuid,active boolean default true);
 create table v2_shifts(id uuid primary key,restaurant_id uuid,active boolean default true,schedule_area_ids uuid[]);
 create table v2_schedules(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null references v2_restaurants(id) on delete cascade,employee_id uuid not null references v2_employees(id),work_date date not null,area_id uuid references v2_areas(id),shift_id uuid references v2_shifts(id),entry_type text not null,color text,break_start time,break_end time,notes text,created_at timestamptz not null default '2025-01-01T12:00:00Z',private_metadata text default 'original metadata',unique(restaurant_id,employee_id,work_date));
 grant usage on schema public,auth to authenticated;
 alter table v2_schedules enable row level security;
 insert into v2_areas values('${area}','${restaurant}',true),('${id(21)}','${foreign}',true);
 insert into v2_employees values('${employee}','${restaurant}','${area}',true),('${secondEmployee}','${restaurant}','${area}',true),('${id(12)}','${foreign}','${id(21)}',true);
 insert into v2_shifts values('${shift}','${restaurant}',true,'{${area}}'),('${otherShift}','${restaurant}',true,'{${area}}'),('${id(32)}','${foreign}',true,'{${id(21)}}');
 set test.uid='${actor}';set test.role='gerente';set test.status='activo';set test.session='yes';set test.mfa='yes';set test.plan='yes';set test.paid='yes';`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../70_TURNOS_POR_AREA.sql'),'utf8'));
 const insert=async r=>db.query('insert into v2_schedules(id,restaurant_id,employee_id,work_date,area_id,shift_id,entry_type,color,break_start,break_end,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[r.id,restaurant,r.employee_id,r.work_date,r.area_id,r.shift_id,r.entry_type,r.color,r.break_start,r.break_end,r.notes]);
 const rows=async()=> (await db.query('select to_jsonb(s) as row from v2_schedules s order by id')).rows.map(r=>r.row);
 const rpc=async(name,args)=>{await db.exec('set role authenticated');try{return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;}finally{await db.exec('reset role')}};
 const apply=(n,changes,label='edit',rid=restaurant)=>rpc('v2_apply_schedule_change',[rid,id(n),JSON.stringify(changes),label]);
 const undo=(n,rid=restaurant)=>rpc('v2_undo_schedule_change',[rid,id(n)]);
 const last=()=>rpc('v2_last_schedule_change',[restaurant]);
 return{db,insert,rows,apply,undo,last};
}

test('installation preserves schedules; complete edits undo atomically with stable IDs and durable receipts',async()=>{
 const f=await fixture();const {db,insert,rows,apply,undo,last}=f;
 try{
 const a=row(100,1,{break_start:'12:00',break_end:'13:00'}),b=row(101,2);
 await insert(a);await insert(b);const original=await rows();
 await db.exec(sql);await db.exec(sql);assert.deepEqual(await rows(),original,'installation/reinstallation must not touch assignments');
 assert.equal(await last(),null);
 const changes=[{before:a,after:{...a,shift_id:otherShift,notes:'Changed'}},{before:b,after:{...b,entry_type:'rest',shift_id:null,color:'#dbeafe'}}];
 const receipt=await apply(200,changes);assert.deepEqual(receipt,{id:id(200),count:2,label:'edit',undone:false,from:date(1),to:date(2)});assert.deepEqual(await last(),receipt);
 assert.equal((await rows())[0].break_start,'12:00:00');
 const replay=await apply(200,changes);assert.equal(replay.id,receipt.id);assert.equal((await db.query('select count(*) from v2_schedule_change_receipts')).rows[0].count,1);
 await assert.rejects(apply(200,[changes[0]]),{code:'22023'});
 const undone=await undo(200);assert.equal(undone.undone,true);assert.deepEqual(await rows(),original);assert.equal(await last(),null);
 assert.equal((await undo(200)).undone,true,'undo replay succeeds without another write');
 assert.equal((await apply(200,changes)).undone,true,'lost apply response never reapplies an undone receipt');
 const history=(await db.query('select changes,undone_at from v2_schedule_change_receipts')).rows[0];assert.equal(history.changes.length,2);assert(history.undone_at);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select * from public.v2_schedule_change_receipts'),{code:'42501'});
 await assert.rejects(db.query('select public.v2_schedule_undo_snapshot($1::jsonb)',[JSON.stringify(a)]),{code:'42501'});
 await assert.rejects(db.exec(`update v2_schedules set notes='direct blocked by fixture RLS'`),{code:'42501'});
 await db.exec('reset role');
 }finally{await db.close()}
});

test('undo detects another write including A→B→A and never partially reverts a batch',async()=>{
 const {db,insert,rows,apply,undo}=await fixture();try{
 await db.exec(sql);const a=row(100,1),b=row(101,2);await insert(a);await insert(b);
 await apply(200,[{before:a,after:{...a,notes:'Mine'}},{before:b,after:{...b,notes:'Mine B'}}]);
 await db.query('update v2_schedules set notes=$1 where id=$2',['Someone else',b.id]);
 let prior=await rows();await assert.rejects(undo(200),{code:'40001'});assert.deepEqual(await rows(),prior);
 await db.query('update v2_schedules set notes=$1 where id=$2',['Mine B',b.id]);
 prior=await rows();await assert.rejects(undo(200),{code:'40001'},'xmin catches same-value restoration by another writer');assert.deepEqual(await rows(),prior);
 assert.equal((await db.query('select undone_at from v2_schedule_change_receipts')).rows[0].undone_at,null);
 // A stale second source rejects the whole forward action before changing the first.
 await assert.rejects(apply(201,[{before:snapshot(prior[0]),after:{...snapshot(prior[0]),notes:'Would write'}},{before:b,after:{...b,notes:'Stale'}}]),{code:'40001'});
 assert.deepEqual(await rows(),prior);assert.equal((await db.query('select count(*) from v2_schedule_change_receipts')).rows[0].count,1);
 }finally{await db.close()}
});

test('overlapping block moves reverse in dependency order, preserve IDs and reject occupied or invalid destinations',async()=>{
 const {db,insert,rows,apply,undo}=await fixture();try{
 await db.exec(sql);const a=row(100,1),b=row(101,2);await insert(a);await insert(b);const original=await rows();
 await apply(200,[{before:b,after:{...b,work_date:date(3)}},{before:a,after:{...a,work_date:date(2)}}],'move');
 assert.deepEqual((await rows()).map(r=>r.work_date),[date(2),date(3)]);
 await undo(200);assert.deepEqual(await rows(),original);
 await insert(row(102,3));let prior=await rows();
 await assert.rejects(apply(201,[{before:a,after:{...a,employee_id:secondEmployee,work_date:date(1)}},{before:b,after:{...b,work_date:date(3)}}],'move'),{code:'23505'});
 assert.deepEqual(await rows(),prior,'first move rolls back when a later destination is occupied');
 await apply(202,[{before:a,after:{...a,work_date:date(4)}}],'move');
 await insert(row(103,1));prior=await rows();await assert.rejects(undo(202),{code:'40001'});assert.deepEqual(await rows(),prior);
 }finally{await db.close()}
});

test('create/delete undo retains history and metadata; newer actions and no-ops follow one-level semantics',async()=>{
 const {db,insert,rows,apply,undo,last}=await fixture();try{
 await db.exec(sql);const a=row(100,1),b=row(101,2);await insert(a);const original=await rows();
 await apply(200,[{before:null,after:b}],'copy');assert.equal((await rows()).length,2);await undo(200);assert.deepEqual(await rows(),original);
 await apply(201,[{before:a,after:null}],'delete');assert.equal((await rows()).length,0);await undo(201);assert.deepEqual(await rows(),original,'deleted row restores metadata and ID');
 await apply(202,[{before:a,after:{...a,notes:'Edit 1'}}]);
 await apply(203,[{before:{...a,notes:'Edit 1'},after:{...a,notes:'Edit 2'}}]);
 await assert.rejects(undo(202),{code:'40001'});assert.equal((await last()).id,id(203));
 const noop=[{before:{...a,notes:'Edit 2'},after:{...a,notes:'Edit 2'}}];
 assert.deepEqual(await apply(204,noop),{id:null,count:0,label:'edit',undone:false,from:null,to:null});assert.equal((await last()).id,id(203));
 await undo(203);assert.equal((await rows())[0].notes,'Edit 1');assert.equal(await last(),null,'older actions never reappear as undo candidates');
 await assert.rejects(undo(202),{code:'40001'});
 assert.equal((await db.query('select count(*) from v2_schedule_change_receipts')).rows[0].count,5,'all action history retained');
 }finally{await db.close()}
});

test('RPC checks permissions, tenant, ownership, foreign references and schema bounds',async()=>{
 const {db,insert,rows,apply,undo,last}=await fixture();try{
 await db.exec(sql);const a=row(100,1);await insert(a);const changes=[{before:a,after:{...a,notes:'Authorized'}}];
 for(const role of ['operacion','lectura','soporte_lectura','']){
  await db.query("select set_config('test.role',$1,false)",[role]);await assert.rejects(apply(200,changes),{code:'42501'});
 }
 await db.exec("set test.role='gerente'");
 for(const [setting,value] of [['uid',''],['status','inactivo'],['session','no'],['mfa','no'],['plan','no'],['paid','no']]){
  const prev=(await db.query('select current_setting($1) as value',['test.'+setting])).rows[0].value;
  await db.query('select set_config($1,$2,false)',['test.'+setting,value]);await assert.rejects(last(),{code:'42501'});await assert.rejects(apply(200,changes),{code:'42501'});
  await db.query('select set_config($1,$2,false)',['test.'+setting,prev]);
 }
 await assert.rejects(apply(200,changes,'edit',foreign),{code:'42501'});
 for(const patch of [{employee_id:id(12)},{area_id:id(21)},{shift_id:id(32)}])await assert.rejects(apply(200,[{before:a,after:{...a,...patch}}]),{code:'23514'});
 for(const invalid of [[],[{before:null,after:null}],[{before:a,after:{...a,restaurant_id:foreign}}],[{before:a,after:{...a,id:id(999)}}],Array(5001).fill(changes[0])])await assert.rejects(apply(200,invalid),{code:'22023'});
 await assert.rejects(apply(200,[changes[0],changes[0]]),{code:'22023'});
 await apply(200,changes);await db.query("select set_config('test.uid',$1,false)",[otherActor]);
 assert.equal(await last(),null);await assert.rejects(undo(200),{code:'42501'});await assert.rejects(apply(200,changes),{code:'42501'});
 await db.query("select set_config('test.uid',$1,false)",[actor]);await db.exec("set test.role='soporte_editor'");await undo(200);
 await db.exec('set role anon');await assert.rejects(db.query('select public.v2_last_schedule_change($1)',[restaurant]),{code:'42501'});await db.exec('reset role');
 assert.equal((await rows())[0].notes,a.notes);
 }finally{await db.close()}
});

test('undo respects current catalog constraints and refuses the entire action when a former shift is no longer allowed',async()=>{
 const {db,insert,rows,apply,undo}=await fixture();try{
 await db.exec(sql);const a=row(100,1),b=row(101,2);await insert(a);await insert(b);
 await apply(200,[{before:a,after:{...a,shift_id:otherShift}},{before:b,after:{...b,notes:'Changed'}}]);
 await db.query('update v2_shifts set active=false where id=$1',[shift]);const prior=await rows();
 await assert.rejects(undo(200),{code:'23514'});assert.deepEqual(await rows(),prior,'reverse-loop update of the second row rolls back too');
 assert.equal((await db.query('select undone_at from v2_schedule_change_receipts')).rows[0].undone_at,null);
 }finally{await db.close()}
});


test('empty-cell ABA from legacy writers blocks restoration without changing any other cell',async()=>{
 const {db,insert,rows,apply,undo}=await fixture();try{
 await db.exec(sql);const a=row(100,1),b=row(101,2);await insert(a);await insert(b);
 await apply(200,[{before:a,after:null},{before:b,after:{...b,notes:'Mine'}}],'delete');
 await insert(row(102,1));await db.query('delete from v2_schedules where id=$1',[id(102)]);
 const prior=await rows();await assert.rejects(undo(200),{code:'40001'});assert.deepEqual(await rows(),prior);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from v2_schedule_cell_versions'),{code:'42501'});await db.exec('reset role');
 }finally{await db.close()}
});


test('existing restaurant deletion can cascade without orphaning receipts or blocking schedule cleanup',async()=>{
 const {db,insert,apply}=await fixture();try{
 await db.exec(sql);const a=row(100,1);await insert(a);
 await apply(200,[{before:a,after:{...a,notes:'Changed'}}]);
 assert.equal((await db.query('select count(*) from v2_schedule_cell_versions')).rows[0].count,1);
 await db.query('delete from v2_restaurants where id=$1',[restaurant]);
 for(const table of ['v2_schedules','v2_schedule_change_receipts','v2_schedule_cell_versions'])assert.equal((await db.query('select count(*) from '+table)).rows[0].count,0);
 assert.equal((await db.query('select count(*) from v2_restaurants')).rows[0].count,1,'unrelated restaurant retained');
 }finally{await db.close()}
});

test('maximum copy batch records and reverses all5000 assignments without truncation',async()=>{
 const {db,rows,apply,undo}=await fixture();try{
 await db.exec(sql);
 const people=Array.from({length:50},(_,i)=>id(10000+i));
 await db.query("insert into v2_employees(id,restaurant_id,area_id,active) select x::uuid,$1::uuid,$2::uuid,true from unnest($3::text[]) x",[restaurant,area,people]);
 const changes=Array.from({length:5000},(_,i)=>({before:null,after:row(50000+i,1,{employee_id:people[i%50],work_date:new Date(Date.UTC(2026,0,1+Math.floor(i/50))).toISOString().slice(0,10)})}));
 const result=await apply(200,changes,'copy');assert.equal(result.count,5000);assert.equal((await rows()).length,5000);
 assert.equal(result.from,'2026-01-01');assert.equal(result.to,'2026-04-10');
 await undo(200);assert.equal((await rows()).length,0);
 assert.equal((await db.query('select jsonb_array_length(changes) as n from v2_schedule_change_receipts')).rows[0].n,5000);
 }finally{await db.close()}
});


test('a trigger that suppresses restoration cannot mark a deleted assignment as successfully undone',async()=>{
 const {db,insert,rows,apply,undo}=await fixture();try{
 await db.exec(sql);const a=row(100,1);await insert(a);
 await apply(200,[{before:a,after:null}],'delete');
 await db.exec(`create function test_suppress_schedule_insert() returns trigger language plpgsql as $$begin return null;end;$$;
 create trigger test_suppress_schedule_insert before insert on v2_schedules for each row execute function test_suppress_schedule_insert();`);
 await assert.rejects(undo(200),{code:'40001'});assert.equal((await rows()).length,0);
 assert.equal((await db.query('select undone_at from v2_schedule_change_receipts')).rows[0].undone_at,null);
 }finally{await db.close()}
});
