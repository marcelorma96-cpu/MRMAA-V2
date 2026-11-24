"use client";
import {useEffect,useRef,useState} from 'react';
import {CheckCheck, Move, Pencil, X} from 'lucide-react';
import {Modal} from './dashboard-ui';
import {MoveScheduleCells} from './schedule-move-dialog';
import {SCHEDULE_COLORS,scheduleShiftLabel,type ScheduleRow} from '@/lib/schedule-range';
import {cellKey,rectangle,planMove,orderedAssigned,paintSelection,MAX_CELLS,type Picked,type Cell,type Operation,type MoveError} from '@/lib/schedule-grid';
import {employeeAreaKey,shiftsForAreas,shiftFitsArea} from '@/lib/schedule-shift-areas';
import {userMessage} from '@/lib/user-message';
import type {Employee,Shift} from './schedules-module';
import './schedule-grid-tools.css';

type Patch=Record<string,string|null>;
type Props={scope:string;en:boolean;enabled:boolean;people:Employee[];destinations?:Employee[];areas?:{id:string;name:string}[];days:string[];rows:Map<string,ScheduleRow>;shifts:Shift[];format:unknown;
  apply:(mode:'edit'|'move',ops:Operation[],patch:Patch)=>Promise<void>;done:(message:string)=>void};
const errorText:Record<MoveError,[string,string]>={
  empty:['Selecciona al menos una casilla con horario para mover.','Select at least one assigned cell to move.'],
  occupied:['Ya hay un horario en el destino. Elige otro lugar.','A destination cell already has a schedule. Choose another location.'],
  bounds:['El grupo no cabe en las fechas o filas visibles. Elige otro destino.','The group extends beyond the visible dates or rows. Choose another destination.'],
  same:['Elige una casilla distinta como destino.','Choose a different destination.']
};
export function useScheduleGridTools({scope,en,enabled,people,destinations=people,areas=[],days,rows,shifts,format,apply,done}:Props){
  const [mode,setMode]=useState<'off'|'pick'|'target'>('off'),[picks,setPicks]=useState<Picked[]>([]);
  const [anchor,setAnchor]=useState<Cell|null>(null),[dialog,setDialog]=useState<'edit'|'move'|null>(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [preview,setPreview]=useState<{keys:Set<string>;invalid:boolean}>({keys:new Set(),invalid:false});
  const lock=useRef(false),context=useRef(scope);context.current=scope;
  const ids=people.map(p=>p.id),selected=new Set(picks.map(cellKey));
  const byEmployee=new Map(destinations.map(p=>[p.id,employeeAreaKey(p.area_id)]));
  const commonShifts=shiftsForAreas(shifts,picks.map(p=>byEmployee.get(p.employee_id)||''));
  const active=enabled&&mode!=='off',tx=(es:string,eng:string)=>en?eng:es;
  const movable=orderedAssigned(picks,ids,days),canMove=movable.length>0;
  const clickUntil=useRef(0),raf=useRef(0);
  type Gesture={pointer:number;host:HTMLElement;root:HTMLElement;from:Cell;kind:'select'|'target';x:number;y:number;px:number;py:number;moved:boolean;base:Picked[];snapshot:Map<string,ScheduleRow>;last:string;range:boolean};
  const gesture=useRef<Gesture|null>(null);
  function clearPreview(){setPreview(previous=>previous.keys.size||previous.invalid?{keys:new Set(),invalid:false}:previous);}
  function stopGesture(restore=false){
    const g=gesture.current;gesture.current=null;cancelAnimationFrame(raf.current);
    if(g){clickUntil.current=Date.now()+700;if(restore&&g.kind==='select')setPicks(g.base);try{if(g.host.hasPointerCapture(g.pointer))g.host.releasePointerCapture(g.pointer)}catch{}}
    clearPreview();
  }
  function reset(){stopGesture();setMode('off');setPicks([]);setAnchor(null);setDialog(null);setMessage('');}
  const previousContext=useRef({scope,enabled});
  useEffect(()=>{
    if(previousContext.current.scope!==scope||previousContext.current.enabled!==enabled)reset();
    previousContext.current={scope,enabled};
  },[scope,enabled]);
  useEffect(()=>()=>{cancelAnimationFrame(raf.current);gesture.current=null},[]);
  function mark(cell:Cell,range:boolean){
    if(!enabled||lock.current)return;
    setMessage('');setMode('pick');
    if(range&&anchor){
      const next=paintSelection(picks,rectangle(anchor,cell,ids,days),rows);
      if(!next){setMessage(tx('Marca hasta 500 casillas a la vez.','Select up to 500 cells at a time.'));return;}
      setPicks(next);
    }else if(selected.has(cellKey(cell))){
      const next=picks.filter(p=>cellKey(p)!==cellKey(cell));setPicks(next);setAnchor(next.at(-1)??null);
    }else if(picks.length<MAX_CELLS){setPicks([...picks,{...cell,expected:rows.get(cellKey(cell))??null}]);setAnchor(cell);}
    else setMessage(tx('Marca hasta 500 casillas a la vez.','Select up to 500 cells at a time.'));
  }
  function plan(from:Cell,target:Cell,source=movable){
    const result=planMove(source,from,target,ids,days,rows);
    if('error' in result)return {error:errorText[result.error][en?1:0]};
    if(result.ops.some(op=>{
      if(op.expected?.entry_type!=='work')return false;
      const shift=shifts.find(s=>s.id===op.expected?.shift_id);
      return !shift?.active||!shiftFitsArea(shift,byEmployee.get(op.to.employee_id)||'');
    }))
      return {error:tx('Ese turno no está disponible en el área de destino.','That shift is not available in the destination area.')};
    return result;
  }
  function showDestination(from:Cell,target:Cell,source=movable){
    const result=plan(from,target,source);
    const next={keys:new Set('error' in result?[cellKey(target)]:result.ops.map(op=>cellKey(op.to))),invalid:'error' in result};
    setPreview(previous=>previous.invalid===next.invalid&&previous.keys.size===next.keys.size&&[...next.keys].every(key=>previous.keys.has(key))?previous:next);
  }
  async function save(kind:'edit'|'move',patch:Patch,operations?:Operation[]){
    if(lock.current||!enabled)return;
    const ops=operations??picks.map(p=>({...p,to:{employee_id:p.employee_id,work_date:p.work_date}}));
    const entered=context.current;
    lock.current=true;setBusy(true);setMessage('');clearPreview();
    try{await apply(kind,ops,patch);if(context.current===entered){
      setPicks([]);setAnchor(null);setDialog(null);setMode(kind==='move'?'off':'pick');
      const movedPeople=[...new Set(ops.map(op=>op.to.employee_id))];
      const recipient=movedPeople.length===1?destinations.find(p=>p.id===movedPeople[0])?.name:'';
      done(kind==='move'?tx('Horarios movidos: ','Schedules moved: ')+ops.length+(recipient?' · '+recipient:''):tx('Casillas modificadas: ','Cells updated: ')+ops.length);
    }}
    catch(e){if(context.current===entered)setMessage(userMessage(e));}
    finally{lock.current=false;setBusy(false);}
  }
  function move(from:Cell,target:Cell,source=movable){
    if(lock.current)return;
    const result=plan(from,target,source);
    if('error' in result){setMessage(result.error);return;}
    void save('move',{},result.ops);
  }
  function hit(e:React.MouseEvent,cell:Cell){
    if(e.detail!==0&&Date.now()<clickUntil.current)return true;
    if(!enabled||(!active&&!e.shiftKey&&!e.metaKey&&!e.ctrlKey))return false;
    if(lock.current||dialog)return true;
    if(mode==='target'&&movable[0])move(movable[0],cell);else mark(cell,e.shiftKey);
    return true;
  }
  function atPoint(g:Gesture):Cell|null{
    const el=g.host.ownerDocument.elementFromPoint(g.px,g.py)?.closest<HTMLElement>('[data-grid-employee][data-grid-date]');
    return el&&g.root.contains(el)?{employee_id:el.dataset.gridEmployee!,work_date:el.dataset.gridDate!}:null;
  }
  function updateGesture(g:Gesture){
    if(!g.moved&&Math.hypot(g.px-g.x,g.py-g.y)<7)return;
    g.moved=true;
    const cell=atPoint(g),key=cell?cellKey(cell):'';
    if(key===g.last)return;g.last=key;
    if(!cell){clearPreview();return;}
    if(g.kind==='select'){
      const next=paintSelection(g.base,rectangle(g.from,cell,ids,days),g.snapshot);
      if(next){setPicks(next);setAnchor(g.from);setMessage('');}
      else setMessage(tx('Marca hasta 500 casillas a la vez.','Select up to 500 cells at a time.'));
    }else showDestination(g.from,cell,orderedAssigned(g.base,ids,days));
  }
  const frameUpdate=useRef<(g:Gesture)=>void>(()=>{});frameUpdate.current=updateGesture;
  function tick(){
    const g=gesture.current;if(!g)return;
    if(g.moved){
      const doc=g.host.ownerDocument,win=doc.defaultView!;
      const over=doc.elementFromPoint(g.px,g.py)?.closest<HTMLElement>('.monthlyTable');
      let tableScrolled=false;
      if(over&&g.root.contains(over)){
        const box=over.getBoundingClientRect(),sticky=over.querySelector<HTMLElement>('.monthRow>b')?.getBoundingClientRect().width||150;
        const left=box.left+sticky,right=Math.min(box.right,win.innerWidth);
        if(g.px>=left&&g.px<left+28)over.scrollLeft-=10;
        else if(g.px>right-28&&g.px<=right)over.scrollLeft+=10;
        if(over.scrollHeight>over.clientHeight+1){
          const top=Math.max(box.top+(over.querySelector<HTMLElement>('.monthHeader')?.offsetHeight||48),45),bottom=Math.min(box.bottom,win.innerHeight);
          const dy=g.py>bottom-28&&g.py<=bottom?10:g.py>=top&&g.py<top+28?-10:0;
          const before=over.scrollTop;over.scrollTop+=dy;tableScrolled=before!==over.scrollTop;
        }
      }
      if(!tableScrolled&&g.px>=0&&g.px<=win.innerWidth){
        const dy=g.py>win.innerHeight-40?10:g.py<45?-10:0;
        if(dy){
          let parent:HTMLElement|null=g.root.parentElement;
          while(parent&&!(parent.scrollHeight>parent.clientHeight+1&&/auto|scroll/.test(win.getComputedStyle(parent).overflowY)))parent=parent.parentElement;
          if(parent)parent.scrollTop+=dy;else win.scrollBy(0,dy);
        }
      }
      frameUpdate.current(g);
    }
    raf.current=requestAnimationFrame(tick);
  }
  function pointerDown(e:React.PointerEvent<HTMLElement>,cell:Cell){
    if(!active||lock.current||dialog)return;
    if(e.isPrimary===false){stopGesture(true);return;}
    if(e.button!==0)return;
    const root=e.currentTarget.closest<HTMLElement>('.monthlyWrap');if(!root)return;
    e.preventDefault();e.stopPropagation();stopGesture();setMessage('');
    const from=mode==='target'&&movable[0]?movable[0]:cell;
    // Selecting never moves data: a sweep has the same meaning on marked and unmarked cells.
    const kind=mode==='target'?'target':'select';
    const g:Gesture={pointer:e.pointerId,host:e.currentTarget,root,from,kind,x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:false,base:picks,snapshot:new Map(rows),last:'',range:e.shiftKey};
    gesture.current=g;
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
    if(kind==='target')showDestination(from,cell);
    raf.current=requestAnimationFrame(tick);
  }
  function pointerMove(e:React.PointerEvent<HTMLElement>,cell:Cell){
    const g=gesture.current;
    if(g&&g.pointer===e.pointerId){e.preventDefault();e.stopPropagation();g.px=e.clientX;g.py=e.clientY;updateGesture(g);}
    else if(active&&mode==='target'&&!lock.current&&movable[0]&&e.pointerType==='mouse')showDestination(movable[0],cell);
  }
  function pointerUp(e:React.PointerEvent<HTMLElement>){
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
    e.preventDefault();e.stopPropagation();g.px=e.clientX;g.py=e.clientY;updateGesture(g);
    const to=atPoint(g);stopGesture();
    if(g.kind==='target'){
      if(to)move(g.from,to,orderedAssigned(g.base,ids,days));
    }else if(!g.moved&&to)mark(to,g.range);
  }
  function pointerCancel(e:React.PointerEvent){if(gesture.current?.pointer===e.pointerId)stopGesture(true);}
  function close(){if(!lock.current){setDialog(null);setMessage('');}}
  const tools=enabled&&<div className={active?'gridTools gridToolsActive':'gridTools'} translate="no">
    {!active?<button type="button" className="secondary" onClick={()=>{reset();setMode('pick')}}><CheckCheck size={16}/>{tx('Seleccionar casillas','Select cells')}</button>:<>
      <div className="gridToolsActions">
        <strong role="status">{busy?tx('Moviendo o guardando…','Saving…'):picks.length+' '+tx('seleccionadas','selected')}</strong>
        {mode==='target'?<button type="button" className="secondary" disabled={busy} onClick={()=>{setMode('pick');clearPreview();setMessage('')}}>{tx('Volver a seleccionar','Back to selection')}</button>:<>
          <button type="button" className="secondary" disabled={busy||!picks.length} onClick={()=>{setMessage('');setDialog('edit')}}><Pencil size={15}/>{tx('Modificar','Edit')}</button>
          <button type="button" className="primary" disabled={busy||!canMove} onClick={()=>{stopGesture();setMessage('');setDialog('move')}}><Move size={15}/>{tx('Mover','Move')}</button>
        </>}
        <button type="button" className="secondary" disabled={busy} onClick={reset} aria-label={tx('Salir de selección','Exit selection')}><X size={16}/></button>
      </div>
      <small>{mode==='target'?tx('Toca el destino inicial. Se conservan el orden y los espacios entre turnos.','Tap the destination for the first cell. The group keeps its order and spacing.'):
        tx('Marca con toques o deslizando. Pulsa Mover para elegir empleado y fecha.','Tap or swipe to select. Choose Move to pick an employee and date.')}</small>
    </>}
    {message&&!dialog&&<p role="alert">{message}</p>}
    {dialog==='edit'&&<EditCells en={en} picks={picks} shifts={commonShifts} format={format} busy={busy} message={message} close={close} apply={p=>void save('edit',p)}/>}
    {dialog==='move'&&<MoveScheduleCells en={en} picks={movable} people={destinations} areas={areas} days={days} rows={rows} shifts={shifts} busy={busy} message={message} close={close}
      change={()=>setMessage('')} calendar={()=>{setDialog(null);setMessage('');setMode('target')}} apply={ops=>void save('move',{},ops)}/>}
  </div>;
  return {active,busy,tools,selected,hit,pointerDown,pointerMove,pointerUp,pointerCancel,preview,clearPreview};
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
