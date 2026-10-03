import {activeReservation,floorMinute,type FloorData,type FloorSeating} from './floor-plan';
import {floorDefaultDuration} from './restaurant-map';

const key=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
/** Area-only reservations reserve that whole room. Projection only: no migration or writes. */
export function withAreaOccupancy(data:FloorData):FloorData {
 const assigned=new Set(data.seatings.map(s=>s.reservation_id)),inferred:FloorSeating[]=[];
 for(const r of data.reservations){
  if(assigned.has(r.id)||!r.area?.trim()||!activeReservation(r)||!Number.isFinite(floorMinute(r.event_date,r.event_time)))continue;
  const matches=data.layout.areas.filter(a=>key(a.name)===key(r.area));
  if(matches.length!==1)continue;
  const area=matches[0];
  inferred.push({reservation_id:r.id,table_ids:data.layout.tables.filter(t=>t.areaId===area.id).map(t=>t.id),whole_area_id:area.id,duration_minutes:floorDefaultDuration(data.layout),service_status:'reserved',source_date:r.event_date,source_time:r.event_time!,source_guests:r.guests,revision:0,inferred_from_area:true});
 }
 return inferred.length?{...data,seatings:[...data.seatings,...inferred]}:data;
}
