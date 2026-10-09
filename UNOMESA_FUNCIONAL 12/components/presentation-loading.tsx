"use client";
import {createContext,useCallback,useContext,useEffect,useId,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {isAppMode} from '@/lib/app-mode';

type Registry={pending:boolean;mark:(id:string,pending:boolean)=>void};
export const StartupLoadingContext=createContext<Registry|null>(null);
const ModuleLoadingContext=createContext<Registry|null>(null);
const ModulePreparingContext=createContext(false);
export function useModulePreparing(){return useContext(ModulePreparingContext)}
const useBrowserLayoutEffect=typeof window==='undefined'?useEffect:useLayoutEffect;
function useRegistry():Registry{
 const entries=useRef(new Set<string>()),[pending,setPending]=useState(false);
 const mark=useCallback((id:string,busy:boolean)=>{if(busy)entries.current.add(id);else entries.current.delete(id);setPending(entries.current.size>0)},[]);
 return useMemo(()=>({pending,mark}),[pending,mark]);
}
function useRegistration(registry:Registry|null,pending:boolean){
 const id=useId(),mark=registry?.mark;
 useBrowserLayoutEffect(()=>{mark?.(id,pending);return()=>mark?.(id,false)},[id,mark,pending]);
}
/** These flags only control presentation. They never grant access or change data. */
export function useStartupPending(pending:boolean){useRegistration(useContext(StartupLoadingContext),pending)}
export function useModulePending(pending:boolean){useRegistration(useContext(ModuleLoadingContext),pending)}
export function StartupLoadingProvider({children}:{children:ReactNode}){const registry=useRegistry();return <StartupLoadingContext.Provider value={registry}>{children}</StartupLoadingContext.Provider>}
export function ModuleChunkLoading(){useModulePending(true);return <div className="empty" role="status">Cargando…</div>}
/** Keep children mounted and measurable. Reveal once; refreshes never hide drafts or steal focus. */
export function AppModuleBoundary({children,pending=false,en=false}:{children:ReactNode;pending?:boolean;en?:boolean}){
 const parentPreparing=useModulePreparing();
 const registry=useRegistry(),[revealed,setRevealed]=useState(false),[app,setApp]=useState(false),content=useRef<HTMLDivElement>(null);
 const waiting=pending||registry.pending;
 useBrowserLayoutEffect(()=>setApp(isAppMode()),[]);
 useStartupPending(!revealed);
 useModulePending(!revealed); // Nested boundaries also hold their parent until ready.
 useEffect(()=>{
  if(waiting||revealed)return;
  let cancelled=false,frame=0,timeout=0;
  const settle=()=>{if(cancelled)return;frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{if(!cancelled)setRevealed(true)})})};
  // Fonts affect map labels. A slow font must not prevent a usable screen forever.
  if(document.fonts?.status==='loading'){
   timeout=window.setTimeout(settle,700);
   void document.fonts.ready.then(()=>{clearTimeout(timeout);if(!cancelled)settle()});
  }else settle();
  return()=>{cancelled=true;clearTimeout(timeout);cancelAnimationFrame(frame)};
 },[waiting,revealed]);
 const blocked=app&&!revealed;
 return <ModuleLoadingContext.Provider value={registry}><ModulePreparingContext.Provider value={parentPreparing||blocked}><div className={`appModuleBoundary${blocked?' isPreparing':''}`} aria-busy={blocked}>
  <div ref={content} className="appModuleContent" aria-hidden={blocked||undefined} inert={blocked}>{children}</div>
  {blocked&&<div className="appModuleLoading" role="status" aria-live="polite"><span className="appLoadingRing" aria-hidden="true"/><span>{en?'Loading…':'Cargando…'}</span></div>}
 </div></ModulePreparingContext.Provider></ModuleLoadingContext.Provider>;
}
