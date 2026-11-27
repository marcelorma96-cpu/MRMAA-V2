const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

// Actual schedule hook, selection planner and shared edit Modal run in
// React/DOM. Only preferences and the persistence boundary use fixtures. DOM
// pointer shims verify the interaction contract, not native scrolling or layout.
async function mount(t) {
  const root = path.resolve(__dirname, '..');
  const requireApp = Module.createRequire(path.join(root, 'package.json'));
  let esbuild, JSDOM;
  try { esbuild = requireApp('esbuild'); ({JSDOM} = require(process.env.UNOMESA_JSDOM_MODULE || 'jsdom')); }
  catch { t.skip('Requires esbuild and jsdom; UNOMESA_JSDOM_MODULE may select an installed module'); return null; }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-transfer-'));
  const write = (name, value) => { const file = path.join(temp, name); fs.writeFileSync(file, value); return file; };
  const preferences = write('preferences.ts', `export const useAppPreferences=()=>({language:'es',t:(s:any)=>s});export const formatAppMoney=(v:any)=>String(v);`);
  const fixture = write('fixture.tsx', `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useScheduleGridTools} from '@/components/schedule-grid-tools';
import {cellKey} from '@/lib/schedule-grid';
const days=Array.from({length:30},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
const people=[['a','Marta','bar'],['b','Maria Veronica','bar'],['c','Carla','kitchen'],['d','Diego','bar']].map(([id,name,area_id])=>({id,name,area_id,active:id!=='d',employee_code:id,phone:''}));
const row=(id:string,employee_id:string,work_date:string)=>({id,employee_id,work_date,area_id:employee_id==='c'?'kitchen':'bar',shift_id:'shift',entry_type:'work',color:'#ccfbf1',break_start:'12:00:00',break_end:'13:00:00',notes:'Keep '+id});
const week=Array.from({length:7},(_,i)=>({...row('week'+i,'a',days[22+i]),...(i===3?{entry_type:'rest',shift_id:null,break_start:null,break_end:null}:{})}));
const initial=[row('a1','a',days[0]),row('a3','a',days[2]),row('b5','b',days[4]),row('c4','c',days[3]),...week];
const qa:any={calls:[],done:[],mode:'ok',release:null};(window as any).qa=qa;
function App(){
 const [enabled,setEnabled]=useState(true),[scope,setScope]=useState('test'),[restricted,setRestricted]=useState(false),[shiftStatus,setShiftStatus]=useState('active');
 const [rows,setRows]=useState(()=>new Map(initial.map(r=>[cellKey(r),r])));
 qa.enable=setEnabled;qa.scope=setScope;qa.restrict=setRestricted;qa.shiftStatus=setShiftStatus;
 const grid=useScheduleGridTools({scope,en:false,enabled,people:people.slice(0,3),destinations:people,areas:[{id:'bar',name:'Bar'},{id:'kitchen',name:'Cocina'}],days,rows,format:'24h',
 shifts:[{id:'shift',name:'Apertura',start_time:'08:00',end_time:'17:00',active:shiftStatus!=='inactive',break_minutes:60,schedule_area_ids:shiftStatus==='unclassified'?undefined:restricted?['bar']:[]}],
 done:(s:string)=>qa.done.push(s),
 apply:async(mode,ops,patch)=>{
  qa.calls.push(JSON.parse(JSON.stringify({mode,ops,patch})));
  if(qa.mode==='fail')throw new Error('Cambió una de las casillas. Vuelve a seleccionarla.');
  if(qa.mode==='hold')await new Promise(resolve=>{qa.release=resolve});
  setRows(previous=>{const next=new Map(previous);if(mode==='move'){for(const op of ops)next.delete(cellKey(op));for(const op of ops)next.set(cellKey(op.to),{...op.expected!,...op.to})}else for(const op of ops)next.set(cellKey(op),{...op.expected!,...patch});return next});
 }
 });
 qa.selected=[...grid.selected];qa.rows=[...rows.values()];
 return <main className="scheduleModule">{grid.tools}<section className="monthlyWrap" data-grid-selecting={grid.active?'true':undefined} aria-busy={grid.busy}><div className="monthlyTable">
 {people.slice(0,3).map(person=><div className="monthRow" key={person.id}><b>{person.name}</b>{days.map(date=>{const cell={employee_id:person.id,work_date:date},key=cellKey(cell);return <button key={date} data-grid-employee={person.id} data-grid-date={date} aria-pressed={grid.active?grid.selected.has(key):undefined}
 onPointerDown={e=>grid.pointerDown(e,cell)} onPointerMove={e=>grid.pointerMove(e,cell)} onPointerUp={grid.pointerUp} onPointerCancel={grid.pointerCancel} onLostPointerCapture={grid.pointerCancel}
 onClick={e=>grid.hit(e,cell)}>{rows.get(key)?.id||'Libre'}</button>})}</div>)}
 </div></section></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
`);
  const candidates = file => [file, file+'.ts', file+'.tsx', file+'.js'].find(f => fs.existsSync(f));
  await esbuild.build({entryPoints:[fixture],bundle:true,outdir:temp,entryNames:'bundle',format:'iife',platform:'browser',jsx:'automatic',nodePaths:[path.join(root,'node_modules')],define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},logLevel:'silent',plugins:[{name:'isolated-schedule',setup(build){
    build.onResolve({filter:/^@\//},args=>{const file=candidates(path.join(root,args.path.slice(2)));return file?{path:file===path.join(root,'components/app-preferences.tsx')?preferences:file}:undefined});
    build.onResolve({filter:/^\.\//},args=>{const file=candidates(path.resolve(args.resolveDir,args.path));return file===path.join(root,'components/app-preferences.tsx')?{path:preferences}:undefined});
  }}]});
  const dom = new JSDOM('<!doctype html><html lang="es"><body><div id="root"></div></body></html>',{url:'https://test.invalid/',pretendToBeVisual:true,runScripts:'outside-only'});
  const w=dom.window, errors=[];
  w.fetch=async()=>{throw new Error('External requests are forbidden in this test')};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.scrollBy=()=>{};
  w.HTMLElement.prototype.setPointerCapture=function(id){this._pointer=id};
  w.HTMLElement.prototype.hasPointerCapture=function(id){return this._pointer===id};
  w.HTMLElement.prototype.releasePointerCapture=function(){delete this._pointer};
  w.document.elementFromPoint=(x,y)=>w.document.querySelector('[data-grid-employee="'+(y<160?'a':y<220?'b':'c')+'"][data-grid-date="2026-11-'+String(Math.floor((x-200)/15)+1).padStart(2,'0')+'"]');
  w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
  w.eval(fs.readFileSync(path.join(temp,'bundle.js'),'utf8'));
  const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
  const waitFor=async(check,label)=>{for(let i=0;i<120;i++){if(check())return;await settle()}throw new Error('Timed out: '+label+'; '+w.document.body.textContent)};
  const button=(text,container=w.document)=>[...container.querySelectorAll('button')].find(b=>b.textContent===text);
  const cell=(employee,date)=>w.document.querySelector('[data-grid-employee="'+employee+'"][data-grid-date="2026-11-'+String(date).padStart(2,'0')+'"]');
  const change=(node,value)=>{assert.ok(node,'control exists');const proto=node.tagName==='SELECT'?w.HTMLSelectElement.prototype:node.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,value);node.dispatchEvent(new w.Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}))};
  const labelled=text=>[...w.document.querySelectorAll('input,select,textarea')].find(n=>n.getAttribute('aria-label')===text||n.closest('label')?.textContent.startsWith(text));
  const pointer=(type,node,employee,date,pointerType='mouse')=>{const ev=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:200+(date-1)*15+8,clientY:employee==='a'?120:employee==='b'?180:240});for(const [key,value] of Object.entries({pointerId:1,pointerType,isPrimary:true}))Object.defineProperty(ev,key,{value});node.dispatchEvent(ev)};
  const tap=async(employee,date,pointerType='mouse')=>{const host=cell(employee,date);pointer('pointerdown',host,employee,date,pointerType);await settle();pointer('pointerup',host,employee,date,pointerType);await settle()};
  const sweep=async(from,to,pointerType='mouse',cancel=false)=>{const host=cell(...from);pointer('pointerdown',host,...from,pointerType);await settle();pointer('pointermove',host,...to,pointerType);await settle();pointer(cancel?'pointercancel':'pointerup',host,...to,pointerType);await settle()};
  const selected=()=>JSON.parse(JSON.stringify(w.qa.selected));
  const dialog=()=>w.document.querySelector('[role="dialog"]');
  t.after(()=>{assert.deepEqual(errors,[]);w.close();fs.rmSync(temp,{recursive:true,force:true})});
  await waitFor(()=>button('Seleccionar casillas'),'schedule tools');
  return {w,settle,waitFor,button,cell,change,labelled,pointer,tap,sweep,selected,dialog};
}

test('mouse and touch sweeps starting on selected cells extend selection without moving data',async t=>{
  for(const pointerType of ['mouse','touch']){
    const h=await mount(t);if(!h)return;
    h.button('Seleccionar casillas').click();await h.settle();
    await h.tap('a',1,pointerType);
    assert.deepEqual(h.selected(),['a|2026-11-01']);
    await h.sweep(['a',1],['a',3],pointerType);
    assert.deepEqual(h.selected().sort(),['a|2026-11-01','a|2026-11-02','a|2026-11-03']);
    assert.equal(h.w.qa.calls.length,0,'expanding a selection never persists a move');
    await h.sweep(['a',2],['b',5],pointerType,true);
    assert.equal(h.selected().length,3,'pointer cancellation restores the original selection');
    await h.tap('a',2,pointerType);
    assert.deepEqual(h.selected().sort(),['a|2026-11-01','a|2026-11-03'],'a tap toggles a selected cell');
  }
});

test('Move immediately asks for a calendar target, with no employee or date form, and preserves sparse order',async t=>{
  const h=await mount(t);if(!h)return;
  h.button('Seleccionar casillas').click();await h.settle();
  await h.tap('a',3,'touch');await h.tap('a',1,'touch');
  h.button('Mover').click();await h.settle();
  assert.equal(h.dialog(),null);
  assert.ok(h.button('Volver a seleccionar'));
  assert.equal(h.w.document.querySelector('input[type="date"],select'),null);
  await h.tap('b',2,'touch');await h.waitFor(()=>h.w.qa.done.length===1,'direct transfer saved');
  assert.equal(h.w.qa.calls.length,1);
  const call=JSON.parse(JSON.stringify(h.w.qa.calls[0]));
  assert.equal(call.mode,'move');assert.deepEqual(call.patch,{});
  assert.deepEqual(call.ops.map(op=>[op.expected.id,op.to.employee_id,op.to.work_date]).sort(),[['a1','b','2026-11-02'],['a3','b','2026-11-04']]);
  assert.ok(call.ops.every(op=>op.expected.notes==='Keep '+op.expected.id&&op.expected.break_start==='12:00:00'));
  assert.ok(h.w.qa.rows.some(row=>row.id==='b5'),'unrelated destination schedule remains present');
  assert.ok(h.button('Seleccionar casillas'),'selection mode exits after a successful move');
});

test('seven selected schedules move directly to another employee on Nov 30 and continue through Dec 6, by mouse or touch',async t=>{
  for(const pointerType of ['mouse','touch']){
    const h=await mount(t);if(!h)return;
    const before=JSON.parse(JSON.stringify(h.w.qa.rows));
    h.button('Seleccionar casillas').click();await h.settle();
    await h.sweep(['a',23],['a',29],pointerType);
    assert.equal(h.selected().length,7);
    h.button('Mover').click();await h.settle();
    assert.equal(h.dialog(),null,'moving a selection never opens a form');
    await h.tap('b',30,pointerType);await h.waitFor(()=>h.w.qa.done.length===1,'month crossing move');
    assert.equal(h.w.qa.calls.length,1,'the group is one save');
    const call=JSON.parse(JSON.stringify(h.w.qa.calls[0]));
    assert.equal(call.ops.length,7);
    const byId=new Map(call.ops.map(op=>[op.expected.id,op]));
    for(let i=0;i<7;i++){
      const op=byId.get('week'+i),original=before.find(row=>row.id==='week'+i);
      assert.deepEqual(op.expected,original,'IDs, notes, meals, day types and colors remain in the snapshot');
      assert.deepEqual(op.to,{employee_id:'b',work_date:i===0?'2026-11-30':'2026-12-0'+i});
    }
    const after=JSON.parse(JSON.stringify(h.w.qa.rows));
    assert.equal(after.length,before.length,'moving creates no extra rows');
    assert.deepEqual(after.filter(row=>!row.id.startsWith('week')),before.filter(row=>!row.id.startsWith('week')),'unselected records stay intact');
    assert.ok(!after.some(row=>row.employee_id==='a'&&row.id.startsWith('week')));
    assert.ok(h.button('Seleccionar casillas'));
  }
});

test('return to selection, server failure, busy state, editing and permission removal keep the expected contract',async t=>{
  const h=await mount(t);if(!h)return;
  h.button('Seleccionar casillas').click();await h.settle();await h.tap('a',1);
  h.button('Mover').click();await h.settle();
  h.button('Volver a seleccionar').click();await h.settle();
  assert.deepEqual(h.selected(),['a|2026-11-01']);assert.equal(h.w.qa.calls.length,0);
  h.button('Mover').click();await h.settle();
  h.w.qa.mode='fail';await h.tap('b',1,'touch');
  await h.waitFor(()=>h.w.document.querySelector('[role="alert"]')?.textContent.includes('Cambió una de las casillas'),'server error');
  assert.deepEqual(h.selected(),['a|2026-11-01']);
  assert.ok(h.w.qa.rows.some(row=>row.id==='a1'&&row.employee_id==='a'));
  h.w.qa.mode='hold';await h.tap('b',1,'touch');
  await h.waitFor(()=>h.w.qa.release,'saving in progress');
  assert.equal(h.button('Volver a seleccionar').disabled,true);
  await h.tap('b',2,'touch');assert.equal(h.w.qa.calls.length,2,'pending save blocks duplicate target gestures');
  h.w.qa.release();await h.waitFor(()=>h.button('Seleccionar casillas'),'save completes');
  h.button('Seleccionar casillas').click();await h.settle();await h.tap('a',3);
  h.button('Modificar').click();await h.waitFor(h.dialog,'edit dialog');
  h.change(h.labelled('Qué deseas modificar'),'notes');await h.settle();
  h.change(h.labelled('Nueva nota'),'Nueva nota del equipo');await h.settle();
  h.w.qa.mode='ok';h.button('Aplicar cambios',h.dialog()).click();await h.waitFor(()=>!h.dialog(),'edit saved');
  assert.equal(h.w.qa.calls.at(-1).patch.notes,'Nueva nota del equipo');
  h.w.qa.enable(false);await h.settle();
  assert.equal(h.button('Seleccionar casillas'),undefined);
  await h.tap('b',5,'touch');assert.equal(h.w.qa.calls.length,3,'read-only gestures do not save');
});

test('direct move blocks occupied targets and incompatible areas before sending a mutation',async t=>{
  const h=await mount(t);if(!h)return;
  h.button('Seleccionar casillas').click();await h.settle();await h.tap('a',1,'touch');
  h.button('Mover').click();await h.settle();
  await h.tap('c',4,'touch');
  assert.equal(h.w.qa.calls.length,0);
  assert.match(h.w.document.querySelector('[role="alert"]').textContent,/horario/);
  h.w.qa.restrict(true);await h.settle();await h.tap('c',2,'touch');
  assert.equal(h.w.qa.calls.length,0);
  assert.match(h.w.document.querySelector('[role="alert"]').textContent,/área/);
  assert.deepEqual(h.selected(),['a|2026-11-01']);
});

test('a multirow selection translates row and date offsets together from the first visual cell',async t=>{
  const h=await mount(t);if(!h)return;
  h.button('Seleccionar casillas').click();await h.settle();await h.tap('b',5,'touch');await h.tap('a',1,'touch');
  h.button('Mover').click();await h.settle();
  await h.tap('b',2,'touch');await h.waitFor(()=>h.w.qa.done.length,'multirow transfer');
  const ops=JSON.parse(JSON.stringify(h.w.qa.calls[0].ops));
  assert.deepEqual(ops.map(op=>[op.expected.id,op.to.employee_id,op.to.work_date]).sort(),[['a1','b','2026-11-02'],['b5','c','2026-11-06']]);
});

test('same-employee date moves reject inactive and unclassified shifts before allowing a valid move',async t=>{
  const h=await mount(t);if(!h)return;
  h.button('Seleccionar casillas').click();await h.settle();await h.tap('a',1,'touch');
  h.button('Mover').click();await h.settle();
  for(const status of ['unclassified','inactive']){
    h.w.qa.shiftStatus(status);await h.settle();await h.tap('a',2,'touch');
    assert.equal(h.w.qa.calls.length,0,status+' shift blocks direct calendar moves');
    assert.match(h.w.document.querySelector('[role="alert"]').textContent,/no está disponible/);
  }
  h.w.qa.shiftStatus('active');await h.settle();await h.tap('a',2,'touch');
  await h.waitFor(()=>h.w.qa.done.length,'valid same-employee date transfer');
  assert.equal(h.w.qa.calls.length,1);assert.equal(h.w.qa.calls[0].ops[0].to.work_date,'2026-11-02');
});
