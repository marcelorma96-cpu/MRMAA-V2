"use client";
import {floorAddedSeatsLabel} from '@/lib/floor-plan';
import {floorTableName} from '@/lib/floor-table-label';
import {useState} from 'react';
import {Users,MapPin,ChevronDown} from 'lucide-react';
import {activeReservation,floorEndTime,type FloorLayout,type FloorReservation} from '@/lib/floor-plan';
import {areaLevel,floorLevels,levelName,restaurantDayReservations} from '@/lib/restaurant-map';
import {formatEventTime} from '@/lib/local-date';
import {translate} from '@/lib/translations';
import {floorAreaLabel} from '@/lib/floor-area-label';
import {FloorReservationDetails} from './floor-reservation-details';
type Booking=ReturnType<typeof restaurantDayReservations>[number];
export type OverviewReservationProps={restaurantId:string;demo:boolean;canEdit:boolean;preferences:Record<string,any>;refreshToken:number;timeFormat?:string;onReservation:(reservation:FloorReservation)=>void;onLinkQuote?:(reservation:FloorReservation)=>void;onEdit?:(id:string)=>void;onQuote?:(id:string)=>void;openQuote?:(id:string)=>void};
export function OverviewReservations({bookings,layout,date,en,onLocate,...props}:OverviewReservationProps&{bookings:Booking[];layout:FloorLayout;date:string;en:boolean;onLocate:(booking:Booking|null)=>void}){
 const [search,setSearch]=useState(''),[area,setArea]=useState(''),[unassigned,setUnassigned]=useState(false),[expanded,setExpanded]=useState(''),[limit,setLimit]=useState(50);
 const say=(es:string,eng:string)=>en?eng:es,normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const tableNames=(b:Booking)=>layout.tables.filter(t=>b.tableIds.includes(t.id)).map(t=>floorTableName(t.name,en)).join(' + ');
 const filtered=bookings.filter(b=>(!area||b.areaIds.includes(area))&&(!unassigned||!b.tableIds.length)&&normalize(`${b.reservation.client_name} ${b.reservation.phone} ${b.reservation.area} ${tableNames(b)}`).includes(normalize(search)));
 const levels=floorLevels(layout),active=bookings.filter(b=>activeReservation(b.reservation));
 return <aside className="overviewReservations" aria-label={say('Reservaciones del mapa completo','Complete map reservations')}>
  <div className="overviewReservationHeading"><div><h3>{say('Reservaciones del día','Day reservations')}</h3><small>{date} · {say('Todos los niveles','All levels')}</small></div><b>{bookings.length}</b></div>
  <div className="overviewReservationTotals"><span>{active.reduce((n,b)=>n+Number(b.reservation.guests||0),0)} {say('personas','guests')}</span><span>{active.filter(b=>!b.tableIds.length).length} {say('sin mesa','unassigned')}</span></div>
  <input type="search" aria-label={say('Buscar en el mapa','Search complete map')} placeholder={say('Cliente, teléfono o mesa…','Customer, phone or table…')} value={search} onChange={e=>{setSearch(e.target.value);setLimit(50)}}/>
  <select aria-label={say('Filtrar reservaciones por área','Filter reservations by area')} value={area} onChange={e=>{setArea(e.target.value);setLimit(50)}}><option value="">{say('Todas las áreas y niveles','All areas and levels')}</option>{layout.areas.map(a=><option key={a.id} value={a.id}>{a.name} · {levelName(levels.find(l=>l.id===areaLevel(layout,a))!.name,en)}</option>)}</select>
  <label className="floorCheck"><input type="checkbox" checked={unassigned} onChange={e=>{setUnassigned(e.target.checked);setLimit(50)}}/>{say('Solo sin mesa','Unassigned only')}</label>
  <p className="overviewReservationHint">{say('La agenda muestra todo el día. Los colores del mapa corresponden al horario elegido.','The schedule covers the whole day. Map colors reflect the selected time window.')}</p>
  <div className="overviewBookingList">{filtered.slice(0,limit).map(b=>{
   const r=b.reservation,s=b.seating,cancelled=!activeReservation(r),open=expanded===r.id,end=s?floorEndTime(r.event_date,r.event_time||s.source_time,s.duration_minutes):null;
   const areas=b.areaIds.map(id=>layout.areas.find(a=>a.id===id)).filter(a=>!!a),names=areas.map(a=>`${a.name} · ${levelName(levels.find(l=>l.id===areaLevel(layout,a))!.name,en)}`).join(' / ');
   return <article key={r.id} data-overview-reservation={r.id} className={`overviewBooking ${open?'selected':''} ${cancelled?'cancelled':''}`}>
    <button type="button" className="overviewBookingSummary" aria-expanded={open} onClick={()=>{setExpanded(open?'':r.id);onLocate(open?null:b)}}>
     <span className="overviewBookingTime"><strong>{r.event_time||s?.source_time?formatEventTime(r.event_time||s?.source_time,props.timeFormat):say('Sin hora','No time')}{end&&` – ${formatEventTime(end.time,props.timeFormat)}${end.nextDay?' +1':''}`}</strong><span>{r.guests} <Users size={13}/></span></span>
     <b>{r.client_name}</b><small>{floorAreaLabel(r.area,s,layout,en)||names||say('Sin área','No area')}</small>{r.phone&&<small dir="ltr">{r.phone}</small>}
     <span className="overviewBookingTags"><span className={`floorBadge ${cancelled?'':s?'assigned':''}`}>{cancelled?translate(r.status,en?'en':'es'):s?.service_status==='finished'?say('Finalizada','Finished'):s?.service_status==='seated'?say('En mesa','Seated'):translate(r.status,en?'en':'es')}</span><small>{s?.whole_area_id?say('Salón completo','Entire room'):tableNames(b)||say('Sin mesa','Unassigned')}</small><ChevronDown size={14}/></span>
     {floorAddedSeatsLabel(r.guests,s,layout,en)&&<small>{floorAddedSeatsLabel(r.guests,s,layout,en)}</small>}{b.continued&&<small>{say('Continúa desde','Continues from')} {r.event_date}</small>}
    </button>
    {open&&<div className="overviewBookingExpanded"><FloorReservationDetails restaurantId={props.restaurantId} reservation={r} demo={props.demo} preferences={props.preferences} refreshToken={props.refreshToken} en={en}/><div className="floorAgendaActions">
     {!!b.areaIds.length&&<button type="button" className="secondary" onClick={()=>onLocate(b)}><MapPin size={14}/>{say('Ubicar en mapa','Locate on map')}</button>}
     {!cancelled&&<button type="button" className="secondary" onClick={()=>props.onReservation(r)}>{say('Ver asignación','View assignment')}</button>}
    </div></div>}
   <div className="floorAgendaActions floorVisibleActions">     {!props.demo&&props.canEdit&&props.onEdit&&<button type="button" className="secondary" onClick={()=>props.onEdit?.(r.id)}>{say('Editar reserva','Edit reservation')}</button>}
     {!props.demo&&(r.quote_id?props.openQuote&&<button type="button" className="secondary" onClick={()=>props.openQuote?.(r.quote_id!)}>{say('Ver cotización','View quote')}</button>:props.canEdit&&!cancelled&&props.onQuote&&<button type="button" className="secondary" onClick={()=>props.onQuote?.(r.id)}>{say('Crear cotización','Create quote')}</button>)}
     {!props.demo&&props.canEdit&&!cancelled&&!r.quote_id&&props.onLinkQuote&&<button type="button" className="secondary" onClick={()=>props.onLinkQuote?.(r)}>{say('Vincular cotización','Link quote')}</button>}
</div>
   </article>;
  })}{!filtered.length&&<p className="floorNoRows">{say('No hay reservaciones para esta selección.','No reservations for this selection.')}</p>}</div>
  {filtered.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(n=>n+50)}>{say('Mostrar más','Show more')} · {limit}/{filtered.length}</button>}
 </aside>;
}
