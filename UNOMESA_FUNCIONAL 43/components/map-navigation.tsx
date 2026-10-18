"use client";
import {useCallback,useLayoutEffect,useRef,useState,useContext,type PointerEvent as ReactPointerEvent} from 'react';
import {FloorTouchContext} from './floor-touch';
import {Hand,Maximize2,Minimize2,ZoomIn,ZoomOut} from 'lucide-react';

type TouchPoint={x:number;y:number};
type Pan={id:number;x:number;y:number;left:number;top:number;moved:boolean;page:HTMLElement|null};
type Pinch={ids:number[];distance:number;zoom:number;anchorX:number;anchorY:number;originX:number;originY:number};
export const MAX_MAP_ZOOM=12;
const limitZoom=(value:number)=>Math.max(1,Math.min(MAX_MAP_ZOOM,value));
/** View gestures never change the saved layout. Two fingers cancel an in-progress object drag. */
export function useMapNavigation(editing:boolean,onGestureStart?:()=>void){
 const viewport=useRef<HTMLDivElement>(null),[zoom,setZoom]=useState(1),[hand,setHand]=useState(false),[wide,setWide]=useState(false),[panning,setPanning]=useState(false),[gestureFrame,setGestureFrame]=useState(0);
 const previousZoom=useRef(1),zoomRef=useRef(zoom),gesture=useRef<Pan|null>(null),suppressClick=useRef(false);
 const touches=useRef(new Map<number,TouchPoint>()),pinch=useRef<Pinch|null>(null),touchLocked=useRef(false);
 const pendingScroll=useRef<{left:number;top:number}|null>(null),cancelObject=useRef(onGestureStart);
 zoomRef.current=zoom;cancelObject.current=onGestureStart;
 const reset=useCallback(()=>{pendingScroll.current={left:0,top:0};zoomRef.current=1;setZoom(1);setGestureFrame(n=>n+1)},[]);
 // Center the selected objects in the part of the canvas left visible by its overlay.
 const focusElements=useCallback((elements:Element[])=>{
  const el=viewport.current;if(!el||!elements.length)return;
  const boxes=elements.map(node=>node.getBoundingClientRect()).filter(b=>b.width&&b.height);if(!boxes.length)return;
  const view=el.getBoundingClientRect(),left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top)),right=Math.max(...boxes.map(b=>b.right)),bottom=Math.max(...boxes.map(b=>b.bottom));
  let width=el.clientWidth,height=el.clientHeight;
  const panel=document.querySelector<HTMLElement>('.touchPanelLayer-agenda.isOpen .touchPanel');
  if(panel){if(matchMedia('(max-width:700px)').matches)height=Math.max(90,Math.min(height,innerHeight-panel.offsetHeight-view.top-12));else width=Math.max(120,Math.min(width,innerWidth-panel.offsetWidth-24-view.left));}
  const current=zoomRef.current,next=limitZoom(current*Math.min(width*.72/Math.max(1,right-left),height*.68/Math.max(1,bottom-top)));
  pendingScroll.current={left:((left+right)/2-view.left+el.scrollLeft)*next/current-width/2,top:((top+bottom)/2-view.top+el.scrollTop)*next/current-height/2};
  zoomRef.current=next;setZoom(next);setGestureFrame(n=>n+1);
 },[]);
 useLayoutEffect(()=>{
  const el=viewport.current,previous=previousZoom.current;previousZoom.current=zoom;if(!el)return;
  const target=pendingScroll.current;pendingScroll.current=null;
  if(target){el.scrollLeft=target.left;el.scrollTop=target.top;return;}
  if(zoom===previous)return;
  const ratio=zoom/previous;el.scrollLeft=(el.scrollLeft+el.clientWidth/2)*ratio-el.clientWidth/2;el.scrollTop=(el.scrollTop+el.clientHeight/2)*ratio-el.clientHeight/2;
 },[zoom,gestureFrame]);
 // Desktop trackpad pinch is delivered as a Ctrl+wheel gesture by supporting browsers.
 useLayoutEffect(()=>{
  const el=viewport.current;if(!el)return;
  const wheel=(event:WheelEvent)=>{
   if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();cancelObject.current?.();
   const rect=el.getBoundingClientRect(),current=zoomRef.current,next=limitZoom(current*Math.exp(-event.deltaY*.01)),x=event.clientX-rect.left,y=event.clientY-rect.top;
   pendingScroll.current={left:(el.scrollLeft+x)*next/current-x,top:(el.scrollTop+y)*next/current-y};
   zoomRef.current=next;setZoom(next);setGestureFrame(n=>n+1);
  };
  el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
 });
 const block=(e:ReactPointerEvent<HTMLDivElement>)=>{e.preventDefault();e.stopPropagation();};
 const finish=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const el=e.currentTarget;
  if(e.pointerType==='touch'){
   touches.current.delete(e.pointerId);
   if(touchLocked.current){
    block(e);suppressClick.current=true;if(pinch.current?.ids.includes(e.pointerId))pinch.current=null;
    if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
    if(!touches.current.size){touchLocked.current=false;gesture.current=null;setPanning(false);}return;
   }
  }
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  if(g.moved||hand){block(e);suppressClick.current=true;}
  gesture.current=null;setPanning(false);if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
 };
 const bindings={
  onPointerDownCapture(e:ReactPointerEvent<HTMLDivElement>){
   if(e.button!==0&&e.button!==1)return;
   const el=e.currentTarget;
   if(!touches.current.size)suppressClick.current=false;
   if(e.pointerType==='touch'){
    touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touchLocked.current){block(e);el.setPointerCapture(e.pointerId);return;}
    if(touches.current.size===2){
     block(e);cancelObject.current?.();gesture.current=null;touchLocked.current=true;suppressClick.current=true;
     const entries=[...touches.current],a=entries[0][1],b=entries[1][1],rect=el.getBoundingClientRect(),scene=el.querySelector('svg')?.getBoundingClientRect();
     const originX=(scene?.left??rect.left)-rect.left+el.scrollLeft,originY=(scene?.top??rect.top)-rect.top+el.scrollTop;
     const x=(a.x+b.x)/2-rect.left,y=(a.y+b.y)/2-rect.top;
     pinch.current={ids:entries.map(([id])=>id),distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:zoomRef.current,anchorX:(x+el.scrollLeft-originX)/zoomRef.current,anchorY:(y+el.scrollTop-originY)/zoomRef.current,originX,originY};
     for(const [id] of entries)el.setPointerCapture(id);setPanning(true);return;
    }
   }
   const interactive=(e.target as Element).closest('[role="button"]');
   if(editing&&!hand&&e.button!==1&&interactive)return;
   const overflow=el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1;
   let page:HTMLElement|null=null;
   if(!overflow&&!hand&&e.button!==1){
    if(e.pointerType!=='touch')return;
    // With no map overflow, one finger can still scroll the enclosing page.
    page=el.parentElement;while(page&&!(page.scrollHeight>page.clientHeight&&/(auto|scroll)/.test(getComputedStyle(page).overflowY)))page=page.parentElement;
    page=page||document.scrollingElement as HTMLElement;
   }
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:page?page.scrollTop:el.scrollTop,moved:false,page};
   if(hand||e.button===1)block(e);
  },
  onPointerMoveCapture(e:ReactPointerEvent<HTMLDivElement>){
   const el=e.currentTarget;
   if(e.pointerType==='touch'&&touches.current.has(e.pointerId))touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(touchLocked.current){
    block(e);const p=pinch.current;if(!p)return;
    const a=touches.current.get(p.ids[0]),b=touches.current.get(p.ids[1]);if(!a||!b)return;
    const rect=el.getBoundingClientRect(),next=limitZoom(p.zoom*Math.hypot(a.x-b.x,a.y-b.y)/p.distance);
    const target={left:p.originX+p.anchorX*next-((a.x+b.x)/2-rect.left),top:p.originY+p.anchorY*next-((a.y+b.y)/2-rect.top)};
    pendingScroll.current=target;zoomRef.current=next;setZoom(next);setGestureFrame(frame=>frame+1);return;
   }
   const g=gesture.current;if(!g||g.id!==e.pointerId)return;
   const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)<5)return;
   g.moved=true;block(e);el.setPointerCapture(e.pointerId);
   if(g.page)g.page.scrollTop=g.top-dy;
   else{el.scrollLeft=g.left-dx;el.scrollTop=g.top-dy;setPanning(true);}
  },
  onPointerUpCapture:finish,onPointerCancelCapture:finish,
  onClickCapture(e:React.MouseEvent<HTMLDivElement>){if(suppressClick.current||hand){e.preventDefault();e.stopPropagation();suppressClick.current=false;}},
 };
 return {viewport,zoom,setZoom,reset,focusElements,hand,setHand,wide,setWide,panning,bindings};
}
export function MapNavigation({map,en,tables=false}:{map:ReturnType<typeof useMapNavigation>;en:boolean;tables?:boolean}){
 const say=(es:string,eng:string)=>en?eng:es;
 const {enabled}=useContext(FloorTouchContext);
 if(enabled&&map.zoom<=1)return null;
 if(enabled)return <div className="mapNavigation touchMapNavigation"><button type="button" aria-label={say('Ajustar plano completo','Fit complete map')} onClick={map.reset}><Maximize2 size={17}/><span>{say('Ajustar','Fit')}</span></button></div>;
 return <div className="mapNavigation">
  <button type="button" className="mapHand" aria-pressed={map.hand} onClick={()=>map.setHand(v=>!v)} title={say('Arrastre para desplazar la vista sin editar el plano','Drag to move the view without editing the layout')}><Hand size={17}/>{say('Mover mapa','Pan map')}</button>
  <button type="button" aria-label={say(tables?'Alejar mesas':'Alejar mapa',tables?'Zoom out tables':'Zoom out')} disabled={map.zoom<=1} onClick={()=>map.setZoom(z=>Math.max(1,z-.25))}><ZoomOut size={17}/></button>
  <button type="button" aria-label={say('Restablecer zoom','Reset zoom')} onClick={map.reset}>{Math.round(map.zoom*100)}%</button>
  <button type="button" aria-label={say(tables?'Acercar mesas':'Acercar mapa',tables?'Zoom in tables':'Zoom in')} disabled={map.zoom>=MAX_MAP_ZOOM} onClick={()=>map.setZoom(z=>limitZoom(z*1.25))}><ZoomIn size={17}/></button>
  <button type="button" aria-label={say(map.wide?'Vista compacta':'Ampliar mapa',map.wide?'Compact view':'Expand map')} aria-pressed={map.wide} onClick={()=>map.setWide(v=>!v)}>{map.wide?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
 </div>;
}
