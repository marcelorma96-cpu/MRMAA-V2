import { isCancelledReservation } from './reservation-totals';
export type FloorLevel = {id:string;name:string};
export type FloorPlacement = {x:number;y:number;width:number;height:number};
export type FloorArea = {id:string;name:string;eventAreaId?:string;levelId?:string;placement?:FloorPlacement;background?:'transparent'|'solid';showBorder?:boolean};
export type FloorTable = {id:string;areaId:string;name:string;seats:number;shape:'round'|'square'|'rectangle';x:number;y:number;rotation:0|90;size?:number};
export type FloorLayout = {areas:FloorArea[];tables:FloorTable[];levels?:FloorLevel[];defaultDurationMinutes?:number};
export type FloorReservation = {id:string;quote_id?:string|null;client_name:string;phone:string;event_date:string;event_time:string|null;guests:number;area:string;status:string};
export type FloorSeating = {inferred_from_area?:boolean;reservation_id:string;table_ids:string[];whole_area_id:string|null;duration_minutes:number;service_status:'reserved'|'seated'|'finished';source_date:string;source_time:string;source_guests:number;revision:number};
export type FloorData = {integration_version?:number;revision:number;layout:FloorLayout;reservations:FloorReservation[];seatings:FloorSeating[]};
export const emptyFloor = ():FloorData => ({revision:0,layout:{areas:[],tables:[]},reservations:[],seatings:[]});
// Event times are restaurant wall-clock values, not converted using the viewer's zone.
export function floorMinute(date:string,time:string|null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)||!time||!/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(time)) return NaN;
  const [h,m]=time.split(':').map(Number); if(h>23||m>59)return NaN;
  return Date.parse(`${date}T00:00:00Z`)/60000+h*60+m;
}
export const overlaps = (a:number,ad:number,b:number,bd:number) => Number.isFinite(a)&&Number.isFinite(b)&&a<b+bd&&b<a+ad;
export const activeReservation = (r:FloorReservation) => !isCancelledReservation(r.status);
export function seatingTables(s:Pick<FloorSeating,'table_ids'|'whole_area_id'>,layout:FloorLayout) {
  return s.whole_area_id ? layout.tables.filter(t=>t.areaId===s.whole_area_id).map(t=>t.id) : s.table_ids;
}
/** Additional seats belong to this party, never to the stored table capacity. */
export function floorAddedSeats(guests:number,selection:Pick<FloorSeating,'table_ids'|'whole_area_id'>|null|undefined,layout:FloorLayout){
 const ids=selection?seatingTables(selection,layout):[];
 return ids.length?Math.max(0,guests-layout.tables.filter(t=>ids.includes(t.id)).reduce((sum,t)=>sum+t.seats,0)):0;
}
export function floorAddedSeatsLabel(guests:number,selection:Pick<FloorSeating,'table_ids'|'whole_area_id'>|null|undefined,layout:FloorLayout,en=false){
 const extra=floorAddedSeats(guests,selection,layout);return extra?`${extra} ${en?'added seats':'asientos adicionales'}${selection&&seatingTables(selection,layout).length>1?(en?' for the group':' para el grupo'):''}`:'';
}
export function conflicts(data:FloorData,ids:string[],date:string,time:string|null,duration:number,exclude?:string) {
  const start=floorMinute(date,time), wanted=new Set(ids);
  if(!wanted.size||!Number.isFinite(start))return [];
  const rooms=new Set(data.layout.tables.filter(t=>wanted.has(t.id)).map(t=>t.areaId));
  const reservations=new Map(data.reservations.map(r=>[r.id,r]));
  return data.seatings.filter(s=>s.reservation_id!==exclude&&s.service_status!=='finished'&&(s.whole_area_id?rooms.has(s.whole_area_id):s.table_ids.some(id=>wanted.has(id))))
    .filter(s=>{const r=reservations.get(s.reservation_id);return r&&activeReservation(r)&&overlaps(start,duration,floorMinute(r.event_date,r.event_time||s.source_time),s.duration_minutes)});
}
export function needsReview(data:FloorData,r:FloorReservation,s:FloorSeating) {
  if(s.inferred_from_area)return false;
  const ids=seatingTables(s,data.layout), capacity=data.layout.tables.filter(t=>ids.includes(t.id)).reduce((v,t)=>v+t.seats,0);
  return !r.event_time||s.source_date!==r.event_date||s.source_time.slice(0,5)!==r.event_time.slice(0,5)||s.source_guests!==r.guests||capacity<r.guests||
    (s.service_status!=='finished'&&conflicts(data,ids,r.event_date,r.event_time,s.duration_minutes,r.id).length>0);
}
export function floorError(error:unknown,en=false) {
  const msg=String((error as {message?:string})?.message||error);
  const messages:Record<string,[string,string]>={
    FLOOR_AREA:['Seleccione una sola área. En Editar plano, elija el área del restaurante para este salón.','Select a single area. In Edit floor plan, choose the restaurant area for this room.'],
    FLOOR_QUOTE:['No se pudo validar la cotización. Actualice e intente nuevamente.','Could not validate the quote. Refresh and try again.'],
    FLOOR_ALREADY_SAVED:['El evento ya fue guardado o convertido. Actualice el listado para consultarlo.','This event was already saved or converted. Refresh the list to view it.'],
    FLOOR_ACCESS:['Su acceso no permite esta acción. Revise su sesión y permisos.','Your access does not allow this action. Check your session and permissions.'],
    FLOOR_STALE:['Hubo cambios en otra pantalla. Pulse Actualizar antes de guardar. Su borrador se conserva.','Another screen made changes. Select Refresh before saving. Your draft is preserved.'],
    FLOOR_CONFLICT:['Una mesa ya está asignada durante ese horario. Revise el aviso o confirme Guardar de todos modos.','A table is already assigned during this time. Review the warning or confirm Save anyway.'],
    FLOOR_OVERRIDE_REQUIRED:['Para guardar cruces confirmados, aplique 45_CRUCES_HORARIO_CONFIRMADOS.sql en el proyecto Supabase conectado a UnoMesa. Su borrador se conserva.','To save confirmed overlaps, apply 45_CRUCES_HORARIO_CONFIRMADOS.sql to the Supabase project connected to UnoMesa. Your draft is preserved.'],
    FLOOR_EXTRA_SEATS_REQUIRED:['Para confirmar asientos adicionales, aplique 46_ASIENTOS_ADICIONALES.sql en el proyecto Supabase conectado a UnoMesa. Su borrador se conserva.','To confirm added seats, apply 46_ASIENTOS_ADICIONALES.sql in the Supabase project connected to UnoMesa. Your draft is preserved.'],
    FLOOR_CAPACITY:['Las mesas elegidas no tienen capacidad suficiente para el grupo.','Selected tables do not have enough seats for this party.'],
    FLOOR_IN_USE:['Hay asignaciones guardadas para esa mesa o área. Quítelas antes de eliminarla o cambiarla de área.','This table or area has saved assignments. Remove them before deleting it or moving it to another area.'],
    FLOOR_LAYOUT:['Revise nombres únicos, capacidad, áreas y posiciones. Máximo 20 áreas y 200 mesas.','Check unique names, capacity, areas and positions. Maximum 20 areas and 200 tables.'],
    FLOOR_LIMIT:['Hay más de 2,000 reservas en el período de consulta. No se muestra disponibilidad parcial.','There are more than 2,000 reservations in the query window. Partial availability is not shown.'],
    FLOOR_RESERVATION:['La reservación cambió, fue cancelada o no tiene hora. Revísela en el listado.','The reservation changed, was canceled or has no time. Review it in the list.'],
    FLOOR_ASSIGNMENT:['Revise mesas, estado y duración (15 a 1,440 minutos).','Check tables, status and duration (15 to 1,440 minutes).'],
    FLOOR_DATE:['Seleccione una fecha válida entre 2000 y 2100.','Select a valid date between 2000 and 2100.'],
  };
  const key=Object.keys(messages).find(k=>msg.includes(k));
  return key?messages[key][en?1:0]:(en?'Could not load or save the floor plan. Check your connection and try again.':'No se pudo cargar o guardar el plano. Revise su conexión e intente nuevamente.');
}
export function demoFloor(date:string):FloorData {
  const tables:FloorTable[]=Array.from({length:8},(_,i)=>({id:`demo-t${i+1}`,areaId:i<6?'salon':'terraza',name:`M${i+1}`,seats:i===4?8:i%3===0?2:4,
    shape:i===4?'rectangle':i%2===0?'round':'square',x:[20,50,80][i%3],y:i<3?28:65,rotation:0}));
  const reservations:FloorReservation[]=[
    {id:'demo-r1',client_name:'Ana García',phone:'',event_date:date,event_time:'13:00',guests:4,area:'Salón principal',status:'confirmada'},
    {id:'demo-r2',client_name:'Grupo Rivera',phone:'',event_date:date,event_time:'13:30',guests:10,area:'Salón principal',status:'confirmada'},
    {id:'demo-r3',client_name:'Luis Méndez',phone:'',event_date:date,event_time:'14:00',guests:2,area:'Terraza',status:'confirmada'},
    {id:'demo-r4',client_name:'Cumpleaños Sofía',phone:'',event_date:date,event_time:'19:00',guests:8,area:'Salón principal',status:'confirmada'},
  ];
  return {revision:1,layout:{areas:[{id:'salon',name:'Salón principal'},{id:'terraza',name:'Terraza'}],tables},reservations,
    seatings:[{reservation_id:'demo-r1',table_ids:['demo-t2'],whole_area_id:null,duration_minutes:120,service_status:'seated',source_date:date,source_time:'13:00',source_guests:4,revision:1},
    {reservation_id:'demo-r4',table_ids:['demo-t5'],whole_area_id:null,duration_minutes:180,service_status:'reserved',source_date:date,source_time:'19:00',source_guests:8,revision:1}]};
}

export type FloorSelection = {allow_extra_seats?:boolean;allow_conflict?:boolean;table_ids:string[];whole_area_id:string|null;duration_minutes:number;service_status:FloorSeating['service_status'];revision:number;plan_revision:number;source?:Record<string,unknown>|null};
export type FloorFormState = {ready:boolean;installed:boolean;value:FloorSelection|null;areaSummary?:{areaId:string;label:string}};
export type FloorCreateSeed = {date:string;time:string;areaName:string;areaId?:string;selection:FloorSelection};
export function defaultFloorSelection(planRevision=0,duration=180):FloorSelection {return {table_ids:[],whole_area_id:null,duration_minutes:duration,service_status:'reserved',revision:0,plan_revision:planRevision}}
export type EventArea = {id:string;name:string};
const areaKey=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
export function floorEventArea(area:FloorArea|undefined,areas:EventArea[]) {
 if(!area)return undefined;
 if(area.eventAreaId)return areas.find(a=>a.id===area.eventAreaId);
 const matches=areas.filter(a=>areaKey(a.name)===areaKey(area.name));return matches.length===1?matches[0]:undefined;
}
export function floorAreaForEvent(layout:FloorLayout,areas:EventArea[],id:string,name:string) {
 const matches=layout.areas.filter(a=>{const match=floorEventArea(a,areas);return match&&(id?match.id===id:areaKey(match.name)===areaKey(name))});
 return matches.length===1?matches[0]:undefined;
}
export function selectionArea(selection:Pick<FloorSelection,'table_ids'|'whole_area_id'>,layout:FloorLayout) {
 if(selection.whole_area_id)return layout.areas.find(a=>a.id===selection.whole_area_id);
 const ids=new Set(layout.tables.filter(t=>selection.table_ids.includes(t.id)).map(t=>t.areaId));
 return ids.size===1?layout.areas.find(a=>ids.has(a.id)):undefined;
}
export function selectFloorArea(selection:FloorSelection,layout:FloorLayout,areaId:string,whole:boolean):FloorSelection {
 const ids=layout.tables.filter(t=>t.areaId===areaId).map(t=>t.id);
 return {...selection,whole_area_id:whole&&ids.length?areaId:null,table_ids:whole?ids:seatingTables(selection,layout).filter(id=>ids.includes(id))};
}
export function toggleFloorTable(selection:FloorSelection,layout:FloorLayout,tableId:string):FloorSelection {
 const table=layout.tables.find(t=>t.id===tableId);if(!table)return selection;
 const ids=seatingTables(selection,layout);
 return {...selection,whole_area_id:null,table_ids:ids.includes(tableId)?ids.filter(id=>id!==tableId):[...ids.filter(id=>layout.tables.find(t=>t.id===id)?.areaId===table.areaId),tableId]};
}
/** Legacy layouts omit size and keep their original geometry and capacity. */
export function floorTableScale(table:Pick<FloorTable,'size'>) {return typeof table.size==='number'&&Number.isFinite(table.size)?Math.min(100,Math.max(40,table.size))/100:1}
export function floorDayBookings(data:FloorData,date:string,tableId?:string,areaId?:string) {
  const day=floorMinute(date,'00:00');
 const reservations=new Map(data.reservations.map(r=>[r.id,r]));
  return data.seatings.flatMap(seating=>{
  const reservation=reservations.get(seating.reservation_id);
  if(!reservation||!activeReservation(reservation))return [];
  const ids=seatingTables(seating,data.layout);
  if(tableId&&!ids.includes(tableId))return [];
  if(areaId&&seating.whole_area_id!==areaId&&!data.layout.tables.some(t=>t.areaId===areaId&&ids.includes(t.id)))return [];
  const start=floorMinute(reservation.event_date,reservation.event_time||seating.source_time);
  return overlaps(day,1440,start,seating.duration_minutes)?[{reservation,seating,start,end:start+seating.duration_minutes}]:[];
 }).sort((a,b)=>a.start-b.start||a.reservation.id.localeCompare(b.reservation.id));
}
export function floorEndTime(date:string,time:string|null,duration:number) {
 const start=floorMinute(date,time);if(!Number.isFinite(start))return {time:'',nextDay:false};
 const end=start+duration,minutes=((end%1440)+1440)%1440;
 return {time:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,nextDay:Math.floor(end/1440)>Math.floor(start/1440)};
}
export function floorAreaAvailability(data:FloorData,areaId:string,date:string,time:string,duration:number) {
 const tables=data.layout.tables.filter(t=>t.areaId===areaId);
 const available=tables.filter(t=>conflicts(data,[t.id],date,time,duration).length===0).length;
 const start=floorMinute(date,time),reservations=new Map(data.reservations.map(r=>[r.id,r]));
 const whole=data.seatings.filter(s=>{const r=reservations.get(s.reservation_id);return s.whole_area_id===areaId&&s.service_status!=='finished'&&r&&activeReservation(r)&&overlaps(start,duration,floorMinute(r.event_date,r.event_time||s.source_time),s.duration_minutes)});
 return {total:tables.length,available,full:whole.length>0||tables.length>0&&available===0,whole};
}
export function missingFloorFunction(error:{code?:string;message?:string}|null|undefined,name:string){return !!error&&['PGRST202','42883'].includes(error.code||'')&&String(error.message).includes(name)}
