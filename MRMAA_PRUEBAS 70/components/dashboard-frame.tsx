"use client";
import {createContext,useContext,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {PanelLeftClose,PanelLeftOpen,X} from 'lucide-react';
type Position={x:number;y:number;anchor:Element|null;top:number;maps:{el:HTMLElement;x:number;y:number}[]};
const MenuContext=createContext<{hidden:boolean;en:boolean;id:string;toggle:()=>void;button:React.RefObject<HTMLButtonElement|null>}|null>(null);

/** Changes layout only; children stay mounted, including map gestures and unsaved drafts. */
export function DashboardFrame({sidebar,children,en,preferenceKey}:{sidebar:ReactNode;children:ReactNode;en:boolean;preferenceKey:string}){
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),aside=useRef<HTMLElement>(null),pending=useRef<Position|null>(null),id=useId();
 const [compact,setCompact]=useState(false),[hidden,setHidden]=useState(false);
 useLayoutEffect(()=>{
  const media=matchMedia('(max-width:850px)');
  const read=()=>{const small=media.matches;let value=small;try{const saved=localStorage.getItem(`${preferenceKey}:${small?'compact':'wide'}`);if(saved==='hidden'||saved==='visible')value=saved==='hidden';}catch{}setCompact(small);setHidden(value)};
  read();media.addEventListener('change',read);return()=>media.removeEventListener('change',read);
 },[preferenceKey]);
 function choose(value:boolean){
  const shell=root.current,main=shell?.querySelector('main');if(!shell||!main)return;
  const map=Array.from(main.querySelectorAll<HTMLElement>('.mapViewport')).find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.top<innerHeight&&r.bottom>100});
  const bounds=main.getBoundingClientRect(),at=document.elementFromPoint(Math.min(innerWidth-20,Math.max(20,bounds.left+bounds.width*.6)),Math.min(140,innerHeight*.25));
  const anchor=map||(at&&main.contains(at)&&!at.closest('.dashboardMenuBar')?at:null);
  pending.current={x:scrollX,y:scrollY,anchor,top:anchor?.getBoundingClientRect().top||0,maps:Array.from(main.querySelectorAll<HTMLElement>('.mapViewport')).filter(el=>el.clientWidth>0&&el.clientHeight>0).map(el=>({el,x:(el.scrollLeft+el.clientWidth/2)/el.scrollWidth,y:(el.scrollTop+el.clientHeight/2)/el.scrollHeight}))};
  shell.dataset.menuResizing='true';setHidden(value);
  try{localStorage.setItem(`${preferenceKey}:${compact?'compact':'wide'}`,value?'hidden':'visible')}catch{}
 }
 useLayoutEffect(()=>{
  const position=pending.current;pending.current=null;
  if(position){for(const m of position.maps)m.el.scrollTo({left:m.x*m.el.scrollWidth-m.el.clientWidth/2,top:m.y*m.el.scrollHeight-m.el.clientHeight/2,behavior:'instant'});
   const delta=position.anchor?.isConnected?position.anchor.getBoundingClientRect().top-position.top:0;
   window.scrollTo({left:position.x,top:position.y+delta,behavior:'instant'});
   if(compact){if(hidden)button.current?.focus({preventScroll:true});else aside.current?.querySelector<HTMLButtonElement>('.dashboardDrawerClose')?.focus({preventScroll:true})}
   requestAnimationFrame(()=>{root.current?.removeAttribute('data-menu-resizing')});
  }
  const main=root.current?.querySelector('main');if(main)main.inert=compact&&!hidden;
  return()=>{if(main)main.inert=false};
 },[hidden,compact]);
 useLayoutEffect(()=>{if(!compact||hidden)return;const original=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=original}},[compact,hidden]);
 const context={hidden,en,id,toggle:()=>choose(!hidden),button};
 return <MenuContext.Provider value={context}><div ref={root} className={`shell dashboardRefined dashboardFrame ${hidden?'sidebarHidden':''}`} onKeyDown={e=>{
  if(!compact||hidden)return;
  if(e.key==='Escape'){e.preventDefault();choose(true)}
  if(e.key==='Tab'){const nodes=Array.from(aside.current?.querySelectorAll<HTMLElement>('button,a[href],summary,input,select,[tabindex="0"]')||[]).filter(el=>el.getClientRects().length&&!(el as HTMLButtonElement).disabled);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 }}>
  {compact&&!hidden&&<button className="dashboardMenuShade" type="button" tabIndex={-1} aria-label={en?'Close menu':'Cerrar menú'} onClick={()=>choose(true)}/>}
  <aside ref={aside} id={id} className="dashboardSidebar" aria-label={en?'Main menu':'Menú principal'} inert={hidden} onClick={e=>{if(compact&&(e.target as Element).closest('nav button'))choose(true)}}>
   <button type="button" className="dashboardDrawerClose" onClick={()=>choose(true)} translate="no"><X size={18}/>{en?'Close menu':'Cerrar menú'}</button>{sidebar}
  </aside>
  {children}
 </div></MenuContext.Provider>;
}
export function DashboardMenuButton(){
 const menu=useContext(MenuContext);if(!menu)return null;
 const label=menu.hidden?(menu.en?'Show menu':'Mostrar menú'):(menu.en?'Hide menu':'Ocultar menú');
 return <div className="dashboardMenuBar" translate="no"><button type="button" ref={menu.button} className="dashboardMenuToggle" onClick={menu.toggle} aria-controls={menu.id} aria-expanded={!menu.hidden} title={label}>{menu.hidden?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}<span>{label}</span></button></div>;
}
