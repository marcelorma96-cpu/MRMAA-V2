"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,ChevronRight,FileText,Search,UserRound} from 'lucide-react';
import {Modal} from './dashboard-ui';
import {formatAppMoney} from './app-preferences';
import {formatEventTime} from '@/lib/local-date';
import {translate} from '@/lib/translations';
import {supabase} from '@/lib/supabase';
import {matchKey,readWorkspaceMatches,searchReady,type WorkspaceMatch} from '@/lib/workspace-search';
import styles from './workspace-search.module.css';

type Props={branch:string;en:boolean;timeFormat?:unknown;onReservation:(id:string,date:string)=>void;onQuote:(id:string)=>void};
function label(m:WorkspaceMatch){return m.kind==='customer'?m.c.name:m.kind==='quote'?m.q.client_name:m.r.client_name}
function SearchPanel({branch,en,timeFormat,onReservation,onQuote,close,recent,remember}:Props&{close:()=>void;recent:string[];remember:(q:string)=>void}){
 const [text,setText]=useState(''),[attempt,retry]=useState(0),[detail,setDetail]=useState<WorkspaceMatch|null>(null);
 const [view,setView]=useState<{key:string;rows:WorkspaceMatch[];more:boolean;failed:boolean}|null>(null);
 const input=useRef<HTMLInputElement>(null),lastRow=useRef<string|null>(null);
 const bindInput=useCallback((node:HTMLInputElement|null)=>{input.current=node;if(node&&!lastRow.current)node.focus({preventScroll:true})},[]);
 const term=text.trim(),valid=searchReady(term),key=JSON.stringify([branch,term,attempt]),current=view?.key===key?view:null;
 useEffect(()=>{if(!valid)return;const ctrl=new AbortController();const timer=setTimeout(()=>{
  readWorkspaceMatches(supabase,branch,term,ctrl.signal).then(data=>{if(!ctrl.signal.aborted)setView({key,...data,failed:false})}).catch(()=>{if(!ctrl.signal.aborted)setView({key,rows:[],more:false,failed:true})});
 },220);return()=>{clearTimeout(timer);ctrl.abort()}},[branch,term,valid,key]);
 const word=(es:string,eng:string)=>en?eng:es;
 const kind=(m:WorkspaceMatch)=>m.kind==='customer'?word('Cliente','Customer'):m.kind==='quote'?word('Cotización','Quote')+' #'+m.q.quote_number:m.q?word('Reservación · Cotización','Reservation · Quote')+' #'+m.q.quote_number:word('Reservación','Reservation');
 const when=(s:string|null|undefined)=>!s?'—':(en?s:s.split('-').reverse().join('/'));
 function subtitle(m:WorkspaceMatch){if(m.kind==='customer')return m.c.phone||m.c.email||'';const r=m.kind==='quote'?m.q:m.r;return [when(r.event_date),formatEventTime(r.event_time,timeFormat,''),r.area].filter(Boolean).join(' · ')}
 function describe(m:WorkspaceMatch){
  if(m.kind==='customer')return [[word('Teléfono','Phone'),m.c.phone],[word('Correo','Email'),m.c.email]];
  const r=m.kind==='quote'?m.q:m.r;
  return [[word('Fecha y hora','Date and time'),[when(r.event_date),formatEventTime(r.event_time,timeFormat,'')].filter(Boolean).join(' · ')],[word('Área','Area'),r.area],[word('Personas','Guests'),r.guests==null?'':String(r.guests)],[word('Teléfono','Phone'),m.kind==='quote'?m.q.client_phone:m.r.phone],[word('Estado','Status'),r.status?translate(r.status,en?'en':'es'):''],[word('Anticipo recibido','Deposit received'),r.deposit==null?'':formatAppMoney(Number(r.deposit))]];
 }
 return <Modal title={word('Buscar en UnoMesa','Search UnoMesa')} close={close}>
 <div className={styles.panel} translate="no">
 {!detail?<><label className={styles.field}><Search aria-hidden size={18}/><input ref={bindInput} type="search" maxLength={96} value={text} onChange={e=>setText(e.target.value)} placeholder={word('Nombre, teléfono o # de cotización','Name, phone or quote #')} aria-label={word('Nombre, teléfono o número de cotización','Name, phone or quote number')}/></label>
 {!valid?<><p className={styles.hint}>{word('Busca en las reservaciones, cotizaciones y clientes de esta sucursal, de cualquier fecha.','Search reservations, quotes and customers at this location, across all dates.')}</p>
 {!!recent.length&&<div className={styles.recent}><small>{word('Búsquedas recientes','Recent searches')}</small>{recent.map(q=><button key={q} type="button" onClick={()=>{setText(q);input.current?.focus({preventScroll:true})}}>{q}</button>)}</div>}</>:!current?<p role="status" className={styles.hint}>{word('Buscando…','Searching…')}</p>:current.failed?<p role="alert">{word('No se pudo completar la búsqueda.','Could not complete the search.')} <button type="button" onClick={()=>retry(n=>n+1)}>{word('Reintentar','Retry')}</button></p>:<>
 <p className={styles.hint} role="status">{current.rows.length?word('Resultados','Results'):word('Sin coincidencias. Prueba con otro nombre, teléfono o número.','No matches. Try a different name, phone or number.')}</p>
 {current.rows.map(m=>{const Icon=m.kind==='customer'?UserRound:m.kind==='reservation'?CalendarDays:FileText;return <button className={styles.result} key={matchKey(m)} ref={el=>{if(el&&lastRow.current===matchKey(m)){el.focus({preventScroll:true});lastRow.current=null}}} type="button" onClick={()=>{remember(term);lastRow.current=matchKey(m);setDetail(m)}}><Icon size={18} aria-hidden/><span><small>{kind(m)}</small><strong>{label(m)}</strong><small>{subtitle(m)}</small></span><ChevronRight size={16} aria-hidden/></button>})}
 {current.more&&<small>{word('Para ver coincidencias más específicas, escribe un poco más.','Type more to narrow down the matches.')}</small>}</>}</>:<>
 <button type="button" className={styles.back} ref={el=>{if(el&&document.activeElement===document.body)el.focus({preventScroll:true})}} onClick={()=>setDetail(null)}><ArrowLeft size={16}/>{word('Resultados','Results')}</button>
 <small>{kind(detail)}</small><h3>{label(detail)}</h3><dl>{describe(detail).filter(([,v])=>!!v).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
 {detail.kind!=='customer'&&<div className={styles.actions}>{detail.kind==='reservation'&&<button type="button" onClick={()=>{close();onReservation(detail.r.id,detail.r.event_date)}}>{word('Abrir reservación','Open reservation')}</button>}{detail.q&&<button type="button" onClick={()=>{const q=detail.q; if(q){close();onQuote(q.id)}}}>{word('Ver cotización','View quote')} #{detail.q.quote_number}</button>}</div>}
 </>}</div></Modal>;
}
export function WorkspaceSearch(props:Props){
 const [open,setOpen]=useState(false),[recent,setRecent]=useState<string[]>([]);
 const trigger=useRef<HTMLButtonElement>(null),wasOpen=useRef(false);
 useLayoutEffect(()=>{if(wasOpen.current&&!open&&!document.querySelector('[role="dialog"][aria-modal="true"]'))trigger.current?.focus({preventScroll:true});wasOpen.current=open},[open]);
 const title=props.en?'Search UnoMesa':'Buscar en UnoMesa';
 return <><button type="button" className={styles.trigger} ref={trigger} aria-label={title} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Search size={19} aria-hidden/><span>{title}</span></button>
 {open&&<SearchPanel {...props} close={()=>setOpen(false)} recent={recent} remember={q=>setRecent(prev=>[q,...prev.filter(t=>t!==q)].slice(0,4))}/>}</>;
}
