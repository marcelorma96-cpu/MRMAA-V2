"use client";
import {useEffect,useRef,useState} from 'react';
import {Building2,ChevronLeft,ChevronRight,Search,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {userMessage} from '@/lib/user-message';
import {teamRoles,type PermissionDraft} from '@/lib/team-access';
import styles from './team-branch-access.module.css';

type Item={id:string;name:string;role:string|null;status:string|null;assigned:boolean;is_principal:boolean;writable:boolean;branch_status:string};
type Cursor={name:string;id:string}|null;
type Catalog={company:string;can_manage_branches:boolean;items:Item[];assigned_count:number;next:Cursor};
export function TeamBranchAccess({restaurantId,userId,changes,onChange,onReady,en=false,disabled=false}:{restaurantId:string;userId?:string;changes:PermissionDraft;onChange:(value:PermissionDraft)=>void;onReady:(ready:boolean)=>void;en?:boolean;disabled?:boolean}){
 const [catalog,setCatalog]=useState<Catalog|null>(null),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[cursors,setCursors]=useState<Cursor[]>([null]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const version=useRef(0),readyRef=useRef(onReady);readyRef.current=onReady;
 const cursor=cursors[cursors.length-1];
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setCursors([null]);},250);return()=>clearTimeout(timer)},[search]);
 useEffect(()=>{
  const generation=++version.current;const controller=new AbortController();setLoading(true);setError('');readyRef.current(false);
  (async()=>{try{
   const session=await supabase.auth.getSession();if(!session.data.session)throw new Error(en?'Sign in again.':'Inicie sesión de nuevo.');
   const params=new URLSearchParams({access:'1',search:query});if(userId)params.set('user',userId);if(cursor){params.set('after_name',cursor.name);params.set('after_id',cursor.id)}
   const response=await fetch('/api/users?'+params,{headers:{Authorization:`Bearer ${session.data.session.access_token}`,'X-Unomesa-Restaurant':restaurantId},signal:controller.signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudieron cargar las sucursales.');
   if(generation!==version.current)return;setCatalog(data);readyRef.current(true);
  }catch(e){if(generation===version.current&&!controller.signal.aborted){setError(userMessage(e));readyRef.current(false)}}finally{if(generation===version.current)setLoading(false)}})();
  return()=>{controller.abort();version.current++};
 },[restaurantId,userId,query,cursor,retry,en]);
 const chosen=Object.values(changes);
 const count=userId?Math.max(0,(catalog?.assigned_count||0)+chosen.reduce((n,x)=>n+(x.selected?1:0)-(x.expected?1:0),0)):chosen.filter(x=>x.selected).length;
 function change(item:Item,selected:boolean,role:string){
  const expected=changes[item.id]&&Object.hasOwn(changes[item.id],'expected')?changes[item.id].expected:(item.assigned?{role:item.role!,status:item.status!}:null);
  const next={...changes};
  if(userId&&selected===item.assigned&&(!selected||role===item.role))delete next[item.id];
  else next[item.id]={id:item.id,name:item.name,selected,role,expected};
  onChange(next);
 }
 return <fieldset className={styles.card} disabled={disabled} translate="no">
  <legend><ShieldCheck size={18}/>{en?'Allowed locations':'Sucursales permitidas'}</legend>
  <div className={styles.heading}><div><strong>{catalog?.company|| (en?'Your business':'Su empresa')}</strong><p>{catalog?.can_manage_branches?(en?'Choose each location and its role. Other locations stay private.':'Seleccione las sucursales y el rol en cada una. Las demás permanecerán privadas.'):(en?'Only the primary administrator can assign other locations.':'Solo el administrador principal puede asignar otras sucursales.')}</p></div><span className={styles.count}>{count} {en?'selected':count===1?'seleccionada':'seleccionadas'}</span></div>
  {(catalog?.can_manage_branches||search)&&<label className={styles.search}><Search size={17}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={en?'Find location…':'Buscar sucursal…'} aria-label={en?'Find location':'Buscar sucursal'}/></label>}
  {error?<div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(x=>x+1)}>{en?'Retry':'Reintentar'}</button></div>:<div className={styles.list} aria-busy={loading}>
   {loading&&<p className={styles.loading} role="status">{en?'Loading locations…':'Cargando sucursales…'}</p>}
   {!loading&&catalog?.items.map(item=>{const draft=changes[item.id],selected=draft?draft.selected:userId?item.assigned:item.id===restaurantId,role=draft?.role||item.role||'operacion';return <div key={item.id} className={`${styles.row} ${selected?styles.selected:''}`}>
    <label className={styles.choice}><input type="checkbox" checked={selected} disabled={!item.writable&&!selected} onChange={e=>change(item,e.target.checked,role)}/><Building2 size={18}/><span><b>{item.name}</b><small>{item.id===restaurantId?(en?'Current location':'Sucursal actual'):item.is_principal?(en?'Primary location':'Sucursal principal'):''}{item.branch_status==='archived'?(en?' · Archived':' · Archivada'):item.status==='inactivo'?(en?' · Access disabled':' · Acceso desactivado'):item.status==='invitado'?(en?' · Invitation pending':' · Invitación pendiente'):''}</small></span></label>
    {selected&&<label className={styles.role}><span>{en?'Role':'Rol'}</span><select aria-label={`${en?'Role in':'Rol en'} ${item.name}`} disabled={!item.writable} value={role==='admin'?'administrador':role} onChange={e=>change(item,true,e.target.value)}>{teamRoles.map(r=><option key={r.value} value={r.value}>{en?r.en:r.es}</option>)}</select></label>}
   </div>})}
   {!loading&&!catalog?.items.length&&<p>{en?'No matching locations.':'No se encontraron sucursales.'}</p>}
  </div>}
  {(cursors.length>1||catalog?.next)&&<nav className={styles.pager} aria-label={en?'Location pages':'Páginas de sucursales'}><button type="button" disabled={loading||cursors.length===1} onClick={()=>setCursors(x=>x.slice(0,-1))}><ChevronLeft size={16}/>{en?'Previous':'Anterior'}</button><span>{en?'Page':'Página'} {cursors.length}</span><button type="button" disabled={loading||!catalog?.next} onClick={()=>setCursors(x=>[...x,catalog!.next])}>{en?'Next':'Siguiente'}<ChevronRight size={16}/></button></nav>}
  {userId&&count===0&&<p className={styles.error} role="status">{en?"To remove the last location, close the editor and use Delete in the user list.":"Para retirar el último acceso, cierre la edición y use Eliminar en la lista de usuarios."}</p>}
  <p className={styles.help}>{en?'With one location, the user enters directly. With several, they can switch between their assigned locations from the restaurant menu.':'Con una sucursal, el usuario ingresa directamente. Con varias, puede cambiar entre las autorizadas desde el menú del restaurante.'}</p>
 </fieldset>;
}
