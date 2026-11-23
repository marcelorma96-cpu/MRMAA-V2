"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, Pencil, Plus, Search, Users, Check } from "lucide-react";
import { Modal, ShiftEndpointInput } from "./dashboard-ui";
import { ShiftAreaPicker } from "./shift-area-picker";
import { useAppPreferences, confirmApp } from "./app-preferences";
import { supabase } from "@/lib/supabase";
import { readCatalog } from "@/lib/account-access";
import { userMessage } from "@/lib/user-message";
import { translate } from "@/lib/translations";
import { useUnsavedChanges } from "@/lib/unsaved-changes";
import { newShiftDraft, shiftDraftFromRow, shiftDraftPayload, scheduleShiftLabel } from "@/lib/schedule-range";
import { shiftFitsArea } from "@/lib/schedule-shift-areas";
import { catalogSnapshot, employeePayload, saveScheduleCatalog, catalogError, type CatalogKind, type CatalogEmployee, type CatalogShift } from "@/lib/schedule-catalog";
import type { Area } from "./schedules-module";
import "./schedule-catalog.css";

type Row = CatalogEmployee | CatalogShift;
type Editor = { id:string; row:Row|null };
const pageSize=20;
export function ScheduleCatalogActions({ allowed, open }: { allowed:boolean; open:(kind:CatalogKind)=>void }) {
  if(!allowed)return null;
  return <div className="scheduleCatalogActions" translate="no">
    <CatalogAction kind="employee" open={open}/><CatalogAction kind="shift" open={open}/>
  </div>;
}
function CatalogAction({kind,open}:{kind:CatalogKind;open:(kind:CatalogKind)=>void}) {
  const {language}=useAppPreferences(),en=language==="en",Icon=kind==="employee"?Users:Clock3;
  return <button type="button" className="secondary" aria-haspopup="dialog" onClick={()=>open(kind)}><Icon size={18}/>{kind==="employee"?(en?"Employees":"Empleados"):(en?"Shifts":"Turnos")}</button>;
}
export function ScheduleCatalogDialog({restaurantId,kind,areas,initialArea,timeFormat,close,onSaved}: {
  restaurantId:string;kind:CatalogKind;areas:Area[];initialArea:string;timeFormat?:string;close:()=>void;onSaved:(kind:CatalogKind,row:Row)=>void;
}) {
  const {language}=useAppPreferences(),en=language==="en";
  const [records,setRecords]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [scope,setScope]=useState(initialArea),[search,setSearch]=useState(""),[status,setStatus]=useState("active"),[page,setPage]=useState(1);
  const [editor,setEditor]=useState<Editor|null>(null),[revision,setRevision]=useState(0);
  const [success,setSuccess]=useState("");
  const requestClose=useRef<()=>void>(close),content=useRef<HTMLDivElement>(null),listScroll=useRef(0),wasEditing=useRef(false);
  useLayoutEffect(()=>{
    const modal=content.current?.closest<HTMLElement>(".modal");
    if(!modal)return;
    if(editor){modal.scrollTop=0;modal.focus({preventScroll:true});}
    else if(wasEditing.current){modal.scrollTop=listScroll.current;modal.focus({preventScroll:true});}
    wasEditing.current=!!editor;
  },[editor]);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    readCatalog(supabase,restaurantId,kind==="employee"?"v2_employees":"v2_shifts","name",false).then(result=>{
      if(!active)return;
      if(result.error)throw result.error;
      setRecords(result.data||[]);setLoading(false);
    }).catch(error=>{if(active){setError(translate(userMessage(error),language));setLoading(false)}});
    return()=>{active=false};
  },[restaurantId,kind,revision,language]);
  const areaName=(id:string|null)=>areas.find(a=>a.id===id)?.name||(en?"No area":"Sin área");
  const scopeName=(s:CatalogShift)=>s.schedule_area_ids==null?(en?"Unclassified":"Sin clasificar"):s.schedule_area_ids.length?s.schedule_area_ids.map(areaName).join(" · "):(en?"All areas":"Todas las áreas");
  const query=search.trim().toLocaleLowerCase();
  const filtered=records.filter(row=>{
    if(status!=="all" && row.active!==(status==="active"))return false;
    if(scope && (kind==="employee" ? ((row as CatalogEmployee).area_id||"unassigned")!==scope : scope==="pending"?(row as CatalogShift).schedule_area_ids!=null:!shiftFitsArea(row as CatalogShift,scope)))return false;
    const detail=kind==="employee"?`${(row as CatalogEmployee).employee_code} ${(row as CatalogEmployee).phone} ${areaName((row as CatalogEmployee).area_id)}`:scopeName(row as CatalogShift);
    return `${row.name} ${detail}`.toLocaleLowerCase().includes(query);
  });
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,pages);
  const reset=()=>{setPage(1);setSuccess("")};
  const begin=(row:Row|null)=>{listScroll.current=content.current?.closest<HTMLElement>(".modal")?.scrollTop||0;setSuccess("");setEditor({id:row?.id||crypto.randomUUID(),row})};
  const title=editor?(kind==="employee"?(editor.row?(en?"Edit employee":"Editar empleado"):(en?"Add employee":"Agregar empleado")):(editor.row?(en?"Edit shift":"Editar turno"):(en?"New shift":"Nuevo turno"))):(kind==="employee"?(en?"Employees":"Empleados"):(en?"Shifts":"Turnos"));
  return <Modal title={title} close={()=>editor?requestClose.current():close()}>
    <div ref={content} className="scheduleCatalog" translate="no">
      {editor ? <CatalogEditor key={editor.id} restaurantId={restaurantId} kind={kind} editor={editor} areas={areas} initialArea={scope} timeFormat={timeFormat}
        requestClose={requestClose} close={close} back={()=>{setEditor(null);setRevision(v=>v+1)}} onSaved={row=>{
          setRecords(list=>[row,...list.filter(r=>r.id!==row.id)].sort((a,b)=>a.name.localeCompare(b.name)));
          setEditor(null);setSuccess(en?"Saved. Your calendar is up to date.":"Guardado. Tu calendario está actualizado.");
          // Make a newly saved item visible even if its area/status changed.
          setSearch("");setStatus(row.active?"active":"inactive");setScope(kind==="employee"?((row as CatalogEmployee).area_id||"unassigned"):((row as CatalogShift).schedule_area_ids?.length?(row as CatalogShift).schedule_area_ids![0]:""));setPage(1);
          onSaved(kind,row);
        }}/>
      : <>
        <div className="scheduleCatalogIntro"><p>{kind==="employee"?(en?"Your team, ready to schedule.":"Tu equipo, listo para organizar."):(en?"Create and adjust the shifts available in each area.":"Crea y ajusta los turnos disponibles en cada área.")}</p>
          <button type="button" className="primary" disabled={loading||!!error} onClick={()=>begin(null)}><Plus size={18}/>{kind==="employee"?(en?"Add employee":"Agregar empleado"):(en?"New shift":"Nuevo turno")}</button>
        </div>
        <div className="scheduleCatalogFilters">
          <label className="scheduleCatalogSearch"><Search size={18} aria-hidden="true"/><input type="search" aria-label={en?"Search":"Buscar"} placeholder={kind==="employee"?(en?"Name, ID or phone":"Nombre, ID o teléfono"):(en?"Name or area":"Nombre o área")} value={search} onChange={e=>{setSearch(e.target.value);reset()}}/></label>
          <label><span>{en?"Area":"Área"}</span><select value={scope} onChange={e=>{setScope(e.target.value);reset()}}>
            <option value="">{en?"All areas":"Todas las áreas"}</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="unassigned">{en?"No area":"Sin área"}</option>{kind==="shift"&&<option value="pending">{en?"Unclassified":"Sin clasificar"}</option>}
          </select></label>
          <label><span>{en?"Status":"Estado"}</span><select value={status} onChange={e=>{setStatus(e.target.value);reset()}}>
            <option value="active">{en?"Active":"Activos"}</option><option value="inactive">{en?"Inactive":"Inactivos"}</option><option value="all">{en?"All":"Todos"}</option>
          </select></label>
        </div>
        {success&&<p className="scheduleCatalogSuccess" role="status"><Check size={17}/>{success}</p>}
        {error?<div className="scheduleCatalogError" role="alert">{error}<button type="button" onClick={()=>setRevision(v=>v+1)}>{en?"Retry":"Reintentar"}</button></div>
        :loading?<p role="status">{en?"Loading…":"Cargando…"}</p>
        :<div className="scheduleCatalogList">
          {filtered.slice((current-1)*pageSize,current*pageSize).map(row=><article key={row.id}>
            <div><strong>{row.name}</strong><small>{kind==="employee"?`${areaName((row as CatalogEmployee).area_id)}${(row as CatalogEmployee).employee_code?` · ID ${(row as CatalogEmployee).employee_code}`:""}`:scheduleShiftLabel(row as CatalogShift,timeFormat,true)}</small>
              {kind==="shift"&&<small>{scopeName(row as CatalogShift)}</small>}
              {!row.active&&<span className="scheduleCatalogInactive">{en?"Inactive":"Inactivo"}</span>}
            </div>
            <button type="button" className="secondary" aria-label={`${en?"Edit":"Editar"} ${row.name}`} onClick={()=>begin(row)}><Pencil size={17}/><span>{en?"Edit":"Editar"}</span></button>
          </article>)}
          {!filtered.length&&<div className="scheduleCatalogEmpty">{en?"No results for these filters.":"No hay resultados con estos filtros."}{!!(scope||search||status!=="all")&&<button type="button" onClick={()=>{setScope("");setSearch("");setStatus("all");reset()}}>{en?"View all":"Ver todos"}</button>}</div>}
        </div>}
        {!loading&&!error&&pages>1&&<nav className="scheduleCatalogPages" aria-label={en?"Pages":"Páginas"}><button type="button" disabled={current===1} onClick={()=>setPage(current-1)}>{en?"Previous":"Anterior"}</button><span>{current} / {pages}</span><button type="button" disabled={current===pages} onClick={()=>setPage(current+1)}>{en?"Next":"Siguiente"}</button></nav>}
      </>}
    </div>
  </Modal>;
}
function CatalogEditor({restaurantId,kind,editor,areas,initialArea,timeFormat,requestClose,close,back,onSaved}: {
  restaurantId:string;kind:CatalogKind;editor:Editor;areas:Area[];initialArea:string;timeFormat?:string;requestClose:React.MutableRefObject<()=>void>;close:()=>void;back:()=>void;onSaved:(row:Row)=>void;
}) {
  const {language}=useAppPreferences(),en=language==="en";
  const existing=editor.row as CatalogEmployee|null;
  const [employee,setEmployee]=useState(()=>({name:existing?.name||"",employee_code:existing?.employee_code||"",phone:existing?.phone||"",area_id:existing?(existing.area_id||""):(areas.some(a=>a.id===initialArea&&a.active)?initialArea:""),active:existing?.active!==false}));
  const [shift,setShift]=useState(()=>kind==="shift"&&editor.row?shiftDraftFromRow(editor.row as CatalogShift):{...newShiftDraft(),schedule_area_ids:areas.some(a=>a.id===initialArea&&a.active)?[initialArea]:initialArea==="unassigned"?[]:null});
  const [active,setActive]=useState(editor.row?.active!==false),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const signature=JSON.stringify(kind==="employee"?employee:{...shift,active}),baseline=useRef(signature),locked=useRef(false),mounted=useRef(true);
  const dirty=baseline.current!==signature;
  const clearUnsaved=useUnsavedChanges(dirty,()=>{baseline.current=signature});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  const leave=(action:()=>void)=>{
    if(locked.current)return;
    if(dirty&&!confirmApp(en?"Discard unsaved changes?":"¿Descartar los cambios sin guardar?"))return;
    clearUnsaved();action();
  };
  requestClose.current=()=>leave(close);
  async function save(event:React.FormEvent){
    event.preventDefault();if(locked.current)return;
    const values=kind==="employee"?employeePayload(employee):shiftDraftPayload(shift);
    if(!values||(kind==="shift"&&shift.schedule_area_ids===null))return setError(en?"Complete the name, area and shift times.":"Completa el nombre, el área y las horas del turno.");
    locked.current=true;setBusy(true);setError("");
    try{
      const row=await saveScheduleCatalog(supabase,restaurantId,kind,editor.id,kind==="shift"?{...values,active}:values,editor.row?catalogSnapshot(kind,editor.row):null);
      if(!mounted.current)return;
      baseline.current=signature;clearUnsaved();onSaved(row);
    }catch(error){if(mounted.current)setError(catalogError(error,en)||translate(userMessage(error),language))}
    finally{locked.current=false;if(mounted.current)setBusy(false)}
  }
  return <form className="scheduleCatalogForm" onSubmit={save}>
    <button type="button" className="scheduleCatalogBack" disabled={busy} onClick={()=>leave(back)}><ArrowLeft size={17}/>{en?"Back to list":"Volver a la lista"}</button>
    <fieldset disabled={busy}>
      <legend className="visuallyHidden">{kind==="employee"?(en?"Employee details":"Datos del empleado"):(en?"Shift details":"Datos del turno")}</legend>
      {kind==="employee"?<>
        <label>{en?"Full name":"Nombre completo"}<input required maxLength={160} autoComplete="off" value={employee.name} placeholder={en?"e.g. Ana López":"Ej. Ana López"} onChange={e=>setEmployee({...employee,name:e.target.value})}/></label>
        <div className="scheduleCatalogTwo"><label>{en?"Area":"Área"}<select value={employee.area_id} onChange={e=>setEmployee({...employee,area_id:e.target.value})}><option value="">{en?"No area":"Sin área"}</option>{areas.filter(a=>a.active||a.id===employee.area_id).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>{en?"Status":"Estado"}<select value={employee.active?"active":"inactive"} onChange={e=>setEmployee({...employee,active:e.target.value==="active"})}><option value="active">{en?"Active":"Activo"}</option><option value="inactive">{en?"Inactive":"Inactivo"}</option></select></label></div>
        <div className="scheduleCatalogTwo"><label>{en?"Employee ID · optional":"ID del empleado · opcional"}<input maxLength={80} autoComplete="off" value={employee.employee_code} onChange={e=>setEmployee({...employee,employee_code:e.target.value})}/></label><label>{en?"Phone · optional":"Teléfono · opcional"}<input type="tel" maxLength={60} autoComplete="off" value={employee.phone} onChange={e=>setEmployee({...employee,phone:e.target.value})}/></label></div>
        <p className="scheduleCatalogHint">{en?"This adds an employee to the schedule. It does not create a login account.":"Agrega un empleado al horario. No crea una cuenta de acceso."}</p>
        {!!editor.row&&!employee.active&&<p className="scheduleCatalogHint">{en?"Existing assignments are kept in reports.":"Las asignaciones anteriores se conservan en reportes."}</p>}
      </>:<>
        <label>{en?"Shift name":"Nombre del turno"}<input required maxLength={120} autoComplete="off" value={shift.name} placeholder={en?"e.g. Opening":"Ej. Apertura"} onChange={e=>setShift({...shift,name:e.target.value})}/></label>
        <ShiftAreaPicker areas={areas} ids={shift.schedule_area_ids} en={en} disabled={busy} change={ids=>setShift({...shift,schedule_area_ids:ids})}/>
        <div className="shiftEndpoints">{(["start","end"] as const).map(side=><ShiftEndpointInput key={side} label={side==="start"?(en?"Start":"Entrada"):(en?"End":"Salida")}
          mode={shift[`${side}_mode`]} time={shift[`${side}_time`]} text={shift[`${side}_text`]} format={timeFormat} disabled={busy}
          calculate={shift[`${side}_calculate`]} calculationTime={shift[`calculation_${side}_time`]}
          onCalculate={value=>setShift({...shift,[`${side}_calculate`]:value})} onCalculationTime={value=>setShift({...shift,[`calculation_${side}_time`]:value})}
          placeholder={side==="start"?(en?"OPENING":"APERTURA"):(en?"CLOSING":"CIERRE")}
          onMode={value=>setShift({...shift,[`${side}_mode`]:value})} onTime={value=>setShift({...shift,[`${side}_time`]:value})} onText={value=>setShift({...shift,[`${side}_text`]:value})}/>)}</div>
        <label>{en?"Status":"Estado"}<select value={active?"active":"inactive"} onChange={e=>setActive(e.target.value==="active")}><option value="active">{en?"Active":"Activo"}</option><option value="inactive">{en?"Inactive":"Inactivo"}</option></select></label>
        {editor.row&&<p className="scheduleCatalogHint">{en?"Changes to this shift apply to schedules that already use it. To keep the previous hours, create a new shift.":"Los cambios del turno se aplican a los horarios que ya lo usan. Para conservar las horas anteriores, crea un turno nuevo."}</p>}
      </>}
    </fieldset>
    {error&&<p role="alert" className="scheduleCatalogError">{error}</p>}
    <div className="scheduleCatalogFooter"><button type="button" className="secondary" disabled={busy} onClick={()=>leave(back)}>{en?"Cancel":"Cancelar"}</button><button type="submit" className="primary" disabled={busy}>{busy?(en?"Saving…":"Guardando…"):(en?"Save":"Guardar")}</button></div>
  </form>;
}
