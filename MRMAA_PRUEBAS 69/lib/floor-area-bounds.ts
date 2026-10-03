import {floorTableScale,type FloorTable,type FloorLayout,type FloorArea} from './floor-plan';
import {areaPlacement} from './restaurant-map';

export type FloorBounds={x:number;y:number;width:number;height:number};
/** Display geometry only: never rewrites table coordinates or saved area placements. */
export function floorAreaBounds(tables:readonly FloorTable[]):FloorBounds {
 if(!tables.length)return {x:32,y:30,width:936,height:590};
 const edges=tables.map(t=>{
  const scale=floorTableScale(t),w=t.shape==='rectangle'?142:100,h=t.shape==='rectangle'?80:100;
  const halfWidth=(t.rotation===90?h:w)/2,halfHeight=(t.rotation===90?w:h)/2;
  // Include chairs and the availability label, including small tables' minimum text size.
  const rx=Math.max((halfWidth+24)*scale,44),top=(halfHeight+24)*scale;
  const bottom=Math.max(top,(halfHeight+44)*scale+5);
  return {left:t.x*10-rx,right:t.x*10+rx,top:t.y*6.5-top,bottom:t.y*6.5+bottom};
 });
 const margin=18,x=Math.min(...edges.map(e=>e.left))-margin,y=Math.min(...edges.map(e=>e.top))-margin;
 return {x,y,width:Math.max(...edges.map(e=>e.right))+margin-x,height:Math.max(...edges.map(e=>e.bottom))+margin-y};
}

export function floorAreaViewport(bounds:FloorBounds,form=false):FloorBounds {
 if(form){const width=Math.max(400,bounds.width+32),height=Math.max(240,bounds.height+32);return {x:bounds.x-(width-bounds.width)/2,y:bounds.y-(height-bounds.height)/2,width,height};}
 // Keep the editing workspace stable and leave room to drag beyond the current contour.
 const x=Math.min(0,bounds.x-8),y=Math.min(0,bounds.y-8);
 return {x,y,width:Math.max(1000,bounds.x+bounds.width+8)-x,height:Math.max(650,bounds.y+bounds.height+8)-y};
}

/** Trim only the room outline in the complete map; the table transform stays unchanged. */
export function floorMapAreaGeometry(layout:FloorLayout,area:FloorArea){
 const p=areaPlacement(layout,area),canvas={x:p.x*11,y:p.y*7.6,width:p.width*11,height:p.height*7.6};
 const tables=layout.tables.filter(t=>t.areaId===area.id);
 if(!tables.length)return {canvas,frame:canvas,bounds:null};
 const bounds=floorAreaBounds(tables),sx=(canvas.width-16)/1000,sy=(canvas.height-58)/650;
 return {canvas,bounds,frame:{x:canvas.x+8+bounds.x*sx,y:canvas.y+32+bounds.y*sy,width:bounds.width*sx,height:bounds.height*sy}};
}

/** Resize from the visible corner, keeping the visible top-left corner anchored. */
export function resizeFloorMapArea(geometry:ReturnType<typeof floorMapAreaGeometry>,width:number,height:number){
 const {bounds,frame}=geometry;
 width=Math.max(20,width);height=Math.max(20,height);
 if(!bounds)return {x:frame.x/11,y:frame.y/7.6,width:width/11,height:height/7.6};
 const canvasWidth=width/bounds.width*1000+16,canvasHeight=height/bounds.height*650+58;
 return {x:(frame.x-8-bounds.x*(canvasWidth-16)/1000)/11,y:(frame.y-32-bounds.y*(canvasHeight-58)/650)/7.6,width:canvasWidth/11,height:canvasHeight/7.6};
}
