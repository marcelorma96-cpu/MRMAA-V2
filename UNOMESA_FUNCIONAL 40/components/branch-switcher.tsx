'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Building2,ChevronDown,Plus,Search,Check,Archive,ArrowLeft,LoaderCircle,Copy,PenLine,Trash2,RotateCcw} from 'lucide-react';
import {supabase} from '@/lib/supabase';
import {AppSheet} from './app-context';
import {useAppPreferences,confirmApp} from './app-preferences';
import {confirmDiscardChanges} from '@/lib/unsaved-changes';
import styles from './branches.module.css';
type Branch={id:string;name:string;sort_name:string;is_principal:boolean;status:string;enabled:boolean;copy_status?:string;copied?:number;error_code?:string;purge_after?:string;recoverable?:boolean};
type Cursor={sort_name:string;id:string};
const copyDefaults={settings:true,menus:true,areas:true,floor:true,clients:false};
const copyFields=[['settings','Configuración de formularios','Form settings'],['menus','Menús y productos de cotización','Quote menus and products'],['areas','Salones y capacidades','Rooms and capacities'],['floor','Plano y mesas','Floor plan and tables'],['clients','Clientes','Customers']];
/** Bounded, searchable source picker: even a large company never loads every location. */
function CopySource({restaurantId,source,onChange}:{restaurantId:string;source:Branch|null;onChange:(row:Branch)=>void}){
 const {language}=useAppPreferences(),en=language==='en';
 const [search,setSearch]=useState(''),[cursor,setCursor]=useState<Cursor|null>(null),[rows,setRows]=useState<Branch[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let cancelled=false;const timer=setTimeout(async()=>{setBusy(true);try{const r=await supabase.rpc('v2_branch_list',{p_restaurant:restaurantId,p_search:search,p_after_name:cursor?.sort_name||null,p_after_id:cursor?.id||null,p_archived:false});if(cancelled)return;if(r.error)throw r.error;setRows(r.data.items.slice(0,25));setMore(r.data.more);setError('');}catch{if(!cancelled)setError(en?'Could not load source locations. Retry.':'No se pudieron cargar los orígenes. Reintente.');}finally{if(!cancelled)setBusy(false)}},180);return()=>{cancelled=true;clearTimeout(timer)}},[restaurantId,search,cursor,en,retry]);
 return <div className={styles.sourcePicker}>
  <label>{en?'Copy from':'Copiar desde'}<input type="search" placeholder={en?'Search source location…':'Buscar sucursal de origen…'} value={search} onChange={e=>{setSearch(e.target.value);setCursor(null)}}/></label>
  {source&&<p className={styles.selection}><Check size={16}/>{source.name}</p>}
  {error&&<p role="alert">{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>{en?'Retry':'Reintentar'}</button></p>}
  <div className={styles.sources} aria-busy={busy}>{rows.filter(r=>r.enabled).map(row=><button type="button" key={row.id} aria-pressed={source?.id===row.id} onClick={()=>onChange(row)}><Building2 size={17}/><span>{row.name}</span>{source?.id===row.id&&<Check size={17}/>}</button>)}</div>
  {!rows.length&&<p role="status">{busy?(en?'Loading sources…':'Cargando orígenes…'):(en?'No matching active location.':'No hay una sucursal activa que coincida.')}</p>}
  {(cursor||more)&&<div className={styles.actions}>{cursor&&<button type="button" className="secondary" disabled={busy} onClick={()=>setCursor(null)}>{en?'First page':'Inicio'}</button>}{more&&<button type="button" className="secondary" disabled={busy} onClick={()=>setCursor(rows.at(-1)||null)}>{en?'Next 25':'Siguientes 25'}</button>}</div>}
 </div>;
}
export function BranchSwitcher({restaurantId,name,onSwitch,onBilling,onChanged}:{restaurantId:string;name:string;onSwitch:(id:string)=>Promise<void>;onBilling:()=>void;onChanged?:()=>Promise<void>}){
 const {language}=useAppPreferences(),en=language==='en',t=(es:string,english:string)=>en?english:es;
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[archived,setArchived]=useState(false),[trash,setTrash]=useState(false),[meta,setMeta]=useState<any>(null),[rows,setRows]=useState<Branch[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[view,setView]=useState<'list'|'create'|'edit'>('list'),[newName,setName]=useState(''),[editing,setEditing]=useState<Branch|null>(null),[copy,setCopy]=useState(false),[source,setSource]=useState<Branch|null>(null),[options,setOptions]=useState<Record<string,boolean>>(copyDefaults),[notice,setNotice]=useState(''),[cursor,setCursor]=useState<Cursor|null>(null);
 const generation=useRef(0),requestId=useRef(''),busyRef=useRef(false);
 const load=useCallback(async(silent=false)=>{const n=++generation.current;if(!silent)setLoading(true);try{
  const r=await supabase.rpc(trash?'v2_branch_trash_list':'v2_branch_list',{p_restaurant:restaurantId,p_search:search,p_after_name:cursor?.sort_name||null,p_after_id:cursor?.id||null,...(!trash?{p_archived:archived}:{})});if(n!==generation.current)return;
  if(r.error)throw r.error;setError('');setMeta((old:any)=>({...old,...r.data}));setRows(r.data.items.slice(0,25));
 }catch{if(n===generation.current)setError(t('No se pudieron cargar las sucursales. Reintente; la papelera requiere SQL 57.','Could not load locations. Retry; trash requires database update 57.'));}finally{if(n===generation.current)setLoading(false)}
 },[restaurantId,search,archived,trash,cursor,en]);
 useEffect(()=>{if(!open||view!=='list')return;const timer=setTimeout(()=>void load(),180);return()=>{clearTimeout(timer);generation.current++};},[open,view,load]);
 const api=useCallback(async(action:string,extra:Record<string,unknown>={})=>{const s=await supabase.auth.getSession();const r=await fetch('/api/branches',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.data.session?.access_token}`},body:JSON.stringify({restaurant_id:restaurantId,action,...extra})});const b=await r.json();if(!r.ok)throw new Error(b.error);return b;},[restaurantId]);
 const preparing=rows.some(x=>x.status==='preparing');
 useEffect(()=>{if(!open||view!=='list'||trash||busy||!preparing||!meta?.can_manage)return;let cancelled=false;const timer=setTimeout(async()=>{try{await api('progress');if(!cancelled)await load(true)}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'No se pudo continuar la copia.')}},5000);return()=>{cancelled=true;clearTimeout(timer)}},[open,view,trash,busy,preparing,rows,api,load,meta?.can_manage]);
 async function run(task:()=>Promise<void>){if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await task()}catch(e){setError(e instanceof Error?e.message:t('No se pudo completar.','Could not complete.'))}finally{busyRef.current=false;setBusy(false)}}
 function leaveForm(){if(busyRef.current)return false;if(view!=='list'&&(newName.trim()||copy)&&!confirmApp(t('¿Descartar los cambios sin guardar?','Discard unsaved changes?')))return false;setView('list');return true}
 function close(){if(leaveForm())setOpen(false)}
 function startCreate(){setView('create');setName('');setCopy(false);setSource(null);setOptions(copyDefaults);setNotice('');setError('');requestId.current=''}
 async function choose(row:Branch){if(row.status==='preparing'||trash)return;if(!confirmDiscardChanges())return;await onSwitch(row.id);setOpen(false)}
 async function mutate(row:Branch,action:'archive'|'restore'|'trash'|'recover'){
  const text=action==='archive'?t('¿Archivar esta sucursal? Sus datos se conservarán en modo de consulta.','Archive this location? Its records remain read-only.'):
   action==='trash'?t(`¿Eliminar «${row.name}»? Podrá recuperarla desde la papelera durante 30 días. Después se eliminarán definitivamente sus registros y archivos. El paquete contratado no cambia.`,`Delete “${row.name}”? You can recover it from Trash for 30 days. After that its records and files will be permanently deleted. Your subscription package does not change.`):
   action==='recover'?t('¿Recuperar esta sucursal? Volverá a Archivadas, con sus datos y sin ocupar un cupo.','Recover this location? It returns to Archived with its records and does not use a slot.'):t('¿Reactivar esta sucursal? Requiere un cupo disponible.','Reactivate this location? An available slot is required.');
  if(!confirmApp(text))return;
  if(row.id===restaurantId&&!confirmDiscardChanges())return;
  await api(action,{branch_id:row.id});
  if(action==='trash'&&row.id===restaurantId){await onSwitch(meta.root_id);setOpen(false);return}
  // Update just the changed account. Never unmount the dashboard to refresh a list.
  if(row.id===restaurantId)await onChanged?.();
  setNotice(action==='trash'?t('Sucursal en la papelera. Puede recuperarla durante 30 días.','Location moved to Trash. Recover it within 30 days.'):action==='recover'?t('Sucursal recuperada en Archivadas.','Location recovered to Archived.'):t('Cambio guardado.','Change saved.'));
  await load(true);
 }
 const title=view==='create'?t('Nueva sucursal','New location'):view==='edit'?t('Editar nombre','Edit name'):trash?t('Papelera de sucursales','Location trash'):t('Sus sucursales','Your locations');
 return <>
  <div className={styles.bar}><button type="button" className={styles.selector} onClick={()=>{setOpen(true);setNotice('')}} aria-haspopup="dialog"><Building2 size={18}/><span>{name}</span><ChevronDown size={16}/></button></div>
  <AppSheet open={open} title={title} close={close}>
   <div className={styles.body} aria-busy={busy}>
    {error&&<div role="alert" className={styles.error}>{error}{view==='list'&&<button type="button" onClick={()=>void load()}>{t('Reintentar','Retry')}</button>}</div>}
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {view!=='list'?<form key={view} onSubmit={e=>{e.preventDefault();void run(async()=>{
     if(view==='edit'){await api('rename',{branch_id:editing!.id,name:newName});if(editing!.id===restaurantId)await onChanged?.();setNotice(t('Nombre actualizado. No se creó otra sucursal.','Name updated. No other location was created.'))}
     else{if(copy&&(!source||!Object.values(options).some(Boolean)))return;if(!requestId.current)requestId.current=crypto.randomUUID();await api('create',{request_id:requestId.current,name:newName,source_id:copy?source!.id:null,options:copy?options:{}});requestId.current='';setNotice(copy?t('Sucursal creada. La copia continúa en segundo plano; verá su progreso en la lista.','Location created. Copying continues in the background; progress appears in the list.'):t('Sucursal creada.','Location created.'));setSearch('');setCursor(null);setArchived(false);setTrash(false)}
     setName('');setView('list');
    })}}>
     <button type="button" className="secondary" onClick={leaveForm} disabled={busy}><ArrowLeft size={16}/>{t('Volver','Back')}</button>
     <label>{t('Nombre de la sucursal','Location name')}<input autoFocus required minLength={2} maxLength={160} value={newName} disabled={busy} onChange={e=>setName(e.target.value)} placeholder={t('Ej. Centro histórico','e.g. Downtown')}/></label>
     {view==='create'&&<>
      <fieldset disabled={busy} className={styles.startChoices}><legend>{t('¿Cómo desea empezar?','How would you like to start?')}</legend>
       <label className={styles.choice}><input type="radio" name="branch-start" checked={!copy} onChange={()=>setCopy(false)}/><Building2 size={20}/><span><b>{t('Empezar vacía','Start empty')}</b><small>{t('Configure este local desde cero.','Set up this location from scratch.')}</small></span></label>
       <label className={styles.choice}><input type="radio" name="branch-start" checked={copy} onChange={()=>setCopy(true)}/><Copy size={20}/><span><b>{t('Copiar de otra sucursal','Copy another location')}</b><small>{t('Elija el origen y qué información copiar.','Choose a source and what to copy.')}</small></span></label>
      </fieldset>
      {copy&&<fieldset disabled={busy}><legend>{t('Copia inicial','Initial copy')}</legend><CopySource restaurantId={restaurantId} source={source} onChange={setSource}/>
       <h3>{t('¿Qué desea copiar?','What would you like to copy?')}</h3>{copyFields.map(([key,es,eng])=><label className={styles.check} key={key}><input type="checkbox" checked={!!options[key]} onChange={e=>setOptions(v=>({...v,[key]:e.target.checked,...(key==='floor'&&e.target.checked?{areas:true}:{}),...(key==='areas'&&!e.target.checked?{floor:false}:{})}))}/>{t(es,eng)}</label>)}
       <button type="button" className="secondary" onClick={()=>setOptions({settings:true,menus:true,areas:true,floor:true,clients:true})}>{t('Seleccionar todo','Select all')}</button>
       <p className={styles.help}>{t('La copia es independiente. Reservas, cotizaciones, usuarios y pagos permanecen en su sucursal original.','Copies are independent. Bookings, quotes, users and payments remain in their original location.')}</p>
      </fieldset>}
     </>}
     <button type="submit" className="primary" disabled={busy||newName.trim().length<2||(view==='create'&&copy&&(!source||!Object.values(options).some(Boolean)))}>{busy?<LoaderCircle size={18}/>:view==='edit'?<Check size={18}/>:<Plus size={18}/>} {view==='edit'?t('Guardar nombre','Save name'):t('Crear sucursal','Create location')}</button>
    </form>:<>
     {meta&&!trash&&<div className={styles.summary}><div><strong>{meta.used}</strong> {t('sucursales ·','locations ·')} {meta.capacity>=10000?t('cuenta exenta','complimentary account'):t(`${meta.capacity} en el paquete`,`${meta.capacity} in your package`)}</div>{meta.can_manage&&<button type="button" className="secondary" onClick={()=>{if(confirmDiscardChanges()){setOpen(false);onBilling()}}}>{t('Gestionar paquete','Manage package')}</button>}</div>}
     <div className={styles.tabs}>{[[false,t('Sucursales','Locations')],[true,t('Papelera','Trash')]].map(([val,label])=>(val===false||meta?.can_manage)&&<button type="button" key={String(val)} aria-pressed={trash===val} disabled={busy} onClick={()=>{setTrash(val as boolean);setCursor(null);setSearch('');setRows([]);setNotice('')}}>{val&&<Trash2 size={16}/>} {label}</button>)}</div>
     {trash&&<p className={styles.help}>{t('Recupere las sucursales durante 30 días desde que se eliminaron. Volverán a Archivadas. Al vencer el plazo, sus registros y archivos se eliminan por lotes.','Recover locations within 30 days of deletion. They return to Archived. After the deadline, records and files are permanently removed in batches.')}</p>}
     <label className={styles.search}><Search size={18}/><input type="search" aria-label={t('Buscar sucursal','Search locations')} placeholder={t('Buscar por nombre…','Search by name…')} value={search} onChange={e=>{setSearch(e.target.value);setCursor(null)}}/></label>
     {!trash&&<label className={styles.check}><input type="checkbox" checked={archived} onChange={e=>{setArchived(e.target.checked);setCursor(null)}}/>{t('Incluir archivadas','Include archived locations')}</label>}
     <div className={styles.list} aria-busy={loading}>{loading&&!rows.length?<p role="status">{t('Cargando…','Loading…')}</p>:rows.map(row=><article key={row.id} className={styles.row}>
      {trash?<div className={styles.open}><Trash2 size={20}/><span><b>{row.name}</b><small>{row.recoverable?t(`Recuperable hasta ${new Date(row.purge_after!).toLocaleString('es-GT')}`,`Recover until ${new Date(row.purge_after!).toLocaleString('en-US')}`):t('Plazo vencido · eliminación programada','Deadline passed · removal scheduled')}</small></span></div>:<button type="button" disabled={busy||row.status==='preparing'} className={styles.open} onClick={()=>void run(()=>choose(row))}><Building2 size={20}/><span><b>{row.name}</b><small>{row.error_code?t('Copia pendiente · reintento automático','Copy pending · retrying automatically'):row.status==='preparing'?t(`Preparando · ${row.copied||0} registros copiados`,`Preparing · ${row.copied||0} records copied`):row.status==='archived'?t('Archivada · solo consulta','Archived · read only'):!row.enabled?t('Fuera del paquete · solo consulta','Outside package · read only'):row.is_principal?t('Cuenta principal','Principal account'):t('Sucursal','Location')}</small></span>{row.id===restaurantId&&<Check size={18}/>}</button>}
      {meta?.can_manage&&!row.is_principal&&<div className={styles.rowActions}>
       {trash?<button type="button" disabled={busy||!row.recoverable} onClick={()=>void run(()=>mutate(row,'recover'))}><RotateCcw size={14}/>{t('Recuperar','Recover')}</button>:<>
        <button type="button" disabled={busy} onClick={()=>{setEditing(row);setName(row.name);setView('edit');setNotice('');setError('')}}><PenLine size={14}/>{t('Editar nombre','Edit name')}</button>
        <button type="button" disabled={busy} onClick={()=>void run(()=>mutate(row,row.status==='archived'?'restore':'archive'))}><Archive size={14}/>{row.status==='archived'?t('Reactivar','Reactivate'):t('Archivar','Archive')}</button>
        {row.status==='archived'&&<button type="button" className={styles.danger} disabled={busy} onClick={()=>void run(()=>mutate(row,'trash'))}><Trash2 size={14}/>{t('Eliminar','Delete')}</button>}
       </>}
      </div>}
     </article>)}</div>
     {!loading&&!rows.length&&<p>{trash?t('La papelera está vacía.','Trash is empty.'):t('No hay sucursales que coincidan.','No matching locations.')}</p>}
     {(cursor||meta?.more)&&<div className={styles.actions}>{cursor&&<button type="button" className="secondary" disabled={loading||busy} onClick={()=>setCursor(null)}>{t('Inicio','First page')}</button>}{meta?.more&&<button type="button" className="secondary" disabled={loading||busy} onClick={()=>setCursor(rows.at(-1)||null)}>{t('Siguientes 25','Next 25')}</button>}</div>}
     {meta?.can_manage&&!trash&&<button type="button" className={`primary ${styles.newButton}`} disabled={busy} onClick={startCreate}><Plus size={18}/>{t('Nueva sucursal','New location')}</button>}
     <p className={styles.help}>{t('Cada sucursal conserva sus registros y permisos. Archivar o eliminar no modifica el cobro del paquete.','Each location keeps its records and permissions. Archiving or deleting does not change package billing.')}</p>
    </>}
   </div>
  </AppSheet>
 </>;
}
