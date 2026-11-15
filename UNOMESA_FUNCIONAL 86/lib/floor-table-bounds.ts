import {floorTableScale,type FloorTable} from './floor-plan';

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

