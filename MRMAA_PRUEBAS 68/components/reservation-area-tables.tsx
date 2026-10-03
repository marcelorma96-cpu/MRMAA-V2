"use client";
import {floorTableName} from '@/lib/floor-table-label';
import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import {Armchair,LayoutGrid,Pencil,Trash2} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {permissionsFor} from '@/lib/permissions';
import {confirmDiscardChanges} from '@/lib/unsaved-changes';
import {floorEventArea,emptyFloor,floorError,type EventArea,type FloorData} from '@/lib/floor-plan';
import {areaLevel,floorDefaultDuration,floorLevels,levelName} from '@/lib/restaurant-map';
import {localDateISO} from '@/lib/local-date';
import {Modal} from './dashboard-ui';
import {FloorDurationInput} from './floor-duration-input';
import {floorWithCatalog} from '@/lib/floor-area-sync';
const Editor=dynamic(()=>import('./floor-plan').then(m=>m.FloorPlan));
export function ReservationAreaTables({restaurantId,restaurantName,areas,onAreaCreated,editId,disabled,readOnly,en,onRename,onRemove}:{restaurantId:string;restaurantName:string;areas:EventArea[];onAreaCreated:(area:EventArea)=>void;editId:string;disabled:boolean;readOnly:boolean;en:boolean;onRename:(area:EventArea)=>void;onRemove:(area:EventArea)=>void}){
 const [storedData,setData]=useState<FloorData>(emptyFloor),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[canManage,setCanManage]=useState(false),[saving,setSaving]=useState(false),[minutes,setMinutes]=useState(180);
 const data=useMemo(()=>floorWithCatalog(storedData,areas),[storedData,areas]);
 const [editor,setEditor]=useState<{eventAreaId?:string;tableId?:string;overview?:boolean}|null>(null),date=localDateISO(),say=(es:string,eng:string)=>en?eng:es;
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');
  (async()=>{const [floor,member]=await Promise.all([supabase.rpc('v2_floor_read',{p_restaurant_id:restaurantId,p_date:date}).abortSignal(c.signal),supabase.rpc('v2_effective_membership',{p_restaurant:restaurantId}).abortSignal(c.signal)]);if(c.signal.aborted)return;if(floor.error)throw floor.error;if(member.error)throw member.error;setData(floor.data);setMinutes(floorDefaultDuration(floor.data.layout));setCanManage(!readOnly&&permissionsFor(member.data?.role,member.data?.status).canManageSchedules);setLoading(false)})().catch(e=>{if(!c.signal.aborted){setError(floorError(e,en));setLoading(false)}});
  return()=>c.abort();
 },[restaurantId,date,retry,readOnly,en]);
 function open(value:NonNullable<typeof editor>){if(!loading&&!error&&!saving&&confirmDiscardChanges())setEditor(value)}
 return <div className="areaTableSettings" translate="no">
  <div className="areaMapHeading"><div><b>{say('Áreas, mesas y niveles','Areas, tables and levels')}</b><p>{say('Una misma distribución en Configuración, reservas y cotizaciones.','One layout across Settings, reservations and quotes.')}</p></div><button type="button" className="secondary" disabled={loading||!!error||saving} onClick={()=>open({overview:true})}><LayoutGrid size={18}/>{say('Mapa completo del restaurante','Complete restaurant map')}</button></div>
  {loading&&<p role="status">{say('Cargando mesas…','Loading tables…')}</p>}{error&&<p className="floorWarning" role="alert">{error} <button type="button" onClick={()=>setRetry(v=>v+1)}>{say('Reintentar','Retry')}</button></p>}
  <div className="areaTableCards" role="region" aria-label={say('Áreas de reservaciones guardadas','Saved reservation areas')}>
   {areas.map(a=>{const rooms=data.layout.areas.filter(room=>floorEventArea(room,areas)?.id===a.id),tables=data.layout.tables.filter(t=>rooms.some(room=>room.id===t.areaId));return <article key={a.id} className={editId===a.id?'catalogSettingsEditing':''} data-settings-area={a.id}>
    <div className="areaTableCardHeading"><div><h4>{a.name}</h4>{!loading&&!error&&<small>{rooms.map(room=>levelName(floorLevels(data.layout).find(l=>l.id===areaLevel(data.layout,room))!.name,en)).join(' · ')||say('Sin distribución aún','No layout yet')} · {tables.length} {say('mesas','tables')} · {tables.reduce((n,t)=>n+t.seats,0)} {say('lugares','seats')}</small>}</div><div className="rowActions"><button type="button" disabled={disabled||saving} aria-label={`${say('Editar área','Edit area')}: ${a.name}`} onClick={()=>onRename(a)}><Pencil size={15}/>{say('Nombre','Name')}</button><button type="button" disabled={disabled||saving} aria-label={`${say('Eliminar área','Delete area')}: ${a.name}`} onClick={()=>onRemove(a)}><Trash2 size={15}/></button></div></div>
    {!loading&&!error&&<><div className="areaTableChips">{tables.map(t=><button type="button" key={t.id} disabled={saving} aria-label={`${say(canManage?'Editar mesa':'Ver mesa',canManage?'Edit table':'View table')} ${floorTableName(t.name,en)} · ${a.name}`} onClick={()=>open({eventAreaId:a.id,tableId:t.id})}><Armchair size={14}/><b>{floorTableName(t.name,en)}</b><span>{t.seats}</span></button>)}{!tables.length&&<small>{say('Ya aparece en el plano, sin mesas. Agréguelas cuando esté listo.','Already on the floor plan, without tables. Add them when ready.')}</small>}</div><button type="button" className="areaEditTables" disabled={saving} onClick={()=>open({eventAreaId:a.id})}>{say(canManage?'Agregar o editar mesas':'Ver mesas',canManage?'Add or edit tables':'View tables')}<Pencil size={14}/></button></>}
   </article>})}
  </div>
  {!loading&&!error&&<div className="areaDefaultDuration"><FloorDurationInput restaurantId={restaurantId} date={date} data={data} value={minutes} onChange={setMinutes} canRemember={canManage} disabled={!canManage||saving} onSaved={next=>setData(next)} onBusy={setSaving} en={en}/><p>{say('Duración predeterminada para nuevos eventos. Las reservas guardadas conservan su duración. Administradores y gerentes pueden cambiar este valor compartido.','Default duration for new events. Saved reservations keep their duration. Administrators and managers can change this shared value.')}</p></div>}
  {editor&&<Modal wide title={say('Áreas y mesas del restaurante','Restaurant areas and tables')} close={()=>{if(!saving&&confirmDiscardChanges())setEditor(null)}}><Editor restaurantId={restaurantId} restaurantName={restaurantName} eventAreas={areas} onAreaCreated={onAreaCreated} canEdit={false} canManageLayout={canManage} configuration initialEditor={editor} onBusyChange={setSaving} onLayoutSaved={next=>{setSaving(false);setData(next);setMinutes(floorDefaultDuration(next.layout));setEditor(null)}}/></Modal>}
 </div>;
}
