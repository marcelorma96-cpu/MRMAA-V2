import type {SupabaseClient} from '@supabase/supabase-js';
import {missingFloorFunction,selectionArea,type FloorData,type FloorLayout,type FloorSelection} from './floor-plan';
import {withAreaOccupancy} from './floor-area-occupancy';
import {localDateISO} from './local-date';
type Selection=Pick<FloorSelection,'table_ids'|'whole_area_id'>;
type Event={id:string;area:string;event_date:string};
export function floorAreaLabel(area:string,selection:Selection|null|undefined,layout:FloorLayout,en=false){
 if(!selection)return area;
 if(selection.whole_area_id)return `${area||layout.areas.find(a=>a.id===selection.whole_area_id)?.name||''} - ${en?'Entire room':'Salón completo'}`;
 const names=layout.tables.filter(t=>selection.table_ids.includes(t.id)).map(t=>{
  const number=/^(?:m|t|mesa|table)\s*(\d+)$/i.exec(t.name.trim());
  return number?`${en?'Table':'Mesa'} ${number[1]}`:t.name;
 });
 return names.length?`${area} - ${names.join(' + ')}`:area;
}
async function parallel<T>(values:T[],work:(value:T)=>Promise<void>,signal:AbortSignal){
 let next=0;await Promise.all(Array.from({length:Math.min(3,values.length)},async()=>{while(next<values.length){signal.throwIfAborted();await work(values[next++]);}}));
}
/** Read-only display labels. Existing day RPCs cover adjacent dates; no per-row reservation reads. */
export async function readEventAreaLabels(client:SupabaseClient,restaurantId:string,kind:'reservation'|'quote',events:Event[],en:boolean,signal:AbortSignal){
 const labels:Record<string,string>={};if(!events.length)return labels;
 const dates=[...new Set(events.map(r=>r.event_date||localDateISO()))].sort(),anchors:string[]=[];
 for(const date of dates){const last=anchors.at(-1);if(!last||Date.parse(date)-Date.parse(last)>86400000)anchors.push(date);}
 const snapshots=new Map<string,FloorData>();let missing=false;
 await parallel(anchors,async date=>{if(missing)return;const result=await client.rpc('v2_floor_read',{p_restaurant_id:restaurantId,p_date:date}).abortSignal(signal);if(missingFloorFunction(result.error,'v2_floor_read')){missing=true;return;}if(result.error)throw result.error;snapshots.set(date,withAreaOccupancy(result.data as FloorData))},signal);
 if(missing)return labels;
 const snapshot=(date:string)=>snapshots.get(anchors.find(a=>Math.abs(Date.parse(date||localDateISO())-Date.parse(a))<=86400000)!);
 const pending:Event[]=[];
 for(const event of events){const data=snapshot(event.event_date);if(!data)continue;
  const linked=kind==='quote'?data.reservations.find(r=>r.quote_id===event.id):undefined;
  const reservationId=kind==='reservation'?event.id:linked?.id;
  if(kind==='quote'&&!reservationId){pending.push(event);continue;}
  const seating=data.seatings.find(s=>s.reservation_id===reservationId),area=linked?.area||event.area;
  labels[event.id]=seating?floorAreaLabel(area,seating,data.layout,en):area?.trim()?`${area} - ${en?'Entire room':'Salón completo'}`:area;
 }
 await parallel(pending,async event=>{const data=snapshot(event.event_date);if(!data)return;const result=await client.rpc('v2_floor_form',{p_restaurant:restaurantId,p_reservation:null,p_quote:event.id}).abortSignal(signal);if(missingFloorFunction(result.error,'v2_floor_form'))return;if(result.error)throw result.error;const selection=result.data?.selection;const area=result.data?.reservation_id&&selection?selectionArea(selection,data.layout)?.name||event.area:event.area;labels[event.id]=floorAreaLabel(area,selection,data.layout,en)},signal);
 return labels;
}
