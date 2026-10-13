import {reservationMenuLabel} from '@/lib/reservation-menu-label';
import type {SupabaseClient} from '@supabase/supabase-js';
import {floorAddedSeatsLabel,activeReservation,type FloorData,type FloorReservation} from './floor-plan';
import {restaurantDayReservations} from './restaurant-map';
import type {EventArea} from './floor-plan';
import {floorAreaLabel} from './floor-area-label';
import {formatEventTime} from './local-date';
import {translate} from './translations';
import {reservationReportHtml,type ReservationReport} from './reservation-report';
export type FloorPrintMode='map'|'both'|'reservations'|'details';
export type FloorPrintMap={svg:string;title:string;areaIds:string[];windowLabel?:string};
export type FloorPrintRow=FloorReservation&{menu?:string;deposit?:number|null;payment_method?:string|null;notes?:string};
export function floorPrintBookings(data:FloorData,date:string,catalog:EventArea[],areaIds:string[]|null,includeCancelled=false){
 return restaurantDayReservations(data,date,catalog).filter(b=>(includeCancelled||activeReservation(b.reservation))&&(!areaIds||b.areaIds.some(id=>areaIds.includes(id))));
}
/** Fetch only the selected day's details, in bounded batches; never export a partial result. */
export async function readFloorPrintDetails(client:SupabaseClient,restaurantId:string,rows:FloorReservation[],signal:AbortSignal):Promise<FloorPrintRow[]>{
 const result=new Map<string,FloorPrintRow>();
 for(let start=0;start<rows.length;start+=100){
  const batch=rows.slice(start,start+100),response=await client.from('v2_reservations').select('id,client_name,phone,event_date,event_time,guests,area,status,quote_id,menu,deposit,payment_method,notes').eq('restaurant_id',restaurantId).in('id',batch.map(r=>r.id)).is('deleted_at',null).abortSignal(signal);
  if(response.error)throw response.error;
  for(const r of response.data||[])result.set(r.id,r);
 }
 return rows.map(row=>{const current=result.get(row.id);
  if(!current||['event_date','guests','area','status','quote_id'].some(key=>(row as any)[key]!==undefined&&((row as any)[key]??null)!==((current as any)[key]??null))||(row.event_time||'').slice(0,5)!==(current.event_time||'').slice(0,5))throw Error('FLOOR_PRINT_STALE');
  return current;
 });
}
export type FloorPrintInput={restaurant:string;date:string;mode:FloorPrintMode;map:FloorPrintMap;maps?:FloorPrintMap[];data:FloorData;bookings:ReturnType<typeof floorPrintBookings>;details?:FloorPrintRow[];en:boolean;timeFormat?:string;showDeposits:boolean;money:(n:number)=>string;scope:string;includeCancelled:boolean;demo:boolean};
export function floorPrintReport({restaurant,date,mode,map,data,bookings,details,en,timeFormat,showDeposits,money,scope,includeCancelled,demo}:FloorPrintInput){
 const say=(es:string,eng:string)=>en?eng:es,t=(value:string)=>translate(value,en?'en':'es'),full=mode==='details',byId=new Map(details?.map(r=>[r.id,r]));
 const method=(value?:string|null)=>t(({efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',deposito:'Depósito',otro:'Otro'} as Record<string,string>)[value||'']||value||'—');
 const columns:[[string,number],...[string,number][]]=[['Fecha',20],['Hora',20],[say('Duración','Duration'),18],['Cliente',35],[say('Teléfono','Phone'),31],[full?say('Pers.','Guests'):say('Personas','People'),15],['Área',40],['Estado',22]];
 if(full)columns.push(['Menú',30],...(showDeposits?[['Anticipo',22],[say('Método','Method'),22]] as [string,number][]:[]),[say('Cotiz.','Quote'),18],['Observaciones',45]);
 // Full-detail widths total 273 mm: keep dates and short headers on one line.
 if(full){const widths=showDeposits?[20,18,18,25,31,14,26,20,21,18,18,17,27]:[20,18,18,35,31,18,36,22,27,20,28];columns.forEach((column,i)=>column[1]=widths[i]);}
 const report:ReservationReport={restaurant,title:say('Plano y reservaciones','Floor plan and reservations'),context:`${date} · ${scope}${demo?' · DEMO':''}`,generated:includeCancelled?say('Incluye canceladas.','Includes canceled reservations.'):say('Sin canceladas.','Canceled reservations excluded.'),language:en?'en':'es',mode:mode==='map'?'summary':'reservations',repeatColumns:5,metrics:[],columns:columns.map(([label,weight])=>({label:t(label),weight})),rows:bookings.map(b=>{const r=byId.get(b.reservation.id)||b.reservation,d=r as FloorPrintRow;return [r.event_date,formatEventTime(r.event_time||b.seating?.source_time,timeFormat),b.seating?`${b.seating.duration_minutes} min`:'—',r.client_name||'',r.phone?.trim()||'—',String(r.guests),[floorAreaLabel(r.area,b.seating,data.layout,en)||say('Sin área','No area'),floorAddedSeatsLabel(r.guests,b.seating,data.layout,en)].filter(Boolean).join('\n'),t(r.status||''),...(full?[reservationMenuLabel(d.menu),...(showDeposits?[d.deposit==null?'—':money(Number(d.deposit)),method(d.payment_method)]:[]),r.quote_id?say('Vinculada','Linked'):'—',d.notes||'']:[])];})};
 return report;
}
export function floorPrintHtml(input:FloorPrintInput){
 const {mode,map,bookings,en}=input,say=(es:string,eng:string)=>en?eng:es;
 const report=floorPrintReport(input);
 let html=reservationReportHtml(report);
 const mapBlock=mode==='map'||mode==='both'?(input.maps||[map]).map((map,index)=>`<section class="printedFloorMap${index===(input.maps||[map]).length-1?' printLastMap':''}"><h2>${escape(map.title)}</h2><p>${escape(map.windowLabel||'')}</p>${map.svg}<p>${say('Colores del intervalo: verde disponible; azul reservada; naranja en mesa; rojo revisar.','Colors for the selected interval: green available; blue reserved; orange seated; red review.')}</p><p>${say('Las líneas dentro de cada mesa muestran personas y hora de las reservas del día. p = personas; ↶ = día anterior; +as. = asientos adicionales; g = grupo completo.','Lines inside each table show people and reservation times for the day. p = people; ↶ = previous day; +s = added seats; g = whole group.')}</p></section>`).join(''):'';
 const empty=mode!=='map'&&!bookings.length?`<p>${say('No hay reservaciones para esta selección.','No reservations for this selection.')}</p>`:'';
 html=html.replace('</style>',`.printedFloorMap{break-inside:avoid;margin:12px 0}.printedFloorMap:not(.printLastMap){break-after:page}.printedFloorMap>svg{display:block;width:100%!important;height:145mm!important;min-width:0!important;min-height:0!important;max-width:100%;--fp-bg:#fff;--fp-text:#182a35;--fp-muted:#5c716a;--fp-line:#abbfb4}.printedFloorMap .overviewRoom{fill:transparent;stroke:#abbfb4;stroke-width:2}.printedFloorMap .overviewRoom.solid{fill:#fff}.printedFloorMap .overviewRoom.borderless{stroke:transparent}.printedFloorMap .overviewRoom.full{fill:#2456c718;stroke:#2456c7;stroke-width:3}.printedFloorMap .overviewAreaLabel.occupied>rect{fill:#2456c7;stroke:#173b91}.printedFloorMap .overviewAreaLabel.occupied>text{fill:#fff}.printedFloorMap text{font-family:Arial}.printedFloorMap *{-webkit-print-color-adjust:exact;print-color-adjust:exact}${mode==='both'?'.printedFloorMap{break-after:page}':''}</style>`);
 html=html.replace(mode==='map'?'<section class="metrics">':'<table>',`${mapBlock}${empty}${mode==='map'?'<section class="metrics">':'<table>'}`);
 return html;
}
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
