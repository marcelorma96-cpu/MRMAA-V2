require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {planTransfer,cellKey,MAX_CELLS}=require('../lib/schedule-grid.ts');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const people=[10,11,12,13].map(id),days=Array.from({length:8},(_,i)=>'2026-11-0'+(i+1));
const cell=(person,day)=>({employee_id:people[person],work_date:days[day]});
const pick=(person,day,label)=>({...cell(person,day),expected:{id:label||person+':'+day}});
const occupied=picks=>new Map(picks.filter(p=>p.expected).map(p=>[cellKey(p),p.expected]));
const mapping=(...pairs)=>Object.fromEntries(pairs.map(([from,to])=>[people[from],people[to]]));

test('explicit employee destinations preserve sparse dates from the earliest assigned day, regardless of tap order',()=>{
 const picks=[pick(1,4,'B'),{...cell(0,0),expected:null},pick(0,2,'A')];
 const result=planTransfer(picks,mapping([0,3],[1,2]),days[3],people,days,occupied(picks));
 assert.deepEqual(result.ops.map(p=>[p.expected.id,cellKey(p.to)]).sort(),[['A',cellKey(cell(3,3))],['B',cellKey(cell(2,5))]]);
 assert.equal(picks[2].work_date,days[2]);
 assert.equal(result.ops.find(p=>p.expected.id==='A').expected,picks[2].expected);
});

test('destination employees need not be in the visible source rows',()=>{
 const picks=[pick(0,1),pick(0,2)];
 const result=planTransfer(picks,mapping([0,3]),days[1],people,days,occupied(picks));
 assert.deepEqual(result.ops.map(p=>p.to),[cell(3,1),cell(3,2)]);
});

test('overlapping translations vacate sources in the correct order in either direction',()=>{
 const picks=[pick(0,1,'first'),pick(0,2,'middle'),pick(0,3,'last')];
 assert.deepEqual(planTransfer(picks,mapping([0,0]),days[2],people,days,occupied(picks)).ops.map(p=>p.expected.id),['last','middle','first']);
 assert.deepEqual(planTransfer([...picks].reverse(),mapping([0,0]),days[0],people,days,occupied(picks)).ops.map(p=>p.expected.id),['first','middle','last']);
});

test('employee chains move their tail first and cycles are rejected without operations',()=>{
 const picks=[pick(0,0,'A'),pick(1,0,'B'),pick(2,0,'C')];
 assert.deepEqual(planTransfer(picks,mapping([0,1],[1,2],[2,3]),days[0],people,days,occupied(picks)).ops.map(p=>p.expected.id),['C','B','A']);
 assert.deepEqual(planTransfer(picks,mapping([0,1],[1,2],[2,0]),days[0],people,days,occupied(picks)),{error:'occupied'});
});

test('unchanged rows are omitted, remain protected and all-unchanged groups are a no-op',()=>{
 const picks=[pick(0,0,'A'),pick(1,0,'B')];
 assert.deepEqual(planTransfer(picks,mapping([0,0],[1,1]),days[0],people,days,occupied(picks)),{error:'same'});
 const result=planTransfer(picks,mapping([0,0],[1,2]),days[0],people,days,occupied(picks));
 assert.deepEqual(result.ops.map(p=>p.expected.id),['B']);
 assert.deepEqual(planTransfer(picks,mapping([0,0],[1,0]),days[0],people,days,occupied(picks)),{error:'occupied'});
});

test('duplicate destinations and unrelated occupied cells never produce a partial plan',()=>{
 const sameDay=[pick(0,0),pick(1,0)],sparse=[pick(0,0),pick(1,2)];
 assert.deepEqual(planTransfer(sameDay,mapping([0,2],[1,2]),days[1],people,days,occupied(sameDay)),{error:'occupied'});
 assert.equal(planTransfer(sparse,mapping([0,2],[1,2]),days[1],people,days,occupied(sparse)).ops.length,2);
 const rows=occupied(sparse);rows.set(cellKey(cell(2,3)),{id:'outside-selection'});
 assert.deepEqual(planTransfer(sparse,mapping([0,2],[1,2]),days[1],people,days,rows),{error:'occupied'});
});

test('invalid employees, dates, oversized and duplicated selections are rejected',()=>{
 const picks=[pick(0,0),pick(0,2)];
 const check=(p,map,date,ids=people)=>planTransfer(p,map,date,ids,days,occupied(p));
 assert.deepEqual(check([],{},days[0]),{error:'empty'});
 assert.deepEqual(check([{...cell(0,0),expected:null}],{},days[0]),{error:'empty'});
 assert.deepEqual(check(picks,{},days[0]),{error:'bounds'});
 assert.deepEqual(check(picks,mapping([0,3]),days[0],people.slice(0,3)),{error:'bounds'});
 assert.deepEqual(check(picks,mapping([0,1]),days[0],people.slice(1)),{error:'bounds'});
 assert.deepEqual(check(picks,mapping([0,1]),'2026-12-01'),{error:'bounds'});
 assert.deepEqual(check(picks,mapping([0,1]),days[7]),{error:'bounds'});
 assert.deepEqual(check([{...pick(0,0),work_date:'2026-10-31'}],mapping([0,1]),days[0]),{error:'bounds'});
 assert.deepEqual(check([picks[0],picks[0]],mapping([0,1]),days[0]),{error:'bounds'});
 assert.deepEqual(check(Array.from({length:MAX_CELLS+1},()=>picks[0]),mapping([0,1]),days[0]),{error:'bounds'});
});

test('existing transactional RPC transfers employees with IDs and details intact, rolls back collisions and stale selections',async()=>{
 const db=await PGlite.create(),tenant=id(1),shift=id(32);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql as $$select '${id(2)}'::uuid$$;
   create function v2_session_alive() returns boolean language sql as $$select true$$;
   create function v2_can_read(uuid) returns boolean language sql as $$select $1='${tenant}'::uuid$$;
   create function v2_effective_membership(uuid) returns jsonb language sql as $$select jsonb_build_object('role',current_setting('test.role'),'status','activo')$$;
   create function v2_account_billing(uuid) returns jsonb language sql as $$select '{"can_write":true}'::jsonb$$;
   create table v2_employees(id uuid primary key,restaurant_id uuid,area_id uuid,active boolean);
   create table v2_shifts(id uuid primary key,restaurant_id uuid,active boolean);
   create table v2_schedules(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null,employee_id uuid not null,work_date date not null,area_id uuid,shift_id uuid,entry_type text not null,color text,break_start time,break_end time,notes text,unique(restaurant_id,employee_id,work_date));
   grant usage on schema auth to authenticated;grant select on v2_employees,v2_shifts to authenticated;grant select,update,insert on v2_schedules to authenticated;
   insert into v2_employees values ${people.map((p,i)=>"('"+p+"','"+tenant+"','"+id(20+i)+"',true)").join(',')};
   insert into v2_shifts values ('${shift}','${tenant}',true);`);
  await db.exec(fs.readFileSync(path.join(__dirname,'../69_SELECCION_HORARIOS.sql'),'utf8'));
  await db.exec("set role authenticated;set test.role='gerente'");
  const rows=async()=>(await db.query("select to_jsonb(s)-'restaurant_id' as s from v2_schedules s order by id")).rows.map(r=>r.s);
  const selections=async(coords)=>{const all=new Map((await rows()).map(r=>[cellKey(r),r]));return coords.map(c=>({...c,expected:all.get(cellKey(c))??null}));};
  const rpc=(mode,ops,patch={})=>db.query('select v2_schedule_cells($1,$2,$3::jsonb,$4::jsonb)',[tenant,mode,JSON.stringify(ops),JSON.stringify(patch)]);
  const coords=[cell(0,0),cell(0,2),cell(2,6)];
  await rpc('edit',(await selections(coords)).map(p=>({...p,to:{employee_id:p.employee_id,work_date:p.work_date}})),{entry_type:'work',shift_id:shift,color:'#ccfbf1',notes:'Conservar esta nota',break_start:'12:30',break_end:'13:30'});
  const before=await rows(),picks=await selections(coords.slice(0,2));
  const plan=planTransfer(picks,mapping([0,1]),days[1],people,days,new Map(before.map(r=>[cellKey(r),r])));
  await rpc('move',plan.ops);const moved=await rows();
  assert.equal(moved.length,before.length);
  for(const row of before){
   const next=moved.find(r=>r.id===row.id);
   if(row.employee_id===people[0])assert.deepEqual(next,{...row,employee_id:people[1],area_id:id(21),work_date:days[days.indexOf(row.work_date)+1]});
   else assert.deepEqual(next,row);
  }
  // A collision introduced after planning must roll back every record in the batch.
  let fresh=await selections([cell(1,1),cell(1,3)]);
  const queued=planTransfer(fresh,mapping([1,3]),days[1],people,days,new Map(moved.map(r=>[cellKey(r),r])));
  await rpc('edit',(await selections([cell(3,3)])).map(p=>({...p,to:cell(3,3)})),{entry_type:'rest',notes:'Unrelated day off'});
  let stable=await rows();
  await assert.rejects(rpc('move',queued.ops),{code:'23505'});assert.deepEqual(await rows(),stable);
  // A concurrent edit to the second selected cell must also roll back the first move.
  fresh=await selections([cell(1,1),cell(1,3)]);
  const stale=planTransfer(fresh,mapping([1,2]),days[1],people,days,new Map(stable.map(r=>[cellKey(r),r])));
  await rpc('edit',[{...fresh[1],to:cell(1,3)}],{notes:'Changed by another editor'});
  stable=await rows();
  await assert.rejects(rpc('move',stale.ops),{code:'40001'});assert.deepEqual(await rows(),stable);
  // Mixed no-op and transfer leaves the no-op ID untouched; read-only roles still fail.
  fresh=await selections([cell(1,1),cell(3,3)]);
  const mixed=planTransfer(fresh,mapping([1,1],[3,0]),days[1],people,days,new Map(stable.map(r=>[cellKey(r),r])));
  assert.equal(mixed.ops.length,1);await db.exec("set test.role='lectura'");
  await assert.rejects(rpc('move',mixed.ops),{code:'42501'});assert.deepEqual(await rows(),stable);
  await db.exec("set test.role='admin'");await rpc('move',mixed.ops);
  const after=await rows();assert.deepEqual(after.find(r=>r.id===fresh[0].expected.id),fresh[0].expected);
  assert.deepEqual(after.find(r=>r.id===fresh[1].expected.id),{...fresh[1].expected,employee_id:people[0],area_id:id(20)});
 }finally{await db.close();}
});
