"use client";
import {useState} from 'react';
import {useUnsavedChanges} from '@/lib/unsaved-changes';

export function ScheduleAreaInstruction({value,canEdit,en,area,save,reload}:{value:string;canEdit:boolean;en:boolean;area:string;save:(value:string,expected:string)=>Promise<void>;reload:()=>void}){
 const [edit,setEdit]=useState(false),[draft,setDraft]=useState(''),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{setEdit(false);setError('')};
 const clear=useUnsavedChanges(edit&&draft.trim()!==baseline,close);
 if(!edit&&!value&&!canEdit)return null;
 const label=en?'Area instructions':'Instrucciones del área';
 return <div className="areaScheduleNote" translate="no">
 {edit&&canEdit?<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await save(draft.trim(),baseline);clear();close()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}>
 <label>{label} · {area}<textarea autoFocus rows={3} maxLength={1000} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)}/></label>
 <small>{en?'Printed below this area for the selected month. Leave blank to remove.':'Se imprime debajo de esta área para el mes seleccionado. Déjelo vacío para quitarlo.'}</small>
 {error&&<p role="alert">{error}</p>}
 <div><button className="primary" disabled={busy}>{en?'Save':'Guardar'}</button> <button type="button" disabled={busy} onClick={()=>{clear();close();reload()}}>{en?'Cancel':'Cancelar'}</button></div>
 </form>:<>{value&&<div><b>{label}</b><p>{value}</p></div>}{canEdit&&<button type="button" className="areaNoteAction" aria-label={label+' · '+area} onClick={()=>{setBaseline(value);setDraft(value);setEdit(true)}}>{value?(en?'Edit instructions':'Editar instrucciones'):(en?'+ Add area instructions':'+ Agregar instrucciones del área')}</button>}</>}
 </div>
}
