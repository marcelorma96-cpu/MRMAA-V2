require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {planMove,cellKey,MAX_CELLS}=require('../lib/schedule-grid.ts');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tenant=id(1),people=[10,11,12].map(id),shift=id(30);
const month=(value,count)=>Array.from({length:count},(_,i)=>value+'-'+String(i+1).padStart(2,'0'));
const november=month('2026-11',30);
const cell=(person,date)=>({employee_id:people[person],work_date:date});
const pick=(person,date,n)=>({...cell(person,date),expected:{id:id(n),entry_type:n%3?'work':'rest',shift_id:n%3?shift:null,notes:'Keep '+n,color:'#ccfbf1',break_start:'12:00:00',break_end:'13:00:00'}});
const occupied=picks=>new Map(picks.map(p=>[cellKey(p),p.expected]));
const byId=ops=>new Map(ops.map(op=>[op.expected.id,op]));

test('seven selected schedules move to another employee on November 30 and continue through December 6',()=>{
 const picks=november.slice(22,29).map((date,i)=>pick(2,date,100+i));
 const result=planMove(picks,picks[0],cell(1,'2026-11-30'),people,november,occupied(picks));
 assert.ok(result.ops);assert.equal(result.ops.length,7);
 const expected=['2026-11-30','2026-12-01','2026-12-02','2026-12-03','2026-12-04','2026-12-05','2026-12-06'];
 const actual=byId(result.ops);
 picks.forEach((p,i)=>{assert.deepEqual(actual.get(p.expected.id).to,cell(1,expected[i]));assert.equal(actual.get(p.expected.id).expected,p.expected)});
 assert.deepEqual(picks.map(p=>p.work_date),november.slice(22,29));
});

test('sparse blocks retain row offsets, date gaps, and the selected drag anchor across months',()=>{
 const picks=[pick(1,'2026-11-23',100),pick(1,'2026-11-26',101),pick(2,'2026-11-26',102)];
 const result=planMove(picks,picks[0],cell(0,'2026-11-30'),people,november,occupied(picks));
 assert.deepEqual(result.ops.map(op=>cellKey(op.to)).sort(),[cell(0,'2026-11-30'),cell(0,'2026-12-03'),cell(1,'2026-12-03')].map(cellKey).sort());
 const anchored=planMove(picks,picks[2],cell(1,'2026-11-30'),people,november,occupied(picks));
 assert.deepEqual(anchored.ops.map(op=>cellKey(op.to)).sort(),[cell(0,'2026-11-27'),cell(0,'2026-11-30'),cell(1,'2026-11-30')].map(cellKey).sort());
 assert.deepEqual(planMove(picks,picks[0],cell(2,'2026-11-30'),people,november,occupied(picks)),{error:'bounds'});
});

test('calendar arithmetic handles previous month, year boundaries, and leap days',()=>{
 const cases=[
  {days:month('2026-11',30),dates:['2026-11-01','2026-11-03'],anchor:1,target:'2026-11-01',expected:['2026-10-30','2026-11-01']},
  {days:month('2026-12',31),dates:['2026-12-29','2026-12-31'],anchor:0,target:'2026-12-31',expected:['2026-12-31','2027-01-02']},
  {days:month('2027-01',31),dates:['2027-01-01','2027-01-03'],anchor:1,target:'2027-01-01',expected:['2026-12-30','2027-01-01']},
  {days:month('2028-02',29),dates:['2028-02-27','2028-02-28','2028-02-29'],anchor:0,target:'2028-02-28',expected:['2028-02-28','2028-02-29','2028-03-01']},
  {days:month('2027-02',28),dates:['2027-02-26','2027-02-27','2027-02-28'],anchor:0,target:'2027-02-27',expected:['2027-02-27','2027-02-28','2027-03-01']}
 ];
 for(const c of cases){
  const picks=c.dates.map((date,i)=>pick(0,date,100+i));
  const result=planMove(picks,picks[c.anchor],cell(1,c.target),people,c.days,occupied(picks));
  assert.ok(result.ops,JSON.stringify(c));
  const actual=byId(result.ops);
  picks.forEach((p,i)=>assert.equal(actual.get(p.expected.id).to.work_date,c.expected[i]));
 }
});

test('device timezone and daylight-saving changes cannot shift or skip civil dates',()=>{
 const previous=process.env.TZ;
 try{
  const days=month('2026-03',31),picks=['2026-03-06','2026-03-07','2026-03-08','2026-03-09'].map((date,i)=>pick(0,date,100+i));
  let baseline;
  for(const tz of ['UTC','America/New_York','America/Guatemala','Pacific/Auckland','Asia/Tokyo']){
   process.env.TZ=tz;
   const result=planMove(picks,picks[0],cell(1,'2026-03-29'),people,days,occupied(picks));
   assert.deepEqual(result.ops.map(op=>op.to.work_date).sort(),['2026-03-29','2026-03-30','2026-03-31','2026-04-01']);
   if(baseline)assert.deepEqual(result,baseline);else baseline=result;
  }
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('known destinations in the following month remain protected; malformed or unavailable source cells cannot move',()=>{
 const picks=[pick(0,'2026-11-29',100),pick(0,'2026-11-30',101)],map=occupied(picks);
 map.set(cellKey(cell(1,'2026-12-01')),{id:'outside'});
 assert.deepEqual(planMove(picks,picks[0],cell(1,'2026-11-30'),people,november,map),{error:'occupied'});
 assert.deepEqual(planMove(picks,picks[0],cell(0,'2026-11-29'),people,november,map),{error:'same'});
 assert.deepEqual(planMove(picks,picks[0],cell(1,'2026-11-31'),people,[...november,'2026-11-31'],map),{error:'bounds'});
 assert.deepEqual(planMove([picks[0],picks[0]],picks[0],cell(1,'2026-11-30'),people,november,map),{error:'bounds'});
 assert.deepEqual(planMove([pick(0,'2026-10-31',102)],cell(0,'2026-11-01'),cell(1,'2026-11-30'),people,november,map),{error:'bounds'});
 assert.deepEqual(planMove(Array.from({length:MAX_CELLS+1},()=>picks[0]),picks[0],cell(1,'2026-11-30'),people,november,map),{error:'bounds'});
});

test('existing SQL moves across months with exact IDs/details and rolls back an unseen occupied destination or stale source',async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql as $$select '${id(2)}'::uuid$$;
   create function v2_session_alive() returns boolean language sql as $$select true$$;
   create function v2_can_read(uuid) returns boolean language sql as $$select $1='${tenant}'::uuid$$;
   create function v2_effective_membership(uuid) returns jsonb language sql as $$select jsonb_build_object('role',current_setting('test.role'),'status','activo')$$;
   create function v2_account_billing(uuid) returns jsonb language sql as $$select '{"can_write":true}'::jsonb$$;
   create table v2_areas(id uuid primary key,restaurant_id uuid);
   create table v2_employees(id uuid primary key,restaurant_id uuid,area_id uuid,active boolean);
   create table v2_shifts(id uuid primary key,restaurant_id uuid,active boolean,schedule_area_ids uuid[] default '{}');
   create table v2_schedules(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null,employee_id uuid not null,work_date date not null,area_id uuid,shift_id uuid,entry_type text not null,color text,break_start time,break_end time,notes text,unique(restaurant_id,employee_id,work_date));
   grant usage on schema auth to authenticated;grant select on v2_areas,v2_employees,v2_shifts to authenticated;grant select,update,insert on v2_schedules to authenticated;
   insert into v2_areas values ${people.map((_,i)=>"('"+id(20+i)+"','"+tenant+"')").join(',')};
   insert into v2_employees values ${people.map((p,i)=>"('"+p+"','"+tenant+"','"+id(20+i)+"',true)").join(',')};
   insert into v2_shifts(id,restaurant_id,active) values ('${shift}','${tenant}',true);`);
  for(const name of ['69_SELECCION_HORARIOS.sql','70_TURNOS_POR_AREA.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
  await db.exec("set role authenticated;set test.role='gerente'");
  const rows=async()=>(await db.query("select to_jsonb(s)-'restaurant_id' as s from v2_schedules s order by id")).rows.map(x=>x.s);
  const rpc=(mode,ops,patch={})=>db.query('select v2_schedule_cells($1,$2,$3::jsonb,$4::jsonb) as n',[tenant,mode,JSON.stringify(ops),JSON.stringify(patch)]);
  const selection=async(coords)=>{const map=new Map((await rows()).map(r=>[cellKey(r),r]));return coords.map(c=>({...c,expected:map.get(cellKey(c))??null}));};
  const edit=async(coords,patch)=>rpc('edit',(await selection(coords)).map(p=>({...p,to:{employee_id:p.employee_id,work_date:p.work_date}})),patch);
  const work={entry_type:'work',shift_id:shift,break_start:'12:00',break_end:'13:00',color:'#ccfbf1',notes:'Keep every field'};
  const screenshot=november.slice(22,29).map(date=>cell(2,date));
  await edit([...screenshot,cell(0,'2026-11-12')],work);
  await edit([screenshot[3]],{entry_type:'rest'});
  const before=await rows(),picks=await selection(screenshot),planned=planMove(picks,picks[0],cell(1,'2026-11-30'),people,november,new Map(before.map(r=>[cellKey(r),r])));
  await rpc('move',planned.ops);
  const after=await rows(),expectedById=byId(planned.ops);
  assert.equal(after.length,before.length);
  for(const original of before){
   const actual=after.find(r=>r.id===original.id),op=expectedById.get(original.id);
   assert.deepEqual(actual,op?{...original,...op.to,area_id:id(21)}:original);
  }
  assert.equal(after.filter(r=>r.employee_id===people[1]).length,7);

  // Only November is loaded. December 1 is occupied, but December 2 is free:
  // the leading edge writes successfully before the next op fails and rolls it back.
  const second=[cell(2,'2026-11-01'),cell(2,'2026-11-02'),cell(2,'2026-11-03')];
  await edit([...second,cell(0,'2026-12-01')],work);
  let stable=await rows();
  const source=await selection(second),visible=new Map(stable.filter(r=>r.work_date.startsWith('2026-11')).map(r=>[cellKey(r),r]));
  const hiddenConflict=planMove(source,source[0],cell(0,'2026-11-30'),people,november,visible);
  assert.ok(hiddenConflict.ops);assert.equal(hiddenConflict.ops[0].to.work_date,'2026-12-02');
  await assert.rejects(rpc('move',hiddenConflict.ops),{code:'23505'});
  assert.deepEqual(await rows(),stable);
  await edit([second[1]],{notes:'Updated concurrently'});stable=await rows();
  await assert.rejects(rpc('move',hiddenConflict.ops),{code:'40001'});
  assert.deepEqual(await rows(),stable);
  await db.exec("set test.role='lectura'");
  await assert.rejects(rpc('move',hiddenConflict.ops),{code:'42501'});
  assert.deepEqual(await rows(),stable);
 }finally{await db.close();}
});
