'use client';
import {useId} from 'react';
import {eventSearchOptions,type EventSearchField,type EventSearchResource} from '@/lib/event-search';
import styles from './event-search-input.module.css';

export function EventSearchInput({resource,value,onChange,field,onField,en}:{resource:EventSearchResource;value:string;onChange:(value:string)=>void;field:EventSearchField;onField:(field:EventSearchField)=>void;en:boolean}){
 const id=useId(),amount=['deposit','total','balance'].includes(field);
 const placeholder=amount?(en?'Amount, e.g. 500.75':'Monto, ej. 500.75'):field==='event_date'?(en?'DD/MM/YYYY':'DD/MM/AAAA'):field==='event_time'?(en?'19:30 or 7:30 pm':'19:30 o 7:30 pm'):field==='all'?(en?'Customer, phone, deposit…':'Cliente, teléfono, anticipo…'):(en?'Type to search…':'Escriba para buscar…');
 return <div className={styles.search} translate="no">
  <label className={styles.scope}><span>{en?'Search in':'Buscar en'}</span><select value={field} onChange={e=>onField(e.target.value as EventSearchField)}>{eventSearchOptions(resource).map(([key,es,english])=><option key={key} value={key}>{en?english:es}</option>)}</select></label>
  <input id={id} type="search" className={`moduleSearch ${styles.input}`} aria-label={en?'Search '+(resource==='quotes'?'quotes':'reservations'):'Buscar '+(resource==='quotes'?'cotizaciones':'reservaciones')} aria-describedby={field==='deposit'?`${id}-help`:undefined} placeholder={placeholder} value={value} maxLength={150} onChange={e=>onChange(e.target.value)}/>
  {field==='deposit'&&<small id={`${id}-help`} className={styles.help}>{en?'Exact amount, “with deposit” or “without deposit”.':'Monto exacto, “con anticipo” o “sin anticipo”.'}</small>}
 </div>;
}
