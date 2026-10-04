"use client";
import {Children,createContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ChevronRight,MoreHorizontal,X} from 'lucide-react';
import {isAppMode} from '@/lib/app-mode';
import {useAppPreferences} from './app-preferences';

export function useAppMode(){const [app,setApp]=useState(false);useEffect(()=>setApp(isAppMode()),[]);return app;}
const SheetContext=createContext<()=>void>(()=>{});
const activeSheets:HTMLElement[]=[];
const layerSheets=()=>activeSheets.forEach((el,index)=>{if(el.parentElement)el.parentElement.style.zIndex=String(95+index)});
/** Content stays mounted while closed: filters, drafts and in-flight operations are retained. */
export function AppSheet({open,title,close,children}:{open:boolean;title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLElement>(null),start=useRef<{x:number;y:number}|null>(null),id=useId(),[ready,setReady]=useState(false),closeRef=useRef(close);closeRef.current=close;
 const {language}=useAppPreferences(),en=language==='en';
 useEffect(()=>setReady(true),[]);
 useEffect(()=>{if(!open||!ready)return;const sheet=ref.current;if(sheet){activeSheets.push(sheet);layerSheets()}const before=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('.appSheetClose')?.focus({preventScroll:true});
 const key=(e:KeyboardEvent)=>{if(activeSheets.at(-1)!==ref.current)return;const inModal=(e.target as Element)?.closest('.overlay,.modalBackdrop,dialog[open]');if(inModal)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRef.current()}
 if(e.key==='Tab'){const controls=[...ref.current!.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!(el as HTMLButtonElement).disabled&&!el.closest('[inert],[hidden]'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 };document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(sheet){const index=activeSheets.indexOf(sheet);if(index>=0)activeSheets.splice(index,1);layerSheets()}if(before?.isConnected&&(sheet?.contains(document.activeElement)||document.activeElement===document.body))before.focus({preventScroll:true})};},[open,ready]);
 if(!ready)return null;
 return createPortal(<div className={`appContextLayer ${open?'isOpen':''}`} aria-hidden={!open} inert={!open} hidden={!open}>
 <button className="appSheetShade" type="button" tabIndex={-1} onClick={close} aria-label={en?'Close panel':'Cerrar panel'}/>
 <section ref={ref} className="appContextSheet" role="dialog" aria-modal={open?true:undefined} aria-labelledby={id}>
 <header className="appSheetHeader" style={{touchAction:'none'}} onPointerDown={e=>{if(e.pointerType==='mouse'||(e.target as Element).closest('button'))return;start.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{const p=start.current;start.current=null;if(p&&((e.clientY-p.y>65&&Math.abs(e.clientX-p.x)<70)||(e.clientX-p.x>80&&Math.abs(e.clientY-p.y)<60)))close()}} onPointerCancel={()=>{start.current=null}}><div><i aria-hidden="true"/><h2 id={id}>{title}</h2></div><button type="button" className="appSheetClose" onClick={close} aria-label={en?'Close panel':'Cerrar panel'}><X size={20}/></button></header>
 <SheetContext.Provider value={close}><div className="appSheetBody" onClick={e=>{if((e.target as Element).closest('[data-app-dismiss]'))close()}}>{children}</div></SheetContext.Provider>
 </section></div>,document.body);
}
export function AppOptions({title,children,icon=false,summary,closeOnAction=false}:{title:string;children:ReactNode;icon?:boolean;summary?:string;closeOnAction?:boolean}){
 const app=useAppMode(),[open,setOpen]=useState(false);
 if(!Children.toArray(children).length)return null;
 if(!app)return <>{children}</>;
 return <><button type="button" className={`appOptionsTrigger ${icon?'iconOnly':''}`} aria-label={title} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><MoreHorizontal size={20}/>{!icon&&<span>{title}{summary&&<small>{summary}</small>}</span>}</button><AppSheet open={open} title={title} close={()=>setOpen(false)}><div className="appOptionsContent" onClick={e=>{if(closeOnAction&&(e.target as Element).closest('button:not([type=submit])'))setOpen(false)}}>{children}</div></AppSheet></>;
}
export function AppRecord({title,subtitle,meta,badge,children,actions,selecting=false,selected=false,onSelect,defaultOpen=false}:{title:string;subtitle?:ReactNode;meta?:ReactNode;badge?:ReactNode;children:ReactNode;actions?:ReactNode;selecting?:boolean;selected?:boolean;onSelect?:()=>void;defaultOpen?:boolean}){
 const [open,setOpen]=useState(defaultOpen),{language}=useAppPreferences(),en=language==='en';
 useEffect(()=>{if(defaultOpen)setOpen(true)},[defaultOpen]);
 return <article className={`appRecord ${selected?'selected':''}`}>
 {selecting&&onSelect&&<input type="checkbox" aria-label={`${en?'Select':'Seleccionar'} ${title}`} checked={selected} onChange={onSelect}/>}
 <button type="button" className="appRecordSummary" aria-haspopup="dialog" aria-expanded={open} onClick={()=>selecting&&onSelect?onSelect():setOpen(true)}><span className="appRecordText"><b translate="no">{title}</b>{subtitle&&<span>{subtitle}</span>}{meta&&<small>{meta}</small>}</span>{badge&&<span className="appRecordBadge">{badge}</span>}<ChevronRight size={18}/></button>
 <AppSheet open={open} title={title} close={()=>setOpen(false)}><div className="appRecordDetails">{children}</div>{actions&&<div className="appRecordActions" onClick={e=>{if((e.target as Element).closest('button'))setOpen(false)}}>{actions}</div>}</AppSheet>
 </article>;
}
/** Section contents and their input state remain mounted, including when collapsed. */
export function AppSection({title,description,children}:{title:string;description?:string;children:ReactNode}){
 const [open,setOpen]=useState(false),id=useId();
 return <section className="appSettingsSection"><button type="button" className="appSectionTrigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}><span><b>{title}</b>{description&&<small>{description}</small>}</span><ChevronRight size={18}/></button><div id={id} className="appSectionContent" hidden={!open}>{children}</div></section>;
}
export function AppContextPanel({open,title,close,children}:{open:boolean;title:string;close:()=>void;children:ReactNode}){const app=useAppMode();return app?<AppSheet open={open} title={title} close={close}>{children}</AppSheet>:<>{children}</>}
