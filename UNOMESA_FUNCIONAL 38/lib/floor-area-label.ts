import type {SupabaseClient} from '@supabase/supabase-js';
import {missingFloorFunction,selectionArea,type FloorData,type FloorLayout,type FloorSelection} from './floor-plan';
import {withAreaOccupancy} from './floor-area-occupancy';
import {localDateISO} from './local-date';
type Selection=Partial<Pick<FloorSelection,'table_ids'|'whole_area_id'>>;
type Event={id:string;area:string;event_date:string};
type LabelLayout={areas:Pick<FloorLayout['areas'][number],'id'|'name'>[];tables:Pick<FloorLayout['tables'][number],'id'|'name'|'areaId'>[]};
export function floorAreaLabel(area:string,selection:Selection|null|undefined,layout:LabelLayout,en=false){
 if(!selection)return area;
 if(selection.whole_area_id)return `${area||layout.areas.find(a=>a.id===selection.whole_area_id)?.name||''} - ${en?'Entire area':'Área completa'}`;
 const tableIds=Array.isArray(selection.table_ids)?selection.table_ids:[];
 const selectedIds=new Set(tableIds);
 const selectedTables=layout.tables.filter(t=>selectedIds.has(t.id));
 const selectedArea=selectedTables[0]?.areaId;
 // Display a complete selection as a whole area, without rewriting saved assignments.
 if(selectedArea&&selectedTables.length===selectedIds.size&&selectedTables.every(t=>t.areaId===selectedArea)){
  const roomTables=layout.tables.filter(t=>t.areaId===selectedArea);
  if(roomTables.length>0&&roomTables.every(t=>selectedIds.has(t.id)))return `${area||layout.areas.find(a=>a.id===selectedArea)?.name||''} - ${en?'Entire area':'Área completa'}`;
 }
 const names=selectedTables.map(t=>{
  const number=/^(?:m|t|mesa|table)\s*(\d+)$/i.exec(t.name.trim());
  return number?`${en?'Table':'Mesa'} ${number[1]}`:t.name;
 });
 return names.length?`${area} - ${names.join(' + ')}`:area;
}
async function parallel<T>(values:T[],work:(value:T)=>Promise<void>,signal:AbortSignal){
 let next=0;await Promise.all(Array.from({length:Math.min(3,values.length)},async()=>{while(next<values.length){signal.throwIfAborted();await work(values[next++]);}}));
}
/** One bounded read for a visible page, without day agendas, images or per-quote reads. */
export async function readEventAreaLabels(client:SupabaseClient,restaurantId:string,kind:'reservation'|'quote',events:Event[],en:boolean,signal:AbortSignal){
 const labels:Record<string,string>={};if(!events.length)return labels;
 signal.throwIfAborted();
 const ids=[...new Set(events.map(event=>event.id))],batches:string[][]=[];
 for(let offset=0;offset<ids.length;offset+=50)batches.push(ids.slice(offset,offset+50));
 const read=async(batch:string[])=>{
  const result=await client.rpc('v2_event_area_labels',{p_restaurant:restaurantId,p_kind:kind,p_ids:batch}).abortSignal(signal);
  signal.throwIfAborted();return result;
 };
 const accept=(result:{data:any;error:unknown},batch:string[])=>{
  if(result.error)throw result.error;
  const data=result.data;
  if(!data||!Array.isArray(data.rows)||!Array.isArray(data.layout?.areas)||!Array.isArray(data.layout?.tables))throw new Error('No se pudieron consultar las mesas seleccionadas.');
  for(const row of data.rows){
   if(!row||!batch.includes(row.id)||typeof row.area!=='string')throw new Error('No se pudieron consultar las mesas seleccionadas.');
   labels[row.id]=row.selection?floorAreaLabel(row.area,row.selection,data.layout,en):row.area.trim()?`${row.area} - ${en?'Entire area':'Área completa'}`:row.area;
  }
 };
 const first=await read(batches[0]);
 // Older deployments keep working. Authorization/network failures never use this fallback.
 if(missingFloorFunction(first.error,'v2_event_area_labels'))return readLegacyEventAreaLabels(client,restaurantId,kind,events,en,signal);
 accept(first,batches[0]);
 await parallel(batches.slice(1),async batch=>accept(await read(batch),batch),signal);
 return labels;
}
/** Compatibility with installations prior to SQL 54. No cache is shared across users. */
export async function readLegacyEventAreaLabels(client:SupabaseClient,restaurantId:string,kind:'reservation'|'quote',events:Event[],en:boolean,signal:AbortSignal){
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
  labels[event.id]=seating?floorAreaLabel(area,seating,data.layout,en):area?.trim()?`${area} - ${en?'Entire area':'Área completa'}`:area;
 }
 await parallel(pending,async event=>{const data=snapshot(event.event_date);if(!data)return;const result=await client.rpc('v2_floor_form',{p_restaurant:restaurantId,p_reservation:null,p_quote:event.id}).abortSignal(signal);if(missingFloorFunction(result.error,'v2_floor_form'))return;if(result.error)throw result.error;const raw=result.data?.selection;
  // Legacy records have only revision metadata; the form RPC does not promise table_ids.
  const hasSelection=raw&&(Array.isArray(raw.table_ids)||!!raw.whole_area_id);
  const selection=hasSelection?{table_ids:Array.isArray(raw.table_ids)?raw.table_ids:[],whole_area_id:raw.whole_area_id||null}:null;
  const area=result.data?.reservation_id&&selection?selectionArea(selection,data.layout)?.name||event.area:event.area;
  labels[event.id]=selection?floorAreaLabel(area,selection,data.layout,en):area?.trim()?`${area} - ${en?'Entire area':'Área completa'}`:area},signal);
 return labels;
}
