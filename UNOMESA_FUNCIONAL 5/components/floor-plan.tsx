"use client";
import {isAppMode} from '@/lib/app-mode';
import {FloorActionMenu,FloorReservationActions,FloorContextBooking} from './floor-action-menu';
import {FloorTouchContext,FloorTouchPanel,FloorTouchHeader,FloorTouchEdges,FloorTouchOverlays,useTouchFloor,type TouchPanelName} from './floor-touch';
import {floorAreaBounds,floorAreaViewport} from '@/lib/floor-area-bounds';
import {floorTableName} from '@/lib/floor-table-label';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, Check, ChevronLeft, ChevronRight, Clock3, LayoutGrid, Move, Plus, Printer, Download, MoreHorizontal, RefreshCw, Settings2, Trash2, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppPreferences } from './app-preferences';
import { useSuccessToast } from './success-toast';
import { displayDate, EventTimeInput, Modal } from './dashboard-ui';
import { useDataRefresh } from './restaurant-sync';
import { confirmDiscardChanges, useUnsavedChanges } from '@/lib/unsaved-changes';
import { formatEventTime, localDateISO } from '@/lib/local-date';
import { requirePermission } from '@/lib/permissions';
import {FloorPrintOptions} from './floor-print-options';
import type {FloorPrintMap} from '@/lib/floor-print';
import {tableDaySchedules} from '@/lib/floor-table-schedule';
import { ensureEventArea } from '@/lib/event-area-catalog';
import { userMessage } from '@/lib/user-message';
import { RestaurantOverview } from './restaurant-overview';
import { FloorDurationInput } from './floor-duration-input';
import { FLOOR_DEFAULT_CHANGED } from '@/lib/floor-duration';
import { ReservationQuoteLink } from './reservation-quote-link';
import { FloorReservationDetails } from './floor-reservation-details';
import { areaLevel, positionArea, attachCatalogArea, floorDefaultDuration, floorLevels, levelName } from '@/lib/restaurant-map';
import {useRememberedView} from './use-remembered-view';
import {MapNavigation,useMapNavigation} from './map-navigation';
import {floorAreaLabel} from '@/lib/floor-area-label';
import {notifyFloorChange} from '@/lib/floor-sync';
import {useFloorConflictConfirmation} from './floor-conflict-confirmation';
import {saveWithFloorConfirmation} from '@/lib/floor-conflict-confirmation';
import {floorWithCatalog,syncCatalogAreas} from '@/lib/floor-area-sync';
import {FloorSetupGuide} from './floor-setup-guide';
import { FloorTableGraphic } from './floor-table-graphic';
import { floorAddedSeatsLabel, floorEventArea, floorAreaForEvent, selectionArea, toggleFloorTable, floorTableScale, type EventArea, activeReservation, conflicts, defaultFloorSelection, floorAreaAvailability, floorDayBookings, floorEndTime, demoFloor, emptyFloor, floorError, floorMinute, needsReview, seatingTables, type FloorCreateSeed, type FloorData, type FloorLayout, type FloorReservation, type FloorSeating, type FloorTable } from '@/lib/floor-plan';

type Assignment = {reservation:FloorReservation;tableIds:string[];wholeArea:string|null;duration:number;status:FloorSeating['service_status'];revision:number;planRevision:number};
type Props = {onBackToList?:()=>void;eventAreas?:EventArea[];onAreaCreated?:(area:EventArea)=>void;restaurantId:string;restaurantName:string;canEdit:boolean;canDelete?:boolean;canManageLayout:boolean;timeFormat?:string;refreshToken?:number;onCreate?:(seed:FloorCreateSeed)=>void;onEdit?:(id:string)=>void;onDelete?:(reservation:FloorReservation)=>void;onQuote?:(id:string)=>void;openQuote?:(id:string)=>void;preferences?:Record<string,any>;configuration?:boolean;initialEditor?:{eventAreaId?:string;tableId?:string;overview?:boolean};onLayoutSaved?:(data:FloorData)=>void;onBusyChange?:(busy:boolean)=>void};
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shifted=(date:string,days:number)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);

export function FloorPlan({onBackToList,eventAreas=[],onAreaCreated,restaurantId,restaurantName,canEdit,canDelete=false,canManageLayout,timeFormat,refreshToken=0,onCreate,onEdit,onDelete,onQuote,openQuote,preferences={},configuration=false,initialEditor,onLayoutSaved,onBusyChange}:Props) {
  const {language}=useAppPreferences(),en=language==='en',say=(es:string,english:string)=>en?english:es,toast=useSuccessToast();
  const touch=useTouchFloor(!configuration),[touchPanel,setTouchPanel]=useState<TouchPanelName>(null);
  const floorConfirmation=useFloorConflictConfirmation(en);
  const [date,setDate]=useState(localDateISO()),[time,setTime]=useState('13:00'),[windowMinutes,setWindowMinutes]=useState(180),[allReservations,setAllReservations]=useState(false),[dayReset,setDayReset]=useState(0);
  const [appFirst]=useState(()=>!configuration&&isAppMode());
  const [perspective,setPerspective]=useRememberedView(`unomesa:${restaurantId}:floor-perspective`,['area','overview'] as const,initialEditor?.overview||appFirst?'overview':'area',!configuration&&!appFirst);
  const overview=perspective==='overview',setOverview=(value:boolean)=>setPerspective(value?'overview':'area');
  const initializedEditor=useRef(false),loadedDateRef=useRef(''),floorContainer=useRef<HTMLElement>(null);
  const [storedData,setData]=useState<FloorData>(emptyFloor),[loadedDate,setLoadedDate]=useState(''),[area,setArea]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[missing,setMissing]=useState(false),[demo,setDemo]=useState(false),[tick,setTick]=useState(0),[busy,setBusy]=useState(false);
  const [layoutDraft,setLayoutDraft]=useState<FloorLayout|null>(null),[layoutRevision,setLayoutRevision]=useState(0),[tableId,setTableId]=useState('');
  const [assignment,setAssignment]=useState<Assignment|null>(null),[assignmentBaseline,setAssignmentBaseline]=useState('');
  const [inspected,setInspected]=useState<string|null>(null),[showRoom,setShowRoom]=useState(false);
  const [demoCreate,setDemoCreate]=useState<(FloorCreateSeed&{name:string;phone:string;guests:number})|null>(null);
  const [newAreaOpen,setNewAreaOpen]=useState(false),[newAreaName,setNewAreaName]=useState(''),[localAreas,setLocalAreas]=useState<EventArea[]>([]);
  const configuredAreas=useMemo(()=>demo?storedData.layout.areas:[...eventAreas,...localAreas.filter(a=>!eventAreas.some(v=>v.id===a.id))],[demo,storedData.layout.areas,eventAreas,localAreas]);
  const data=useMemo(()=>demo?storedData:floorWithCatalog(storedData,configuredAreas),[demo,storedData,configuredAreas]);
  const newAreaInput=useRef<HTMLInputElement>(null);
  const [printSnapshot,setPrintSnapshot]=useState<{map:FloorPrintMap;data:FloorData;date:string;output:'print'|'pdf';time:string;duration:number;allDay:boolean}|null>(null);
  const [quoteLink,setQuoteLink]=useState<FloorReservation|null>(null);
  const [linkOpen,setLinkOpen]=useState(false),[linkSearch,setLinkSearch]=useState('');
  const [search,setSearch]=useState(''),[onlyUnassigned,setOnlyUnassigned]=useState(false);
  const svg=useRef<SVGSVGElement>(null),drag=useRef<{id:string;x:number;y:number;px:number;py:number;moved:boolean;pointerId:number;layout:FloorLayout}|null>(null),lock=useRef(false);
  const cancelTableDrag=()=>{const d=drag.current;drag.current=null;if(d)setLayoutDraft(d.layout)};
  const map=useMapNavigation(!!layoutDraft,cancelTableDrag);
  useEffect(()=>{onBusyChange?.(busy)},[busy,onBusyChange]);
  const dirty=!!layoutDraft&&(JSON.stringify(layoutDraft)!==JSON.stringify(data.layout)||!!newAreaName.trim())||!!assignment&&JSON.stringify(assignment)!==assignmentBaseline;
  useEffect(()=>{if(touch&&!layoutDraft&&(inspected||showRoom||assignment))setTouchPanel('agenda')},[touch,inspected,showRoom,assignment?.reservation.id]);
  useEffect(()=>{if(!touch)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[touch]);
  const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  const assignmentRef=useRef(assignment);assignmentRef.current=assignment;
  const editingRef=useRef(false);editingRef.current=!!layoutDraft||!!assignment;
  const clearDirty=useUnsavedChanges(dirty,()=>{setLayoutDraft(null);setAssignment(null);setNewAreaOpen(false);setNewAreaName('');});
  const version=useDataRefresh(restaurantId,'v2_reservations');
  useEffect(()=>{
    const changed=(event:Event)=>{const value=(event as CustomEvent).detail;if(value?.restaurantId===restaurantId){setData(current=>({...current,layout:value.layout,revision:value.revision}));setWindowMinutes(floorDefaultDuration(value.layout));}};
    window.addEventListener(FLOOR_DEFAULT_CHANGED,changed);return()=>window.removeEventListener(FLOOR_DEFAULT_CHANGED,changed);
  },[restaurantId]);
  useEffect(()=>{
    if(demo)return;
    const controller=new AbortController();setLoading(loadedDateRef.current!==date);setError('');setMissing(false);
    (async()=>{
      const response=await supabase.rpc('v2_floor_read',{p_restaurant_id:restaurantId,p_date:date}).abortSignal(controller.signal);
      if(controller.signal.aborted)return;
      if(response.error){
        if(['PGRST202','42883'].includes(response.error.code)&&response.error.message.includes('v2_floor_read'))setMissing(true);
        else setError(floorError(response.error,en));
        setLoadedDate('');
      }else{const next=response.data as FloorData;setData(current=>JSON.stringify(current)===JSON.stringify(next)?current:next);if(!loadedDateRef.current)setWindowMinutes(floorDefaultDuration(next.layout));loadedDateRef.current=date;setLoadedDate(date);}
      setLoading(false);
    })().catch(e=>{if(!controller.signal.aborted){setError(floorError(e,en));setLoadedDate('');setLoading(false)}});
    return ()=>controller.abort();
  },[restaurantId,date,tick,refreshToken,version,demo,en]);
  useEffect(()=>{
    if(demo)return;
    const refresh=()=>{if(document.visibilityState==='visible'&&!dirtyRef.current&&!editingRef.current&&!lock.current)setTick(v=>v+1)};
    const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh)};
  },[demo]);
  // Background/form saves refresh clean selections; unsaved assignments keep their stale-write guard.
  useEffect(()=>{const current=assignmentRef.current;if(!current||dirtyRef.current)return;
    const r=data.reservations.find(r=>r.id===current.reservation.id);
    if(!r||!activeReservation(r)){setAssignment(null);return;}
    const s=data.seatings.find(s=>s.reservation_id===r.id),next:Assignment={reservation:{...r},tableIds:s?.table_ids||[],wholeArea:s?.whole_area_id||null,duration:s?.duration_minutes||floorDefaultDuration(data.layout),status:s?.service_status||'reserved',revision:s?.revision||0,planRevision:data.revision};
    if(JSON.stringify(current)!==JSON.stringify(next)){setAssignment(next);setAssignmentBaseline(JSON.stringify(next));const areaId=next.wholeArea||data.layout.tables.find(t=>next.tableIds.includes(t.id))?.areaId;if(areaId)setArea(areaId);setAllReservations(false);if(r.event_time)setTime(r.event_time.slice(0,5));}
  },[data]);
  const layout=layoutDraft||data.layout;
  useEffect(()=>{if(!assignment&&!layoutDraft)setWindowMinutes(floorDefaultDuration(data.layout))},[data.layout.defaultDurationMinutes]);
  const eventAreaFor=(id:string)=>floorEventArea(layout.areas.find(a=>a.id===id),configuredAreas);
  const assignmentSelection=assignment?{...defaultFloorSelection(assignment.planRevision),table_ids:assignment.tableIds,whole_area_id:assignment.wholeArea,duration_minutes:assignment.duration,service_status:assignment.status,revision:assignment.revision}:null;
  const activeArea=layout.areas.find(a=>a.id===area)||layout.areas[0];
  const visibleTables=layout.tables.filter(t=>t.areaId===activeArea?.id);
  const areaBounds=floorAreaBounds(visibleTables),areaViewport=floorAreaViewport(areaBounds);
  const editTable=layout.tables.find(t=>t.id===tableId);
  const ready=demo||!loading&&!missing&&loadedDate===date;
  const showFloor=ready||!!loadedDateRef.current&&!missing;
  const displayedDate=ready?date:loadedDate||loadedDateRef.current||date;
  const selectedReservation=assignment?data.reservations.find(r=>r.id===assignment.reservation.id):null;
  const selectedIds=assignment?(assignment.wholeArea?layout.tables.filter(t=>t.areaId===assignment.wholeArea).map(t=>t.id):assignment.tableIds):[];
  const selectedCapacity=layout.tables.filter(t=>selectedIds.includes(t.id)).reduce((v,t)=>v+t.seats,0);
  const viewingDate=assignment?.reservation.event_date||displayedDate,viewingTime=assignment?.reservation.event_time||time,duration=assignment?.duration||windowMinutes;
  const allDay=allReservations&&!assignment&&!layoutDraft,mapTime=allDay?'00:00':viewingTime||'',mapDuration=allDay?1440:duration;
  const validWindow=Number.isFinite(floorMinute(viewingDate,viewingTime))&&Number.isInteger(duration)&&duration>=15&&duration<=1440;
  const reservations=data.reservations.filter(r=>r.event_date===displayedDate&&activeReservation(r));
  const seatFor=(id:string)=>data.seatings.find(s=>s.reservation_id===id);
  const reviewCount=reservations.filter(r=>{const s=seatFor(r.id);return s&&needsReview(data,r,s)}).length;
  const unassigned=reservations.filter(r=>!seatFor(r.id)).length;
  const filteredReservations=reservations.filter(r=>(!onlyUnassigned||!seatFor(r.id))&&`${r.client_name} ${r.phone} ${r.area}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
  const tableStates=useMemo(()=>{
    const reservationsById=new Map(data.reservations.map(r=>[r.id,r])),reviewBySeating=new Map<string,boolean>();
    return new Map(layout.tables.map(table=>{
      const occupied=allDay||validWindow?conflicts(data,[table.id],viewingDate,mapTime,mapDuration,assignment?.reservation.id):[];
      const review=occupied.some(s=>{if(!reviewBySeating.has(s.reservation_id)){const r=reservationsById.get(s.reservation_id);reviewBySeating.set(s.reservation_id,!!r&&needsReview(data,r,s))}return reviewBySeating.get(s.reservation_id)});
      return [table.id,review?'review':!allDay&&occupied.some(s=>s.service_status==='seated')?'seated':occupied.length?'reserved':'free'];
    }));
  },[data,layout.tables,validWindow,viewingDate,mapTime,mapDuration,allDay,assignment?.reservation.id]);
  const schedules=useMemo(()=>tableDaySchedules(data,displayedDate,timeFormat),[data,displayedDate,timeFormat]);
  const tableState=(table:FloorTable)=>tableStates.get(table.id)||'free';
  const stateLabel=(state:string)=>({free:say('Disponible','Available'),reserved:say('Reservada','Reserved'),seated:say('En mesa','Seated'),review:say('Revisar','Review'),selected:say('Seleccionada','Selected')}[state]||state);
  const freeTables=visibleTables.filter(t=>tableState(t)==='free').length;
  const changeDate=(value:string)=>{if(!value||value<'2000-01-01'||value>'2100-12-31')return;if(confirmDiscardChanges()){setAssignment(null);setLayoutDraft(null);setDate(value);setInspected(null);setShowRoom(false);if(demo){setData(demoFloor(value));setLoadedDate(value)}}};
  const refresh=()=>{if(confirmDiscardChanges()){setAssignment(null);setLayoutDraft(null);setError('');setTick(v=>v+1)}};
  function startDemo(){if(!confirmDiscardChanges())return;setAssignment(null);setLayoutDraft(null);setDemo(true);setData(demoFloor(date));setLoadedDate(date);setTime('13:30');setError('');setArea('salon');}
  function leaveDemo(){if(!confirmDiscardChanges())return;setAssignment(null);setLayoutDraft(null);setDemo(false);setData(emptyFloor());setLoadedDate('');setError('');setArea('');setTick(v=>v+1);}
  function chooseReservation(r:FloorReservation) {
    if(layoutDraft||busy)return;
    if(assignment?.reservation.id!==r.id&&!confirmDiscardChanges())return;
    const s=seatFor(r.id),draft:Assignment={reservation:{...r},tableIds:s?.table_ids||[],wholeArea:s?.whole_area_id||null,duration:s?.duration_minutes||floorDefaultDuration(layout),status:s?.service_status||'reserved',revision:s?.revision||0,planRevision:data.revision};
    setInspected(null);setShowRoom(false);setAssignment(draft);setAssignmentBaseline(JSON.stringify(draft));setError('');
    setAllReservations(false);if(r.event_time)setTime(r.event_time.slice(0,5));
    const target=draft.wholeArea||layout.tables.find(t=>draft.tableIds.includes(t.id))?.areaId||floorAreaForEvent(layout,configuredAreas,'',r.area)?.id;
    if(target)setArea(target);
  }
  function linkQuote(r:FloorReservation){if(demo||!canEdit||r.quote_id||!activeReservation(r)||!confirmDiscardChanges())return;setAssignment(null);setQuoteLink(r);}
  function requestDelete(r:FloorReservation){if(!demo&&canDelete&&onDelete&&!busy&&!layoutDraft&&confirmDiscardChanges())onDelete(r)}
  function reservationActions(r:FloorReservation){
    if(touch)return !demo&&<FloorReservationActions disabled={busy}
      onEdit={canEdit&&onEdit?()=>{if(confirmDiscardChanges()){setAssignment(null);clearDirty();onEdit(r.id)}}:undefined}
      onDelete={canDelete&&onDelete?()=>requestDelete(r):undefined}
      onViewQuote={r.quote_id&&openQuote?()=>{if(confirmDiscardChanges())openQuote(r.quote_id!)}:undefined}
      onCreateQuote={!r.quote_id&&canEdit&&activeReservation(r)&&onQuote?()=>{if(confirmDiscardChanges()){setAssignment(null);clearDirty();onQuote(r.id)}}:undefined}
      onLinkQuote={!r.quote_id&&canEdit&&activeReservation(r)?()=>linkQuote(r):undefined}/>;
    return !demo&&<div className="floorAgendaActions floorVisibleActions">{canDelete&&onDelete&&<button type="button" className="secondary floorDeleteAction" disabled={busy} onClick={()=>requestDelete(r)}><Trash2 size={14}/>{say('Eliminar reserva','Delete reservation')}</button>}{canEdit&&onEdit&&<button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirmDiscardChanges()){setAssignment(null);clearDirty();onEdit(r.id)}}}>{say('Editar reserva','Edit reservation')}</button>}{r.quote_id?openQuote&&<button type="button" className="secondary" onClick={()=>openQuote(r.quote_id!)}>{say('Ver cotización','View quote')}</button>:canEdit&&activeReservation(r)&&<>{onQuote&&<button type="button" className="secondary" disabled={busy} onClick={()=>{if(confirmDiscardChanges()){setAssignment(null);clearDirty();onQuote(r.id)}}}>{say('Crear cotización','Create quote')}</button>}<button type="button" className="secondary" disabled={busy} onClick={()=>linkQuote(r)}>{say('Vincular cotización','Link quote')}</button></>}</div>}
  function linkReservation(r:FloorReservation){
    if(busy||!ready||!activeArea||!canEdit||!confirmDiscardChanges())return;
    const seating=seatFor(r.id),original:Assignment={reservation:{...r},tableIds:seating?.table_ids||[],wholeArea:seating?.whole_area_id||null,duration:seating?.duration_minutes||floorDefaultDuration(layout),status:seating?.service_status||'reserved',revision:seating?.revision||0,planRevision:data.revision};
    const existing=seating?seatingTables(seating,layout):[];
    const proposed=inspectedTable?[...new Set([...existing.filter(id=>layout.tables.some(t=>t.id===id&&t.areaId===activeArea.id)),inspectedTable.id])]:visibleTables.map(t=>t.id);
    setAssignmentBaseline(JSON.stringify(original));setAssignment({...original,tableIds:proposed,wholeArea:inspectedTable?null:activeArea.id,status:original.status==='finished'?'reserved':original.status});
    setAllReservations(false);if(r.event_time)setTime(r.event_time.slice(0,5));setInspected(null);setShowRoom(false);setLinkOpen(false);setError('');
  }
  function showAllReservations(){if(busy||layoutDraft||!confirmDiscardChanges())return;setAssignment(null);setInspected(null);setShowRoom(false);setSearch('');setOnlyUnassigned(false);setAllReservations(true);setDayReset(v=>v+1);setError('');}
  function toggleRoomAgenda(){if(busy||!confirmDiscardChanges())return;setAssignment(null);setInspected(null);setShowRoom(current=>!current);setError('');}
  function toggleTable(t:FloorTable) {
    if(layoutDraft){setTableId(t.id);if(touch)setTouchPanel('agenda');return;}
    if(busy)return;
    if(!assignment){setInspected(current=>touch?t.id:current===t.id?null:t.id);if(touch)setTouchPanel('agenda');setShowRoom(false);setError('');return;}
    if(!canEdit)return;
    setError('');const next=toggleFloorTable(assignmentSelection!,layout,t.id);setAssignment({...assignment,wholeArea:next.whole_area_id,tableIds:next.table_ids});
  }
  function updateTable(values:Partial<FloorTable>){setLayoutDraft(l=>l?{...l,tables:l.tables.map(t=>t.id===tableId?{...t,...values}:t)}:l)}
  function addArea(){
    if(!layoutDraft||busy||layoutDraft.areas.length>=20)return;
    setNewAreaOpen(true);setNewAreaName('');setError('');if(touch)setTouchPanel('agenda');
    requestAnimationFrame(()=>newAreaInput.current?.focus());
  }
  async function createArea(event:React.FormEvent){
    event.preventDefault();if(!layoutDraft||lock.current||!newAreaName.trim())return;
    lock.current=true;setBusy(true);setError('');
    try{
      if(!demo)await requirePermission(supabase,restaurantId,'canManageFloorPlan');
      const saved=demo?{id:crypto.randomUUID(),name:newAreaName.trim()}:await ensureEventArea(supabase,restaurantId,newAreaName);
      if(!demo){if(onAreaCreated)onAreaCreated(saved);else setLocalAreas(current=>[...current.filter(a=>a.id!==saved.id),saved]);}
      const shared=[...configuredAreas.filter(a=>a.id!==saved.id),saved];
      const existing=layoutDraft.areas.find(a=>floorEventArea(a,shared)?.id===saved.id);
      const id=existing?.id||crypto.randomUUID();
      if(!existing)setLayoutDraft({...layoutDraft,areas:[...layoutDraft.areas,{id,name:saved.name,...(!demo?{eventAreaId:saved.id}:{})}]});
      setArea(id);setTableId('');setNewAreaOpen(false);setNewAreaName('');
      toast(say(demo?'Área de ejemplo agregada':'Área disponible en formularios y Configuración',demo?'Sample area added':'Area available in forms and Settings'));
    }catch(error){setError(userMessage(error,say('No se pudo guardar el área. Revise la conexión e intente de nuevo.','Could not save the area. Check your connection and retry.')))}
    finally{lock.current=false;setBusy(false)}
  }
  function addTable(){if(!layoutDraft||!activeArea||layoutDraft.tables.length>=200)return;let number=1;while(layoutDraft.tables.some(t=>t.areaId===activeArea.id&&floorTableName(t.name)===`M${number}`))number++;const id=crypto.randomUUID(),n=visibleTables.length;setLayoutDraft({...layoutDraft,tables:[...layoutDraft.tables,{id,areaId:activeArea.id,name:`M${number}`,seats:4,shape:'square',x:20+(n%3)*30,y:25+(Math.floor(n/3)%3)*25,rotation:0}]});setTableId(id);}
  async function saveLayout(){
    if(!layoutDraft||lock.current)return;if(layoutDraft.levels?.some(l=>!l.name.trim()||l.name.length>40)){setError(say('Escriba un nombre para cada nivel (máximo 40 caracteres).','Enter a name for every level (up to 40 characters).'));return;}if(newAreaName.trim()){setError(say('Agregue el área pendiente o cancele su creación antes de guardar el plano.','Add the pending area or cancel its creation before saving the floor plan.'));return;}lock.current=true;setBusy(true);setError('');
    try{
      const savedLayout=demo?layoutDraft:syncCatalogAreas(layoutDraft,configuredAreas);
      if(savedLayout.areas.length>20)throw Error('FLOOR_LAYOUT');
      let revision=data.revision+1;
      if(!demo){await requirePermission(supabase,restaurantId,'canManageFloorPlan');const result=await supabase.rpc('v2_floor_save_layout',{p_restaurant_id:restaurantId,p_revision:layoutRevision,p_layout:savedLayout});if(result.error)throw result.error;revision=result.data;}
      else if(layoutDraft.areas.some(a=>!a.name.trim())||layoutDraft.tables.some(t=>!t.name.trim()||!Number.isInteger(t.seats)||t.seats<1||t.seats>100))throw Error('FLOOR_LAYOUT');
      const saved={...storedData,layout:savedLayout,revision};setData(saved);setWindowMinutes(floorDefaultDuration(savedLayout));setLayoutDraft(null);clearDirty();onLayoutSaved?.(saved);if(!demo)notifyFloorChange(restaurantId);toast(say(demo?'Plano de prueba actualizado':'Plano guardado',demo?'Demo floor plan updated':'Floor plan saved'));
    }catch(e){setError(floorError(e,en))}finally{lock.current=false;setBusy(false)}
  }
  async function saveAssignment(remove=false){
    if(!assignment||lock.current)return;
    const a=assignment,r=a.reservation;
    if(remove&&!window.confirm(say('¿Quitar el área y las mesas asignadas? La reservación se conserva.','Remove the area and table assignments? The reservation is kept.')))return;
    lock.current=true;setBusy(true);setError('');
    try{
      if(!remove){
        if(!validWindow||!selectedIds.length)throw Error('FLOOR_ASSIGNMENT');
        if(demo&&selectedCapacity<r.guests&&!await floorConfirmation.confirm('capacity'))return;
        if(demo&&a.status!=='finished'&&conflicts(data,selectedIds,r.event_date,r.event_time,a.duration,r.id).length&&!await floorConfirmation.confirm())return;
      }
      let revision=a.revision+1;
      const chosen=selectionArea(assignmentSelection!,layout),eventArea=floorEventArea(chosen,configuredAreas);
      if(!remove&&integrated&&!eventArea)throw Error('FLOOR_AREA');
      if(!demo){await requirePermission(supabase,restaurantId,'canOperate');
       if(integrated){
        const result=await saveWithFloorConfirmation((confirmed,extraSeats)=>supabase.rpc('v2_floor_save_reservation',{p_restaurant:restaurantId,p_id:r.id,p_new:false,
         p_payload:remove?{area:'',area_id:null}:{area:eventArea!.name,area_id:eventArea!.id},
         p_floor:{...assignmentSelection,allow_conflict:confirmed,allow_extra_seats:extraSeats,table_ids:remove?[]:selectedIds,whole_area_id:remove?null:a.wholeArea,source:{event_date:r.event_date,event_time:r.event_time,guests:r.guests,quote_id:r.quote_id||null}}}),floorConfirmation.confirm);
        if(!result)return;if(result.error)throw result.error;
       }else{const result=await saveWithFloorConfirmation<number>((confirmed,extraSeats)=>supabase.rpc(extraSeats?'v2_floor_assign_extra_seats':confirmed?'v2_floor_assign_confirmed':'v2_floor_assign',{
        ...(extraSeats?{p_allow_conflict:confirmed}:{}),p_restaurant_id:restaurantId,p_reservation_id:r.id,p_revision:a.revision,p_plan_revision:a.planRevision,p_table_ids:remove?[]:selectedIds,p_whole_area_id:remove?null:a.wholeArea,
        p_duration:a.duration,p_status:a.status,p_source_date:r.event_date,p_source_time:r.event_time,p_source_guests:r.guests,
       }),floorConfirmation.confirm);if(!result)return;if(result.error)throw result.error;revision=result.data!;}
      }
      const s:FloorSeating={reservation_id:r.id,table_ids:selectedIds,whole_area_id:a.wholeArea,duration_minutes:a.duration,service_status:a.status,source_date:r.event_date,source_time:r.event_time||'',source_guests:r.guests,revision};
      setData(d=>({...d,reservations:d.reservations.map(v=>v.id===r.id?remove?{...v,area:''}:eventArea?{...v,area:eventArea.name}:v:v),seatings:[...d.seatings.filter(s=>s.reservation_id!==r.id),...(remove?[]:[s])]}));setAssignment(null);clearDirty();toast(say(demo?'Cambio aplicado en la prueba':remove?'Asignación quitada':'Asignación guardada',demo?'Demo updated':remove?'Assignment removed':'Assignment saved'));if(!demo)notifyFloorChange(restaurantId);
    }catch(e){setError(floorError(e,en))}finally{lock.current=false;setBusy(false)}
  }
  function printFloor(output:'print'|'pdf'='print'){
    const canvas=overview?floorContainer.current?.querySelector('.overviewCanvas>svg'):svg.current;
    if(!canvas||!ready||layoutDraft||assignment)return;
    const printable=canvas.cloneNode(true) as SVGSVGElement;printable.style.width='100%';printable.style.minWidth='0';printable.style.height='390px';
    const map:FloorPrintMap={svg:new XMLSerializer().serializeToString(printable).replace(/tabindex="[^"]*"/g,''),title:canvas.getAttribute('data-print-title')||activeArea?.name||'',windowLabel:allDay?say('Todas las reservaciones del día','All day reservations'):`${formatEventTime(viewingTime,timeFormat)} · ${duration} min`,areaIds:JSON.parse(canvas.getAttribute('data-print-areas')||'[]')};
    setPrintSnapshot({map,data:structuredClone(data),date:displayedDate,output,time:mapTime,duration:mapDuration,allDay});
  }
  const inspectedTable=layout.tables.find(t=>t.id===inspected);
  const areaFocusKey=(assignment?selectedIds:inspected?[inspected]:showRoom?visibleTables.map(t=>t.id):[]).join('|');
  useEffect(()=>{if(!touch||overview||layoutDraft||!ready||!areaFocusKey)return;let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{const ids=areaFocusKey.split('|');map.focusElements(Array.from(svg.current?.querySelectorAll('[data-table]')||[]).filter(node=>ids.includes(node.getAttribute('data-table')||'')))})});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)}},[areaFocusKey,touch,overview,!!layoutDraft,ready]);
  const agenda=floorDayBookings(data,displayedDate,inspectedTable?.id,inspectedTable?undefined:activeArea?.id);
  const areaAvailability=activeArea?floorAreaAvailability(data,activeArea.id,viewingDate,mapTime,mapDuration):null;
  const integrated=demo||data.integration_version===2;
  function startReservation(whole=false){
    if(!activeArea||!validWindow||busy||!confirmDiscardChanges())return;
    const selected=whole?visibleTables.map(t=>t.id):inspectedTable?[inspectedTable.id]:assignment?selectedIds:demo?visibleTables.filter(t=>!conflicts(data,[t.id],date,time,windowMinutes).length).slice(0,1).map(t=>t.id):[];
    const seed:FloorCreateSeed={date,time,areaName:eventAreaFor(activeArea.id)?.name||activeArea.name,areaId:eventAreaFor(activeArea.id)?.id,selection:{...defaultFloorSelection(data.revision),table_ids:selected,whole_area_id:whole?activeArea.id:null,duration_minutes:windowMinutes}};
    if(demo)setDemoCreate({...seed,name:'',phone:'',guests:2});else onCreate?.(seed);
  }
  async function saveDemoReservation(event:React.FormEvent){
    event.preventDefault();if(!demoCreate)return;
    const draft=demoCreate,ids=seatingTables(draft.selection,layout);
    const capacity=layout.tables.filter(t=>ids.includes(t.id)).reduce((n,t)=>n+t.seats,0);
    if(!draft.name.trim()||!ids.length||!Number.isInteger(draft.guests)||draft.guests<1||!Number.isFinite(floorMinute(draft.date,draft.time))||!Number.isInteger(draft.selection.duration_minutes)||draft.selection.duration_minutes<15||draft.selection.duration_minutes>1440){setError(floorError({message:'FLOOR_ASSIGNMENT'},en));return;}
    if(capacity<draft.guests&&!await floorConfirmation.confirm('capacity'))return;
    if(conflicts(data,ids,draft.date,draft.time,draft.selection.duration_minutes).length&&!await floorConfirmation.confirm())return;
    const id='demo-'+crypto.randomUUID();
    const r:FloorReservation={id,client_name:draft.name,phone:draft.phone,event_date:draft.date,event_time:draft.time,guests:draft.guests,area:draft.areaName,status:'confirmada'};
    const seat:FloorSeating={reservation_id:id,table_ids:ids,whole_area_id:draft.selection.whole_area_id,duration_minutes:draft.selection.duration_minutes,service_status:'reserved',revision:1,source_date:r.event_date,source_time:r.event_time||'',source_guests:r.guests};
    setData(d=>({...d,reservations:[...d.reservations,r],seatings:[...d.seatings,seat]}));setDemoCreate(null);setError('');toast(say('Reservación de ejemplo creada','Sample reservation created'));
  }
  function bookingRange(r:FloorReservation,s:FloorSeating){const end=floorEndTime(r.event_date,r.event_time||s.source_time,s.duration_minutes);return `${r.event_date!==date?displayDate(r.event_date)+' · ':''}${formatEventTime(r.event_time||s.source_time,timeFormat)} – ${formatEventTime(end.time,timeFormat)}${end.nextDay?say(' (+1 día)',' (+1 day)'):''}`;}
  function beginLayout(){if(!canManageLayout||busy)return;if(confirmDiscardChanges()){setAssignment(null);setLayoutDraft(structuredClone(data.layout));setLayoutRevision(data.revision);setTableId('');setError('')}}
  useEffect(()=>{
    if(!ready||!initialEditor||initializedEditor.current)return;
    initializedEditor.current=true;
    try{let draft=structuredClone(data.layout);const target=eventAreas.find(a=>a.id===initialEditor.eventAreaId);
      if(target&&canManageLayout)draft=attachCatalogArea(draft,target,crypto.randomUUID());
      const match=target?draft.areas.find(a=>floorEventArea(a,eventAreas)?.id===target.id):undefined;
      if(match)setArea(match.id);if(initialEditor.tableId){setTableId(initialEditor.tableId);if(!canManageLayout)setInspected(initialEditor.tableId);}
      if(canManageLayout){setLayoutDraft(draft);setLayoutRevision(data.revision)}
    }catch(e){setError(floorError(e,en))}
  },[ready,initialEditor,data,eventAreas,canManageLayout,en]);
  function rememberedDuration(next:FloorData){setData(next);if(assignment)setAssignment(a=>a?{...a,planRevision:next.revision}:a)}
  const inputDisabled=busy||!!layoutDraft;
  const dateControls=!configuration&&<FloorTouchPanel name="filters" side="left" title={say('Fecha y disponibilidad','Date and availability')}><div className="floorToolbar floorMapControls" role="group" aria-label={say('Disponibilidad del plano','Floor plan availability')}>
      <div className="floorDay"><button aria-label={say('Día anterior','Previous day')} disabled={inputDisabled} onClick={()=>changeDate(shifted(date,-1))}><ChevronLeft size={18}/></button><label>{say('Fecha','Date')}<input type="date" aria-label={say('Fecha del plano','Floor plan date')} min="2000-01-01" max="2100-12-31" value={date} disabled={inputDisabled} onChange={e=>changeDate(e.target.value)}/></label><button aria-label={say('Día siguiente','Next day')} disabled={inputDisabled} onClick={()=>changeDate(shifted(date,1))}><ChevronRight size={18}/></button></div>
      <button type="button" className="secondary floorAllReservations" aria-pressed={allDay} disabled={inputDisabled||!ready} onClick={()=>allDay?setAllReservations(false):showAllReservations()}>{say('Ver todas las reservaciones','View all reservations')}</button>
      <label className="floorFrom">{say('Hora','Time')}<EventTimeInput value={time} format={timeFormat} disabled={inputDisabled||!!assignment} onChange={value=>{setTime(value);setAllReservations(!value)}}/></label>
      <FloorDurationInput restaurantId={restaurantId} date={date} data={data} value={assignment?.duration??windowMinutes} disabled={inputDisabled||!!assignment||!ready} onChange={setWindowMinutes} onSaved={rememberedDuration} onBusy={setBusy} canRemember={canManageLayout} en={en} demo={demo}/>
      <span className="floorTimeNote"><Clock3 size={15}/>{allDay?say('Todo el día · cambie la hora para filtrar','Whole day · change the time to filter'):say('Hora local del evento','Event local time')}</span>
    </div><div className="touchFilterSummary"><b>{layout.areas.length} {say('áreas','areas')} · {layout.tables.length} {say('mesas','tables')}</b><p>{say('Cambiar estos filtros consulta la disponibilidad; no cambia la fecha de las reservas.','These filters check availability; they do not change reservation dates.')}</p></div></FloorTouchPanel>;
  const emptyRoom=activeArea&&!visibleTables.length?<div className="floorEmptyRoom"><b>{say('Sin mesas configuradas','No tables configured')}</b><p>{say('El área ya está sincronizada. Puede agregar sus mesas cuando esté listo.','This area is already synced. Add its tables whenever you are ready.')}</p>{canManageLayout&&<button type="button" className="secondary" disabled={busy||!ready} onClick={()=>{beginLayout();setOverview(false)}}><Plus size={16}/>{say('Configurar mesas','Set up tables')}</button>}</div>:null;
  const setupGuide=(layoutDraft&&canManageLayout&&<FloorSetupGuide restaurantId={restaurantId} en={en} busy={busy} onView={setOverview} onSave={saveLayout}/>);
  const sidePanel = (
        <aside className={`floorPanel ${touch&&(inspectedTable||showRoom)&&!assignment&&!layoutDraft?'touchTableDetails':''}`} inert={!ready}>
          {overview&&!layoutDraft&&<button type="button" className="secondary floorBackToDay" disabled={busy} onClick={showAllReservations}><ChevronLeft size={16}/>{say('Todas las reservaciones','All reservations')}</button>}
          {layoutDraft?<>
            <h3>{say('Diseñar espacio','Design space')}</h3><button type="button" className="secondary" onClick={()=>setOverview(true)}><LayoutGrid size={16}/>{say('Ubicar en mapa completo','Place on complete map')}</button>
            {newAreaOpen&&<form className="floorAreaCreator" onSubmit={createArea}>
              <label>{say('Nombre del área','Area name')}<input ref={newAreaInput} required maxLength={60} list="floor-shared-areas" disabled={busy} value={newAreaName} onChange={e=>setNewAreaName(e.target.value)} placeholder={say('Ej. Salón privado','e.g. Private room')}/></label>
              <datalist id="floor-shared-areas">{configuredAreas.filter(a=>!layoutDraft.areas.some(v=>floorEventArea(v,configuredAreas)?.id===a.id)).map(a=><option key={a.id} value={a.name}/>)}</datalist>
              <p>{say(demo?'Solo se agrega a esta demostración.':'Cree un área o elija una existente. Se guarda también en Configuración y formularios; la distribución se confirma con Guardar plano.',demo?'Only added to this demo.':'Create an area or choose an existing one. It is also saved in Settings and forms; confirm the layout with Save floor plan.')}</p>
              <div className="floorPanelActions"><button className="primary" disabled={busy}>{busy?say('Guardando…','Saving…'):say('Agregar área','Add area')}</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setNewAreaOpen(false);setNewAreaName('')}}>{say('Cancelar','Cancel')}</button></div>
            </form>}
            {!activeArea?<p>{say('Cree un área para comenzar.','Create an area to get started.')}</p>:<>
              <label>{say('Área del restaurante','Restaurant area')}{demo?<input maxLength={60} value={activeArea.name} disabled={busy} onChange={e=>setLayoutDraft({...layoutDraft,areas:layoutDraft.areas.map(a=>a.id===activeArea.id?{...a,name:e.target.value}:a)})}/>:<select value={eventAreaFor(activeArea.id)?.id||''} disabled={busy} onChange={e=>{const selected=configuredAreas.find(a=>a.id===e.target.value);if(selected)setLayoutDraft({...layoutDraft,areas:layoutDraft.areas.map(a=>a.id===activeArea.id?{...a,eventAreaId:selected.id,name:selected.name}:a)})}}><option value="" disabled>{say('Seleccione el área','Choose area')}</option>{configuredAreas.filter(a=>a.id===eventAreaFor(activeArea.id)?.id||!layoutDraft.areas.some(v=>v.id!==activeArea.id&&floorEventArea(v,configuredAreas)?.id===a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}</label>
              <label>{say('Nivel del área','Area level')}<select aria-label={say('Nivel del área','Area level')} value={areaLevel(layoutDraft,activeArea)} disabled={busy} onChange={e=>{const levelId=e.target.value;setLayoutDraft(current=>current?positionArea(current,activeArea.id,{levelId}):current)}}>{floorLevels(layoutDraft).map(level=><option key={level.id} value={level.id}>{levelName(level.name,en)}</option>)}</select><small>{say('Se trasladan juntas el área y sus mesas. Confirme con Guardar plano.','The area and its tables move together. Confirm with Save floor plan.')}</small></label>
              <button type="button" className="floorTextButton" disabled={busy} onClick={()=>setOverview(true)}>{say('Administrar niveles en mapa completo','Manage levels in complete map')}</button>
              <div className="floorPanelActions"><button className="primary" disabled={busy||layout.tables.length>=200} onClick={addTable}><Plus size={16}/>{say('Agregar mesa','Add table')}</button>{(demo||!eventAreaFor(activeArea.id))&&<button className="floorTextButton" disabled={busy||visibleTables.length>0} onClick={()=>{setLayoutDraft({...layoutDraft,areas:layoutDraft.areas.filter(a=>a.id!==activeArea.id)});setTableId('')}}>{say('Quitar área vacía','Remove empty area')}</button>}</div>
            </>}
            {!layout.areas.length&&<button className="primary" onClick={addArea}><Plus size={16}/>{say('Agregar área','Add area')}</button>}
            {!!visibleTables.length&&<div className="floorEditTableList" aria-label={say('Mesas del área','Area tables')}>{visibleTables.map(t=><button type="button" key={t.id} aria-pressed={tableId===t.id} disabled={busy} onClick={()=>setTableId(t.id)}><b>{floorTableName(t.name,en)}</b><span>{t.seats} {say('lugares','seats')}</span></button>)}</div>}
            {editTable&&<div className="floorTableEditor"><h4>{say('Mesa seleccionada','Selected table')}</h4><label>{say('Nombre de mesa','Table name')}<input value={floorTableName(editTable.name,en)} maxLength={30} disabled={busy} onChange={e=>updateTable({name:e.target.value})}/></label>
              <div className="floorFieldPair"><label>{say('Capacidad','Capacity')}<input type="number" min={1} max={100} value={editTable.seats} disabled={busy} onChange={e=>updateTable({seats:Number(e.target.value)})}/></label><label>{say('Forma','Shape')}<select value={editTable.shape} disabled={busy} onChange={e=>updateTable({shape:e.target.value as FloorTable['shape']})}><option value="round">{say('Redonda','Round')}</option><option value="square">{say('Cuadrada','Square')}</option><option value="rectangle">{say('Rectangular','Rectangle')}</option></select></label></div>
              <label>{say('Tamaño de mesa','Table size')} · {Math.round(floorTableScale(editTable)*100)}%<input type="range" min={40} max={100} step={5} value={Math.round(floorTableScale(editTable)*100)} disabled={busy} onChange={e=>updateTable({size:Number(e.target.value)})}/><small>{say('Solo cambia el tamaño visual; conserva su capacidad.','Changes visual size only; keeps the same capacity.')}</small></label>
              <label>{say('Área de la mesa','Table area')}<select value={editTable.areaId} disabled={busy} onChange={e=>{updateTable({areaId:e.target.value});setArea(e.target.value)}}>{layout.areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <div className="floorPanelActions"><button className="secondary" disabled={busy} onClick={()=>updateTable({rotation:editTable.rotation===0?90:0})}>{say('Girar 90°','Rotate 90°')}</button><button className="floorTextButton danger" disabled={busy} onClick={()=>{setLayoutDraft({...layoutDraft,tables:layoutDraft.tables.filter(t=>t.id!==editTable.id)});setTableId('')}}>{say('Quitar mesa','Remove table')}</button></div>
            </div>}
            <p className="floorFootnote">{say('Cree o elija un área compartida con los formularios, agregue mesas y guarde el plano.','Create or choose an area shared with forms, add tables and save the floor plan.')}</p>
          </>:assignment?<>
            <div className="floorPanelHeader"><span className="floorEyebrow">{say('ASIGNAR MESAS','ASSIGN TABLES')}</span><button aria-label={say('Cerrar detalle','Close detail')} disabled={busy} onClick={()=>{if(confirmDiscardChanges()){setAssignment(null);setError('')}}}><X size={18}/></button></div>
            <h3>{assignment.reservation.client_name}</h3><p>{displayDate(assignment.reservation.event_date)} · {formatEventTime(assignment.reservation.event_time,timeFormat)} · {assignment.reservation.guests} {say('personas','guests')}</p>
            <small>{floorAreaLabel(assignment.reservation.area,assignmentSelection,layout,en)}</small>
            {reservationActions(assignment.reservation)}
            {seatFor(assignment.reservation.id)&&needsReview(data,assignment.reservation,seatFor(assignment.reservation.id)!)&&<p className="floorWarning">{say('Revise hora, capacidad y mesas; vuelva a guardar para confirmar la asignación.','Review time, capacity and tables; save again to confirm the assignment.')}</p>}
            {!assignment.reservation.event_time&&<p className="floorWarning">{say('Agregue la hora del evento desde el listado antes de asignar mesas.','Add the event time in the list before assigning tables.')}</p>}
            {!selectedReservation&&<p className="floorWarning">{say('La reserva ya no está disponible. Actualice la vista.','This reservation is no longer available. Refresh the view.')}</p>}
            <FloorReservationDetails restaurantId={restaurantId} reservation={assignment.reservation} demo={demo} preferences={preferences} refreshToken={tick+version} en={en}/><FloorDurationInput restaurantId={restaurantId} date={date} data={data} value={assignment.duration} disabled={!canEdit||busy} onChange={value=>setAssignment({...assignment,duration:value})} onSaved={rememberedDuration} onBusy={setBusy} canRemember={canManageLayout} en={en} demo={demo}/>
            <label>{say('Estado en el salón','Dining room status')}<select value={assignment.status} disabled={!canEdit||busy} onChange={e=>setAssignment({...assignment,status:e.target.value as FloorSeating['service_status']})}><option value="reserved">{say('Reservada','Reserved')}</option><option value="seated">{say('En mesa','Seated')}</option><option value="finished">{say('Finalizada · liberar mesas','Finished · release tables')}</option></select></label>
            <div className="floorSelected"><strong>{say('Mesas seleccionadas','Selected tables')}</strong><span>{assignment.wholeArea?`${eventAreaFor(assignment.wholeArea)?.name||layout.areas.find(a=>a.id===assignment.wholeArea)?.name} · ${say('Salón completo','Entire room')}`:layout.tables.filter(t=>selectedIds.includes(t.id)).map(t=>floorTableName(t.name,en)).join(' + ')||say('Toque las mesas del plano','Select tables on the floor plan')}</span><p className={selectedCapacity<assignment.reservation.guests?'short':''}>{selectedCapacity} / {assignment.reservation.guests} {say('lugares','seats')}{selectedCapacity<assignment.reservation.guests&&` · ${assignment.reservation.guests-selectedCapacity} ${say('asientos adicionales','added seats')}`}</p></div>
            {assignment.status!=='finished'&&!!conflicts(data,selectedIds,assignment.reservation.event_date,assignment.reservation.event_time,assignment.duration,assignment.reservation.id).length&&<p className="floorWarning">{say('Hay mesas ocupadas en este horario. Al guardar puede confirmar Guardar de todos modos.','Some tables are booked at this time. On save, you can confirm Save anyway.')}</p>}
            {canEdit&&<><button className="secondary" disabled={busy||!visibleTables.length} onClick={()=>setAssignment({...assignment,wholeArea:activeArea!.id,tableIds:visibleTables.map(t=>t.id)})}>{say('Reservar esta área completa','Reserve this entire area')}</button><button className="primary" disabled={busy||!selectedReservation||!validWindow||!selectedIds.length} onClick={()=>saveAssignment()}>{busy?say('Guardando…','Saving…'):say('Guardar asignación','Save assignment')}</button>{(assignment.revision>0||integrated&&assignment.wholeArea)&&<button className="floorTextButton danger" disabled={busy} onClick={()=>saveAssignment(true)}>{say('Quitar ubicación','Remove location')}</button>}</>}
            <p className="floorFootnote">{say('Finalizada libera las mesas. Este estado no cambia el estado comercial de la reservación.','Finished releases tables. This status does not change the reservation’s business status.')}</p>
          </>:(inspectedTable||showRoom)?<>
            <div className="floorPanelHeader"><h3>{inspectedTable?floorTableName(inspectedTable.name,en).replace(/^M(\d+)$/,say('Mesa $1','Table $1')).replace(/^T(\d+)$/,'Table $1'):say('Agenda del salón','Room schedule')}</h3><button aria-label={say('Cerrar agenda','Close schedule')} onClick={()=>{setInspected(null);setShowRoom(false)}}><X size={18}/></button></div>
            <p>{displayDate(date)} · {activeArea?.name}</p>
            {inspectedTable&&<p>{inspectedTable.seats} {say('lugares','seats')} · {agenda.length} {say('reservaciones del día','reservations for the day')}</p>}
            {emptyRoom}
            {touch?<>            <div className="floorTableQuickActions">
              {canEdit&&integrated&&!!visibleTables.length&&<button type="button" className="primary" disabled={busy||!validWindow} onClick={()=>startReservation(!inspectedTable)}><Plus size={18}/>{inspectedTable?say('Reservar esta mesa','Book this table'):say('Reservar salón completo','Book entire room')}</button>}
              <FloorActionMenu>
                {canEdit&&integrated&&!!visibleTables.length&&<button type="button" disabled={busy||!ready} onClick={()=>{setLinkSearch('');setLinkOpen(true)}}>{say('Vincular reservación','Link reservation')}</button>}
                {canManageLayout&&<button type="button" disabled={busy||!ready} onClick={()=>{beginLayout();setTableId(inspectedTable?.id||'');setOverview(false);setTouchPanel('agenda')}}>{inspectedTable?say('Editar mesa','Edit table'):say('Editar área','Edit area')}</button>}
              </FloorActionMenu>
            </div></>:<>
            {canEdit&&integrated&&!!visibleTables.length&&<button className="primary" disabled={busy||!validWindow} onClick={()=>startReservation(!inspectedTable)}><Plus size={16}/>{inspectedTable?say('Reservar esta mesa','Book this table'):say('Reservar salón completo','Book entire room')}</button>}
            {canEdit&&integrated&&!!visibleTables.length&&<button type="button" className="secondary" disabled={busy||!ready} onClick={()=>{setLinkSearch('');setLinkOpen(true)}}>{say('Vincular reservación','Link reservation')}</button>}
            </>}
            <div className="floorAgenda">{agenda.length?agenda.map(({reservation:r,seating:s})=><article key={r.id} className={s.service_status==='finished'?'finished':''}><FloorContextBooking summary={<><div><strong>{bookingRange(r,s)}</strong><span className="floorBadge">{s.service_status==='finished'?say('Finalizada','Finished'):s.whole_area_id?say('Salón completo','Entire room'):s.service_status==='seated'?say('En mesa','Seated'):say('Reservada','Reserved')}</span></div><b>{r.client_name}</b><small>{r.guests} {say('personas','guests')} · {floorAreaLabel(r.area,s,layout,en)}</small>{floorAddedSeatsLabel(r.guests,s,layout,en)&&<small>{floorAddedSeatsLabel(r.guests,s,layout,en)}</small>}</>}><FloorReservationDetails lazy restaurantId={restaurantId} reservation={r} demo={demo} preferences={preferences} refreshToken={tick+version} en={en}/><div className="floorAgendaActions"><button className="secondary" onClick={()=>chooseReservation(r)}>{say('Ver asignación','View assignment')}</button></div>{reservationActions(r)}</FloorContextBooking></article>):<p className="floorNoRows">{say('No hay reservaciones asignadas en esta fecha.','No reservations assigned on this date.')}</p>}</div>
            <p className="floorFootnote">{say('La agenda muestra todo el día, incluidos eventos que continúan desde el día anterior. Cambie Fecha para consultar otro día.','The schedule covers the whole day, including events continuing from the previous day. Change Date to view another day.')}</p>
          </>:<>
            <div className="floorPanelHeader"><h3>{say('Reservaciones','Reservations')}<span>{reservations.length}</span></h3><Users size={18}/></div>
            <div className="floorSummary"><span><b>{reservations.reduce((s,r)=>s+Number(r.guests||0),0)}</b>{say('personas','guests')}</span><span><b>{unassigned}</b>{say('sin mesa','unassigned')}</span></div>
            <input type="search" aria-label={say('Buscar reservación','Search reservations')} placeholder={say('Buscar cliente…','Search customer…')} value={search} onChange={e=>setSearch(e.target.value)}/>
            <label className="floorCheck"><input type="checkbox" checked={onlyUnassigned} onChange={e=>setOnlyUnassigned(e.target.checked)}/>{say('Solo sin mesa','Unassigned only')}</label>
            <div className="floorReservationList">{filteredReservations.length?filteredReservations.map(r=>{const s=seatFor(r.id),review=s&&needsReview(data,r,s);return <div key={r.id} className="floorReservationCard"><button type="button" className="floorReservation" onClick={()=>chooseReservation(r)}><div><strong>{formatEventTime(r.event_time,timeFormat)}</strong><span>{r.guests} <Users size={13}/></span></div><b>{r.client_name}</b><small>{r.area||'—'} · {r.status}</small>{r.phone&&<small dir="ltr">{r.phone}</small>}<span className={`floorBadge ${review?'review':s?'assigned':''}`}>{review?say('Revisar asignación','Review assignment'):s?s.service_status==='finished'?say('Finalizada','Finished'):floorAreaLabel(r.area,s,layout,en):say('Sin mesa','Unassigned')}</span></button>{!touch&&reservationActions(r)}</div>}):<p className="floorNoRows">{search||onlyUnassigned?say('No hay coincidencias.','No matching reservations.'):say('No hay reservaciones activas para esta fecha. Créelas desde el listado o convierta una cotización.','No active reservations for this date. Create one in the list or convert a quote.')}</p>}</div>
          </>}
        </aside>
  );
  return <FloorTouchContext.Provider value={{enabled:touch,panel:touchPanel,open:setTouchPanel,en,agendaFooter:assignment?<><button type="button" onClick={()=>setTouchPanel(null)}>{say('Elegir mesas','Choose tables')}</button>{canEdit&&<button type="button" className="primary" disabled={busy||!selectedReservation||!validWindow||!selectedIds.length} onClick={()=>saveAssignment()}>{busy?say('Guardando…','Saving…'):say('Guardar asignación','Save assignment')}</button>}</>:layoutDraft?<><button type="button" onClick={()=>setTouchPanel(null)}>{say('Volver al plano','Back to map')}</button><button type="button" className="primary" disabled={busy} onClick={saveLayout}>{say('Guardar plano','Save floor plan')}</button></>:undefined}}><section ref={floorContainer} className={`floorPlan${configuration?' floorConfiguration':''}${touch?' floorTouchMode':''}`} translate="no" aria-label={say('Plano de mesas','Floor plan')}>
    <FloorTouchHeader onAgenda={()=>{if(layoutDraft){setTouchPanel('agenda');return}if(!confirmDiscardChanges())return;setAssignment(null);setInspected(null);setShowRoom(false);setTouchPanel('agenda')}} count={reservations.length} restaurant={restaurantName} date={displayDate(date)} time={allDay?say('Todo el día','All day'):formatEventTime(time,timeFormat)} onPrevious={()=>changeDate(shifted(date,-1))} onNext={()=>changeDate(shifted(date,1))} onList={onBackToList?()=>{if(confirmDiscardChanges())onBackToList()}:undefined} onCreate={showFloor&&integrated&&!layoutDraft&&onCreate&&canEdit?()=>{if(confirmDiscardChanges())onCreate({date,time,areaName:'',selection:defaultFloorSelection(data.revision,windowMinutes)})}:undefined} disabled={inputDisabled||!ready} createDisabled={!validWindow} editing={!!layoutDraft}/>
    <FloorTouchPanel name="tools" title={say('Opciones del plano','Floor options')}><div className="floorHeading"><div><span className="floorEyebrow">UNOMESA · {say('ORGANIZACIÓN DEL SALÓN','DINING ROOM')}</span><h2>{say('Cada grupo, en su lugar','A place for every party')}</h2><p>{say('Organice el espacio y prepare la próxima llegada.','Organize your space and prepare for the next arrival.')}</p></div>
      <div className="floorTopActions">{!configuration&&showFloor&&integrated&&canEdit&&!layoutDraft&&onCreate&&<button className="primary" disabled={busy||!ready||!validWindow} onClick={()=>{if(confirmDiscardChanges())onCreate({date,time,areaName:'',selection:defaultFloorSelection(data.revision,windowMinutes)})}}><Plus size={16}/>{say('Nueva reservación','New reservation')}</button>}{showFloor&&canManageLayout&&!layoutDraft&&<button className="floorEditPrimary" disabled={busy||!ready} onClick={()=>{beginLayout();setTouchPanel(null)}}><Settings2 size={20}/>{say('Editar plano','Edit floor plan')}</button>}<button className="secondary" disabled={busy||demo||loading} onClick={refresh}><RefreshCw size={16}/>{say('Actualizar','Refresh')}</button><details className="floorMoreOptions"><summary><MoreHorizontal size={18}/>{say('Más opciones','More options')}</summary><div><button type="button" className="secondary" disabled={!ready||!!layoutDraft||!!assignment||busy||!layout.areas.length} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');printFloor()}}><Printer size={16}/>{say('Imprimir','Print')}</button><button type="button" className="secondary" disabled={!ready||!!layoutDraft||!!assignment||busy||!layout.areas.length} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');printFloor('pdf')}}><Download size={16}/>{say('Descargar PDF','Download PDF')}</button></div></details></div></div>{touch&&<div className="touchViewChoices"><h3>{say('Vista','View')}</h3><button type="button" aria-pressed={overview} onClick={()=>{setOverview(true);setTouchPanel(null)}}>{say('Mapa completo','Complete map')}</button><button type="button" aria-pressed={!overview} onClick={()=>{setOverview(false);setTouchPanel(null)}}>{say('Mesas por área','Tables by area')}</button>{onBackToList&&<button type="button" onClick={()=>{if(confirmDiscardChanges())onBackToList()}}>{say('Volver al listado','Back to list')}</button>}</div>}{touch&&setupGuide}</FloorTouchPanel>
    {demo&&<div className="floorDemoBanner"><div><strong>{say('Vista de prueba · datos ficticios','Demo view · sample data')}</strong><span>{say('Puede probar el plano. Los cambios de esta vista no se guardan en su restaurante.','Try the floor plan. Changes in this view are not saved to your restaurant.')}</span></div><button className="secondary" disabled={busy} onClick={leaveDemo}>{say('Volver a mis datos','Back to my data')}</button></div>}
    {(!showFloor||!layout.areas.length&&!layoutDraft)&&dateControls}
    {loading&&!demo&&!loadedDateRef.current&&<div className="floorEmpty" role="status">{say('Cargando plano y reservaciones…','Loading floor plan and reservations…')}</div>}
    {missing&&!demo&&<div className="floorEmpty"><LayoutGrid size={36}/><h3>{say('Su plano está listo para activarse','Your floor plan is ready to activate')}</h3><p>{say('Para guardar mesas y asignaciones, active la ampliación 43_PLANO_MESAS.sql incluida en la actualización. El listado de reservaciones sigue disponible.','To save tables and assignments, activate 43_PLANO_MESAS.sql included in the update. The reservation list remains available.')}</p><button className="primary" onClick={startDemo}>{say('Probar con datos de ejemplo','Try sample data')}</button></div>}
    {error&&<div className="floorError" role="alert">{error}{!demo&&!missing&&<button disabled={busy} onClick={refresh}>{say('Actualizar','Refresh')}</button>}</div>}
    {showFloor&&<div className="floorStableView" aria-busy={!ready}>
      {!ready&&<div className="floorDatePending" role="status">{error?say('No se pudo actualizar la fecha. Pulse Actualizar para reintentar.','Could not update this date. Select Refresh to retry.'):say('Actualizando reservaciones…','Updating reservations…')}</div>}
      <div className="floorStableContent">
      <div inert={!ready}>
      {!validWindow&&!layoutDraft&&<p className="floorError" role="alert">{say('Seleccione una hora y duración válida para consultar disponibilidad.','Choose a valid time and duration to check availability.')}</p>}
      {!integrated&&!demo&&<p className="floorWarning">{say('Para reservar desde el plano y conectar cotizaciones, aplique 44_PLANO_FORMULARIOS_COTIZACIONES.sql en el proyecto Supabase conectado a UnoMesa.','To book from the floor plan and connect quotes, apply 44_PLANO_FORMULARIOS_COTIZACIONES.sql in the Supabase project connected to UnoMesa.')}</p>}
      {reviewCount>0&&<p className="floorWarning">{say(`${reviewCount} asignación(es) requiere(n) revisión por cambios en la reserva, capacidad o cruces de horario.`,`${reviewCount} assignment(s) need review because of reservation changes, capacity or time conflicts.`)}</p>}
      {layoutDraft&&<div className="floorEditBanner"><span><Move size={17}/>{overview?say('Organice las áreas en cada nivel.','Arrange areas on each level.'):say('Edición: arrastre las mesas o use las flechas del teclado.','Editing: drag tables or use the arrow keys.')}</span><div><button className="secondary" disabled={busy} onClick={()=>{if(confirmDiscardChanges()){setLayoutDraft(null);setError('')}}}>{say('Cancelar','Cancel')}</button><button className="primary" disabled={busy} onClick={saveLayout}><Check size={16}/>{busy?say('Guardando…','Saving…'):say('Guardar plano','Save floor plan')}</button></div></div>}
      {!touch&&setupGuide}
      </div>
      {!layout.areas.length&&!layoutDraft?<div className="floorEmpty"><Armchair size={42}/><h3>{say('Dibuje su primera distribución','Create your first layout')}</h3><p>{say('Agregue áreas y mesas. Después seleccione una reservación y asigne sus lugares.','Add areas and tables. Then select a reservation and assign seats.')}</p>{canManageLayout&&<button className="primary" onClick={()=>{setLayoutDraft(structuredClone(layout));setLayoutRevision(data.revision)}}>{say('Crear mi plano','Create my floor plan')}</button>}<button className="secondary" onClick={startDemo}>{say('Ver ejemplo interactivo','View interactive example')}</button></div>:<>
      <div inert={!ready}><div className="floorPerspective" role="group" aria-label={say('Vista del restaurante','Restaurant view')}><button type="button" aria-pressed={overview} onClick={()=>setOverview(true)}><LayoutGrid size={17}/>{say('Mapa completo','Complete map')}</button><button type="button" aria-pressed={!overview} onClick={()=>setOverview(false)}><Armchair size={17}/>{say('Mesas por área','Tables by area')}</button>{overview&&!layoutDraft&&activeArea&&<button type="button" className="floorRoomAgendaToggle" aria-pressed={showRoom&&!assignment&&!inspected} onClick={toggleRoomAgenda}>{say('Ver agenda del salón','View room schedule')} · {activeArea.name}</button>}{layoutDraft&&<span>{say('Los cambios se confirman con Guardar plano.','Confirm changes with Save floor plan.')}</span>}</div>
      </div>
      {overview?<RestaurantOverview dayReset={dayReset} allDay={allDay} pending={!ready} dateControls={dateControls} restaurantId={restaurantId} eventAreas={configuredAreas} canEdit={canEdit} canDelete={canDelete} onDelete={onDelete?requestDelete:undefined} demo={demo} preferences={preferences} refreshToken={tick+version} timeFormat={timeFormat} onReservation={chooseReservation} onLinkQuote={linkQuote} onEdit={onEdit} onQuote={onQuote} openQuote={openQuote} layout={layout} data={data} date={displayedDate} availabilityDate={viewingDate} time={mapTime} duration={mapDuration} editing={!!layoutDraft} busy={busy} en={en} areaId={activeArea?.id} onSelect={setArea} selectedTableIds={assignment?selectedIds:inspectedTable?[inspectedTable.id]:showRoom?visibleTables.map(t=>t.id):undefined} detailPanel={!layoutDraft&&(assignment||inspectedTable||showRoom)?sidePanel:undefined} detailTitle={assignment?assignment.reservation.client_name:inspectedTable?`${activeArea?.name} · ${floorTableName(inspectedTable.name,en)}`:showRoom?activeArea?.name:undefined} onOpen={(id,table)=>{if(busy)return;setArea(id);if(layoutDraft){setTableId(table||'');setOverview(false);if(touch)setTouchPanel('agenda');return;}if(table){const selected=layout.tables.find(t=>t.id===table);if(selected)toggleTable(selected);}else if(!assignment){setInspected(null);setShowRoom(true);if(touch)setTouchPanel('agenda');}}} onChange={next=>{if(layoutDraft&&!busy)setLayoutDraft(next)}} tableState={tableState}/>:<>
      <div inert={!ready}><div className="floorAreaBar"><div role="group" aria-label={say('Áreas del plano','Floor plan areas')}>{layout.areas.map(a=><button key={a.id} className={`${a.id===activeArea?.id?'active':''} ${!layoutDraft&&floorAreaAvailability(data,a.id,viewingDate,mapTime,mapDuration).full?'floorAreaFull':''}`} aria-pressed={a.id===activeArea?.id} onClick={()=>{setArea(a.id);setTableId('');setInspected(null);setShowRoom(false)}}>{a.name}<small className="floorLevelTag">{levelName(floorLevels(layout).find(l=>l.id===areaLevel(layout,a))!.name,en)}</small><span>{layout.tables.filter(t=>t.areaId===a.id).length}</span>{!layoutDraft&&floorAreaAvailability(data,a.id,viewingDate,mapTime,mapDuration).full&&<small>{allDay?say('Con reservas hoy','Bookings today'):say('Sin disponibilidad','Unavailable')}</small>}</button>)}{layoutDraft&&<button onClick={addArea} disabled={busy||layout.areas.length>=20}><Plus size={15}/>{say('Área','Area')}</button>}</div>{!layoutDraft&&<span>{freeTables}/{visibleTables.length} {allDay?say('mesas sin reservas hoy','tables without bookings today'):say('mesas disponibles','tables available')}</span>}</div>
      {!layoutDraft&&activeArea&&<div className={`floorRoomSummary ${areaAvailability?.full?'full':''}`}><div><strong>{allDay?say('Reservaciones del salón durante el día','Room reservations throughout the day'):areaAvailability?.whole.length?say('Salón reservado completo','Entire room reserved'):!visibleTables.length?say('Área sin mesas','Area without tables'):areaAvailability?.full?say('Salón sin disponibilidad','Room unavailable'):say('Disponibilidad del salón','Room availability')}</strong><p>{visibleTables.length?`${areaAvailability?.available}/${areaAvailability?.total} ${allDay?say('mesas sin reservas activas hoy.','tables without active bookings today.'):say('mesas libres para todo el intervalo elegido.','tables available for the entire selected interval.')}`:say('Agregue mesas para consultar su disponibilidad.','Add tables to check their availability.')}</p></div><button type="button" className="secondary floorRoomAgendaToggle" aria-pressed={showRoom&&!assignment&&!inspected} onClick={toggleRoomAgenda}>{say('Ver agenda del salón','View room schedule')}</button>{canEdit&&integrated&&<button className="secondary" disabled={!visibleTables.length||busy||!validWindow} onClick={()=>startReservation(true)}>{say('Reservar salón completo','Book entire room')}</button>}</div>}
      {!layoutDraft&&!showRoom&&emptyRoom}
      </div>
      <div className={`floorBody ${map.wide?'mapWide':''}`}>
        <div className="floorMapColumn">
          <div className="floorMapTitle" inert={!ready}><div><h3>{activeArea?.name||say('Nueva área','New area')}</h3><p>{layoutDraft?say('El contorno se ajusta automáticamente alrededor de sus mesas.','The outline automatically fits around your tables.'):assignment?say('Seleccione las mesas para este grupo.','Select tables for this party.'):say('Seleccione una mesa para ver su agenda o crear una reservación.','Select a table to view its schedule or create a reservation.')}</p></div><span><Users size={16}/>{visibleTables.reduce((v,t)=>v+t.seats,0)} {say('lugares','seats')}</span></div>
          {dateControls}
          <div ref={map.viewport} inert={!ready} {...map.bindings} style={{touchAction:'none'}} className={`floorCanvas mapViewport ${map.hand?'mapHandActive':''} ${map.panning?'mapPanning':''}`} tabIndex={0} aria-label={say('Vista desplazable de mesas','Scrollable table view')} aria-busy={loading&&!demo}>
            <svg data-print-title={activeArea?.name||''} data-print-areas={JSON.stringify(activeArea?[activeArea.id]:[])} ref={svg} style={{width:`${map.zoom*100}%`,minWidth:0,height:`${map.zoom*100}%`}} viewBox={`${areaViewport.x} ${areaViewport.y} ${areaViewport.width} ${areaViewport.height}`} role="group" aria-label={say('Distribución de mesas','Table layout')}>
              <defs><pattern id="floor-dots" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#cbd5db" opacity=".55"/></pattern></defs>
              <rect {...areaViewport} fill="url(#floor-dots)"/>
              <rect data-area-contour={activeArea?.id} {...areaBounds} rx="16" fill="none" stroke="#b9c8cc" strokeWidth="3"/>
              {visibleTables.map(t=>{
                const selected=layoutDraft?t.id===tableId:assignment?selectedIds.includes(t.id):inspected===t.id,state=layoutDraft?'free':allDay||validWindow?tableState(t):'review';
                const selectedOrState=selected?'selected':state;
                return <g key={t.id} data-table={t.id} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${floorTableName(t.name,en)} · ${t.seats} ${say('lugares','seats')} · ${stateLabel(selectedOrState)}`} transform={`translate(${t.x*10} ${t.y*6.5})`}
                  onKeyDown={e=>{if(layoutDraft&&!busy&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setTableId(t.id);setLayoutDraft(l=>l?{...l,tables:l.tables.map(v=>v.id===t.id?{...v,x:clamp(v.x+(e.key==='ArrowLeft'?-2:e.key==='ArrowRight'?2:0),8,92),y:clamp(v.y+(e.key==='ArrowUp'?-2:e.key==='ArrowDown'?2:0),10,90)}:v)}:l)}else if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleTable(t)}}}
                  onPointerDown={e=>{if(!layoutDraft||busy||map.hand||e.button!==0)return;e.preventDefault();setTableId(t.id);e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:t.id,x:t.x,y:t.y,px:e.clientX,py:e.clientY,moved:false,pointerId:e.pointerId,layout:layoutDraft}}}
                  onPointerMove={e=>{const d=drag.current,matrix=svg.current?.getScreenCTM();if(!d||d.id!==t.id||d.pointerId!==e.pointerId||!matrix)return;const inverse=matrix.inverse(),from=new DOMPoint(d.px,d.py).matrixTransform(inverse),to=new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse),dx=(to.x-from.x)/10,dy=(to.y-from.y)/6.5;if(Math.abs(dx)+Math.abs(dy)>.5)d.moved=true;if(d.moved)setLayoutDraft(l=>l?{...l,tables:l.tables.map(v=>v.id===d.id?{...v,x:Math.round(clamp(d.x+dx,8,92)),y:Math.round(clamp(d.y+dy,10,90))}:v)}:l)}}
                  onPointerUp={e=>{if(drag.current){const moved=drag.current.moved;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(moved)return}toggleTable(t)}} onPointerCancel={cancelTableDrag}>
                  <FloorTableGraphic allBookings={allDay} bookings={layoutDraft?[]:schedules.get(t.id)} table={t} state={state} selected={selected} editing={!!layoutDraft} en={en}/>
                </g>;
              })}
              {!visibleTables.length&&<text x="500" y="315" textAnchor="middle" fontSize="22" fill="#71838b">{say('Agregue mesas a esta área','Add tables to this area')}</text>}
            </svg>
          </div>
          <div className="floorAreaZoom" inert={!ready}><span>{say('Tamaño de vista','View size')}</span><MapNavigation map={map} en={en} tables/></div>
          <div className="floorLegend">{['free','reserved','seated','review'].map(s=><span key={s}><i className={s}/>{allDay&&s==='reserved'?say('Con reservas hoy','Bookings today'):allDay&&s==='free'?say('Sin reservas activas hoy','No active bookings today'):stateLabel(s)}</span>)}</div>
          <p className="floorFootnote">{say('La disponibilidad considera las asignaciones y su duración. Una reserva con área y sin mesas individuales ocupa el salón completo. Sin área no bloquea lugares.','Availability uses saved assignments and their duration. A reservation with an area and no individual tables reserves the entire room. No area means no seats blocked.')}</p>
        </div>
        <FloorTouchPanel name="agenda" title={layoutDraft?say('Editar mesas','Edit tables'):say('Reservaciones y detalles','Reservations and details')}>{sidePanel}</FloorTouchPanel>
      </div></>}</>}
    </div></div>}
    {touch&&(assignment||layoutDraft)&&<div className="touchSelectionBar"><button type="button" onClick={()=>setTouchPanel('agenda')}><span>{assignment?assignment.reservation.client_name:say('Edición de plano','Editing floor plan')}</span><b>{assignment?`${selectedIds.length} ${say('mesas','tables')}`:say('Editar selección','Edit selection')}</b></button><button type="button" className="primary" disabled={busy||(!!assignment&&(!selectedReservation||!validWindow||!selectedIds.length))} onClick={()=>assignment?saveAssignment():saveLayout()}>{say('Guardar','Save')}</button></div>}
    <FloorTouchEdges/>
    <FloorTouchOverlays>{quoteLink&&canEdit&&<ReservationQuoteLink restaurantId={restaurantId} reservation={quoteLink} close={()=>setQuoteLink(null)} linked={()=>{setQuoteLink(null);setTick(v=>v+1);toast(say('Cotización vinculada','Quote linked'))}}/>}
    {linkOpen&&<Modal title={say('Vincular reservación','Link reservation')} close={()=>setLinkOpen(false)}><div className="floorLinkPicker"><p>{inspectedTable?`${activeArea?.name} · ${floorTableName(inspectedTable.name,en)}`:`${activeArea?.name} · ${say('Salón completo','Entire room')}`} · {displayDate(date)}</p><small>{say('Elija una reserva existente. Revise las mesas propuestas y pulse Guardar asignación. Si pertenecía a otra área, la nueva selección la reemplazará al guardar.','Choose an existing reservation. Review the proposed tables and select Save assignment. If it belonged to another area, saving will replace that selection.')}</small><input type="search" aria-label={say('Buscar reserva para vincular','Search reservation to link')} placeholder={say('Cliente o teléfono…','Customer or phone…')} value={linkSearch} onChange={e=>setLinkSearch(e.target.value)}/><div className="floorLinkList">{reservations.filter(r=>`${r.client_name} ${r.phone}`.toLocaleLowerCase().includes(linkSearch.toLocaleLowerCase())).map(r=>{const s=seatFor(r.id);return <button type="button" key={r.id} className="floorReservation" onClick={()=>linkReservation(r)}><div><strong>{formatEventTime(r.event_time,timeFormat)}</strong><span>{r.guests} <Users size={13}/></span></div><b>{r.client_name}</b><small>{r.area||'—'} · {s?floorAreaLabel(r.area,s,layout,en):say('Sin mesa','Unassigned')}</small></button>})}</div>{!reservations.length&&<p>{say('No hay reservas activas para esta fecha.','No active reservations for this date.')}</p>}</div></Modal>}
    {demoCreate&&<Modal title={say('Reservar en el plano · ejemplo','Book on floor plan · demo')} close={()=>{setDemoCreate(null);setError('')}}><form className="form" onSubmit={saveDemoReservation} translate="no"><p>{say('Datos ficticios. No se guarda en el restaurante.','Sample data. Nothing is saved to the restaurant.')}</p>{error&&<p className="floorWarning" role="alert">{error}</p>}<label>{say('Nombre del cliente','Customer name')}<input required value={demoCreate.name} onChange={e=>setDemoCreate({...demoCreate,name:e.target.value})}/></label><label>{say('Personas','Guests')}<input type="number" min={1} required value={demoCreate.guests} onChange={e=>setDemoCreate({...demoCreate,guests:Number(e.target.value)})}/></label><label>{say('Hora','Time')}<EventTimeInput value={demoCreate.time} format={timeFormat} onChange={time=>setDemoCreate({...demoCreate,time})}/></label><label>{say('Duración (min)','Duration (min)')}<input type="number" min={15} max={1440} required value={demoCreate.selection.duration_minutes} onChange={e=>setDemoCreate({...demoCreate,selection:{...demoCreate.selection,duration_minutes:Number(e.target.value)}})}/></label><p>{floorAreaLabel(demoCreate.areaName,demoCreate.selection,layout,en)||say('Primero seleccione una mesa del plano.','Select a table on the floor plan first.')}</p><button className="primary" type="submit">{say('Crear reservación de ejemplo','Create sample reservation')}</button></form></Modal>}
    {printSnapshot&&<FloorPrintOptions restaurantId={restaurantId} restaurantName={restaurantName} {...printSnapshot} catalog={configuredAreas} en={en} timeFormat={timeFormat} showDeposits={preferences.reservation_show_deposits_list!==false} demo={demo} close={()=>setPrintSnapshot(null)}/>}
    {floorConfirmation.dialog}</FloorTouchOverlays>
  </section></FloorTouchContext.Provider>;
}
