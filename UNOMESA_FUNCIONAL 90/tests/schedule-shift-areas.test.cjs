require('tsx/cjs');
const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {shiftsForAreas,employeeAreaKey}=require('../lib/schedule-shift-areas.ts');
test('Bar and Kitchen intersect only on deliberately shared shifts; unclassified is never shared',()=>{
  const shifts=[['bar',['b']],['kitchen',['k']],['both',['b','k']],['shared',[]],['pending',null],['old',undefined]].map(([id,schedule_area_ids])=>({id,schedule_area_ids}));
  const names=a=>shiftsForAreas(shifts,a).map(s=>s.id);
  assert.deepEqual(names(['b']),['bar','both','shared']);assert.deepEqual(names(['k']),['kitchen','both','shared']);assert.deepEqual(names(['b','k']),['both','shared']);
  assert.deepEqual(names([employeeAreaKey(null)]),['shared']);assert.deepEqual(names([]),[]);assert.deepEqual(names(['']),[]);
});
test('migration scopes established shifts by actual use and preserves existing assignments; new writes respect employee area',async()=>{
 const db=await PGlite.create();try{
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const [r,other,bar,kitchen,dish,foreign,b,k,solo,both,pending]=[1,2,3,4,5,6,7,8,9,10,11].map(id);
 await db.exec("create table v2_areas(id uuid primary key,restaurant_id uuid);create table v2_employees(id uuid primary key,restaurant_id uuid,area_id uuid);create table v2_shifts(id uuid primary key,restaurant_id uuid,active boolean default true);create table v2_schedules(restaurant_id uuid,employee_id uuid,area_id uuid,shift_id uuid,work_date date,entry_type text,notes text,unique(restaurant_id,employee_id,work_date));");
 for (const [a,t] of [[bar,r],[kitchen,r],[dish,r],[foreign,other]]) await db.query('insert into v2_areas values ($1,$2)',[a,t]);
 for (const [e,a] of [[b,bar],[k,kitchen]])await db.query('insert into v2_employees values ($1,$2,$3)',[e,r,a]);
 for(const s of [solo,both,pending])await db.query('insert into v2_shifts(id,restaurant_id) values ($1,$2)',[s,r]);
 const add=(e,a,s,day)=>db.query("insert into v2_schedules values ($1,$2,$3,$4,$5,'work','')",[r,e,a,s,day]);
 await add(b,null,solo,'2026-11-01');await add(b,bar,both,'2026-11-02');await add(k,kitchen,both,'2026-11-03');
 const entries=async()=>(await db.query('select * from v2_schedules order by work_date')).rows;
 const before=await entries();
 const sql=fs.readFileSync(path.join(__dirname,'../70_TURNOS_POR_AREA.sql'),'utf8');await db.exec(sql);
 const scope=async s=>(await db.query('select schedule_area_ids as a from v2_shifts where id=$1',[s])).rows[0].a;
 assert.deepEqual(await scope(solo),[bar]);assert.deepEqual(await scope(both),[bar,kitchen]);assert.equal(await scope(pending),null);assert.deepEqual(await entries(),before);
 await assert.rejects(add(k,bar,solo,'2026-11-04'),{code:'23514'}); await assert.rejects(add(b,bar,pending,'2026-11-04'),{code:'23514'});
 const set=(s,ids)=>db.query('update v2_shifts set schedule_area_ids=$1::uuid[] where id=$2',[ids,s]);
 await assert.rejects(set(solo,[foreign]),{code:'23514'});await assert.rejects(set(solo,[bar,bar]),{code:'23514'});
 await set(pending,[]);await add(k,kitchen,pending,'2026-11-04');await set(solo,[dish]);await db.exec(sql);assert.deepEqual(await scope(solo),[dish]);
 await db.query("insert into v2_schedules values ($1,$2,$3,$4,'2026-11-01','work','updated') on conflict(restaurant_id,employee_id,work_date) do update set notes=excluded.notes,shift_id=excluded.shift_id",[r,b,bar,solo]);
 await assert.rejects(db.query("update v2_schedules set employee_id=$1 where work_date='2026-11-01'",[k]),{code:'23514'});
 await assert.rejects(db.query("update v2_schedules set work_date='2026-12-01' where work_date='2026-11-01'"),{code:'23514'});
 assert.equal((await entries())[0].notes,'updated');
 }finally{await db.close();}
});
