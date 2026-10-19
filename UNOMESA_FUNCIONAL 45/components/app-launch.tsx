"use client";
import {useContext,useEffect,useRef,useState} from 'react';
import {useAppMode} from './app-context';
import {StartupLoadingContext,useStartupPending} from './presentation-loading';
import {nativeAppMessage} from '@/lib/app-mode';

export function AppLoading(){
 return <div className="appBrandLoading" role="status" aria-label="UnoMesa"><span className="appBrandMark"><img src="/mobile-app-icon.png" width="104" height="104" alt="" draggable={false}/><i aria-hidden="true"/></span><strong>UnoMesa</strong><span className="appBrandPulse" aria-hidden="true"/></div>;
}
/** One coordinated handoff: access gates and the initial module finish before the logo leaves. */
export function AppLaunch({enabled=false}:{enabled?:boolean}){
 const detected=useAppMode(),app=enabled||detected,registry=useContext(StartupLoadingContext),pending=registry?.pending||false;
 const [phase,setPhase]=useState<'waiting'|'leaving'|'done'>('waiting'),started=useRef(0),finished=useRef(false);
 useEffect(()=>{
  if(!app)return;
  if(!started.current)started.current=performance.now();
  let frame=0,timer=0,exitTimer=0,cancelled=false;
  document.documentElement.dataset.unomesaContentReady='false';
  nativeAppMessage('appContentPending');
  if(pending){if(!finished.current)setPhase('waiting');return;}
  const ready=()=>{
   if(cancelled)return;
   // Keep the pre-hydration cover until auth gates AND the first module settle.
   delete document.documentElement.dataset.unomesaEntryPending;
   document.documentElement.dataset.unomesaContentReady='true';
   const native=document.documentElement.dataset.unomesaNativeLaunch==='true';
   nativeAppMessage('appContentReady');
   if(finished.current)return;
   if(native){finished.current=true;setPhase('done');return;}
   setPhase('leaving');
   exitTimer=window.setTimeout(()=>{finished.current=true;setPhase('done')},matchMedia('(prefers-reduced-motion: reduce)').matches?180:650);
  };
  // Frames allow newly mounted auth gates/readers and map measurements to settle.
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{timer=window.setTimeout(ready,finished.current?0:(document.documentElement.dataset.unomesaNativeLaunch==='true'?0:Math.max(0,450-(performance.now()-started.current))))})});
  return()=>{cancelled=true;cancelAnimationFrame(frame);clearTimeout(timer);clearTimeout(exitTimer)};
 },[app,pending]);
 return app&&phase!=='done'?<div className={`appLaunchOverlay ${phase==='leaving'?'isLeaving':''}`}><AppLoading/></div>:null;
}
export function AccessLoading({text}:{text:string}){
 useStartupPending(true);
 return <main className="center accessLoading"><div className="appLoadingBrand"><AppLoading/><p className="accessLoadingText visuallyHidden" aria-live="polite">{text}</p></div></main>;
}
