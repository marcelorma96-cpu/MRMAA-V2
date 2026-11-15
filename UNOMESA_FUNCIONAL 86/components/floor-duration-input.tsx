"use client";
import {useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {saveFloorDuration} from '@/lib/floor-duration';
import {floorError,type FloorData} from '@/lib/floor-plan';
import {floorDefaultDuration,validFloorDuration} from '@/lib/restaurant-map';
export function FloorDurationInput({restaurantId,date,data,value,onChange,onSaved,onBusy,canRemember,en,disabled=false,demo=false}:{restaurantId:string;date:string;data:FloorData;value:number;onChange:(n:number)=>void;onSaved:(data:FloorData)=>void;onBusy?:(busy:boolean)=>void;canRemember:boolean;en:boolean;disabled?:boolean;demo?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),lock=useRef(false),changed=useRef(false);
 async function remember(){
  if(!changed.current||!canRemember||lock.current)return;
  if(!validFloorDuration(value)){setError(en?'Use 15–1,440 whole minutes.':'Use entre 15 y 1,440 minutos enteros.');return;}
  if(value===floorDefaultDuration(data.layout)){changed.current=false;return;}
  lock.current=true;setBusy(true);onBusy?.(true);setError('');
  try{const next=demo?{...data,layout:{...data.layout,defaultDurationMinutes:value}}:await saveFloorDuration(supabase,restaurantId,date,value);onSaved(next);changed.current=false;setSaved(true)}
  catch(e){setError(floorError(e,en))}finally{lock.current=false;setBusy(false);onBusy?.(false)}
 }
 return <div className="floorDurationField"><label>{en?'Duration (min)':'Duración (min)'}<input type="number" min={15} max={1440} step={15} value={value} disabled={disabled||busy} onChange={e=>{changed.current=true;setSaved(false);onChange(Number(e.target.value))}} onBlur={()=>void remember()}/></label>{canRemember&&<small role="status">{busy?(en?'Saving default…':'Guardando duración…'):saved?(en?'Saved for new reservations':'Guardada para nuevas reservas'):(en?'Changes become the default for new reservations.':'Al cambiarla se recuerda para nuevas reservas.')}</small>}{error&&<div className="floorWarning" role="alert">{error}<button type="button" className="secondary" disabled={busy} onClick={()=>void remember()}>{en?'Retry':'Reintentar'}</button></div>}</div>;
}
