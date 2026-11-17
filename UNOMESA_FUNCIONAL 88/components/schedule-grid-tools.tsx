"use client";
import {useEffect,useRef,useState} from 'react';
import {CheckCheck, Move, Pencil, X} from 'lucide-react';
import {Modal} from './dashboard-ui';
import {SCHEDULE_COLORS,scheduleShiftLabel,type ScheduleRow} from '@/lib/schedule-range';
import {cellKey,rectangle,planMove,MAX_CELLS,type Picked,type Cell,type Operation,type MoveError} from '@/lib/schedule-grid';
import {employeeAreaKey,shiftsForAreas,shiftFitsArea} from '@/lib/schedule-shift-areas';
import {userMessage} from '@/lib/user-message';
import type {Employee,Shift} from './schedules-module';
import './schedule-grid-tools.css';

type Patch=Record<string,string|null>;
type Props={scope:string;en:boolean;enabled:boolean;people:Employee[];days:string[];rows:Map<string,ScheduleRow>;shifts:Shift[];format:unknown;
  apply:(mode:'edit'|'move',ops:Operation[],patch:Patch)=>Promise<void>;done:(message:string)=>void};
const errorText:Record<MoveError,[string,string]>={
  empty:['Para mover, selecciona solo casillas que tengan horario.','To move, select only assigned cells.'],
  occupied:['Ya hay un horario en el destino. Elige otro lugar.','A destination cell already has a schedule. Choose another location.'],
  bounds:['El grupo no cabe en las fechas o filas visibles. Elige otro destino.','The group extends beyond the visible dates or rows. Choose another destination.'],
  same:['Elige una casilla distinta como destino.','Choose a different destination.']
};
export function useScheduleGridTools({scope,en,enabled,people,days,rows,shifts,format,apply,done}:Props){
  const [mode,setMode]=useState<'off'|'pick'|'target'>('off'),[picks,setPicks]=useState<Picked[]>([]);
  const [anchor,setAnchor]=useState<Cell|null>(null), [dialog,setDialog]=useState<'edit'|'move'|null>(null);
  const [moves,setMoves]=useState<Operation[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const lock=useRef(false),context=useRef(scope);context.current=scope;
  const ids=people.map(p=>p.id),names=new Map(people.map(p=>[p.id,p.name])),selected=new Set(picks.map(cellKey));
  const byEmployee=new Map(people.map(p=>[p.id,employeeAreaKey(p.area_id)]));
  const commonShifts=shiftsForAreas(shifts,picks.map(p=>byEmployee.get(p.employee_id)||''));
  const active=enabled&&mode!=='off',tx=(es:string,eng:string)=>en?eng:es;
  const label=(c:Cell)=>(names.get(c.employee_id)||'')+' · '+c.work_date.split('-').reverse().slice(0,2).join('/');
  function reset(){setMode('off');setPicks([]);setAnchor(null);setDialog(null);setMoves([]);setMessage('');}
  const previousContext=useRef({scope,enabled});
  useEffect(()=>{
    if(previousContext.current.scope!==scope||previousContext.current.enabled!==enabled)reset();
    previousContext.current={scope,enabled};
  },[scope,enabled]);
  function mark(cell:Cell,range:boolean){
    if(!enabled||lock.current)return;
    setMessage('');setMode('pick');
    const snapshot=(c:Cell):Picked=>({...c,expected:rows.get(cellKey(c))??null});
    if(range&&anchor){
      const list=rectangle(anchor,cell,ids,days).filter(c=>!selected.has(cellKey(c)));
      if(list.length+picks.length>MAX_CELLS){setMessage(tx('Marca hasta 500 casillas a la vez.','Select up to 500 cells at a time.'));return;}
      setPicks([...picks,...list.map(snapshot)]);
    }else if(selected.has(cellKey(cell))){
      const next=picks.filter(p=>cellKey(p)!==cellKey(cell));setPicks(next);setAnchor(next.at(-1)??null);
    }else if(picks.length<MAX_CELLS){setPicks([...picks,snapshot(cell)]);setAnchor(cell);}
    else setMessage(tx('Marca hasta 500 casillas a la vez.','Select up to 500 cells at a time.'));
  }
  function preview(from:Cell,target:Cell){
    if(lock.current)return;
    const plan=planMove(picks,from,target,ids,days,rows);
    if('error' in plan){setMessage(errorText[plan.error][en?1:0]);return;}
    if(plan.ops.some(op=>op.expected?.entry_type==='work'&&!shiftFitsArea(shifts.find(s=>s.id===op.expected?.shift_id),byEmployee.get(op.to.employee_id)||''))){
      setMessage(tx('Ese turno no está disponible en el área de destino.','That shift is not available in the destination area.'));return;
    }
    setMoves(plan.ops);setMessage('');setDialog('move');
  }
  function hit(e:React.MouseEvent,cell:Cell){
    if(!enabled||(!active&&!e.shiftKey&&!e.metaKey&&!e.ctrlKey))return false;
    if(mode==='target'&&picks[0])preview(picks[0],cell);
    else mark(cell,e.shiftKey);
    return true;
  }
  const dragAnchor=useRef<Cell|null>(null);
  function startDrag(cell:Cell){dragAnchor.current=cell;}
  function drop(target:Cell){if(dragAnchor.current){const src=dragAnchor.current;dragAnchor.current=null;preview(src,target);}}
  function close(){if(!lock.current){setDialog(null);setMessage('');}}
  async function save(kind:'edit'|'move',patch:Patch){
    if(lock.current||!enabled)return;
    const ops=kind==='move'?moves:picks.map(p=>({...p,to:{employee_id:p.employee_id,work_date:p.work_date}}));
    const entered=context.current;
    lock.current=true;setBusy(true);setMessage('');
    try{await apply(kind,ops,patch);if(context.current===entered){reset();done(kind==='move'?tx('Casillas movidas: ','Cells moved: ')+ops.length:tx('Casillas modificadas: ','Cells updated: ')+ops.length);}}
    catch(e){if(context.current===entered)setMessage(userMessage(e));}
    finally{lock.current=false;setBusy(false);}
  }
  const canMove=picks.length>0&&picks.every(p=>p.expected);
  const tools=enabled&&<div className={active?"gridTools gridToolsActive":"gridTools"} translate="no">
    {!active?<button type="button" className="secondary" onClick={()=>{reset();setMode('pick')}}><CheckCheck size={16}/>{tx('Seleccionar casillas','Select cells')}</button>:<>
      <div className="gridToolsActions">
        <strong role="status">{picks.length} {tx('seleccionadas','selected')}</strong>
        {mode==='target'?<button type="button" className="secondary" onClick={()=>{setMode('pick');setMessage('')}}>{tx('Volver a seleccionar','Back to selection')}</button>:<>
          <button type="button" className="secondary" disabled={!picks.length} onClick={()=>{setMessage('');setDialog('edit')}}><Pencil size={15}/>{tx('Modificar','Edit')}</button>
          <button type="button" className="secondary" disabled={!canMove} onClick={()=>{setMessage('');setMode('target')}}><Move size={15}/>{tx('Mover','Move')}</button>
        </>}
        <button type="button" className="secondary" onClick={reset} aria-label={tx('Salir de selección','Exit selection')}><X size={16}/></button>
      </div>
      <small>{mode==='target'&&picks[0]?tx('Toca el destino de ','Tap the destination for ')+label(picks[0])+tx('. El resto se moverá con ella.','. The rest will move with it.'):
        tx('Toca para marcar o desmarcar. En computadora, Mayús + clic selecciona un bloque.','Tap to select or deselect. On desktop, Shift + click selects a block.')}</small>
      {picks.length>0&&!canMove&&<small>{errorText.empty[en?1:0]}</small>}
    </>}
    {message&&!dialog&&<p role="alert">{message}</p>}
    {dialog==='edit'&&<EditCells en={en} picks={picks} shifts={commonShifts} format={format} busy={busy} message={message} close={close} apply={p=>save('edit',p)}/>}
    {dialog==='move'&&<Modal title={tx('Mover horarios','Move schedules')} close={close}>
      <div className="gridDialog" translate="no"><p>{tx('Revisa el destino de las casillas. Se conservarán sus turnos, comidas, notas y colores.','Review the destination cells. Shifts, meal times, notes and colors will move with them.')}</p>
        <ul className="gridMoveList">{moves.map(op=><li key={cellKey(op)}><span>{label(op)}</span><span>→ {label(op.to)}</span></li>)}</ul>
        {message&&<p role="alert">{message}</p>}
        <div className="gridToolsActions"><button type="button" className="secondary" disabled={busy} onClick={close}>{tx('Cancelar','Cancel')}</button><button type="button" className="primary" disabled={busy} onClick={()=>void save('move',{})}>{busy?tx('Guardando…','Saving…'):tx('Mover casillas','Move cells')+' ('+moves.length+')'}</button></div></div>
    </Modal>}
  </div>;
  return {active,tools,selected,hit,startDrag,drop,endDrag:()=>{dragAnchor.current=null},canDrag:(c:Cell)=>active&&mode==='pick'&&canMove&&selected.has(cellKey(c))};
}
function EditCells({en,picks,shifts,format,busy,message,close,apply}:{en:boolean;picks:Picked[];shifts:Shift[];format:unknown;busy:boolean;message:string;close:()=>void;apply:(p:Patch)=>void}){
  const tx=(es:string,eng:string)=>en?eng:es;
  const empty=picks.some(p=>!p.expected),workOnly=picks.every(p=>p.expected?.entry_type==='work');
  const [field,setField]=useState('assignment'),[assignment,setAssignment]=useState(''),[color,setColor]=useState(''),[notes,setNotes]=useState('');
  const [start,setStart]=useState(''),[end,setEnd]=useState('');
  let patch:Patch={};let valid=true;
  switch(field){
    case 'assignment': valid=!!assignment;patch=assignment.startsWith('shift:')?{entry_type:'work',shift_id:assignment.slice(6)}:{entry_type:assignment};break;
    case 'meal':valid=!!start===!!end;patch={break_start:start||null,break_end:end||null};break;
    case 'color':patch={color:color||null};break;
    case 'notes':patch={notes};break;
  }
  return <Modal title={tx('Modificar casillas','Edit cells')+' ('+picks.length+')'} close={close}>
    <form className="gridDialog" translate="no" onSubmit={e=>{e.preventDefault();if(valid)apply(patch)}}>
      <label>{tx('Qué deseas modificar','What to change')}<select value={field} onChange={e=>setField(e.target.value)}>
        <option value="assignment">{tx('Turno o tipo de día','Shift or day type')}</option><option disabled={!workOnly} value="meal">{tx('Horario de comida','Meal time')}</option><option disabled={empty} value="color">{tx('Color','Color')}</option><option disabled={empty} value="notes">{tx('Notas o motivo','Notes or reason')}</option>
      </select></label>
      {field==='assignment'&&<label>{tx('Asignar a la selección','Assign to selection')}<select required value={assignment} onChange={e=>setAssignment(e.target.value)}>
        <option value="">{tx('Elige una opción…','Choose an option…')}</option>{shifts.filter(s=>s.active).map(s=><option key={s.id} value={'shift:'+s.id}>{scheduleShiftLabel(s,format).replace('\n',' · ')}</option>)}
        <option value="rest">{tx('Descanso','Day off')}</option><option value="permission">{tx('Permiso','Leave')}</option><option value="vacation">{tx('Vacaciones','Vacation')}</option>
      </select></label>}
      {field==='assignment'&&!shifts.length&&<small>{tx('No hay un turno común para estas casillas. Puedes cambiar el tipo de día o seleccionar una sola área.','These cells have no common shift. Change the day type or select cells from one area.')}</small>}
      {field==='meal'&&<div className="gridToolsActions">
        <label>{tx('Inicio de comida','Meal start')}<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>{tx('Fin de comida','Meal end')}<input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      </div>}
      {field==='color'&&<label>{tx('Color de casilla','Cell color')}<select value={color} onChange={e=>setColor(e.target.value)}><option value="">Auto</option>{SCHEDULE_COLORS.map(c=><option key={c.value} value={c.value}>{en?c.en:c.es}</option>)}</select></label>}
      {field==='notes'&&<label>{tx('Nueva nota','New note')}<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label>}
      <small>{field==='assignment'&&['rest','permission','vacation'].includes(assignment)?tx('Estos días no tienen turno ni horario de comida.','These day types have no shift or meal time.'):field==='meal'?tx('Deja ambas horas vacías para quitar la comida.','Leave both times empty to clear the meal time.'):field==='notes'?tx('Reemplaza las notas seleccionadas. Deja el campo vacío para borrarlas.','Replaces selected notes. Leave blank to clear them.'):tx('Solo se aplicará a las casillas marcadas.','Only the selected cells will change.')}</small>
      {message&&<p role="alert">{message}</p>}
      <div className="gridToolsActions"><button type="button" className="secondary" disabled={busy} onClick={close}>{tx('Cancelar','Cancel')}</button><button type="submit" className="primary" disabled={busy||!valid}>{busy?tx('Guardando…','Saving…'):tx('Aplicar cambios','Apply changes')}</button></div>
    </form>
  </Modal>;
}
