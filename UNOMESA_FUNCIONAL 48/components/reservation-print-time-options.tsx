"use client";
import {useId} from 'react';
import {reservationPrintTimeError,type ReservationPrintTime} from '@/lib/reservation-print-time';
import styles from './reservation-print-time-options.module.css';

export function ReservationPrintTimeOptions({value,onChange,en,disabled=false}:{value:ReservationPrintTime;onChange:(value:ReservationPrintTime)=>void;en:boolean;disabled?:boolean}){
 const id=useId(),say=(es:string,eng:string)=>en?eng:es,error=reservationPrintTimeError(value,en);
 return <fieldset className={styles.timeFilter} disabled={disabled}>
  <legend>{say('Horario de reservaciones','Reservation times')}</legend>
  <div className={styles.choices}>{([['all','Todo','All'],['range','Por horario','By time']] as const).map(([mode,es,eng])=><label key={mode} className={value.mode===mode?'active':''}><input type="radio" name={`${id}-time-scope`} value={mode} checked={value.mode===mode} onChange={()=>onChange({...value,mode})}/><span>{say(es,eng)}</span></label>)}</div>
  {value.mode==='range'&&<><div className={styles.range}>
   <label className={styles.rangeLabel} htmlFor={`${id}-from`}>{say('Desde','From')}<input id={`${id}-from`} type="time" step="60" required value={value.from} aria-describedby={`${id}-help`} aria-invalid={!!error} onChange={e=>onChange({...value,from:e.target.value})}/></label>
   <label className={styles.rangeLabel} htmlFor={`${id}-to`}>{say('Hasta','To')}<input id={`${id}-to`} type="time" step="60" required value={value.to} aria-describedby={`${id}-help`} aria-invalid={!!error} onChange={e=>onChange({...value,to:e.target.value})}/></label>
  </div><small id={`${id}-help`}>{say('Incluye las reservas que comienzan entre ambas horas, en cada fecha seleccionada. Se ordenan por fecha y hora.','Includes reservations starting between both times, on each selected date. Sorted by date and time.')}</small></>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
 </fieldset>;
}
