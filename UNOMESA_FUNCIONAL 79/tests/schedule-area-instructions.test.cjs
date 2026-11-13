const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');function load(file){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require});return mod.exports}
test('instructions belong to a branch, area and month, require edit access, detect concurrent changes, and clear on blank',async()=>{
 const db=await PGlite.create(),r='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',a='20000000-0000-4000-8000-000000000001';
 try{await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$ select '${a}'::uuid $$;
 create function v2_session_alive() returns boolean language sql as $$ select true $$;
 create function v2_can_read(uuid) returns boolean language sql as $$ select $1='${r}'::uuid $$;
 create function v2_account_billing(uuid) returns jsonb language sql as $$ select '{"can_write":true}'::jsonb $$;
 create function v2_effective_membership(uuid) returns jsonb language sql as $$ select jsonb_build_object('role',current_setting('test.role'),'status','activo') $$;
 create table v2_restaurants(id uuid primary key);create table v2_areas(id uuid,restaurant_id uuid);
 insert into v2_restaurants values('${r}'),('${other}');insert into v2_areas values('${a}','${r}');
 create function v2_emit_sync_change() returns trigger language plpgsql as $$ begin return null;end $$;`);
 const migration=fs.readFileSync(path.join(root,'67_INSTRUCCIONES_HORARIOS.sql'),'utf8');await db.exec(migration);await db.exec(migration);
 await db.exec("set role authenticated;set test.role='gerente'");
 const set=(v,expected='',date='2026-11-01',area=a)=>db.query('select v2_set_schedule_area_note($1,$2,$3,$4,$5)',[r,date,area,v,expected]);
 const get=async (tenant=r,from='2026-11-03',to='2026-11-20')=>(await db.query('select v2_get_schedule_area_notes($1,$2,$3) as notes',[tenant,from,to])).rows[0].notes;
 await set('  Cerrar gas  ');await set('Otro mes','','2026-12-01');await set('Otra área','','2026-11-01','unassigned');
 assert.deepEqual((await get()).map(n=>n.text).sort(),['Cerrar gas','Otra área']);await assert.rejects(get(other));await assert.rejects(set('Conflicto'));await assert.rejects(set('Mal','','2026-11-01',other));
 await db.exec("set test.role='lectura'");await assert.rejects(set('X','Cerrar gas'));assert.equal((await get()).length,2);await assert.rejects(db.query('select * from v2_schedule_area_notes'));
 await db.exec("set test.role='gerente'");await set(' \n\t','Cerrar gas');assert.deepEqual((await get()).map(n=>n.area),['unassigned']);
 }finally{await db.close();}
});
test('cross-month ranges split only where the instruction may change',()=>{
 const {scheduleDateBlocks}=load('lib/schedule-area-notes.ts'),d=['2026-11-30','2026-12-01'];
 assert.equal(scheduleDateBlocks(d,[]).length,1);assert.equal(scheduleDateBlocks(d,[{month:'2026-12',area:'a',text:'A'}]).length,2);
});
test('blank notes preserve the original PDF content; a long note stays complete with a footer in both layouts',()=>{
 const {createSchedulePdf}=load('lib/schedule-pdf.ts');const first={area:'Dish',dates:[{label:'01/11'}],rows:Array.from({length:37},(_,i)=>({name:'Empleado '+i,cells:[{text:'Turno',color:'#ffffff'}]}))};
 const pdf=(section,layout='continuous')=>createSchedulePdf([section,{...first,area:'Salon',rows:first.rows.slice(0,1)}],'2026-11-01','2026-11-01','es','Observación general',{scale:120,layout});
 assert.deepEqual(pdf(first).internal.pages,pdf({...first,instruction:'   '}).internal.pages);
 const note=Array.from({length:75},(_,i)=>'LINEA-'+String(i).padStart(2,'0')).join('\n');
 for(const mode of ['continuous','area']){
  const doc=pdf({...first,instruction:note},mode),text=doc.internal.pages.flat().join('\n');
  assert.match(text,/Instrucciones/);for(const line of note.split('\n'))assert.equal(text.split(line).length,2);
  assert.ok(text.indexOf('LINEA-74')<text.lastIndexOf('(Salon)')); 
 }
});
