"use client";
import { useEffect, useRef, useState } from 'react';
import { FileDown, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { requirePermission } from '@/lib/permissions';
import { useAppPreferences } from '@/components/app-preferences';
import { useExcelExportAccess } from '@/components/excel-permission';
import { useUnsavedChanges } from '@/lib/unsaved-changes';
import { Pagination } from '@/components/pagination';
import { userMessage } from '@/lib/user-message';
import { translate } from '@/lib/translations';
import { CLIENT_IMPORT_BATCH, CLIENT_IMPORT_LIMIT, clientImportPayload, createClientTemplate, parseClientImport, type ClientImportRow, type ClientImportResult, type ClientImportStatus } from '@/lib/client-import';

export function ClientImport({ restaurantId, onImported }: { restaurantId: string; onImported: () => void }) {
  const { language } = useAppPreferences(), en = language === 'en';
  const excel = useExcelExportAccess(restaurantId);
  const fileInput = useRef<HTMLInputElement>(null), lock = useRef(false), generation = useRef(0);
  const [rows,setRows] = useState<ClientImportRow[]>([]), [fileName,setFileName] = useState('');
  const [busy,setBusy] = useState(false), [templateBusy,setTemplateBusy] = useState(false), [error,setError] = useState('');
  const [done,setDone] = useState(false), [page,setPage] = useState(1), [progress,setProgress] = useState('');
  const [filter,setFilter] = useState('all');
  const message = (es:string,english:string) => en ? english : es;
  const reset = () => { generation.current++; setRows([]); setFileName(''); setDone(false); setError(''); setPage(1); setFilter('all'); };
  useEffect(() => { reset(); return () => { generation.current++; }; },[restaurantId]);
  const ready = rows.filter(row=>row.status==='new');
  const clearDraft = useUnsavedChanges(busy || ready.length>0,reset);
  const labels: Record<ClientImportStatus,string> = {
    new:message('Nuevo','New'),created:message('Importado','Imported'),existing:message('Ya existe','Already exists'),
    trash:message('En papelera','In trash'),duplicate:message('Repetido','Duplicate'),invalid:message('Revisar','Review'),
  };
  const reasonText = (reason:string) => ({
    name:message('Nombre obligatorio, máximo 200 caracteres.','Name is required, up to 200 characters.'),
    phone:message('Revise el teléfono; use números y código de país.','Check the phone; use numbers and country code.'),
    phone_text:message('Guarde el teléfono como texto para conservar todos sus dígitos.','Store the phone as text to preserve every digit.'),
    email:message('Correo no válido.','Invalid email.'),notes:message('Notas: máximo 2,000 caracteres.','Notes: up to 2,000 characters.'),
    formula:message('Reemplace la fórmula por su valor.','Replace the formula with its value.'),
    cell:message('Corrija el error de la celda.','Correct the cell error.'),file_duplicate:message('Coincide con una fila anterior del archivo.','Matches an earlier row in this file.'),
  }[reason] || '');
  const fileError = (err: unknown) => {
    const code = err instanceof Error ? err.message : '';
    return ({empty:message('El archivo no contiene clientes. Complete la primera hoja.','The file contains no customers. Fill the first sheet.'),
      rows:message(`Use hasta ${CLIENT_IMPORT_LIMIT.toLocaleString()} filas de datos por archivo.`,`Use up to ${CLIENT_IMPORT_LIMIT.toLocaleString()} data rows per file.`),
      headers:message('La primera fila debe incluir la columna Nombre o Name. Use la plantilla.','The first row must include Name or Nombre. Use the template.'),
      headers_duplicate:message('Hay columnas repetidas para un mismo campo. Revise los encabezados.','Multiple columns map to the same field. Review the headers.'),
    }[code] || userMessage(err,message('No se pudo revisar el archivo. Intente nuevamente.','Could not review the file. Try again.')));
  };
  async function downloadTemplate() {
    if (templateBusy) return;setTemplateBusy(true);setError('');
    try {
      await excel.ensureAllowed();const XLSX = await import('xlsx');const book = createClientTemplate(XLSX,en);
      await excel.ensureAllowed();XLSX.writeFile(book,en?'customer-import-template.xlsx':'plantilla-importacion-clientes.xlsx');
    } catch(err){setError(userMessage(err));} finally {setTemplateBusy(false);}
  }
  async function batchResult(batch:ClientImportRow[],dryRun:boolean) {
    const result = await supabase.rpc('v2_import_clients',{p_restaurant_id:restaurantId,p_rows:clientImportPayload(batch),p_dry_run:dryRun});
    if (result.error) throw result.error;
    const output = result.data as ClientImportResult[];
    const allowed = dryRun ? ['new','existing','trash','duplicate','invalid'] : ['created','existing','trash','duplicate','invalid'];
    if (!Array.isArray(output) || output.length!==batch.length || new Set(output.map(x=>x.row_number)).size!==batch.length || output.some(x=>!allowed.includes(x.status)||!batch.some(r=>r.row_number===x.row_number))) throw new Error(message('No se recibió el resultado completo. Intente nuevamente.','The full result was not received. Try again.'));
    return output;
  }
  async function chooseFile(event:React.ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];event.target.value='';if (!file || lock.current) return;
    lock.current=true;setBusy(true);reset();const ticket=generation.current;setFileName(file.name);
    try {
      await requirePermission(supabase,restaurantId,'canOperate');
      if(file.size>5*1024*1024)throw new Error(message('El archivo supera el límite de 5 MB.','The file exceeds the 5 MB limit.'));
      if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw new Error(message('Use un archivo XLSX, XLS o CSV.','Use an XLSX, XLS or CSV file.'));
      const XLSX=await import('xlsx');
      const book=XLSX.read(await file.arrayBuffer(),{sheetRows:CLIENT_IMPORT_LIMIT+2,cellFormula:true});
      let reviewed=parseClientImport(book,XLSX,()=>crypto.randomUUID());
      const candidates=reviewed.filter(r=>r.status==='new');
      for(let start=0;start<candidates.length;start+=CLIENT_IMPORT_BATCH){
        if(ticket!==generation.current)return;
        setProgress(message(`Revisando ${Math.min(start+CLIENT_IMPORT_BATCH,candidates.length)} de ${candidates.length}…`,`Reviewing ${Math.min(start+CLIENT_IMPORT_BATCH,candidates.length)} of ${candidates.length}…`));
        const results=await batchResult(candidates.slice(start,start+CLIENT_IMPORT_BATCH),true);
        const byRow=new Map(results.map(r=>[r.row_number,r]));
        reviewed=reviewed.map(r=>byRow.has(r.row_number)?{...r,...byRow.get(r.row_number)!}:r);
      }
      if(ticket===generation.current)setRows(reviewed);
    } catch(err){if(ticket===generation.current)setError(fileError(err));}
    finally {lock.current=false;setBusy(false);setProgress('');}
  }
  async function importNew() {
    if(lock.current || !ready.length)return;
    lock.current=true;setBusy(true);setError('');const ticket=generation.current;
    try {
      await requirePermission(supabase,restaurantId,'canOperate');
      for(let start=0;start<ready.length;start+=CLIENT_IMPORT_BATCH){
        if(ticket!==generation.current)return;
        setProgress(message(`Importando ${Math.min(start+CLIENT_IMPORT_BATCH,ready.length)} de ${ready.length}…`,`Importing ${Math.min(start+CLIENT_IMPORT_BATCH,ready.length)} of ${ready.length}…`));
        const results=await batchResult(ready.slice(start,start+CLIENT_IMPORT_BATCH),false);
        if(ticket!==generation.current)return;
        const byRow=new Map(results.map(r=>[r.row_number,r]));setRows(current=>current.map(r=>byRow.has(r.row_number)?{...r,...byRow.get(r.row_number)!}:r));
      }
      if(ticket===generation.current){setDone(true);setFilter('all');setPage(1);clearDraft();}
    } catch(err){if(ticket===generation.current)setError(message('No se completó la importación. Las filas ya guardadas se conservan; puede reintentar las pendientes. ','Import was not completed. Saved rows are preserved; you can retry pending rows. ')+userMessage(err));}
    finally {lock.current=false;setBusy(false);setProgress('');onImported();}
  }
  const visible=rows.filter(r=>filter==='all'||(filter==='omitted'?!['new','created','invalid'].includes(r.status):r.status===filter));
  return <section className="clientImport" translate="no">
    <div className="clientImportActions">
      <button type="button" className="secondary" disabled={busy||templateBusy||!excel.allowed} title={!excel.allowed?translate(excel.hint,language):undefined} onClick={downloadTemplate}><FileDown/>{templateBusy?message('Preparando…','Preparing…'):message('Plantilla de clientes','Customer template')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>fileInput.current?.click()}><Upload/>{message('Importar clientes','Import customers')}</button>
      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={chooseFile} aria-label={message('Archivo de clientes','Customer file')}/>
    </div>
    {busy && <p role="status">{progress||message('Revisando archivo…','Reviewing file…')}</p>}
    {error && <p className="moduleNotice" role="alert">{translate(error,language)}</p>}
    {!!rows.length && <div className="moduleCard clientImportReview">
      <div className="clientImportHeading"><div><h3>{done?message('Importación terminada','Import complete'):message('Revisar importación','Review import')}</h3><p>{fileName}</p></div>
        <button type="button" className="secondary" disabled={busy} onClick={()=>{reset();clearDraft();}}>{message('Cerrar','Close')}</button></div>
      <p>{message('Se agregarán únicamente clientes nuevos. Las coincidencias se omiten y no se sobrescriben datos existentes.','Only new customers are added. Matches are skipped and existing data is not overwritten.')}</p>
      <div className="clientImportCounts" role="status">{(Object.keys(labels) as ClientImportStatus[]).map(status=>{const count=rows.filter(r=>r.status===status).length;return count?<span key={status} className={`clientImportStatus ${status}`}>{labels[status]}: {count}</span>:null;})}</div>
      <div className="clientImportActions">
        <label>{message('Mostrar','Show')} <select value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
          <option value="all">{message('Todas las filas','All rows')}</option><option value="new">{message('Nuevos','New')}</option><option value="invalid">{message('Revisar errores','Review errors')}</option><option value="omitted">{message('Omitidos','Skipped')}</option><option value="created">{message('Importados','Imported')}</option>
        </select></label>
        {!!ready.length && <button type="button" className="primary" disabled={busy} onClick={importNew}>{message('Importar clientes nuevos','Import new customers')} ({ready.length})</button>}
      </div>
      <div className="clientImportTable"><table><thead><tr>{(en?['Row','Name','Phone','Email','Notes','Result']:['Fila','Nombre','Teléfono','Correo','Notas','Resultado']).map(label=><th key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.slice((page-1)*50,page*50).map(row=><tr key={row.row_number}><td>{row.row_number}</td><td>{row.name||'—'}</td><td>{row.phone||'—'}</td><td>{row.email||'—'}</td><td className="clientImportNote">{row.notes||'—'}</td><td><span className={`clientImportStatus ${row.status}`}>{labels[row.status]}</span>{row.reason&&<small>{reasonText(row.reason)}</small>}{row.match_name&&<small>{row.match_name}</small>}</td></tr>)}</tbody></table></div>
      <Pagination total={visible.length} page={page} onPage={setPage} language={language}/>
      <small>{message('Corrija las filas marcadas en el archivo y vuelva a cargarlo. Para recuperar un cliente en papelera use la opción Restaurar.','Correct flagged rows in the file and upload it again. To recover a customer in trash, use Restore.')}</small>
    </div>}
  </section>;
}
