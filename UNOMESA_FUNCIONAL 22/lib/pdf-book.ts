/** Zero-based selected page; resizing retains that page in the visible spread. */
export function pdfBookSpread(total:number,index:number,width:number){
 const count=Math.max(0,Math.floor(total)),columns=width>=660&&count>1?2:1;
 const selected=Math.max(0,Math.min(Math.floor(index),Math.max(0,count-1))),start=Math.floor(selected/columns)*columns;
 const pages=Array.from({length:Math.min(columns,count-start)},(_,i)=>start+i+1);
 return {columns,start,pages,previous:start>0,next:start+columns<count};
}
export function pdfSwipeDirection(dx:number,dy:number,elapsed:number,zoom:number){
 if(zoom!==1||elapsed>800||Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.5)return 0;
 return dx<0?1:-1;
}
export function publicMenuTitle(name:string,en=false){return name.replace(/\.pdf$/i,'').replace(/[_]+/g,' ').trim()||(en?'Menu':'Menú');}
