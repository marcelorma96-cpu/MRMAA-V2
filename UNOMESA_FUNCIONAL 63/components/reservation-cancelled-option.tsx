"use client";
import styles from './reservation-print-time-options.module.css';

export function ReservationCancelledOption({exclude,onChange,en,disabled=false}:{exclude:boolean;onChange:(value:boolean)=>void;en:boolean;disabled?:boolean}){
 return <label className={styles.cancelled}><input type="checkbox" checked={exclude} disabled={disabled} onChange={e=>onChange(e.target.checked)}/><span>{en?'Exclude canceled reservations':'Excluir reservaciones canceladas'}</span></label>;
}
