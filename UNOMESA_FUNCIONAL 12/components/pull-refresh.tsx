"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {isAppMode} from '@/lib/app-mode';
import {hasUnsavedChanges} from '@/lib/unsaved-changes';
type Task=()=>void|Promise<unknown>;
const RefreshContext=createContext<(task:Task)=>()=>void>(()=>()=>{});
export function useRefreshRegistration(){return useContext(RefreshContext)}
export function useRefreshTask(task:Task){const register=useRefreshRegistration(),latest=useRef(task);latest.current=task;useEffect(()=>register(()=>latest.current()),[register])}
/** Refresh mounted readers only. Never reload the page, sign out or discard a draft. */
export function PullRefresh({children,en,onRefresh}:{children:ReactNode;en:boolean;onRefresh?:Task}){
 const tasks=useRef(new Set<Task>()),parentTask=useRef(onRefresh);parentTask.current=onRefresh;
 const register=useCallback((task:Task)=>{tasks.current.add(task);return()=>{tasks.current.delete(task)}},[]);
 const [distance,setDistance]=useState(0),[busy,setBusy]=useState(false),alive=useRef(true),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useEffect(()=>{
  if(!isAppMode())return;
  let start:{x:number;y:number;distance:number}|null=null,suppressClickUntil=0;
  const reset=()=>{start=null;if(alive.current)setDistance(0)};
  const blocked=()=>hasUnsavedChanges()||!!document.querySelector('.overlay,.modalBackdrop,.appContextLayer.isOpen,.touchPanelLayer.isOpen,.touchSelectionBar,.appModuleBoundary[aria-busy="true"]');
  const down=(event:TouchEvent)=>{
   if(locked.current||event.touches.length!==1||blocked())return;
   const el=event.target as Element,touch=event.touches[0];
   if(touch.clientX<26||!el.closest('main.workspace')||el.closest('.mapViewport,svg,input,textarea,select,form,[contenteditable=true],.dashboardSidebar,.appTabBar'))return;
   for(let node:Element|null=el;node;node=node.parentElement){if(node.scrollTop>1)return;}
   if(window.scrollY>1)return;
   start={x:touch.clientX,y:touch.clientY,distance:0};
  };
  const move=(event:TouchEvent)=>{
   if(!start)return;if(event.touches.length!==1||blocked()){reset();return;}
   const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
   if(dy< -5||Math.abs(dx)>Math.max(18,dy*.7)){reset();return;}
   if(dy>8&&event.cancelable){event.preventDefault();start.distance=Math.min(110,dy);setDistance(start.distance);suppressClickUntil=Date.now()+500;}
  };
  const up=()=>{
   const ready=start&&start.distance>=80;reset();if(!ready||locked.current||blocked())return;
   locked.current=true;setBusy(true);
   const readers=[...tasks.current];if(parentTask.current)readers.push(parentTask.current);
   void Promise.allSettled(readers.map(task=>Promise.resolve().then(task))).then(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))).finally(()=>{locked.current=false;if(alive.current)setBusy(false)});
  };
  const click=(event:MouseEvent)=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation()}};
  document.addEventListener('touchstart',down,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',up);document.addEventListener('touchcancel',reset);document.addEventListener('click',click,true);
  return()=>{document.removeEventListener('touchstart',down);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up);document.removeEventListener('touchcancel',reset);document.removeEventListener('click',click,true)};
 },[]);
 return <RefreshContext.Provider value={register}>{children}{(distance>8||busy)&&<div className="appPullRefresh" role="status" aria-live="polite" data-refreshing={busy}><span className={busy?'appLoadingRing':'appPullArrow'} aria-hidden="true">{busy?'':'↓'}</span><span>{busy?(en?'Refreshing…':'Actualizando…'):distance>=80?(en?'Release to refresh':'Suelta para actualizar'):(en?'Pull down to refresh':'Desliza hacia abajo')}</span></div>}</RefreshContext.Provider>;
}
