import {floorDayBookings,floorMinute,seatingTables,type EventArea,type FloorArea,type FloorData,type FloorLayout,type FloorPlacement} from './floor-plan';
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export const validFloorDuration=(n:number)=>Number.isInteger(n)&&n>=15&&n<=1440;
export const floorDefaultDuration=(layout:FloorLayout)=>validFloorDuration(layout.defaultDurationMinutes as number)?layout.defaultDurationMinutes!:180;
/** Legacy plans remain byte-for-byte unchanged until the user saves an edit. */
export function floorLevels(layout:FloorLayout){return layout.levels?.length?layout.levels:[{id:'level-1',name:'Nivel 1'}]}
export function areaLevel(layout:FloorLayout,area:FloorArea){const levels=floorLevels(layout);return levels.some(l=>l.id===area.levelId)?area.levelId!:levels[0].id}
export function levelName(name:string,en:boolean){return en&&/^Nivel \d+$/.test(name)?name.replace('Nivel','Level'):name}
export function areaPlacement(layout:FloorLayout,area:FloorArea):FloorPlacement{
 const peers=layout.areas.filter(a=>areaLevel(layout,a)===areaLevel(layout,area)),index=Math.max(0,peers.findIndex(a=>a.id===area.id));
 const columns=peers.length<=2?2:peers.length<=9?3:4,rows=Math.max(2,Math.ceil(peers.length/columns)),w=92/columns,h=92/rows;
 const fallback={x:4+index%columns*w,y:4+Math.floor(index/columns)*h,width:w-3,height:h-3};
 const p=area.placement;if(!p||!Object.values(p).every(Number.isFinite))return fallback;
 const width=clamp(p.width,14,96),height=clamp(p.height,14,96);
 return {width,height,x:clamp(p.x,2,98-width),y:clamp(p.y,2,98-height)};
}
export function positionArea(layout:FloorLayout,id:string,patch:Partial<FloorPlacement>&{levelId?:string}):FloorLayout{
 return {...layout,areas:layout.areas.map(area=>{if(area.id!==id)return area;const {levelId,...coords}=patch;const next={...area,...(levelId?{levelId}:{}),placement:{...areaPlacement(layout,area),...coords}};return {...next,placement:areaPlacement({...layout,areas:layout.areas.map(a=>a.id===id?next:a)},next)}})};
}
/** Existing linked areas retain their IDs, table IDs and placements after catalog renames. */
export function attachCatalogArea(layout:FloorLayout,eventArea:{id:string;name:string},newId:string):FloorLayout{
 const key=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const matches=layout.areas.filter(a=>a.eventAreaId===eventArea.id||!a.eventAreaId&&key(a.name)===key(eventArea.name));
 if(matches.length>1)throw Error('FLOOR_AREA');
 if(matches.length)return {...layout,areas:layout.areas.map(a=>a.id===matches[0].id?{...a,name:eventArea.name,eventAreaId:eventArea.id}:a)};
 if(layout.areas.length>=20)throw Error('FLOOR_LAYOUT');
 return {...layout,areas:[...layout.areas,{id:newId,name:eventArea.name,eventAreaId:eventArea.id}]};
}

/** All day records, plus overnight assignments; IDs always come from the saved seating. */
export function restaurantDayReservations(data:FloorData,date:string,catalog:EventArea[]=[]){
 const seatings=new Map(data.seatings.map(s=>[s.reservation_id,s]));
 const continuing=new Set(floorDayBookings(data,date).map(b=>b.reservation.id));
 const tables=new Map(data.layout.tables.map(t=>[t.id,t]));
 const key=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 return data.reservations.filter(r=>r.event_date===date||continuing.has(r.id)).map(reservation=>{
  const seating=seatings.get(reservation.id),tableIds=seating?seatingTables(seating,data.layout):[];
  const assignedAreas=[...new Set([...(seating?.whole_area_id?[seating.whole_area_id]:[]),...tableIds.map(id=>tables.get(id)?.areaId).filter((id):id is string=>!!id)])];
  const namedAreas=data.layout.areas.filter(a=>key(catalog.find(c=>c.id===a.eventAreaId)?.name||a.name)===key(reservation.area||''));
  const areaIds=assignedAreas.length?assignedAreas:namedAreas.length===1?[namedAreas[0].id]:[];
  return {reservation,seating,tableIds,areaIds,start:floorMinute(reservation.event_date,reservation.event_time||seating?.source_time||null),continued:reservation.event_date!==date};
 }).sort((a,b)=>(Number.isFinite(a.start)?a.start:Infinity)-(Number.isFinite(b.start)?b.start:Infinity)||a.reservation.client_name.localeCompare(b.reservation.client_name)||a.reservation.id.localeCompare(b.reservation.id));
}
