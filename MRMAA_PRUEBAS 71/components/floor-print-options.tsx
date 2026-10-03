"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Modal} from './dashboard-ui';
import {formatAppMoney} from './app-preferences';
import {supabase} from '@/lib/supabase';
import {needsNativePdfViewer,reserveQuotePrintWindow,openQuotePrintDocument,printHtml} from '@/lib/print';
import {floorPrintBookings,floorPrintHtml,readFloorPrintDetails,type FloorPrintMap,type FloorPrintMode} from '@/lib/floor-print';
import {conflicts,needsReview,type EventArea,type FloorData} from '@/lib/floor-plan';
import {areaLevel,floorLevels,levelName} from '@/lib/restaurant-map';
import {RestaurantOverview} from './restaurant-overview';
type Props={restaurantId:string;restaurantName:string;date:string;map:FloorPrintMap;data:FloorData;catalog:EventArea[];en:boolean;timeFormat?:string;showDeposits:boolean;demo:boolean;close:()=>void;output?:'print'|'pdf';time:string;duration:number};
export function FloorPrintOptions({restaurantId,restaurantName,date,map,data,catalog,en,timeFormat,showDeposits,demo,close,output='print',time,duration}:Props){
 const say=(es:string,eng:string)=>en?eng:es,levels=floorLevels(data.layout);
 const [mode,setMode]=useState<FloorPrintMode>('both'),[scope,setScope]=useState<'all'|'visible'>('all'),[cancelled,setCancelled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [mapScope,setMapScope]=useState<'all'|'level'|'current'>('all'),[levelId,setLevelId]=useState(()=>areaLevel(data.layout,data.layout.areas.find(a=>map.areaIds.includes(a.id))||data.layout.areas[0]));
 const [pdfFile,setPdfFile]=useState<{url:string;name:string}|null>(null),pdfUrlRef=useRef(''),nativeTarget=useRef<Window|null>(null),mapsRef=useRef<HTMLDivElement>(null);
 const controller=useRef<AbortController|null>(null),lock=useRef(false);
 const selectedLevels=levels.filter(l=>mapScope==='all'||l.id===levelId),hasMap=mode==='map'||mode==='both';
 const areaIds=mapScope==='current'?map.areaIds:data.layout.areas.filter(a=>mapScope==='all'||areaLevel(data.layout,a)===levelId).map(a=>a.id);
 const mapTitle=mapScope==='all'?say('Mapa completo del restaurante','Complete restaurant map'):mapScope==='current'?map.title:levelName(levels.find(l=>l.id===levelId)?.name||'',en);
 useEffect(()=>()=>{controller.current?.abort();if(pdfUrlRef.current)URL.revokeObjectURL(pdfUrlRef.current);nativeTarget.current?.close()},[]);
 useEffect(()=>{if(pdfUrlRef.current)URL.revokeObjectURL(pdfUrlRef.current);pdfUrlRef.current='';setPdfFile(null);setError('')},[mode,scope,cancelled,mapScope,levelId]);
 const bookings=useMemo(()=>floorPrintBookings(data,date,catalog,scope==='all'?null:areaIds,cancelled),[data,date,catalog,scope,mapScope,levelId,cancelled]);
 const states=useMemo(()=>new Map(data.layout.tables.map(table=>{const occupied=conflicts(data,[table.id],date,time,duration);return [table.id,occupied.some(s=>{const r=data.reservations.find(r=>r.id===s.reservation_id);return r&&needsReview(data,r,s)})?'review':occupied.some(s=>s.service_status==='seated')?'seated':occupied.length?'reserved':'free']})),[data,date,time,duration]);
 function captureMaps():FloorPrintMap[]{
  if(!hasMap)return [];
  if(mapScope==='current')return [map];
  const nodes=Array.from(mapsRef.current?.querySelectorAll<SVGSVGElement>('svg[data-print-level]')||[]);
  if(nodes.length!==selectedLevels.length)throw Error('FLOOR_IMAGE_MISSING');
  return nodes.map(node=>({svg:new XMLSerializer().serializeToString(node),title:node.getAttribute('data-print-title')||'',areaIds:JSON.parse(node.getAttribute('data-print-areas')||'[]'),windowLabel:map.windowLabel}));
 }
 async function generate(){if(lock.current)return;lock.current=true;setBusy(true);setError('');const c=new AbortController();controller.current=c;
  const safari=/Safari/i.test(navigator.userAgent)&&!/Chrome|Chromium|CriOS|Edg|Android/i.test(navigator.userAgent),nativeViewer=output==='pdf'&&(needsNativePdfViewer()||safari),target=nativeViewer?reserveQuotePrintWindow(say('Plano de mesas','Floor plan'),say('Preparando PDF…','Preparing PDF…')):null;nativeTarget.current=target;
  try{const details=mode==='details'&&!demo?await readFloorPrintDetails(supabase,restaurantId,bookings.map(b=>b.reservation),c.signal):undefined;
   if(c.signal.aborted)return;
   const maps=captureMaps(),input={restaurant:restaurantName,date,mode,map,maps,data,bookings,details,en,timeFormat,showDeposits,money:formatAppMoney,scope:mode==='map'?mapTitle:scope==='all'?say('Todas las áreas','All areas'):mapTitle,includeCancelled:cancelled,demo};
   if(output==='pdf'){
    const {createFloorPdf}=await import('@/lib/floor-pdf');const pdf=await createFloorPdf(input,c.signal);if(c.signal.aborted)return;
    const blob=pdf.output('blob');if(pdfUrlRef.current)URL.revokeObjectURL(pdfUrlRef.current);const url=URL.createObjectURL(blob),name=`unomesa-${mode}-${mapScope==='all'?'all-levels':mapScope==='level'?'level':'view'}-${date}.pdf`;pdfUrlRef.current=url;setPdfFile({url,name});
    if(nativeViewer){const result=openQuotePrintDocument(blob,target);nativeTarget.current=null;if(!result.opened)URL.revokeObjectURL(result.url)}
    else {const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();}
   }else printHtml(floorPrintHtml(input),{translated:true});
  }catch(e){target?.close();nativeTarget.current=null;if(!c.signal.aborted){const reason=String(e);setError(reason.includes('FLOOR_PRINT_STALE')?say('Los datos cambiaron. Cierre, actualice el plano y vuelva a intentarlo.','Data changed. Close, refresh the map and try again.'):reason.includes('FLOOR_IMAGE')?say('No se pudo preparar la imagen del plano. Intente con un nivel o vuelva a abrir el plano.','Could not prepare the map image. Try one floor or reopen the floor plan.'):say('No se pudo generar el documento. Intente de nuevo.','Could not generate the document. Please try again.'));}}
  finally{lock.current=false;if(!c.signal.aborted)setBusy(false)}
 }
 return <Modal title={output==='pdf'?say('Descargar PDF del plano','Download floor plan PDF'):say('Imprimir plano y reservaciones','Print floor plan and reservations')} close={()=>{controller.current?.abort();close()}}><div className="floorPrintOptions" translate="no">
  <fieldset disabled={busy}><legend>{say('Contenido del documento','Document contents')}</legend>{([['map','Solo plano','Map only'],['both','Plano y reservaciones','Map and reservations'],['reservations','Solo reservaciones','Reservations only'],['details','Reservaciones con datos completos','Reservations with full details']] as const).map(([id,es,eng])=><label key={id}><input type="radio" name="floor-print-mode" value={id} checked={mode===id} onChange={()=>setMode(id)}/><span>{say(es,eng)}</span></label>)}</fieldset>
  {(hasMap||scope==='visible')&&<><label>{say('Áreas y niveles','Rooms and floors')}<select aria-label={say('Áreas y niveles','Rooms and floors')} disabled={busy} value={mapScope} onChange={e=>setMapScope(e.target.value as typeof mapScope)}><option value="all">{say('Mapa completo · Todos los niveles','Complete map · All floors')}</option><option value="level">{say('Un nivel','One floor')}</option><option value="current">{say('Área o nivel que estaba viendo','Area or floor I was viewing')}</option></select></label>{mapScope==='level'&&<label>{say('Nivel','Floor')}<select aria-label={say('Nivel del documento','Document floor')} disabled={busy} value={levelId} onChange={e=>setLevelId(e.target.value)}>{levels.map(l=><option key={l.id} value={l.id}>{levelName(l.name,en)}</option>)}</select></label>}{hasMap&&<p>{mapScope==='all'?say('Incluye todos los niveles, una página por nivel.','Includes every floor, one page per floor.'):mapTitle}. {say('Sin el recorte del zoom.','Without the zoom crop.')}</p>}</>}
  {mode!=='map'&&<><label>{say('Reservaciones','Reservations')}<select aria-label={say('Reservaciones del documento','Document reservations')} disabled={busy} value={scope} onChange={e=>setScope(e.target.value as 'all'|'visible')}><option value="all">{say('Todas las áreas del restaurante','All restaurant areas')}</option><option value="visible">{say('Solo áreas o nivel elegidos','Only selected rooms or floor')}</option></select></label><label className="floorPrintCheck"><input type="checkbox" disabled={busy} checked={cancelled} onChange={e=>setCancelled(e.target.checked)}/>{say('Incluir canceladas','Include canceled')}</label><p>{bookings.length} {say('reservaciones · incluye las que continúan del día anterior.','reservations · includes those continuing from the previous day.')}</p></>}
  {pdfFile&&<div className="floorPdfReady" role="status"><b>{say('PDF listo','PDF ready')}</b><p>{say('Si la descarga no comenzó, pulse Descargar archivo.','If the download did not start, select Download file.')}</p><div><a className="primary" href={pdfFile.url} download={pdfFile.name}>{say('Descargar archivo','Download file')}</a><a className="secondary" href={pdfFile.url} target="_blank" rel="noopener">{say('Abrir PDF','Open PDF')}</a></div></div>}
  {error&&<p role="alert" className="floorWarning">{error}</p>}<div className="actions"><button type="button" className="secondary" onClick={()=>{controller.current?.abort();close()}}>{say('Cerrar','Close')}</button><button type="button" className="primary" disabled={busy} onClick={generate}>{busy?say('Preparando…','Preparing…'):output==='pdf'?say('Descargar PDF','Download PDF'):say('Imprimir','Print')}</button></div>
  {hasMap&&mapScope!=='current'&&<div hidden aria-hidden="true" inert ref={mapsRef}>{selectedLevels.map(l=><RestaurantOverview key={l.id} exportLevelId={l.id} restaurantId={restaurantId} eventAreas={catalog} layout={data.layout} data={data} date={date} time={time} duration={duration} editing={false} busy={false} en={en} tableState={t=>states.get(t.id)||'free'} onSelect={()=>{}} onOpen={()=>{}} onChange={()=>{}} demo={demo} canEdit={false} preferences={{}} refreshToken={0} timeFormat={timeFormat} onReservation={()=>{}}/>)}</div>}
 </div></Modal>;
}
