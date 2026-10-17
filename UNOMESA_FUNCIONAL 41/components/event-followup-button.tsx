"use client";
import {ListChecks} from 'lucide-react';
import {openEventFollowup,type EventTarget} from '@/lib/event-followup';
import styles from './event-followup.module.css';
export function EventFollowupButton({restaurantId,target=null,en=false,header=false}:{restaurantId:string;target?:EventTarget|null;en?:boolean;header?:boolean}){
 const label=target?(en?'Pending items':'Pendientes'):(en?'Reminders':'Recordatorios');
 return <button type="button" className={`${styles.trigger} ${header?styles.headerTrigger:''}`} aria-label={label} title={label} translate="no" onClick={()=>openEventFollowup(restaurantId,target)}><ListChecks aria-hidden="true"/><span>{label}</span></button>;
}
