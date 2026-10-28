"use client";
import {useEffect,useRef} from 'react';
import {useAppPreferences} from './app-preferences';
import {useSurfaceMotion} from './surface-motion';
import {registerOverlay,isTopOverlay} from '@/lib/overlay-stack';

/** Immediate visual feedback while the document's data/chunk loads. */
export function QuotePreviewLoading({close}:{close?:()=>void}){
 const layer=useRef<HTMLDivElement>(null),paper=useRef<HTMLDivElement>(null),closeRef=useRef(close);closeRef.current=close;
 const {language}=useAppPreferences(),en=language==='en';
 useSurfaceMotion(paper,true,'document');
 useEffect(()=>{
  if(!layer.current)return;const el=layer.current,unregister=registerOverlay(el);
  el.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
  const key=(event:KeyboardEvent)=>{if(!isTopOverlay(el))return;if(event.key==='Escape'&&closeRef.current){event.preventDefault();event.stopPropagation();closeRef.current()}if(event.key==='Tab'){event.preventDefault();el.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true})}};
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);unregister()};
 },[]);
 return <div ref={layer} className="overlay quotePreviewOverlay quoteOpeningOverlay" role="dialog" aria-modal="true" aria-label={en?'Opening quote':'Abriendo cotización'}>
  <div ref={paper} className="quoteOpeningShell">
   <div className="quoteOpeningPaper" aria-hidden="true"><div className="quoteOpeningHeader"><i/><div><i/><i/></div></div><div className="quoteOpeningFields"><i/><i/><i/><i/></div><div className="quoteOpeningRows"><i/><i/><i/></div><div className="quoteOpeningTotal"><i/><i/></div></div>
   <footer><span role="status" translate="no">{en?'Preparing your quote…':'Preparando tu cotización…'}</span>{close&&<button type="button" className="secondary" onClick={close}>{en?'Close':'Cerrar'}</button>}</footer>
  </div>
 </div>;
}
