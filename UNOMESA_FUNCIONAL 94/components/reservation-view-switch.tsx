"use client";
import {LayoutGrid,List} from 'lucide-react';

/** The same explicit destinations in both reservation views. */
export function ReservationViewSwitch({view,en,onChange}:{view:'list'|'floor';en:boolean;onChange:(view:'list'|'floor')=>void}){
 return <div className="floorViewSwitch" translate="no" role="group" aria-label={en?'Reservation view':'Vista de reservaciones'}>
  <button type="button" className={view==='list'?'active':''} aria-pressed={view==='list'} onClick={()=>{if(view!=='list')onChange('list')}}><List size={17}/>{en?'List':'Listado'}</button>
  <button type="button" className={view==='floor'?'active':''} aria-pressed={view==='floor'} onClick={()=>{if(view!=='floor')onChange('floor')}}><LayoutGrid size={17}/>{en?'Map':'Mapa'}</button>
 </div>;
}
