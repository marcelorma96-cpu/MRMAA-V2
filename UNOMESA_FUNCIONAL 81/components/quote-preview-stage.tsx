"use client";
import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useAppPreferences} from './app-preferences';
import {getMotionOrigin} from './surface-motion';
import {registerOverlay,isTopOverlay} from '@/lib/overlay-stack';

type Stage={reveal:(title:string)=>void;close:()=>void;settle:()=>void};
const QuoteStageContext=createContext<Stage|null>(null);
export const useQuoteStage=()=>useContext(QuoteStageContext);

/** One mounted surface for the request, the measured document and its exit. */
export function QuotePreviewStage({children,close,cancelLoad,busy=false}:{children?:ReactNode;close:()=>void;cancelLoad?:()=>void;busy?:boolean}){
 const {language}=useAppPreferences(),en=language==='en';
 const layer=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),documentRef=useRef<HTMLDivElement>(null);
 const callbacks=useRef({close,cancelLoad,busy});callbacks.current={close,cancelLoad,busy};
 const [ready,setReady]=useState(false),[closing,setClosing]=useState(false),[title,setTitle]=useState('');
 const [reduced,setReduced]=useState(false),[height,setHeight]=useState<number>();
 const revealed=useRef(false),exiting=useRef(false),mounted=useRef(false);
 const frames=useRef<number[]>([]),animations=useRef<Animation[]>([]),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const settle=useCallback(()=>{
  for(const el of [layer.current,shell.current,canvas.current,documentRef.current]){
   el?.getAnimations().forEach(a=>{if(Number.isFinite(Number(a.effect?.getTiming().iterations)))a.finish()});
  }
 },[]);
 const requestClose=useCallback(()=>{
  if(callbacks.current.busy||exiting.current)return;
  exiting.current=true;callbacks.current.cancelLoad?.();
  frames.current.forEach(cancelAnimationFrame);frames.current=[];
  settle();setClosing(true);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done=()=>{if(mounted.current)callbacks.current.close()};
  closeTimer.current=setTimeout(done,reduce?100:200);
 },[settle]);
 const reveal=useCallback((label:string)=>{
  setTitle(label);
  if(revealed.current||exiting.current)return;
  revealed.current=true;
  // The paper measures in a layout effect. Give its final mobile scale a paint
  // before dissolving the placeholder; never replay the entrance animation.
  frames.current.push(requestAnimationFrame(()=>{
   frames.current.push(requestAnimationFrame(()=>{if(mounted.current&&!exiting.current)setReady(true)}));
  }));
 },[]);
 const context=useMemo(()=>({reveal,close:requestClose,settle}),[reveal,requestClose,settle]);
 useLayoutEffect(()=>{
  const el=layer.current,card=shell.current,doc=documentRef.current;if(!el||!card||!doc)return;
  mounted.current=true;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');setReduced(preference.matches);
  const change=()=>{setReduced(preference.matches);if(preference.matches)settle()};
  preference.addEventListener('change',change);
  const unregister=registerOverlay(el),before=document.activeElement as HTMLElement|null;
  card.focus({preventScroll:true});
  const measure=()=>{
   const measured=doc.offsetHeight;
   const next=measured||Math.min(innerHeight*.72,Math.max(310,card.clientWidth*1.12));
   setHeight(previous=>previous===Math.ceil(next)?previous:Math.ceil(next));
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(doc);observer.observe(card);
  if(typeof card.animate==='function'){
   const point=getMotionOrigin(),rect=card.getBoundingClientRect();
   const dx=point?Math.max(-28,Math.min(28,(point.x-rect.left-rect.width/2)*.08)):0;
   card.style.transformOrigin=`${point?Math.max(0,Math.min(rect.width,point.x-rect.left)):rect.width/2}px 80px`;
   const animation=card.animate(preference.matches?[{opacity:0},{opacity:1}]:[
    {opacity:0,transform:`translate3d(${dx}px,24px,0) scale(.965)`},
    {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
   ],{duration:preference.matches?120:520,easing:'cubic-bezier(.16,1,.3,1)'});
   card.dataset.surfaceAnimating='document';
   const clear=()=>{delete card.dataset.surfaceAnimating};animation.onfinish=clear;animation.oncancel=clear;
   animations.current.push(animation);
  }
  return()=>{
   mounted.current=false;revealed.current=false;observer.disconnect();preference.removeEventListener('change',change);
   frames.current.forEach(cancelAnimationFrame);frames.current=[];
   animations.current.forEach(a=>{a.onfinish=null;a.oncancel=null;a.cancel()});animations.current=[];
   if(closeTimer.current)clearTimeout(closeTimer.current);
   unregister();if(before?.isConnected&&!before.closest('[inert],[hidden]'))before.focus({preventScroll:true});
  };
 },[settle]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   const el=layer.current;if(!el||!isTopOverlay(el))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();requestClose()}
   if(event.key==='Tab'){
    const controls=[...el.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')].filter(c=>c.getClientRects().length&&!c.closest('[inert],[hidden]'));
    const first=controls[0],last=controls.at(-1);
    if(!first){event.preventDefault();return}
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===shell.current)){event.preventDefault();last?.focus({preventScroll:true})}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true})}
   }
  };document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
 },[requestClose]);
 useEffect(()=>{
  // A loading button may disappear beneath the content; keep focus in the dialog.
  if(ready&&document.activeElement?.closest('.quoteStagePlaceholder'))shell.current?.focus({preventScroll:true});
 },[ready]);
 if(typeof document==='undefined')return null;
 return createPortal(<QuoteStageContext.Provider value={context}>
  <div ref={layer} className={`overlay quotePreviewOverlay quoteStage${ready?' isReady':''}${closing?' isClosing':''}${reduced?' isReduced':''}`}>
   <div ref={shell} className="quotePreviewShell quoteStageShell" role="dialog" aria-modal="true" aria-label={title||(en?'Opening quote':'Abriendo cotización')} aria-busy={!ready} tabIndex={-1}>
    <div ref={canvas} className="quoteStageCanvas" style={{height}}>
     <div className="quoteStagePlaceholder" aria-hidden={ready||undefined} inert={ready||closing}>
      <div className="quoteStagePaper" aria-hidden="true"><div className="quoteStageHeading"><i/><span><i/><i/></span></div><div className="quoteStageFields"><i/><i/><i/><i/></div><div className="quoteStageRows"><i/><i/><i/></div><div className="quoteStageTotals"><i/><i/><i/></div></div>
      <footer><span role="status" translate="no">{en?'Preparing your quote…':'Preparando tu cotización…'}</span><button type="button" className="secondary" onClick={requestClose}>{en?'Close':'Cerrar'}</button></footer>
     </div>
     <div ref={documentRef} className="quoteStageDocument" inert={!ready||closing} aria-hidden={!ready||undefined}>{children}</div>
    </div>
   </div>
  </div>
 </QuoteStageContext.Provider>,document.body);
}
