"use client";
import {useId,useState} from 'react';
import {Search,X,ChevronDown} from 'lucide-react';
import {useAppPreferences} from './app-preferences';
import {reservationAreaKey} from '@/lib/reservation-area';
import type {EventArea} from '@/lib/floor-plan';
import styles from './event-area-select.module.css';
export function EventAreaSelect({areas,ids,onChange,selectionSummary,previousValue}:{areas:EventArea[];ids:string[];onChange:(areas:EventArea[])=>void;selectionSummary?:string;previousValue?:string}){
 const {language}=useAppPreferences(),en=language==='en',id=useId(),[search,setSearch]=useState('');
 const selected=ids.map(id=>areas.find(a=>a.id===id)).filter((a):a is EventArea=>!!a),missing=ids.filter(id=>!areas.some(a=>a.id===id));
 const terms=reservationAreaKey(search).split(' ').filter(Boolean),filtered=areas.filter(a=>terms.every(t=>reservationAreaKey(a.name).includes(t)));
 const toggle=(a:EventArea)=>onChange(ids.includes(a.id)?selected.filter(v=>v.id!==a.id):[...selected,a]);
 return <div className={`field ${styles.field}`} translate="no">
 <span className={styles.label} id={id}>{en?'Areas':'Áreas'}</span>
 <details className={styles.picker}><summary aria-labelledby={id}><span>{selected.length?selected.map(a=>a.name).join(' + '):en?'Select one or more areas':'Seleccionar una o varias áreas'}</span><ChevronDown size={18}/></summary>
 <div className={styles.choices}><label className={styles.search}><Search size={17}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={en?'Search areas…':'Buscar áreas…'} aria-label={en?'Search areas':'Buscar áreas'}/></label>
 <div className={styles.options} role="group" aria-label={en?'Available areas':'Áreas disponibles'}>{filtered.map(a=><label key={a.id}><input type="checkbox" checked={ids.includes(a.id)} onChange={()=>toggle(a)}/><span>{a.name}</span></label>)}{!filtered.length&&<p>{en?'No matching areas.':'No hay áreas coincidentes.'}</p>}</div></div></details>
 <div className={styles.selected}>{selected.map(a=><button key={a.id} type="button" aria-label={`${en?'Remove':'Quitar'} ${a.name}`} onClick={()=>toggle(a)}>{a.name}<X size={14}/></button>)}</div>
 <small>{selected.length>1?(en?'These entire areas will be reserved together for the same group.':'Estas áreas completas se reservarán juntas para el mismo grupo.'):(en?'You can select several areas for a larger group.':'Puede seleccionar varias áreas para un grupo grande.')}</small>
 {!!selected.length&&<button type="button" className="quoteAreaUnassigned" onClick={()=>onChange([])}>{en?'No table or area':'Sin mesa ni área'}</button>}
 {!!missing.length&&<p role="alert">{en?'An area is no longer available. Review the selection.':'Un área ya no está disponible. Revise la selección.'}</p>}
 {!selected.length&&previousValue&&<small>{en?'Previous area':'Área anterior'}: {previousValue}</small>}
 {selectionSummary&&<div className="quoteAreaSeatingSummary" role="status">{selectionSummary}</div>}
 </div>
}
