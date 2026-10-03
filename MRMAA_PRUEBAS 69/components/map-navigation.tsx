"use client";
import {useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Hand,Maximize2,Minimize2,ZoomIn,ZoomOut} from 'lucide-react';

/** Drag the viewport, never the saved layout. A click remains a click until it moves. */
export function useMapNavigation(editing:boolean){
 const viewport=useRef<HTMLDivElement>(null),[zoom,setZoom]=useState(1),[hand,setHand]=useState(false),[wide,setWide]=useState(false),[panning,setPanning]=useState(false);
 const previousZoom=useRef(1),gesture=useRef<{id:number;x:number;y:number;left:number;top:number;moved:boolean}|null>(null),suppressClick=useRef(false);
 useLayoutEffect(()=>{const el=viewport.current,previous=previousZoom.current;previousZoom.current=zoom;if(!el||zoom===previous)return;const ratio=zoom/previous;el.scrollLeft=(el.scrollLeft+el.clientWidth/2)*ratio-el.clientWidth/2;el.scrollTop=(el.scrollTop+el.clientHeight/2)*ratio-el.clientHeight/2;},[zoom]);
 const finish=(e:ReactPointerEvent<HTMLDivElement>)=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;if(g.moved||hand){e.preventDefault();e.stopPropagation();suppressClick.current=true;}gesture.current=null;setPanning(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
 const bindings={
  onPointerDownCapture(e:ReactPointerEvent<HTMLDivElement>){
   if(e.button!==0&&e.button!==1)return;
   const el=e.currentTarget,interactive=(e.target as Element).closest('[role="button"]');
   if(editing&&!hand&&e.button!==1&&interactive)return;
   if(el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight&&!hand)return;
   suppressClick.current=false;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop,moved:false};
   if(hand||e.button===1){e.preventDefault();e.stopPropagation();}
  },
  onPointerMoveCapture(e:ReactPointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)<5)return;g.moved=true;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.scrollLeft=g.left-dx;e.currentTarget.scrollTop=g.top-dy;setPanning(true);},
  onPointerUpCapture:finish,onPointerCancelCapture:finish,
  onClickCapture(e:React.MouseEvent<HTMLDivElement>){if(suppressClick.current||hand){e.preventDefault();e.stopPropagation();suppressClick.current=false;}},
 };
 return {viewport,zoom,setZoom,hand,setHand,wide,setWide,panning,bindings};
}
export function MapNavigation({map,en,tables=false}:{map:ReturnType<typeof useMapNavigation>;en:boolean;tables?:boolean}){
 const say=(es:string,eng:string)=>en?eng:es;
 return <div className="mapNavigation">
  <button type="button" className="mapHand" aria-pressed={map.hand} onClick={()=>map.setHand(v=>!v)} title={say('Arrastre para desplazar la vista sin editar el plano','Drag to move the view without editing the layout')}><Hand size={17}/>{say('Mover mapa','Pan map')}</button>
  <button type="button" aria-label={say(tables?'Alejar mesas':'Alejar mapa',tables?'Zoom out tables':'Zoom out')} disabled={map.zoom<=1} onClick={()=>map.setZoom(z=>Math.max(1,z-.25))}><ZoomOut size={17}/></button>
  <button type="button" aria-label={say('Restablecer zoom','Reset zoom')} onClick={()=>{map.setZoom(1);if(map.viewport.current){map.viewport.current.scrollLeft=0;map.viewport.current.scrollTop=0;}}}>{Math.round(map.zoom*100)}%</button>
  <button type="button" aria-label={say(tables?'Acercar mesas':'Acercar mapa',tables?'Zoom in tables':'Zoom in')} disabled={map.zoom>=3} onClick={()=>map.setZoom(z=>Math.min(3,z+.25))}><ZoomIn size={17}/></button>
  <button type="button" aria-label={say(map.wide?'Vista compacta':'Ampliar mapa',map.wide?'Compact view':'Expand map')} aria-pressed={map.wide} onClick={()=>map.setWide(v=>!v)}>{map.wide?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
 </div>;
}
