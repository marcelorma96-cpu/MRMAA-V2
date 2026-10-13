import {withAreaOccupancy} from './floor-area-occupancy';
import {floorEventArea,type EventArea,type FloorData,type FloorLayout,type FloorPlacement} from './floor-plan';
import {areaLevel,areaPlacement,floorLevels} from './restaurant-map';

/** A read-only projection of the shared catalog. Only Save floor plan persists its layout. */
export function syncCatalogAreas(layout:FloorLayout,catalog:EventArea[]):FloorLayout {
 const seen=new Set<string>();
 const areas=layout.areas.map(area=>{
  const match=floorEventArea(area,catalog);
  if(!match)return area;
  seen.add(match.id);
  return area.eventAreaId===match.id&&area.name===match.name?area:{...area,eventAreaId:match.id,name:match.name,...(area.name!==match.name?{previousNames:[...new Set([...(area.previousNames||[]),area.name])]}:{})};
 });
 const missing=catalog.filter(area=>{if(seen.has(area.id))return false;seen.add(area.id);return true});
 if(!missing.length&&areas.every((area,i)=>area===layout.areas[i]))return layout;
 let next:FloorLayout={...layout,areas};
 if(!missing.length)return next;
 // Adding a catalog room must not resize or move legacy rooms with implicit placements.
 next={...next,areas:next.areas.map(area=>area.placement?area:{...area,placement:areaPlacement(layout,area)})};
 const levelId=floorLevels(layout)[0].id;
 for(const area of missing){
  const base=`catalog-${area.id}`;let id=base,suffix=1;
  while(next.areas.some(room=>room.id===id))id=`${base}-${suffix++}`;
  const placement=emptyAreaPlacement(next,levelId);
  next={...next,areas:[...next.areas,{id,name:area.name,eventAreaId:area.id,levelId,placement}]};
 }
 return next;
}

function emptyAreaPlacement(layout:FloorLayout,levelId:string):FloorPlacement {
 const occupied=layout.areas.filter(area=>areaLevel(layout,area)===levelId).map(area=>areaPlacement(layout,area));
 const overlap=(a:FloorPlacement,b:FloorPlacement)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 let best={x:4,y:4,width:26,height:24},score=Infinity;
 for(let y=4;y<=72;y+=4)for(let x=4;x<=72;x+=4){
  const candidate={x,y,width:26,height:24},amount=occupied.reduce((sum,room)=>sum+overlap(candidate,room),0);
  if(amount<score){best=candidate;score=amount;if(score===0)return best;}
 }
 return best;
}

export function floorWithCatalog(data:FloorData,catalog:EventArea[]):FloorData {
 const layout=syncCatalogAreas(data.layout,catalog);
 return withAreaOccupancy(layout===data.layout?data:{...data,layout});
}
