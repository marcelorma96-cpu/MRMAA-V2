type Box={x:number;y:number;width:number;height:number};
export type MapLabelInput=Box&{id:string;name:string};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const overlaps=(a:Box,b:Box,gap=8)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
const textWidth=(s:string)=>Array.from(s).reduce((w,c)=>w+(/[MW@%]/.test(c)?21:/[ilI .,'’]/.test(c)?7:/[A-Z0-9]/.test(c)?16:13),0);
function linesFor(name:string){
 const lines:string[]=[];let line='';
 for(const word of name.trim().split(/\s+/)){
  if(line&&textWidth(`${line} ${word}`)>276){lines.push(line);line='';}
  for(const char of (line?' ':'')+word){if(textWidth(line+char)>276){lines.push(line);line='';}line+=char;}
 }
 if(line)lines.push(line);
 if(lines.length>2){let end=lines[1];while(textWidth(end+'…')>276)end=end.slice(0,-1);return [lines[0],end+'…'];}
 return lines.length?lines:[''];
}
/** Display-only labels. Never move a room or write coordinates back to its layout. */
export function placeMapLabels(areas:MapLabelInput[],obstacles:Box[]=[]){
 const source=areas.map(area=>{const lines=linesFor(area.name);return {...area,lines,width:Math.max(210,Math.min(308,Math.max(...lines.map(textWidth))+32)),height:lines.length===2?90:64,anchorX:area.x+12,anchorY:area.y+8};});
 const placed:(typeof source[number]&{displaced:boolean})[]=[];
 for(const item of source){
  const candidates:Box[]=[];
  const add=(x:number,y:number)=>candidates.push({x:clamp(x,12,1088-item.width),y:clamp(y,12,748-item.height),width:item.width,height:item.height});
  add(item.anchorX,item.anchorY);
  add(item.x+item.width+12,item.y+8);add(item.x,item.y-item.height-10);
  // Nearby rows and columns also cover the full canvas for heavily merged areas.
  for(let y=12;y<=748-item.height;y+=24)for(let x=12;x<=1088-item.width;x+=24)add(x,y);
  let best:Box|undefined,score=Infinity;
  candidates.sort((a,b)=>Math.hypot(a.x-item.anchorX,a.y-item.anchorY)-Math.hypot(b.x-item.anchorX,b.y-item.anchorY));
  for(const box of candidates){
   const distance=Math.hypot(box.x-item.anchorX,box.y-item.anchorY);
   if(distance>=score)break;
   if(placed.some(other=>overlaps(box,other)))continue;
   const cost=distance+obstacles.filter(table=>overlaps(box,table,3)).length*180;
   if(cost<score){best=box;score=cost;}
  }
  if(!best){
   // At most 20 areas are supported. A 3 × 7 label grid is always a safe fallback.
   return source.map((label,index)=>({...label,x:16+(index%3)*360,y:16+Math.floor(index/3)*104,displaced:true}));
  }
  placed.push({...item,...best,displaced:Math.hypot(best.x-item.anchorX,best.y-item.anchorY)>12});
 }
 return placed;
}
