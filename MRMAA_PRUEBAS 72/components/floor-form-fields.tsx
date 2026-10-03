"use client";
import {floorAreaBounds,floorAreaViewport} from '@/lib/floor-area-bounds';
import {floorTableName} from '@/lib/floor-table-label';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Eraser,LayoutGrid} from 'lucide-react';
import {useDataRefresh} from './restaurant-sync';
import {useRememberedView} from './use-remembered-view';
import {supabase} from '@/lib/supabase';
import {useAppPreferences} from './app-preferences';
import {useUnsavedChanges} from '@/lib/unsaved-changes';
import {conflicts,defaultFloorSelection,emptyFloor,floorError,missingFloorFunction,seatingTables,floorEventArea,floorAreaForEvent,selectionArea,selectFloorArea,toggleFloorTable,type EventArea,type FloorData,type FloorFormState,type FloorSelection} from '@/lib/floor-plan';
import {FloorTableGraphic} from './floor-table-graphic';
import {floorAreaLabel} from '@/lib/floor-area-label';
import {floorDefaultDuration} from '@/lib/restaurant-map';
import {FloorDurationInput} from './floor-duration-input';
import {formatEventTime} from '@/lib/local-date';
import {floorWithCatalog} from '@/lib/floor-area-sync';
export function FloorFormFields({restaurantId,reservationId,quoteId,date,time,guests,kind,initial,timeFormat,onState,eventAreas,eventArea,eventAreaId,onAreaChange,clearAreaRequest=0,canManageDefault=false}: {
 restaurantId:string;reservationId?:string|null;quoteId?:string|null;date:string;time:string;guests:number;kind:'reservation'|'quote';initial?:FloorSelection;timeFormat?:string;onState:(value:FloorFormState)=>void;
 clearAreaRequest?:number;canManageDefault?:boolean;eventAreas:EventArea[];eventArea:string;eventAreaId?:string;onAreaChange:(area:EventArea)=>void;
}){
 const {language}=useAppPreferences(),en=language==='en',copy=(es:string,eng:string)=>en?eng:es;
 const [storedData,setData]=useState<FloorData>(emptyFloor),[selection,setSelection]=useState<FloorSelection>(initial||defaultFloorSelection());
 const data=useMemo(()=>floorWithCatalog(storedData,eventAreas),[storedData,eventAreas]);
 const [baseline,setBaseline]=useState(JSON.stringify(initial||defaultFloorSelection())),[ready,setReady]=useState(false),[installed,setInstalled]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[hydrated,setHydrated]=useState(false),[linkedId,setLinkedId]=useState(reservationId||null),[proposal,setProposal]=useState(kind==='quote'&&!reservationId);
 const dataVersion=useDataRefresh(restaurantId,'v2_reservations,v2_quotes,v2_reservation_areas');
 const needsDefault=useRef(false),needsAreaReservation=useRef(false);
 const [durationSaving,setDurationSaving]=useState(false);
 const callbacks=useRef({onState,onAreaChange});callbacks.current={onState,onAreaChange};
 const selectionRef=useRef(selection);selectionRef.current=selection;
 const [view,setView]=useRememberedView(`unomesa:${restaurantId}:event-table-view`,['map','list'] as const,'map');
 const syncedArea=useRef<string|null>(null);
 const lastClearAreaRequest=useRef(0);
 const clearDraft=useUnsavedChanges(JSON.stringify(selection)!==baseline,()=>setSelection(JSON.parse(baseline)));
 useEffect(()=>{const c=new AbortController();setReady(false);setError('');syncedArea.current=null;callbacks.current.onState({ready:false,installed:false,value:null});
 (async()=>{
  const form=await supabase.rpc('v2_floor_form',{p_restaurant:restaurantId,p_reservation:reservationId||null,p_quote:quoteId||null}).abortSignal(c.signal);
  if(c.signal.aborted)return;
  if(form.error){if(missingFloorFunction(form.error,'v2_floor_form')){setInstalled(false);setReady(!initial);if(initial)setError(copy('Aplique el SQL 44 en el proyecto Supabase conectado a UnoMesa para guardar esta asignación.','Apply SQL 44 in the Supabase project connected to UnoMesa to save this assignment.'));return;}throw form.error;}
  setInstalled(true);setLinkedId(form.data.reservation_id);setProposal(kind==='quote'&&!form.data.reservation_id);
  needsAreaReservation.current=!!form.data.reservation_id&&!initial&&!Array.isArray(form.data.selection?.table_ids);
  needsDefault.current=!initial&&typeof form.data.selection?.duration_minutes!=='number';
  const value={...defaultFloorSelection(),...form.data.selection,...(initial||{}),source:form.data.source};
  setSelection(value);setBaseline(JSON.stringify(value));setHydrated(true);
 })().catch(e=>{if(!c.signal.aborted)setError(floorError(e,en))});return()=>c.abort();
 },[restaurantId,reservationId,quoteId,retry]);
 useEffect(()=>{
  if(!installed||!hydrated)return;const c=new AbortController();setReady(false);setError('');
  if(!date){setError(copy('Seleccione fecha para consultar las mesas.','Choose a date to check tables.'));return;}
  (async()=>{const result=await supabase.rpc('v2_floor_read',{p_restaurant_id:restaurantId,p_date:date}).abortSignal(c.signal);if(c.signal.aborted)return;if(result.error)throw result.error;setData(result.data);if(needsDefault.current){needsDefault.current=false;setSelection(previous=>{const next={...previous,duration_minutes:floorDefaultDuration(result.data.layout),plan_revision:result.data.revision};setBaseline(JSON.stringify(next));return next})}setReady(true);})().catch(e=>{if(!c.signal.aborted)setError(floorError(e,en))});
  return()=>c.abort();
 },[installed,hydrated,restaurantId,date,retry,dataVersion]);
 const activeArea=floorAreaForEvent(data.layout,eventAreas,eventAreaId||'',eventArea);
 const ids=seatingTables(selection,data.layout),capacity=data.layout.tables.filter(t=>ids.includes(t.id)).reduce((v,t)=>v+t.seats,0);
 const chosenArea=selectionArea(selection,data.layout),chosenEventArea=floorEventArea(chosenArea,eventAreas);
 const areaMismatch=ids.length>0&&(!chosenEventArea||chosenEventArea.id!==eventAreaId);
 useEffect(()=>{
  if(!ready||!installed)return;
  if(clearAreaRequest)needsAreaReservation.current=false;
  if(needsAreaReservation.current){
   const existing=data.seatings.find(s=>s.reservation_id===linkedId&&s.inferred_from_area);
   if(existing){needsAreaReservation.current=false;setSelection(current=>{const next={...current,table_ids:existing.table_ids,whole_area_id:existing.whole_area_id,duration_minutes:existing.duration_minutes};selectionRef.current=next;setBaseline(JSON.stringify(next));return next});}
  }
  if(clearAreaRequest!==lastClearAreaRequest.current){
   lastClearAreaRequest.current=clearAreaRequest;
   syncedArea.current=JSON.stringify(['','']);
   setSelection(current=>{const next={...current,table_ids:[],whole_area_id:null};selectionRef.current=next;return next});
   return;
  }
  const key=JSON.stringify([eventAreaId||'',eventArea]);
  if(syncedArea.current===null){
   const saved=floorEventArea(selectionArea(selectionRef.current,data.layout),eventAreas);
   syncedArea.current=saved?JSON.stringify([saved.id,saved.name]):key;
   if(saved&&(saved.id!==eventAreaId||saved.name!==eventArea))callbacks.current.onAreaChange(saved);
   return;
  }
  // Searching an area temporarily clears its ID; wait for the user's choice.
  if(syncedArea.current===key||!eventAreaId)return;
  syncedArea.current=key;
  setSelection(s=>selectFloorArea(s,data.layout,activeArea?.id||'',!!s.whole_area_id));
 },[ready,installed,data.layout,eventAreas,eventAreaId,eventArea,activeArea?.id,clearAreaRequest,linkedId,data.seatings]);
 const summaryArea=chosenEventArea||floorEventArea(activeArea,eventAreas);
 const areaSummaryLabel=summaryArea?(ids.length?floorAreaLabel(summaryArea.name,selection,data.layout,en):`${summaryArea.name} - ${copy('Salón completo','Entire room')}`):'';
 useLayoutEffect(()=>{callbacks.current.onState({ready:ready&&!areaMismatch&&!durationSaving,installed,value:installed?selection:null,areaSummary:ready&&installed&&summaryArea&&areaSummaryLabel?{areaId:summaryArea.id,label:areaSummaryLabel}:undefined})},[ready,installed,selection,areaMismatch,durationSaving,areaSummaryLabel,summaryArea?.id]);
 const areaTables=data.layout.tables.filter(t=>t.areaId===activeArea?.id);
 const areaBounds=floorAreaBounds(areaTables),mapBounds=floorAreaViewport(areaBounds,true);
 const booked=conflicts(data,ids,date,time,selection.duration_minutes,linkedId||undefined);
 function change(update:FloorSelection|((current:FloorSelection)=>FloorSelection)){needsAreaReservation.current=false;const value=typeof update==='function'?update(selectionRef.current):update;selectionRef.current=value;setSelection(value);const mapped=floorEventArea(selectionArea(value,data.layout),eventAreas);if(mapped){syncedArea.current=JSON.stringify([mapped.id,mapped.name]);if(mapped.id!==eventAreaId||mapped.name!==eventArea)callbacks.current.onAreaChange(mapped);}}
 function toggleTable(id:string){change(current=>toggleFloorTable(current,data.layout,id));}
 function refresh(){if(JSON.stringify(selection)!==baseline&&!window.confirm(copy('¿Descartar la selección pendiente y recargar las mesas?','Discard the pending selection and reload tables?')))return;clearDraft();setHydrated(false);setRetry(v=>v+1);}
 return <section className="floorFormFields" translate="no" aria-label={copy('Mesas del evento','Event tables')}>
  <div className="floorFormHeading"><div><h3>{proposal?copy('Propuesta de mesas','Proposed tables'):copy('Mesas de la reservación','Reservation tables')}</h3><p>{proposal?copy('La propuesta se confirma al convertir o vincular la cotización. No bloquea disponibilidad.','The proposal is confirmed when converting or linking the quote. It does not block availability.'):copy('El área de arriba y estas mesas forman una sola selección.','The area above and these tables are one selection.')}</p></div><button type="button" className="secondary" onClick={refresh}>{copy('Actualizar mesas','Refresh tables')}</button></div>
  {error&&<p role="alert" className="floorWarning">{error}</p>}
  {!installed&&ready?<p>{copy('Para asignar mesas desde este formulario, aplique 43 y 44 en el proyecto Supabase conectado a UnoMesa. Puede guardar el evento sin mesas.','To assign tables in this form, apply 43 and 44 in the Supabase project connected to UnoMesa. You can save the event without tables.')}</p>:!ready?<p role="status">{error?'':copy('Consultando mesas…','Checking tables…')}</p>:<>
   {areaMismatch&&<p role="alert" className="floorWarning">{copy('Vincule el salón con su área del formulario en Editar plano, o seleccione un área y sus mesas antes de guardar.','Link the room to its form area in Edit floor plan, or choose an area and its tables before saving.')}</p>}
   {!activeArea?<p className="floorNoArea">{copy('Sin mesa ni área. Puede guardar así y asignarlas después. Para elegir mesas, seleccione un área arriba.','No table or area. Save now and assign them later. To choose tables, select an area above.')}</p>:!areaTables.length?<p className="floorEmptyRoom">{copy('Esta área todavía no tiene mesas configuradas. La reservación ocupa el salón completo en su horario. Puede agregar mesas después desde Editar plano.','This area has no tables configured yet. The reservation occupies the entire room during its time slot. Add tables later in Edit floor plan.')}</p>:<>
    <div className="floorSelectionMode" role="group" aria-label={copy('Tipo de selección','Selection type')}><button type="button" className="secondary" aria-pressed={!selection.whole_area_id} onClick={()=>change(current=>({...current,whole_area_id:null,table_ids:seatingTables(current,data.layout)}))}>{copy('Mesas individuales','Individual tables')}</button><button type="button" className="secondary" aria-pressed={!!selection.whole_area_id} disabled={!data.layout.tables.some(t=>t.areaId===activeArea.id)} onClick={()=>change(current=>selectFloorArea(current,data.layout,activeArea.id,true))}>{copy('Salón completo','Entire room')}</button></div>
    <div className="floorFormView" role="group" aria-label={copy('Vista de mesas','Table view')}><button type="button" aria-pressed={view==='map'} onClick={()=>setView('map')}>{copy('Plano','Map')}</button><button type="button" aria-pressed={view==='list'} onClick={()=>setView('list')}>{copy('Lista','List')}</button><span>{activeArea.name}</span></div>
    {<div className="floorFormMap" hidden={view!=='map'}><svg viewBox={`${mapBounds.x} ${mapBounds.y} ${mapBounds.width} ${mapBounds.height}`} style={{minWidth:Math.min(520,mapBounds.width)}} aria-label={copy('Mesas del área seleccionada','Tables in selected area')}><rect data-area-contour={activeArea?.id} {...areaBounds} rx="16" fill="none" stroke="#b9c8cc" strokeWidth="3"/>{areaTables.map(t=>{const taken=conflicts(data,[t.id],date,time,selection.duration_minutes,linkedId||undefined).length>0;return <g key={t.id} data-form-table={t.id} transform={`translate(${t.x*10} ${t.y*6.5})`} role="button" tabIndex={0} aria-pressed={ids.includes(t.id)} aria-label={`${floorTableName(t.name,en)} · ${t.seats} ${copy('lugares','seats')} · ${ids.includes(t.id)?copy('Seleccionada','Selected')+' · ':''}${taken?copy('Ocupada','Booked'):copy('Disponible','Available')}`} onClick={()=>toggleTable(t.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleTable(t.id)}}}><rect x="-65" y="-65" width="130" height="150" fill="transparent"/><FloorTableGraphic table={t} state={taken?'reserved':'free'} selected={ids.includes(t.id)} en={en}/>{ids.includes(t.id)&&<g className="floorTableCheck" aria-hidden="true" pointerEvents="none"><circle cx="51" cy="-53" r="18" fill="#28634f" stroke="white" strokeWidth="2"/><path d="m43 -53 5 5 10 -11" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></g>}</g>})}</svg></div>}
    <div className="floorFormTableChoices" hidden={view!=='list'}>{areaTables.map(t=>{const taken=conflicts(data,[t.id],date,time,selection.duration_minutes,linkedId||undefined);return <label key={t.id} data-form-choice={t.id} className={`${taken.length?'unavailable':''} ${ids.includes(t.id)?'selected':''}`}><input type="checkbox" checked={ids.includes(t.id)} onChange={()=>toggleTable(t.id)}/><span><b>{floorTableName(t.name,en)}</b> · {t.seats} {copy('lugares','seats')}<small>{taken.length?copy('Ocupada en este intervalo','Booked during this interval'):copy('Disponible','Available')}</small></span></label>})}</div>
   </>}
   <div className="floorFormControls"><FloorDurationInput restaurantId={restaurantId} date={date} data={data} value={selection.duration_minutes} onChange={duration_minutes=>setSelection(s=>({...s,duration_minutes}))} onSaved={next=>{setData(next);setSelection(s=>({...s,plan_revision:next.revision}));setBaseline(raw=>JSON.stringify({...JSON.parse(raw),plan_revision:next.revision}))}} onBusy={setDurationSaving} canRemember={canManageDefault} en={en}/><div className="floorTableSelectionActions"><button type="button" className="floorUseRoom" disabled={!activeArea||!areaTables.length} onClick={()=>{if(activeArea)change(current=>selectFloorArea(current,data.layout,activeArea.id,true))}}><LayoutGrid size={16} aria-hidden="true"/>{copy('Usar salón completo','Use entire room')}</button><button type="button" className="floorClearTables" disabled={!ids.length&&!selection.whole_area_id} onClick={()=>change(current=>({...current,table_ids:[],whole_area_id:null}))}><Eraser size={16} aria-hidden="true"/>{copy('Deseleccionar mesas','Deselect tables')}</button></div></div>
   <p className="floorFormSelectionSummary"><b>{copy('Selección:','Selection:')}</b> {selection.whole_area_id?`${chosenEventArea?.name||chosenArea?.name||''} · ${copy('Salón completo','Entire room')} (${ids.length} ${copy('mesas','tables')})`:floorAreaLabel(chosenEventArea?.name||chosenArea?.name||'',selection,data.layout,en)||(activeArea?copy('Área reservada completa, sin mesas individuales','Entire area reserved, no individual tables'):copy('Sin mesa ni área','No table or area'))} · {capacity}/{guests} {copy('lugares','seats')}</p>
   {ids.length>0&&capacity<guests&&<p className="floorWarning">{copy(`${guests-capacity} asientos adicionales. Al guardar deberá confirmarlos; la capacidad habitual se conserva.`,`${guests-capacity} added seats. Confirm them on save; usual capacity stays unchanged.`)}</p>}
   {!!booked.length&&<p className="floorWarning">{proposal?copy('Hay reservas en estas mesas. La propuesta puede guardarse; la disponibilidad se validará al confirmar.','These tables have reservations. The proposal can be saved; availability will be checked on confirmation.'):copy('Hay un cruce de horario. Al guardar puede revisar las mesas o confirmar Guardar de todos modos.','There is a time conflict. On save, review the tables or confirm Save anyway.')}</p>}
   {!!ids.length&&!time&&<p className="floorWarning">{copy('Indique la hora del evento.','Enter the event time.')}</p>}
   <small>{copy('Consulta para','Availability for')} {date} · {formatEventTime(time,timeFormat)} · {selection.duration_minutes} min</small>
  </>}
 </section>;
}
