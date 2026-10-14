import {type FloorLayout,type FloorArea} from './floor-plan';
import {areaPlacement} from './restaurant-map';
import {floorAreaBounds,type FloorBounds} from './floor-table-bounds';
export {floorAreaBounds,type FloorBounds} from './floor-table-bounds';

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
 const canvasWidth=Math.min(96*11,Math.max(14*11,width/bounds.width*1000+16)),canvasHeight=Math.min(96*7.6,Math.max(14*7.6,height/bounds.height*650+58));
 return {x:(frame.x-8-bounds.x*(canvasWidth-16)/1000)/11,y:(frame.y-32-bounds.y*(canvasHeight-58)/650)/7.6,width:canvasWidth/11,height:canvasHeight/7.6};
}
