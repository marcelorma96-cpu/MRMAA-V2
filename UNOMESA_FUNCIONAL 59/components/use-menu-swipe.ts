"use client";
import {useLayoutEffect,useRef,type RefObject} from 'react';

// Portals live outside the dashboard. A menu gesture must not bypass a dialog.
export function hasMenuBlockingLayer(){
 return Array.from(document.querySelectorAll<HTMLElement>('.overlay,.modalBackdrop,.appContextLayer.isOpen,.touchPanelLayer.isOpen,.touchSelectionBar,[role="dialog"][aria-modal="true"]'))
  .some(el=>!el.classList.contains('dashboardSidebar')&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
}
const protectedSurface='input,textarea,select,form,[contenteditable]:not([contenteditable="false"]),[role="slider"],[draggable="true"],[data-menu-swipe="off"],.mapViewport,canvas,.appTabBar';
type Swipe={id:number;x:number;y:number;dx:number;locked:boolean;width:number;open:boolean};

/** One-finger horizontal intent only. Never restrict touch-action on the workspace:
 * that would disable two-finger map navigation on iOS and Android. */
export function useMenuSwipe(root:RefObject<HTMLDivElement|null>,enabled:boolean,open:boolean,onOpenChange:(open:boolean)=>void){
 const latest=useRef({open,onOpenChange});latest.current={open,onOpenChange};
 const clear=useRef<()=>void>(()=>{});
 useLayoutEffect(()=>{clear.current()},[open]);
 useLayoutEffect(()=>{
  const shell=root.current;if(!enabled||!shell)return;
  let swipe:Swipe|null=null,suppressUntil=0;
  const reset=()=>{swipe=null;delete shell.dataset.menuDragging;shell.style.removeProperty('--menu-progress')};
  clear.current=reset;
  const down=(event:TouchEvent)=>{
   reset();
   if(event.touches.length!==1||hasMenuBlockingLayer())return;
   const target=event.target;if(!(target instanceof Element)||target.closest(protectedSurface))return;
   const isOpen=latest.current.open;
   if(!target.closest(isOpen?'.dashboardSidebar':'main.workspace'))return;
   // A horizontal list/carousel keeps its own gesture, including at its boundary.
   for(let el:Element|null=target;el&&el!==shell;el=el.parentElement){
    if(el.scrollWidth>el.clientWidth+2&&/auto|scroll/.test(getComputedStyle(el).overflowX))return;
   }
   const t=event.touches[0],width=shell.querySelector('.dashboardSidebar')?.getBoundingClientRect().width||320;
   swipe={id:t.identifier,x:t.clientX,y:t.clientY,dx:0,locked:false,width,open:isOpen};
  };
  const move=(event:TouchEvent)=>{
   if(!swipe)return;
   if(event.touches.length!==1||hasMenuBlockingLayer()){reset();return;}
   const t=event.touches[0];if(t.identifier!==swipe.id){reset();return;}
   const dx=t.clientX-swipe.x,dy=t.clientY-swipe.y;
   if(!swipe.locked){
    if(Math.abs(dx)<12&&Math.abs(dy)<12)return;
    if(Math.abs(dx)<Math.abs(dy)*1.6||(swipe.open?dx>=0:dx<=0)){reset();return;}
    if(!event.cancelable){reset();return;}
    swipe.locked=true;shell.dataset.menuDragging='true';
   }
   if(event.cancelable)event.preventDefault();
   swipe.dx=dx;suppressUntil=Date.now()+450;
   shell.style.setProperty('--menu-progress',String(Math.max(0,Math.min(1,(swipe.open?1:0)+dx/swipe.width))));
  };
  const up=()=>{
   const done=swipe;if(!done?.locked){reset();return;}
   const traveled=done.open?-done.dx:done.dx;
   // Deliberate short swipes work without making users drag the entire drawer.
   const commit=traveled>=Math.min(76,done.width*.23);
   if(commit){swipe=null;delete shell.dataset.menuDragging;latest.current.onOpenChange(!done.open)}
   else reset();
  };
  const click=(event:MouseEvent)=>{if(Date.now()<suppressUntil&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation()}};
  shell.addEventListener('touchstart',down,{passive:true});
  shell.addEventListener('touchmove',move,{passive:false});
  shell.addEventListener('touchend',up);shell.addEventListener('touchcancel',reset);
  shell.addEventListener('click',click,true);
  return()=>{reset();clear.current=()=>{};shell.removeEventListener('touchstart',down);shell.removeEventListener('touchmove',move);shell.removeEventListener('touchend',up);shell.removeEventListener('touchcancel',reset);shell.removeEventListener('click',click,true)};
 },[root,enabled]);
}
