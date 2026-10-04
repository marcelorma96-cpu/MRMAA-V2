"use client";
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X,SlidersHorizontal,MoreHorizontal,Plus,CalendarDays,Maximize2,Minimize2,List,ChevronLeft,ChevronRight} from 'lucide-react';
import {DashboardMenuButton} from './dashboard-frame';
import {isAppMode} from '@/lib/app-mode';
export type TouchPanelName='filters'|'agenda'|'tools'|null;
type Context={enabled:boolean;panel:TouchPanelName;open:(panel:TouchPanelName)=>void;en:boolean;agendaFooter?:ReactNode};
export const FloorTouchContext=createContext<Context>({enabled:false,panel:null,open:()=>{},en:false});
export function useTouchFloor(enabled=true){const [touch,setTouch]=useState(false);useEffect(()=>{const media=matchMedia('(max-width:700px), (pointer:coarse)');const read=()=>setTouch(enabled&&(isAppMode()||media.matches));read();media.addEventListener('change',read);return()=>media.removeEventListener('change',read)},[enabled]);return touch;}
export function FloorTouchPanel({name,title,side='right',children}:{name:Exclude<TouchPanelName,null>;title:string;side?:'left'|'right';children:ReactNode}){
 const ctx=useContext(FloorTouchContext),ref=useRef<HTMLElement>(null),id=useId(),start=useRef<{x:number;y:number}|null>(null),open=ctx.enabled&&ctx.panel===name;
 const [expanded,setExpanded]=useState(false),agenda=name==='agenda';
 useEffect(()=>{if(!open)setExpanded(false)},[open]);
 const close=useRef(()=>ctx.open(null));close.current=()=>ctx.open(null);
 useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('.touchPanelClose')?.focus({preventScroll:true});
 const keys=(e:KeyboardEvent)=>{if((e.target as Element)?.closest('.overlay,dialog[open]'))return;if(e.key==='Escape'){e.preventDefault();close.current()}if(e.key==='Tab'&&!agenda){const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length&&!(el as HTMLButtonElement).disabled);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',keys);return()=>{document.removeEventListener('keydown',keys);if(previous?.isConnected)previous.focus({preventScroll:true})};},[open,agenda]);
 if(!ctx.enabled)return <>{children}</>;
 return createPortal(<div className={`floorPlan touchPanelLayer touchPanelLayer-${name} ${open?'isOpen':''} ${expanded?'isExpanded':''}`} aria-hidden={!open} inert={!open}>
  {!agenda&&<button tabIndex={-1} className="touchPanelShade" aria-label={ctx.en?'Close panel':'Cerrar panel'} onClick={()=>ctx.open(null)}/>}
  <section ref={ref} role="dialog" aria-modal={open&&!agenda?true:undefined} aria-labelledby={id} className={`touchPanel touchPanel-${side}`}>
   <header className="touchPanelHandle" style={{touchAction:'none'}} onPointerDown={e=>{if(e.pointerType==='mouse'||(e.target as Element).closest('button'))return;start.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{const a=start.current;start.current=null;if(!a)return;const dx=e.clientX-a.x,dy=e.clientY-a.y;if(agenda&&Math.abs(dy)>55&&Math.abs(dx)<60){if(dy<0)setExpanded(true);else if(expanded)setExpanded(false);else ctx.open(null);return;}if(Math.abs(dy)<70&&(side==='right'?dx>65:dx< -65))ctx.open(null)}} onPointerCancel={()=>{start.current=null}}>
    <div><span className="touchPanelGrip"/><h2 id={id}>{title}</h2></div>{agenda&&<button type="button" className="touchPanelExpand" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?(ctx.en?'Collapse details':'Reducir detalles'):(ctx.en?'Expand details':'Ampliar detalles')}>{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>}<button type="button" className="touchPanelClose" onClick={()=>ctx.open(null)} aria-label={ctx.en?'Back to map':'Volver al plano'}><X size={22}/></button>
   </header>
   <div className="touchPanelBody">{children}</div>
   {name==='agenda'&&ctx.agendaFooter?<div className="touchStickyActions">{ctx.agendaFooter}</div>:<button className="touchReturn" type="button" onClick={()=>ctx.open(null)}>{ctx.en?'Back to map':'Volver al plano'}</button>}
  </section>
 </div>,document.body);
}
export function FloorTouchHeader({restaurant,date,time,onPrevious,onNext,onList,onAgenda,onCreate,disabled,createDisabled,editing,count}:{restaurant:string;date:string;time:string;onPrevious:()=>void;onNext:()=>void;onList?:()=>void;onAgenda?:()=>void;onCreate?:()=>void;disabled:boolean;createDisabled?:boolean;editing:boolean;count:number}){
 const ctx=useContext(FloorTouchContext),say=(a:string,b:string)=>ctx.en?b:a;
 if(!ctx.enabled)return null;
 return <><header className="touchFloorHeader"><DashboardMenuButton/>{onList&&<button type="button" className="touchBackToList" onClick={onList} aria-label={say('Volver al listado','Back to list')}><List size={19}/><span>{say('Listado','List')}</span></button>}<div><small>{restaurant}</small><h2>{editing?say('Editar plano','Edit floor plan'):say('Plano de mesas','Floor plan')}</h2></div><button className="touchAgendaButton" type="button" onClick={()=>onAgenda?onAgenda():ctx.open('agenda')} aria-label={say('Reservaciones','Reservations')}><CalendarDays size={20}/><b>{count}</b></button><button type="button" onClick={()=>ctx.open('tools')} aria-label={say('Opciones del plano','Floor options')}><MoreHorizontal size={22}/></button></header>
 <div className="touchDateBar"><button type="button" disabled={disabled} onClick={onPrevious} aria-label={say('Día anterior','Previous day')}><ChevronLeft size={19}/></button><button className="touchDateChip" onClick={()=>ctx.open('filters')}><CalendarDays size={17}/><b>{date}</b><span>{time}</span><SlidersHorizontal size={16}/></button><button type="button" disabled={disabled} onClick={onNext} aria-label={say('Día siguiente','Next day')}><ChevronRight size={19}/></button></div></>;
}
export function FloorTouchEdges(){const ctx=useContext(FloorTouchContext),start=useRef(0);if(!ctx.enabled)return null;return <>{(['left','right'] as const).map(side=><button key={side} type="button" className={`touchFloorEdge ${side}`} aria-label={side==='left'?(ctx.en?'Date and filters':'Fecha y filtros'):(ctx.en?'Reservations panel':'Panel de reservaciones')} style={{touchAction:'none'}} onClick={()=>ctx.open(side==='left'?'filters':'agenda')} onPointerDown={e=>{e.stopPropagation();start.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{e.stopPropagation();if(Math.abs(e.clientX-start.current)>28)ctx.open(side==='left'?'filters':'agenda')}}><span/></button>)}</>}

export function FloorTouchOverlays({children}:{children:ReactNode}){const ctx=useContext(FloorTouchContext);return ctx.enabled?createPortal(<div className="floorPlan touchModalLayer">{children}</div>,document.body):<>{children}</>;}
