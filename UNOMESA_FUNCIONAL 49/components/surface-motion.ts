"use client";
import {useEffect,useLayoutEffect,type RefObject} from 'react';

type Origin={x:number;y:number;at:number};
let origin:Origin|null=null;
const useBrowserLayoutEffect=typeof window==='undefined'?useEffect:useLayoutEffect;

/** Coordinates only. Never retain a record, DOM snapshot or previous tenant's UI. */
export function useMotionTracking(scope:string){
 useEffect(()=>{
  origin=null;
  const capture=(event:MouseEvent)=>{
   const target=event.target instanceof Element?event.target.closest('button,a,summary,[role=button]'):null;
   if(!target)return;
   // Settle a moving ancestor before opening a fixed dialog or exporting a PDF.
   for(let parent=target.parentElement;parent;parent=parent.parentElement){
    if(parent.dataset.surfaceAnimating)parent.getAnimations().forEach(animation=>animation.finish());
   }
   const r=target.getBoundingClientRect();
   origin={x:event.detail?event.clientX:r.left+r.width/2,y:event.detail?event.clientY:r.top+r.height/2,at:performance.now()};
  };
  document.addEventListener('click',capture,true);
  return()=>{document.removeEventListener('click',capture,true);origin=null};
 },[scope]);
}

/** Short compositor animations; the final layout never retains a transform or clip. */
export function useSurfaceMotion(ref:RefObject<HTMLElement|null>,open:boolean,kind:'section'|'sheet'|'document'|'content'='sheet'){
 useBrowserLayoutEffect(()=>{
  const el=ref.current;if(!open||!el||typeof el.animate!=='function')return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const rect=el.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const point=origin&&performance.now()-origin.at<8000?origin:{x:rect.left+rect.width/2,y:Math.min(innerHeight,rect.bottom)};
  const x=Math.max(0,Math.min(rect.width,point.x-rect.left));
  const y=Math.max(0,Math.min(rect.height,point.y-rect.top));
  const dx=Math.max(-70,Math.min(70,(point.x-(rect.left+rect.width/2))*.15));
  let frames:Keyframe[],duration:number;
  if(reduced.matches){frames=[{opacity:.4},{opacity:1}];duration=120;}
  else if(kind==='section'&&CSS.supports('clip-path','circle(1px at 0 0)')){
   const radius=Math.hypot(Math.max(x,rect.width-x),Math.max(y,rect.height-y));
   frames=[{clipPath:`circle(18px at ${x}px ${y}px)`,opacity:.4},{clipPath:`circle(${radius}px at ${x}px ${y}px)`,opacity:1}];duration=480;
  }else if(kind==='content'){
   frames=[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'none'}];duration=240;
  }else{
   const rotate=kind==='document'?(dx<0?-1.2:1.2):0;
   frames=[{opacity:0,transformOrigin:`${x}px ${y}px`,transform:`translate(${dx}px, 24px) scale(.94) rotate(${rotate}deg)`},{opacity:1,transformOrigin:`${x}px ${y}px`,transform:'none'}];duration=kind==='document'?420:360;
  }
  const animation=el.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
  el.dataset.surfaceAnimating=kind;
  const clear=()=>{delete el.dataset.surfaceAnimating};
  animation.onfinish=clear;animation.oncancel=clear;
  const cancel=()=>{animation.cancel();clear()};
  const reduce=()=>{if(reduced.matches)cancel()};
  reduced.addEventListener('change',reduce);
  return()=>{reduced.removeEventListener('change',reduce);cancel()};
 },[ref,open,kind]);
}
