"use client";
import {useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {StartupLoadingContext,useStartupPending} from './presentation-loading';
import {nativeAppMessage} from '@/lib/app-mode';
import {OPENING_EVENT,pendingLoginOpening,takeLoginOpening} from '@/lib/launch-session';
const useLayout=typeof window==='undefined'?useEffect:useLayoutEffect;

/** A neutral cover for session restore, MFA, OAuth handoffs and first-load errors. */
export function AppLoading(){return <span className="entryWaitDot" aria-hidden="true"/>}
export function AccessLoading({text}:{text:string}){
 useStartupPending(true);
 return <main className="center accessLoading" role="status"><AppLoading/><span className="visuallyHidden">{text}</span></main>;
}
/** Release SSR/native covers once gates are ready, without triggering an opening. */
export function EntryReady({enabled}:{enabled:boolean}){
 const pending=!!useContext(StartupLoadingContext)?.pending;
 useEffect(()=>{
  if(!enabled)return;
  const root=document.documentElement;
  if(pending){root.dataset.unomesaContentReady='false';nativeAppMessage('appContentPending');return}
  let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   delete root.dataset.unomesaEntryPending;root.dataset.unomesaContentReady='true';nativeAppMessage('appContentReady');
  })});return()=>cancelAnimationFrame(frame);
 },[enabled,pending]);return null;
}
/** This component is mounted only inside a verified account surface, after the MFA gate. */
export function SignedInOpening({user}:{user:string}){
 const pending=!!useContext(StartupLoadingContext)?.pending;
 const [phase,setPhase]=useState<'off'|'holding'|'opening'>('off');
 const active=useRef(false);
 useLayout(()=>{
  const check=()=>{
   if(active.current||!pendingLoginOpening(user))return;
   if(document.visibilityState==='hidden')return;
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){takeLoginOpening(user);return}
   setPhase('holding');
  };
  const hide=()=>{if(document.visibilityState==='hidden'&&active.current){setPhase('off')}else if(!active.current)check()};
  const leave=()=>{if(active.current)setPhase('off')};
  check();window.addEventListener(OPENING_EVENT,check);window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',hide);
  return()=>{window.removeEventListener(OPENING_EVENT,check);window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',hide)};
 },[user]);
 useEffect(()=>{
  if(phase!=='holding')return;
  // If a slow module needs a retry, reveal its UI rather than trap the user behind a logo.
  const fallback=window.setTimeout(()=>{takeLoginOpening(user);setPhase('off')},3500);
  return()=>clearTimeout(fallback);
 },[phase,user]);
 useEffect(()=>{
  if(phase!=='holding'||pending)return;
  let f=requestAnimationFrame(()=>{f=requestAnimationFrame(()=>{
    if(document.visibilityState==='hidden'||matchMedia('(prefers-reduced-motion: reduce)').matches||!takeLoginOpening(user)){takeLoginOpening(user);setPhase('off');return}
    active.current=true;setPhase('opening');
  })});return()=>cancelAnimationFrame(f);
 },[phase,pending,user]);
 useEffect(()=>{
  if(phase!=='opening')return;
  const t=window.setTimeout(()=>setPhase('off'),1580);return()=>clearTimeout(t);
 },[phase]);
 if(phase==='off')return null;
 return <div aria-hidden="true" className={'unoOpening'+(phase==='opening'?' moving':'')}>
  {(['left','right'] as const).map(side=><div key={side} className={'unoOpeningPanel '+side}><div className="unoOpeningScene"><span className="unoOpeningMark"><img src="/brand/opening-table.png" width="512" height="512" alt="" draggable={false}/><i/><img className="unoOriginal" src="/brand/unomesa-symbol.png" width="512" height="512" alt="" draggable={false}/></span></div></div>)}
 </div>;
}
