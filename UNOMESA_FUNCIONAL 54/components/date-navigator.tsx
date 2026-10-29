"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import styles from './date-navigator.module.css';

export function shiftCalendarDay(value:string,delta:number){
 const [y,m,d]=value.split('-').map(Number), date=new Date(y,m-1,d+delta,12);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
type Props={date:string;en?:boolean;caption?:string;detail?:string;disabled?:boolean;min?:string;max?:string;
 onPrevious:()=>void;onNext:()=>void;onChange?:(date:string)=>void;onOpen?:()=>void;onToday?:()=>void};
/** The adjacent days travel with the finger; only a completed gesture commits a date. */
export function DateNavigator(props:Props){
 const {date,en=false,caption,detail,disabled=false,min,max,onChange,onOpen,onToday}=props;
 const viewport=useRef<HTMLDivElement>(null), input=useRef<HTMLInputElement>(null), latest=useRef(props);
 latest.current=props;
 const [offset,setOffset]=useState(0),[settling,setSettling]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),busy=useRef(false),suppress=useRef(0);
 const drag=useRef<{id:number;x:number;y:number;dx:number;locked:boolean}|null>(null);
 const unavailable=()=>latest.current.disabled||!!viewport.current?.closest('[inert]');
 const permitted=(delta:number)=>{const p=latest.current,n=shiftCalendarDay(p.date,delta);return !unavailable()&&!(p.min&&n<p.min)&&!(p.max&&n>p.max)};
 const reset=()=>{drag.current=null;busy.current=false;setSettling(false);setOffset(0);if(timer.current)clearTimeout(timer.current)};
 useLayoutEffect(reset,[date,disabled]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 const settle=(delta:number)=>{
  if(busy.current)return;
  busy.current=true;drag.current=null;setSettling(true);
  const commit=delta!==0&&permitted(delta);
  setOffset(commit?-delta*(viewport.current?.clientWidth||240):0);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  timer.current=setTimeout(()=>{
   if(commit&&permitted(delta)){
    if(delta>0)latest.current.onNext();else latest.current.onPrevious();
   }
   // Also reset when an unsaved-layout confirmation rejects the date change.
   reset();
  },reduce?0:220);
 };
 const locale=en?'en-US':'es-GT';
 const renderDay=(value:string)=>{
  const [y,m,d]=value.split('-').map(Number),day=new Date(y,m-1,d,12);
  return <><small>{new Intl.DateTimeFormat(locale,{weekday:'long'}).format(day)}</small><strong>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(day)}</strong>{detail&&<span>{detail}</span>}</>;
 };
 return <div className={styles.navigator} data-date-navigator="true" data-menu-swipe="off" translate="no" role="group" aria-label={en?'Browse dates':'Navegar fechas'}>
  <div className={styles.heading}><span><CalendarDays size={14}/>{caption||(en?'Date':'Fecha')}</span>{onToday&&<button type="button" disabled={disabled} onClick={()=>{reset();onToday()}}>{en?'Today':'Hoy'}</button>}</div>
  <div className={styles.row}>
   <button type="button" className={styles.arrow} disabled={disabled||!!(min&&shiftCalendarDay(date,-1)<min)} onClick={()=>settle(-1)} aria-label={en?'Previous day':'Día anterior'}><ChevronLeft size={22}/></button>
   <div ref={viewport} className={styles.viewport}
    onPointerDown={e=>{
     if(!e.isPrimary){if(drag.current){suppress.current=Date.now()+500;settle(0)}return}
     if(busy.current||unavailable()||e.button!==0||e.clientX<24||e.clientX>innerWidth-24)return;
     suppress.current=0;
     drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,locked:false};
    }}
    onPointerMove={e=>{
     const g=drag.current;if(!g||e.pointerId!==g.id)return;
     if(unavailable()){reset();return}
     const dx=e.clientX-g.x,dy=e.clientY-g.y;
     if(!g.locked){if(Math.abs(dx)<10&&Math.abs(dy)<10)return;if(Math.abs(dx)<Math.abs(dy)*1.6){drag.current=null;return}g.locked=true;e.currentTarget.setPointerCapture(e.pointerId)}
     e.preventDefault();g.dx=dx;suppress.current=Date.now()+500;
     const width=e.currentTarget.clientWidth;
     setOffset(permitted(dx<0?1:-1)?Math.max(-width,Math.min(width,dx)):dx*.15);
    }}
    onPointerUp={e=>{
     const g=drag.current;if(!g||g.id!==e.pointerId)return;
     drag.current=null;if(!g.locked)return;
     suppress.current=Date.now()+500;
     settle(Math.abs(g.dx)>=Math.min(56,e.currentTarget.clientWidth*.25)?(g.dx<0?1:-1):0);
    }}
    onPointerCancel={()=>{if(drag.current){suppress.current=Date.now()+500;settle(0)}}}
    onLostPointerCapture={e=>{if(e.target===e.currentTarget&&drag.current?.locked)settle(0)}}
    onClickCapture={e=>{if(e.detail!==0&&Date.now()<suppress.current){e.preventDefault();e.stopPropagation()}}}>
    <div className={styles.track} aria-hidden="true" style={{transform:`translate3d(calc(-100% + ${offset}px),0,0)`,transition:settling?'transform 220ms cubic-bezier(.2,.8,.2,1)':'none'}}>
     {[-1,0,1].map(delta=><div className={styles.day} key={delta}>{renderDay(shiftCalendarDay(date,delta))}</div>)}
    </div>
    <button className={styles.calendarTarget} type="button" disabled={disabled} aria-label={`${en?'Choose date':'Elegir fecha'}: ${date}`} onClick={()=>{
     if(onOpen){onOpen();return}const el=input.current;if(!el)return;
     try{el.showPicker()}catch{el.focus();el.click()}
    }}/>
    {onChange&&<input ref={input} className={styles.dateInput} type="date" aria-label={en?'Calendar date':'Fecha del calendario'} tabIndex={-1} value={date} min={min} max={max} disabled={disabled} onChange={e=>{if(e.target.value){reset();onChange(e.target.value)}}}/>}
   </div>
   <button type="button" className={styles.arrow} disabled={disabled||!!(max&&shiftCalendarDay(date,1)>max)} onClick={()=>settle(1)} aria-label={en?'Next day':'Día siguiente'}><ChevronRight size={22}/></button>
  </div>
  <span className={styles.live} aria-live="polite" aria-atomic="true">{date}</span>
 </div>;
}
