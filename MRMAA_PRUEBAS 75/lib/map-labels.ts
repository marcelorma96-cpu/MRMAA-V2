type Box={x:number;y:number;width:number;height:number};
export type MapLabelInput=Box&{id:string;name:string};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const overlaps=(a:Box,b:Box,gap=8)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
// Approximate a 14 px semibold label; the full name remains in its accessible title.
const textWidth=(s:string)=>Array.from(s).reduce((w,c)=>w+(/[MW@%]/.test(c)?14:/[ilI .,'’]/.test(c)?5:/[A-Z0-9]/.test(c)?10:9),0);
function compactName(name:string){let text=name.trim().replace(/\s+/g,' ');if(textWidth(text)<=156)return text;while(text&&textWidth(text+'…')>156)text=Array.from(text).slice(0,-1).join('');return text+'…';}
/** A single-line label outside table hit areas. Geometry is display-only, never saved. */
export function placeMapLabels(areas:MapLabelInput[],obstacles:Box[]=[],unit=1){
 unit=Number.isFinite(unit)&&unit>0?unit:1;
 const source=areas.map(area=>{const text=compactName(area.name);return {...area,lines:[text],text,unit,width:Math.max(64,textWidth(text)+30)*unit,height:28*unit,anchorX:area.x+Math.min(12,area.width/2),anchorY:area.y};});
 const placed:(typeof source[number]&{displaced:boolean})[]=[];
 for(const item of source){
  const room=areas.find(a=>a.id===item.id)!,candidates:Box[]=[];
  const add=(x:number,y:number)=>candidates.push({x:clamp(x,8,1092-item.width),y:clamp(y,8,752-item.height),width:item.width,height:item.height});
  // Prefer the edge above the room, then other outer edges, never a table.
  add(room.x,room.y-item.height-6*unit);add(room.x,room.y+room.height+6*unit);
  add(room.x-item.width-6*unit,room.y);add(room.x+room.width+6*unit,room.y);
  add(room.x+8*unit,room.y+8*unit);
  const step=Math.max(10,Math.min(24,item.height/2));
  for(let y=8;y<=752-item.height;y+=step)for(let x=8;x<=1092-item.width;x+=step)add(x,y);
  const preferred={x:room.x,y:room.y-item.height-6*unit};
  candidates.sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
  let best=candidates.find(box=>!placed.some(other=>overlaps(box,other,4*unit))&&!obstacles.some(table=>overlaps(box,table,3*unit)));
  if(!best){
   // A completely full drawing gets an outer label strip instead of covering tables.
   const bottom=Math.max(760,...obstacles.map(o=>o.y+o.height),...placed.map(o=>o.y+o.height));
   best={x:12,y:bottom+8*unit,width:item.width,height:item.height};
  }
  placed.push({...item,...best,displaced:Math.hypot(best.x-item.anchorX,best.y-item.anchorY)>12});
 }
 return placed;
}
