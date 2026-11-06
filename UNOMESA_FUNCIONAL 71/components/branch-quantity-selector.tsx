'use client';
import {useId} from 'react';
import {parseBranchQuantity} from '@/lib/branches';
import styles from './branch-quantity-selector.module.css';

export function BranchQuantitySelector({value,onChange,en,disabled=false}:{value:string;onChange:(value:string)=>void;en:boolean;disabled?:boolean}){
 const id=useId(),count=parseBranchQuantity(value);
 const label=en?'Total locations':'Total de sucursales';
 function step(delta:number){onChange(String(Math.min(10000,Math.max(1,(count??0)+delta))));}
 return <fieldset className={styles.picker} disabled={disabled}>
  <legend className={styles.legend}>{label}</legend>
  <div className={styles.shortcuts} role="group" aria-label={en?'Quick selection':'Selección rápida'}>
   {[1,2,3,4].map(n=><button key={n} type="button" className={styles.shortcut} aria-label={en?`${n} ${n===1?'location':'locations'}`:`${n} ${n===1?'sucursal':'sucursales'}`} aria-pressed={count===n} onClick={()=>onChange(String(n))}>{n}</button>)}
  </div>
  <div className={styles.stepper}>
   <button type="button" className={styles.step} disabled={disabled||count===1} aria-label={en?'One fewer location':'Una sucursal menos'} onClick={()=>step(-1)}>−</button>
   <input id={id} className={styles.input} aria-label={label} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={value} onChange={event=>onChange(event.target.value)} onFocus={event=>event.target.select()} aria-invalid={count===null} aria-describedby={`${id}-help${count===null?` ${id}-error`:''}`}/>
   <button type="button" className={styles.step} disabled={disabled||count===10000} aria-label={en?'One more location':'Una sucursal más'} onClick={()=>step(1)}>+</button>
  </div>
  <p id={`${id}-help`} className={styles.help}>{en?'Includes the main location. Use − / + or type any quantity.':'Incluye la principal. Use − / + o escriba la cantidad que necesite.'}</p>
  {count===null&&<p id={`${id}-error`} className={styles.error} role="status">{en?'Enter a whole number from 1 to 10,000.':'Ingrese un número entero de 1 a 10,000.'}</p>}
 </fieldset>;
}
