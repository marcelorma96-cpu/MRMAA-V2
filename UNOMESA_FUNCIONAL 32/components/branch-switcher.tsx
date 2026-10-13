'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Building2,ChevronDown,Plus,Search,Check,Archive,ArrowLeft,LoaderCircle} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {AppSheet} from './app-context';
import {useAppPreferences,confirmApp} from './app-preferences';
import {confirmDiscardChanges} from '@/lib/unsaved-changes';
import styles from './branches.module.css';
type Branch={id:string;name:string;sort_name:string;is_principal:boolean;status:string;enabled:boolean;copy_status?:string;copied?:number;error_code?:string};
export function BranchSwitcher({restaurantId,name,onSwitch,onBilling}:{restaurantId:string;name:string;onSwitch:(id:string)=>Promise<void>;onBilling:()=>void}){
 const {language}=useAppPreferences(),en=language==='en',t=(es:string,english:string)=>en?english:es;
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[archived,setArchived]=useState(false),[meta,setMeta]=useState<any>(null),[rows,setRows]=useState<Branch[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[create,setCreate]=useState(false),[newName,setName]=useState(''),[source,setSource]=useState<Branch|null>(null),[options,setOptions]=useState<Record<string,boolean>>({}),[notice,setNotice]=useState('');
 const generation=useRef(0),requestId=useRef('');
 const load=useCallback(async(after?:Branch)=>{const n=++generation.current;setLoading(true);const r=await supabase.rpc('v2_branch_list',{p_restaurant:restaurantId,p_search:search,p_after_name:after?.sort_name||null,p_after_id:after?.id||null,p_archived:archived});if(n!==generation.current)return;setLoading(false);
  if(r.error){setError(en?'Could not load locations. Apply database update 56 and retry.':'No se pudieron cargar las sucursales. Aplique la actualización 56 y reintente.');return;}
  setError('');setMeta(r.data);setRows(r.data.items.slice(0,25));
 },[restaurantId,search,archived,en]);
 useEffect(()=>{if(!open)return;const timer=setTimeout(()=>void load(),180);return()=>{clearTimeout(timer);generation.current++};},[open,load]);
 const api=useCallback(async(action:string,extra:Record<string,unknown>={})=>{const s=await supabase.auth.getSession();const r=await fetch('/api/branches',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.data.session?.access_token}`},body:JSON.stringify({restaurant_id:restaurantId,action,...extra})});const b=await r.json();if(!r.ok)throw new Error(b.error);return b;},[restaurantId]);
 const preparing=rows.some(x=>x.status==='preparing');
 useEffect(()=>{if(!open||!preparing||!meta?.can_manage)return;let cancelled=false;const timer=setTimeout(async()=>{try{await api('progress');if(!cancelled)await load();}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'No se pudo continuar la copia.');}},2500);return()=>{cancelled=true;clearTimeout(timer)};},[open,preparing,rows,api,load,meta?.can_manage]);
 async function run(task:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await task();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar.');}finally{setBusy(false);}}
 function close(){if(busy)return;if(create&&newName&&!confirmApp(t('¿Salir sin crear la sucursal?','Leave without creating this location?')))return;setOpen(false);setCreate(false);}
 async function choose(row:Branch){if(row.status==='preparing')return;if(!confirmDiscardChanges())return;await onSwitch(row.id);setOpen(false);}
 return <>
  <div className={styles.bar}><button className={styles.selector} onClick={()=>{setOpen(true);setNotice('')}} aria-haspopup="dialog"><Building2 size={18}/><span>{name}</span><ChevronDown size={16}/></button></div>
  <AppSheet open={open} title={create?t('Nueva sucursal','New location'):t('Sus sucursales','Your locations')} close={close}>
   <div className={styles.body} aria-busy={busy}>
    {error&&<p role="alert" className={styles.error}>{error}<button onClick={()=>void load()}>{t('Reintentar','Retry')}</button></p>}{notice&&<p role="status">{notice}</p>}
    {create?<form onSubmit={e=>{e.preventDefault();void run(async()=>{if(!requestId.current)requestId.current=crypto.randomUUID();await api('create',{request_id:requestId.current,name:newName,source_id:source?.id||null,options});requestId.current='';setCreate(false);setName('');setNotice(t('Sucursal creada. La preparación continuará por lotes; puede seguir trabajando.','Location created. Setup continues in batches; you can keep working.'));await api('progress');await load();})}}>
     <button type="button" className="secondary" onClick={()=>setCreate(false)}><ArrowLeft size={16}/>{t('Volver','Back')}</button>
     <label>{t('Nombre de la sucursal','Location name')}<input required minLength={2} maxLength={160} value={newName} onChange={e=>setName(e.target.value)} placeholder={t('Ej. Centro histórico','e.g. Downtown')}/></label>
     <p>{source?t(`Copiar desde ${source.name}`,`Copy from ${source.name}`):t('Empezar con una sucursal vacía.','Start with an empty location.')}</p>
     {source&&<fieldset><legend>{t('¿Qué desea copiar?','What would you like to copy?')}</legend>{[['settings','Configuración de formularios','Form settings'],['menus','Menús y productos de cotización','Quote menus and products'],['areas','Salones y capacidades','Rooms and capacities'],['floor','Plano y mesas','Floor plan and tables'],['clients','Clientes','Customers']].map(([key,es,eng])=><label className={styles.check} key={key}><input type="checkbox" checked={!!options[key]} onChange={e=>setOptions(v=>({...v,[key]:e.target.checked,...(key==='floor'&&e.target.checked?{areas:true}:{})}))}/>{t(es,eng)}</label>)}<button type="button" className="secondary" onClick={()=>setOptions({settings:true,menus:true,areas:true,floor:true,clients:true})}>{t('Seleccionar todo','Select all')}</button><p>{t('La copia es independiente. Las reservas, cotizaciones, usuarios y pagos permanecen en su sucursal original.','Copies are independent. Bookings, quotes, users and payments remain in their original location.')}</p></fieldset>}
     <button className="primary" disabled={busy||newName.trim().length<2}>{busy?<LoaderCircle size={18}/>:<Plus size={18}/>} {t('Crear sucursal','Create location')}</button>
    </form>:<>
     {meta&&<div className={styles.summary}><div><strong>{meta.used}</strong> {t('sucursales ·','locations ·')} {meta.capacity>=10000?t('cuenta exenta','complimentary account'):t(`${meta.capacity} en el paquete`,`${meta.capacity} in your package`)}</div>{meta.can_manage&&<button className="secondary" onClick={()=>{setOpen(false);onBilling()}}>{t('Gestionar paquete','Manage package')}</button>}</div>}
     <label className={styles.search}><Search size={18}/><input aria-label={t('Buscar sucursal','Search locations')} placeholder={t('Buscar por nombre…','Search by name…')} value={search} onChange={e=>setSearch(e.target.value)}/></label>
     <label className={styles.check}><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{t('Incluir archivadas','Include archived locations')}</label>
     {loading&&<p role="status">{t('Cargando…','Loading…')}</p>}
     <div className={styles.list}>{rows.map(row=><article key={row.id} className={styles.row}>
      <button disabled={busy||row.status==='preparing'} className={styles.open} onClick={()=>void run(()=>choose(row))}><Building2 size={20}/><span><b>{row.name}</b><small>{row.error_code?t('Copia pendiente · reintento automático','Copy pending · retrying automatically'):row.status==='preparing'?t(`Preparando · ${row.copied||0} registros copiados`,`Preparing · ${row.copied||0} records copied`):row.status==='archived'?t('Archivada · solo consulta','Archived · read only'):!row.enabled?t('Fuera del paquete · solo consulta','Outside package · read only'):row.is_principal?t('Cuenta principal','Principal account'):t('Sucursal','Location')}</small></span>{row.id===restaurantId&&<Check size={18}/>}</button>
      {meta?.can_manage&&<div className={styles.rowActions}>{row.enabled&&<button onClick={()=>{setSource(row);setOptions({settings:true,menus:true,areas:true,floor:true});setCreate(true);setName('');requestId.current=''}}>{t('Crear a partir de esta','Copy to new location')}</button>}{!row.is_principal&&<button disabled={busy} onClick={()=>void run(async()=>{if(!confirmApp(row.status==='archived'?t('¿Restaurar esta sucursal?','Restore this location?'):t('¿Archivar esta sucursal? Se conservarán sus datos y quedará en modo de consulta.','Archive this location? Its data will remain available in read-only mode.')))return;await api(row.status==='archived'?'restore':'archive',{branch_id:row.id});await load();window.dispatchEvent(new Event('mrmaa:billing-updated'));})}><Archive size={14}/>{row.status==='archived'?t('Restaurar','Restore'):t('Archivar','Archive')}</button>}</div>}
     </article>)}</div>
     {!loading&&!rows.length&&<p>{t('No hay sucursales que coincidan.','No matching locations.')}</p>}
     <div className={styles.actions}><button className="secondary" disabled={loading} onClick={()=>void load()}>{t('Inicio','First page')}</button>{meta?.more&&<button className="secondary" disabled={loading} onClick={()=>void load(rows.at(-1))}>{t('Siguientes 25','Next 25')}</button>}</div>
     {meta?.can_manage&&<button className="primary" disabled={busy} onClick={()=>{setSource(null);setOptions({});setCreate(true);setName('');requestId.current=''}}><Plus size={18}/>{t('Nueva sucursal','New location')}</button>}
     <p className={styles.help}>{t('Cada sucursal conserva sus propios registros y permisos. Para asignar un equipo, abra la sucursal y vaya a Configuración → Usuarios.','Each location has separate records and permissions. To assign a team, open the location and go to Settings → Users.')}</p>
    </>}
   </div>
  </AppSheet>
 </>;
}
