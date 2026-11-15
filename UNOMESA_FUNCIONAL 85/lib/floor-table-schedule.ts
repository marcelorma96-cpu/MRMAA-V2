import {floorDayBookings,seatingTables,type FloorData} from './floor-plan';
import {formatEventTime} from './local-date';
export type TableBookingLine={id:string;guests:number;time:string;continued:boolean;extraSeats:number;group:boolean};
/** Saved assignments for the whole selected day, including events crossing midnight. */
export function tableDaySchedules(data:FloorData,date:string,timeFormat?:string){
 const result=new Map<string,TableBookingLine[]>();
 for(const booking of floorDayBookings(data,date)){
  const r=booking.reservation,time=formatEventTime(r.event_time||booking.seating.source_time,timeFormat).replace(/^0(?=\d:)/,'').replace(/:00 (?=[AP]M)/,' ');
  const ids=seatingTables(booking.seating,data.layout),capacity=data.layout.tables.filter(t=>ids.includes(t.id)).reduce((sum,t)=>sum+t.seats,0);
  const line={id:r.id,guests:r.guests,time,continued:r.event_date!==date,extraSeats:Math.max(0,r.guests-capacity),group:ids.length>1};
  for(const id of seatingTables(booking.seating,data.layout)){const lines=result.get(id)||[];lines.push(line);result.set(id,lines);}
 }
 return result;
}
export const tableBookingDescription=(lines:TableBookingLine[],en:boolean)=>lines.map(line=>`${line.guests} ${en?'people':'personas'} · ${line.time}${line.continued?(en?' (previous day)':' (día anterior)'):''}${line.extraSeats?` · ${line.extraSeats} ${en?'added seats':'asientos adicionales'}${line.group?(en?' for the group':' para el grupo'):''}`:''}`).join('; ');
