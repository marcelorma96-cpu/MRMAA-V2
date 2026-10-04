"use client";
import { useEffect, type ComponentProps } from 'react';
import {useRememberedView} from './use-remembered-view';
import { LayoutGrid, List } from 'lucide-react';
import { ReservationsEnhanced } from './reservations-enhanced';
import type { FloorCreateSeed, FloorReservation, EventArea } from '@/lib/floor-plan';
import { FloorPlan } from './floor-plan';
import { useAppPreferences } from './app-preferences';
import { confirmDiscardChanges } from '@/lib/unsaved-changes';
export function ReservationsWorkspace({eventAreas=[],onAreaCreated,canManageLayout=false,onCreateFromFloor,onEditFromFloor,onQuoteFromFloor,onDeleteFromFloor,...props}:ComponentProps<typeof ReservationsEnhanced>&{eventAreas?:EventArea[];onAreaCreated?:(area:EventArea)=>void;canManageLayout?:boolean;onCreateFromFloor?:(seed:FloorCreateSeed)=>void;onEditFromFloor?:(id:string)=>void;onQuoteFromFloor?:(id:string)=>void;onDeleteFromFloor?:(reservation:FloorReservation)=>void}) {
  const {language}=useAppPreferences(),en=language==='en';
  const [view,setView]=useRememberedView(`unomesa:${props.restaurantId}:reservations-view`,['list','floor'] as const,'list');
  useEffect(()=>{if(props.focusedReservationId)setView('list')},[props.focusedReservationId]);
  return <div className="moduleStack">
    <div className="floorViewSwitch" translate="no" role="group" aria-label={en?'Reservation view':'Vista de reservaciones'}>
      <button className={view==='list'?'active':''} onClick={()=>{if(view!=='list'&&confirmDiscardChanges())setView('list')}} aria-pressed={view==='list'}><List size={17}/>{en?'List':'Listado'}</button>
      <button className={view==='floor'?'active':''} onClick={()=>{if(view!=='floor'&&confirmDiscardChanges())setView('floor')}} aria-pressed={view==='floor'}><LayoutGrid size={17}/>{en?'Floor plan':'Plano de mesas'}</button>
    </div>
    {view==='list'?<ReservationsEnhanced {...props}/>:<FloorPlan onBackToList={()=>setView('list')} eventAreas={eventAreas} onAreaCreated={onAreaCreated} onCreate={onCreateFromFloor} onEdit={onEditFromFloor} onQuote={onQuoteFromFloor} onDelete={onDeleteFromFloor} canDelete={!!props.canDelete} openQuote={props.openQuote} key={props.restaurantId} restaurantId={props.restaurantId} restaurantName={props.restaurantName} canEdit={!!props.canEdit} canManageLayout={canManageLayout} preferences={props.preferences} timeFormat={props.preferences?.time_format} refreshToken={props.refreshToken}/>}
  </div>;
}
