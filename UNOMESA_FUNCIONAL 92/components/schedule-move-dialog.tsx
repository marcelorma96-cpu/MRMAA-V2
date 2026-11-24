"use client";
import {useState} from 'react';
import {ArrowRight, CalendarDays, Move} from 'lucide-react';
import {Modal} from './dashboard-ui';
import {planTransfer,type Picked,type Operation} from '@/lib/schedule-grid';
import type {ScheduleRow} from '@/lib/schedule-range';
import {employeeAreaKey,shiftFitsArea} from '@/lib/schedule-shift-areas';
import type {Employee,Shift} from './schedules-module';

type Props={en:boolean;picks:Picked[];people:Employee[];areas:{id:string;name:string}[];days:string[];rows:Map<string,ScheduleRow>;shifts:Shift[];
  busy:boolean;message:string;close:()=>void;change:()=>void;calendar:()=>void;apply:(ops:Operation[])=>void};

export function MoveScheduleCells({en,picks,people,areas,days,rows,shifts,busy,message,close,change,calendar,apply}:Props){
  const tx=(es:string,eng:string)=>en?eng:es;
  const sources=[...new Set(picks.map(p=>p.employee_id))];
  const first=picks.map(p=>p.work_date).sort()[0]||days[0];
  const last=picks.map(p=>p.work_date).sort().at(-1)||first;
  const [date,setDate]=useState(first),[targets,setTargets]=useState<Record<string,string>>(()=>Object.fromEntries(sources.map(id=>[id,id])));
  const [search,setSearch]=useState('');
  const active=people.filter(p=>p.active),byId=new Map(active.map(p=>[p.id,p]));
  const areaName=(person:Employee)=>areas.find(a=>a.id===person.area_id)?.name||tx('Sin área','No area');
  const personName=(id:string)=>byId.get(id)?.name||tx('Empleado no disponible','Employee unavailable');
  const formatDate=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString(en?'en-US':'es-GT',{day:'numeric',month:'short'});
  const range=(start:string,end:string)=>start===end?formatDate(start):formatDate(start)+' – '+formatDate(end);
  const result=planTransfer(picks,targets,date,active.map(p=>p.id),days,rows);
  const incompatible='ops' in result?result.ops.find(op=>{
    if(op.expected?.entry_type!=='work')return false;
    const shift=shifts.find(s=>s.id===op.expected?.shift_id);
    return !shift?.active||!shiftFitsArea(shift,employeeAreaKey(byId.get(op.to.employee_id)?.area_id));
  }):undefined;
  let invalid='error' in result?result.error==='same'?'':result.error==='occupied'?tx('Hay horarios ocupados o destinos repetidos. Elige otro empleado o fecha.','Some destinations are occupied or repeated. Choose another employee or date.'):
    result.error==='bounds'?tx('Elige empleados disponibles y fechas dentro de este mes para todo el grupo.','Choose available employees and dates within this month for the entire group.'):
    tx('Selecciona al menos un horario.','Select at least one schedule.'):'';
  if(incompatible)invalid=tx('Uno de los turnos no está habilitado en el área de ','One of the shifts is not available in the area of ')+personName(incompatible.to.employee_id)+'.';
  const valid='ops' in result&&!invalid;
  const count='ops' in result?result.ops.length:picks.length;
  const schedules=(n:number)=>n===1?tx('horario','schedule'):tx('horarios','schedules');
  const changed=()=>change();
  const query=search.trim().toLocaleLowerCase(en?'en':'es');
  function options(source:string){
    const matching=active.filter(p=>p.id===targets[source]||!query||[p.name,p.employee_code,areaName(p)].some(v=>v.toLocaleLowerCase(en?'en':'es').includes(query)));
    const groups=[...new Set(matching.map(p=>employeeAreaKey(p.area_id)))];
    return groups.map(area=>{
      const members=matching.filter(p=>employeeAreaKey(p.area_id)===area);
      return <optgroup key={area} label={areaName(members[0])}>{members.map(p=><option key={p.id} value={p.id}>{p.name}{p.employee_code?' · '+p.employee_code:''}</option>)}</optgroup>;
    });
  }
  return <Modal title={tx('Mover horarios','Move schedules')} close={close}>
    <form className="scheduleMoveDialog" translate="no" onSubmit={e=>{e.preventDefault();if(valid&&!busy&&'ops' in result)apply(result.ops)}}>
      <div className="scheduleMoveSummary"><span className="scheduleMoveIcon"><Move size={20}/></span><div><strong>{picks.length} {picks.length===1?tx('horario seleccionado','selected schedule'):tx('horarios seleccionados','selected schedules')}</strong><small>{range(first,last)} · {tx('Se conservan el orden y los espacios.','Order and gaps stay the same.')}</small></div></div>
      <fieldset disabled={busy}>
        {active.length>8&&<label className="scheduleMoveSearch">{tx('Buscar empleado','Find employee')}<input type="search" placeholder={tx('Nombre, área o ID…','Name, area or ID…')} value={search} onChange={e=>setSearch(e.target.value)}/></label>}
        <div className="scheduleMovePeople">{sources.map(source=><label key={source}>
          {sources.length===1?<><span>{tx('Empleado de destino','Destination employee')}</span><small>{tx('Desde: ','From: ')}{personName(source)}</small></>:<span>{tx('Destino de ','Destination for ')}{personName(source)}</span>}
          <select required aria-label={sources.length===1?tx('Empleado de destino','Destination employee'):tx('Destino de ','Destination for ')+personName(source)} value={targets[source]||''} onChange={e=>{setTargets(previous=>({...previous,[source]:e.target.value}));changed()}}>
            {!byId.has(targets[source])&&<option value="">{tx('Elige un empleado','Choose an employee')}</option>}{options(source)}
          </select>
        </label>)}</div>
        <label className="scheduleMoveDate"><span><CalendarDays size={16}/>{tx('Fecha del primer horario','First schedule date')}</span><input aria-label={tx('Fecha del primer horario','First schedule date')} type="date" required min={days[0]} max={days.at(-1)} value={date} onChange={e=>{setDate(e.target.value);changed()}}/></label>
        <div className="scheduleMoveDateHelp">{date===first?<small>{tx('Se mantienen las fechas actuales.','Current dates will be kept.')}</small>:<button type="button" className="scheduleMoveLink" onClick={()=>{setDate(first);changed()}}>{tx('Mantener fechas actuales','Keep current dates')}</button>}</div>
        {valid&&'ops' in result&&<div className="scheduleMovePreview" role="status"><ArrowRight size={16}/><span>{count} {schedules(count)} · {range(result.ops.map(op=>op.to.work_date).sort()[0],result.ops.map(op=>op.to.work_date).sort().at(-1)!)}{sources.length===1?' · '+personName(targets[sources[0]]):''}</span></div>}
        {(message||invalid)&&<p className="scheduleMoveError" role="alert">{message||invalid}</p>}
        {!message&&!invalid&&!valid&&<small>{tx('Elige otro empleado o cambia la fecha para mover la selección.','Choose another employee or date to move the selection.')}</small>}
        <div className="scheduleMoveActions"><button type="button" className="secondary" onClick={close}>{tx('Cancelar','Cancel')}</button><button type="submit" className="primary" disabled={!valid||busy}>{busy?tx('Moviendo…','Moving…'):tx('Mover ','Move ')+count+' '+schedules(count)}</button></div>
        <button type="button" className="scheduleMoveLink scheduleMoveCalendar" onClick={calendar}>{tx('Elegir en calendario','Choose on calendar')}<ArrowRight size={14}/></button>
      </fieldset>
    </form>
  </Modal>;
}
