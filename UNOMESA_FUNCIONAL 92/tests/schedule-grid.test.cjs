require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {rectangle,planMove,cellKey,paintSelection,orderedAssigned,MAX_CELLS}=require('../lib/schedule-grid.ts');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tenant=id(1),people=[10,11,12].map(id),shift=id(32),otherShift=id(33);
const days=[1,2,3,4,5].map(n=>'2026-11-0'+n),cell=(i,j)=>({employee_id:people[i],work_date:days[j]});
test('range selection, disjoint moves, bounds and occupied cells',()=>{
 const source=[{...cell(0,0),expected:{id:'1'}},{...cell(1,2),expected:{id:'2'}}],occ=new Map(source.map(p=>[cellKey(p),p.expected]));
 assert.deepEqual(rectangle(cell(1,2),cell(0,1),people,days),[cell(0,1),cell(0,2),cell(1,1),cell(1,2)]);
 const planned=planMove(source,source[0],cell(1,1),people,days,occ);
 assert.deepEqual(planned.ops.map(x=>x.to),[cell(2,3),cell(1,1)]);
 assert.deepEqual(planMove(source,source[0],cell(2,3),people,days,occ),{error:'bounds'});
 occ.set(cellKey(cell(2,3)),{id:'other'});
 assert.deepEqual(planMove(source,source[0],cell(1,1),people,days,occ),{error:'occupied'});
 assert.deepEqual(planMove([{...cell(0,0),expected:null}],cell(0,0),cell(2,3),people,days,occ),{error:'empty'});
});
test('sweeps grow and shrink, preserve prior selections and keep conflict snapshots',()=>{
 const original={id:'original',notes:'first'},changed={...original,notes:'changed'};
 const snapshot=new Map([[cellKey(cell(0,0)),original]]),base=[{...cell(0,0),expected:original}];
 const grown=paintSelection(base,rectangle(cell(1,0),cell(2,3),people,days),snapshot);
 assert.equal(grown.length,9);
 const shrunk=paintSelection(base,rectangle(cell(1,0),cell(1,1),people,days),snapshot);
 assert.deepEqual(shrunk.map(cellKey),[cellKey(cell(0,0)),cellKey(cell(1,0)),cellKey(cell(1,1))]);
 assert.equal(paintSelection(base,[cell(0,0)],new Map([[cellKey(cell(0,0)),changed]]))[0].expected,original);
 const many=Array.from({length:MAX_CELLS+1},(_,i)=>({employee_id:String(i),work_date:days[0]}));
 assert.equal(paintSelection([],many,new Map()),null);
 assert.equal(paintSelection([],many.slice(0,MAX_CELLS),new Map()).length,MAX_CELLS);
});
test('destination taps use visual order, move all assigned cells and preserve empty gaps',()=>{
 const rows=new Map([[cellKey(cell(0,0)),{id:'first',notes:'A'}],[cellKey(cell(0,2)),{id:'last',notes:'B'}]]);
 const picks=paintSelection([], [cell(0,2),cell(0,1),cell(0,0)],rows);
 const assigned=orderedAssigned(picks,people,days);
 assert.deepEqual(assigned.map(p=>p.expected.id),['first','last']);
 const result=planMove(assigned,assigned[0],cell(1,1),people,days,rows);
 assert.deepEqual(result.ops.map(p=>[p.expected.id,cellKey(p.to)]).sort(),[['first',cellKey(cell(1,1))],['last',cellKey(cell(1,3))]]);
 assert.ok(!result.ops.some(p=>cellKey(p.to)===cellKey(cell(1,2))));
 assert.equal(picks.length,3); // Empty cells remain editable in a multi-selection.
});
test('dragging from any selected cell preserves the block offsets and rejects all on a collision',()=>{
 const picks=[cell(1,1),cell(1,2),cell(2,1),cell(2,2)].map((c,i)=>({...c,expected:{id:String(i)}}));
 const rows=new Map(picks.map(p=>[cellKey(p),p.expected]));
 const result=planMove(picks,picks[3],cell(1,3),people,days,rows);
 assert.deepEqual(result.ops.map(p=>cellKey(p.to)).sort(),[cell(0,2),cell(0,3),cell(1,2),cell(1,3)].map(cellKey).sort());
 rows.set(cellKey(cell(0,3)),{id:'outsider'});
 assert.deepEqual(planMove(picks,picks[3],cell(1,3),people,days,rows),{error:'occupied'});
});
test('transaction preserves IDs, rejects stale or occupied destinations and changes only marked fields and cells',async()=>{
 const db=await PGlite.create();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$ select '${id(2)}'::uuid $$;
 create function v2_session_alive() returns boolean language sql as $$select true$$;
 create function v2_can_read(uuid) returns boolean language sql as $$select $1='${tenant}'::uuid$$;
 create function v2_effective_membership(uuid) returns jsonb language sql as $$select jsonb_build_object('role',current_setting('test.role'),'status','activo')$$;
 create function v2_account_billing(uuid) returns jsonb language sql as $$ select '{"can_write":true}'::jsonb $$;
 create table v2_employees(id uuid primary key,restaurant_id uuid,area_id uuid,active boolean);
 create table v2_shifts(id uuid primary key,restaurant_id uuid,active boolean);
 create table v2_schedules(id uuid primary key default gen_random_uuid(),restaurant_id uuid not null,employee_id uuid not null,work_date date not null,area_id uuid,shift_id uuid,entry_type text not null,color text,break_start time,break_end time,notes text,unique(restaurant_id,employee_id,work_date));
 grant usage on schema auth to authenticated;grant select on v2_employees,v2_shifts to authenticated;grant select,update,insert on v2_schedules to authenticated;
 insert into v2_employees values ${people.map((p,i)=>"('"+p+"','"+tenant+"','"+id(20+i)+"',true)").join(',')};
 insert into v2_shifts values ('${shift}','${tenant}',true),('${otherShift}','${tenant}',true);`);
 const sql=fs.readFileSync(path.join(__dirname,'../69_SELECCION_HORARIOS.sql'),'utf8');
 await db.exec(sql);await db.exec(sql);await db.exec("set role authenticated;set test.role='gerente'");
 const rows=async()=>(await db.query('select to_jsonb(s)-\'restaurant_id\' as s from v2_schedules s order by work_date,employee_id')).rows.map(x=>x.s);
 const rpc=(mode,ops,patch={},r=tenant)=>db.query('select v2_schedule_cells($1,$2,$3::jsonb,$4::jsonb) as n',[r,mode,JSON.stringify(ops),JSON.stringify(patch)]);
 const picks=async(coords)=>{const by=new Map((await rows()).map(r=>[cellKey(r),r]));return coords.map(c=>({...c,expected:by.get(cellKey(c))??null}));};
 const edit=(p)=>p.map(s=>({...s,to:{employee_id:s.employee_id,work_date:s.work_date}}));
 const start=[cell(0,0),cell(0,1),cell(1,3)];
 await rpc('edit',edit(await picks(start)),{entry_type:'work',shift_id:shift,break_start:'12:00',break_end:'13:00',color:'#ccfbf1',notes:'Dish'});
 const before=await rows(),selected=await picks(start.slice(0,2));
 const plan=planMove(selected,selected[0],cell(0,1),people,days,new Map(before.map(r=>[cellKey(r),r])));
 await rpc('move',plan.ops);const moved=await rows();
 assert.deepEqual(moved.map(r=>r.id),before.map(r=>r.id));assert.deepEqual(moved.map(r=>r.work_date),[days[1],days[2],days[3]]);
 const sparse=await picks([cell(0,1),cell(1,3)]);
 await rpc('edit',edit(sparse),{color:'#fff000'});assert.deepEqual((await rows()).map(r=>r.color),['#fff000','#ccfbf1','#fff000']);
 assert.ok((await rows()).every(r=>r.shift_id===shift&&r.break_start==='12:00:00'&&r.notes==='Dish'));
 let fresh=await picks([cell(0,1),cell(0,2)]), stable=await rows();
 // The first write would succeed, the second targets an outsider: both must roll back.
 await assert.rejects(rpc('move',[{...fresh[0],to:cell(2,0)},{...fresh[1],to:cell(1,3)}]),{code:'23505'});
 assert.deepEqual(await rows(),stable);
 await assert.rejects(rpc('edit',edit([fresh[1],sparse[0]]),{notes:'oops'}),{code:'40001'});
 assert.deepEqual(await rows(),stable);
 await rpc('move',[{...fresh[0],to:cell(2,0)}]);const left=(await picks([cell(2,0)]))[0].expected;
 assert.equal(left.area_id,id(22));assert.equal(left.id,fresh[0].expected.id);assert.equal(left.notes,'Dish');
 const current=await picks([cell(2,0)]);await rpc('edit',edit(current),{entry_type:'rest'});const rest=(await picks([cell(2,0)]))[0].expected;
 assert.equal(rest.shift_id,null);assert.equal(rest.break_start,null);assert.equal(rest.color,'#fff000');
 const after=await rows();await db.exec("set test.role='lectura'");
 await assert.rejects(rpc('edit',edit(await picks([cell(1,3)])),{notes:'bad'}),{code:'42501'});
 await db.exec("set test.role='admin'");await assert.rejects(rpc('edit',edit(await picks([cell(1,3)])),{notes:'bad'},id(999)),{code:'42501'});assert.deepEqual(await rows(),after);
 }finally{await db.close();}
});
