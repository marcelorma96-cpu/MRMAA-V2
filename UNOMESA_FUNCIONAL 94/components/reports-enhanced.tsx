"use client";
import {useRefreshRegistration} from "./pull-refresh";
import {useModulePending} from "./presentation-loading";
import {AppOptions,AppRecord,useAppMode} from "./app-context";
import {useEffect,useMemo,useRef,useState} from "react";
import {FileSpreadsheet,Printer,RefreshCw} from "lucide-react";
import {useDataRefresh} from "@/components/restaurant-sync";
import {useExcelExportAccess} from "@/components/excel-permission";
import {useAppPreferences} from "@/components/app-preferences";
import {Pagination,PAGE_SIZE} from "@/components/pagination";
import {supabase} from "@/lib/supabase";
import {printHtml} from "@/lib/print";
import {recordAuditActivity} from "@/lib/audit-activity";
import {localDateISO} from "@/lib/local-date";
import {exportBudget,PRINT_ROW_LIMIT,EXPORT_ROW_LIMIT} from "@/lib/export-limits";
import {userMessage} from "@/lib/user-message";
import {filterReport,readReportExport,requireReportAccess,validateReportQuery,reportDate,type ReportKind,type ReportRow,type ReportQuery} from "@/lib/report-data";
import {reportNumberUnit,reportCell,reportColumnLabel,reportNote,reportTitles} from "@/lib/report-presentation";
import {analyzeReport,type ReportMetric,type ReportGrouping} from "@/lib/report-consolidation";

const esc=(value:unknown)=>String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]!);
export function EnhancedReports({restaurantId,restaurantName="",timeFormat}:{restaurantId:string;restaurantName?:string;timeFormat?:unknown}){
 const app=useAppMode();
 const remoteVersion=useDataRefresh(restaurantId,"v2_clients,v2_reservations,v2_quotes,v2_quote_items,v2_employees,v2_schedules,v2_areas,v2_shifts");
 const {language,currency,t,money}=useAppPreferences(),en=language==="en";
 const say=(es:string,english:string)=>en?english:es;
 const excelAccess=useExcelExportAccess(restaurantId);
 const [filters,setFilters]=useState(()=>{const now=new Date();return {kind:"frequent" as ReportKind,from:localDateISO(new Date(now.getFullYear(),now.getMonth(),1)),to:localDateISO(now),search:"",page:1,grouping:undefined as ReportGrouping|undefined}});
 const {kind,from,to,search,page,grouping}=filters;
 const [revision,setRevision]=useState(0),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const exporting=useRef(false);
 const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",today=localDateISO();
 // Fetch the whole period once. Search, grouping and pagination only affect its breakdown.
 const query:ReportQuery={restaurantId,kind,from,to,search:"",timezone};
 const sourceKey=JSON.stringify([restaurantId,kind,from,to,timezone,remoteVersion,revision]);
 const registerRefresh=useRefreshRegistration();
 const [result,setResult]=useState<{key:string;source:ReportRow[];error?:string}|null>(null);
 const current=result?.key===sourceKey?result:null,loading=!current;
 useModulePending(loading);
 const prepared=useMemo(()=>{
  if(!current||current.error)return {analysis:null,error:current?.error||""};
  try{return {analysis:analyzeReport(kind,current.source,{from,to,today,en,grouping}),error:""}}
  catch(error){return {analysis:null,error:userMessage(error)}}
 },[current,kind,from,to,today,en,grouping]);
 const analysis=prepared.analysis,error=prepared.error,note=reportNote(kind,en);
 const columns=analysis?.columns||[];
 const filtered=filterReport(analysis?.rows||[],search,(key,value,row)=>cell(key,row));
 const total=filtered.length,rows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 const change=(update:Partial<typeof filters>)=>{setNotice("");setFilters(previous=>({...previous,...update,page:1}))};
 useEffect(()=>{if(page>1&&!rows.length)setFilters(previous=>({...previous,page:1}))},[page,rows.length]);
 useEffect(()=>{
  const controller=new AbortController();
  const read=async()=>{
   try{
    validateReportQuery(query);
    const source=await readReportExport(supabase,query,EXPORT_ROW_LIMIT,controller.signal);
    if(!controller.signal.aborted)setResult({key:sourceKey,source});
   }catch(error){if(!controller.signal.aborted)setResult({key:sourceKey,source:[],error:userMessage(error)})}
  };
  let reading=Promise.resolve();
  const timer=window.setTimeout(()=>{reading=read()},200);
  const unregister=registerRefresh(async()=>{window.clearTimeout(timer);await reading;if(controller.signal.aborted)return;reading=read();await reading});
  return()=>{unregister();controller.abort();window.clearTimeout(timer)};
  // A result belongs to one complete source query, not a visible page or search.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[sourceKey,registerRefresh]);
 function number(value:number){return new Intl.NumberFormat(en?"en-US":"es-GT",{maximumFractionDigits:2}).format(value)}
 function metricValue(metric:ReportMetric){
  if(metric.value===null)return "—";
  if(typeof metric.value!=="number")return metric.value;
  if(metric.format==="money")return money(metric.value);
  if(metric.format==="percent")return `${number(metric.value)}%`;
  if(metric.format==="days")return `${number(metric.value)} ${say('días','days')}`;
  return number(metric.value);
 }
 function cell(key:string,row:ReportRow){
  const value=reportCell(key,row[key],language,timeFormat);
  const unit=reportNumberUnit(key,row);
  return typeof value==="number"?unit==='money'?money(value):unit==='percent'?`${number(value)}%`:unit==='points'?`${number(value)} pp`:number(value):String(value);
 }
 const groupingLabel=analysis?.groupings.find(option=>option.value===analysis.grouping)?.label||say('Detalle','Details');
 function metadata(count:number){
  const data:(string|number)[][]=[
   [say('Reporte','Report'),t(reportTitles[kind])],[say('Restaurante','Restaurant'),restaurantName],
   [say('Desde','From'),from],[say('Hasta','Through'),to],[say('Desglose','Breakdown'),groupingLabel],
   [say('Búsqueda en desglose','Breakdown search'),search.trim()||"—"],[say('Filas del desglose','Breakdown rows'),count],
   [say('Moneda','Currency'),currency],[say('Zona horaria del dispositivo','Device time zone'),timezone],
   [say('Generado','Generated'),new Date().toLocaleString(en?'en-US':'es-GT')],
   [say('Alcance del resumen','Summary scope'),say('Período completo, antes de la búsqueda y la paginación.','Full period, before search and pagination.')],
   [say('Criterios','Calculation basis'),note],
  ];
  if(kind==='comparison'){
   const days=Date.parse(to)-Date.parse(from)+86400000;
   data.push([say('Período anterior','Previous period'),`${new Date(Date.parse(from)-days).toISOString().slice(0,10)} – ${new Date(Date.parse(from)-86400000).toISOString().slice(0,10)}`]);
  }
  for(const warning of analysis?.warnings||[])data.push([say('Observación','Note'),warning]);
  return data;
 }
 async function exportReport(format:'print'|'excel'){
  if(exporting.current||loading||error||!analysis||!current)return;
  exporting.current=true;setBusy(true);setNotice('');
  try{
   // Recheck permissions, then export the same complete snapshot that produced the summary.
   await requireReportAccess(supabase,restaurantId);
   if(format==='excel')await excelAccess.ensureAllowed();
   const output=filtered;exportBudget(format==='print'?PRINT_ROW_LIMIT:EXPORT_ROW_LIMIT).add(output);
   if(format==='print'){
    const metrics=analysis.metrics.map(metric=>`<div><span>${esc(metric.label)}</span><strong>${esc(metricValue(metric))}</strong>${metric.hint?`<small>${esc(metric.hint)}</small>`:''}</div>`).join('');
    printHtml(`<html lang="${language}"><head><meta charset="utf-8"><title>${esc(t(reportTitles[kind]))}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#18181b}h1{font-size:20px}p{font-size:11px}.metrics{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.metrics>div{flex:1;min-width:140px;border:1px solid #ddd;border-radius:8px;padding:12px}.metrics span,.metrics strong,.metrics small{display:block}.metrics span,.metrics small{font-size:10px}.metrics strong{font-size:22px;margin:5px 0}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left;font-size:10px}th{background:#eee}td{overflow-wrap:anywhere}</style></head><body translate="no"><h1>${esc(t(reportTitles[kind]))}</h1><p>${esc(restaurantName)} · ${esc(reportDate(from))} — ${esc(reportDate(to))}</p><section class="metrics">${metrics}</section>${metadata(output.length).slice(1).map(([key,value])=>`<p><b>${esc(key)}:</b> ${esc(value)}</p>`).join('')}<h2>${esc(groupingLabel)}</h2><table><thead><tr>${columns.map(key=>`<th>${esc(reportColumnLabel(key,language))}</th>`).join('')}</tr></thead><tbody>${output.map(row=>`<tr>${columns.map(key=>`<td>${esc(cell(key,row))}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`,{translated:true});
   }else{
    const XLSX=await import('xlsx');
    const workbook=XLSX.utils.book_new();
    const summary=XLSX.utils.aoa_to_sheet([[say('Indicador','Metric'),say('Valor','Value'),say('Criterio','Basis')],...analysis.metrics.map(metric=>[metric.label,metric.value,metric.hint||''])]);
    summary['!cols']=[{wch:38},{wch:24},{wch:95}];
    analysis.metrics.forEach((metric,index)=>{const value=summary[XLSX.utils.encode_cell({r:index+1,c:1})];if(value?.t==='n')value.z=metric.format==='money'?`"${currency}" #,##0.00`:metric.format==='percent'?'0.00"%"':'0.##'});
    XLSX.utils.book_append_sheet(workbook,summary,say('Resumen','Summary'));
    const sheet=XLSX.utils.aoa_to_sheet([columns.map(key=>reportColumnLabel(key,language)),...output.map(row=>columns.map(key=>row[key]==null?null:reportCell(key,row[key],language,timeFormat)))]);
    if(columns.length)sheet['!autofilter']={ref:XLSX.utils.encode_range({r:0,c:0},{r:output.length,c:columns.length-1})};
    sheet['!cols']=columns.map(key=>({wch:['Cliente','Empleado','Area','Origen','Indicador','Anticipación'].includes(key)?30:22}));
    for(let index=0;index<output.length;index++)for(let column=0;column<columns.length;column++){
     const value=sheet[XLSX.utils.encode_cell({r:index+1,c:column})];
     const unit=reportNumberUnit(columns[column],output[index]);
     if(value?.t==='n')value.z=unit==='money'?`"${currency}" #,##0.00`:unit==='percent'?'0.00"%"':unit==='points'?'0.00" pp"':'0.##';
    }
    XLSX.utils.book_append_sheet(workbook,sheet,say('Desglose','Breakdown'));
    const info=XLSX.utils.aoa_to_sheet(metadata(output.length));info['!cols']=[{wch:32},{wch:115}];
    XLSX.utils.book_append_sheet(workbook,info,say('Criterios','Criteria'));
    await excelAccess.ensureAllowed();
    XLSX.writeFile(workbook,`${en?'report':'reporte'}-${kind}-${from}-${to}.xlsx`);
   }
   void recordAuditActivity(restaurantId,format==='excel'?'excel_exportado':'impresion','reportes',{label:reportTitles[kind],from,to,rows:filtered.length,grouping:analysis.grouping}).catch(()=>{});
  }catch(error){setNotice(userMessage(error))}
  finally{exporting.current=false;setBusy(false)}
 }
 const chartMax=Math.max(1,...(analysis?.chart||[]).map(item=>item.value));
 return <div className="moduleStack reportsModule" translate="no">
  <AppOptions title={say('Reporte y fechas','Report and dates')} summary={`${t(reportTitles[kind])} · ${reportDate(from)} — ${reportDate(to)}`}>
   <section className="moduleCard reportControls">
    <select aria-label={say('Tipo de reporte','Report type')} disabled={busy} value={kind} onChange={e=>change({kind:e.target.value as ReportKind,grouping:undefined,search:''})}>{Object.entries(reportTitles).map(([key,value])=><option value={key} key={key}>{t(value)}</option>)}</select>
    <label className="reportDate"><span>{say('Desde','From')}</span><input aria-label={say('Fecha inicial','From date')} type="date" disabled={busy} value={from} onChange={e=>change({from:e.target.value})}/></label>
    <label className="reportDate"><span>{say('Hasta','Through')}</span><input aria-label={say('Fecha final','Through date')} type="date" disabled={busy} value={to} onChange={e=>change({to:e.target.value})}/></label>
    <button type="button" className="secondary" disabled={busy} onClick={()=>{setNotice('');setRevision(value=>value+1)}}><RefreshCw/>{say('Actualizar','Refresh')}</button>
    <button type="button" className="primary" disabled={loading||busy||!!error} onClick={()=>void exportReport('print')}><Printer/>{t('Imprimir')}</button>
    <button type="button" className="secondary" disabled={loading||busy||!!error||!excelAccess.allowed} title={excelAccess.allowed?undefined:t(excelAccess.hint)} onClick={()=>void exportReport('excel')}><FileSpreadsheet/>{busy?say('Preparando…','Preparing…'):'Excel'}</button>
   </section>
  </AppOptions>
  {(error||notice)&&<p role="alert" className="moduleNotice moduleError">{t(error||notice)}</p>}
  <section className="moduleCard reportOverview" aria-busy={loading}>
   <div className="moduleTitle"><div><span className="reportEyebrow">{say('RESUMEN DEL PERÍODO','PERIOD SUMMARY')}</span><h2>{t(reportTitles[kind])}</h2><p>{reportDate(from)} — {reportDate(to)}</p></div></div>
   {loading?<div className="empty" role="status">{say('Consolidando el período completo…','Consolidating the full period…')}</div>:error?<div className="empty">{say('Revise las fechas y presione Actualizar para reintentar.','Check the dates and press Refresh to retry.')}</div>:analysis&&<>
    {!!analysis.metrics.length&&<div className="reportMetricGrid">{analysis.metrics.map((metric,index)=><article className="reportMetric" key={`${metric.label}-${index}`}><span>{metric.label}</span><strong>{metricValue(metric)}</strong>{metric.hint&&<small>{metric.hint}</small>}</article>)}</div>}
    <p className="reportDescription">{analysis.description}</p>
    {analysis.warnings.map((warning,index)=><p className="reportDataWarning" key={index}>{warning}</p>)}
   </>}
  </section>
  {analysis&&!error&&<section className="moduleCard reportBreakdown">
   <div className="reportBreakdownHeading"><div><h3>{say('Explorar el desglose','Explore the breakdown')}</h3><p>{say('El resumen siempre conserva el período completo.','The summary always covers the full period.')}</p></div>
    {analysis.groupings.length>1&&<div className="reportGrouping" role="group" aria-label={say('Agrupar reporte','Group report')}>{analysis.groupings.map(option=><button type="button" key={option.value} disabled={busy} aria-pressed={analysis.grouping===option.value} onClick={()=>change({grouping:option.value,search:''})}>{option.label}</button>)}</div>}
   </div>
   {!!analysis.chart?.length&&<div className="reportChart"><h4>{analysis.chartLabel||groupingLabel}</h4><p>{say('Distribución del período completo.','Distribution across the full period.')}</p><div className="reportBars" role="list">{analysis.chart.map((item,index)=><div className="reportBarRow" role="listitem" key={`${item.label}-${index}`}><span>{item.label}</span><div className="reportBarTrack" aria-hidden="true"><i style={{width:`${Math.max(0,item.value)/chartMax*100}%`}}/></div><b>{number(item.value)}</b>{item.secondary&&<small>{item.secondary}</small>}</div>)}</div></div>}
   <div className="reportSearchRow"><input aria-label={say('Buscar en desglose','Search breakdown')} className="moduleSearch" placeholder={say('Buscar en este desglose…','Search this breakdown…')} disabled={busy} value={search} onChange={e=>change({search:e.target.value})}/><span>{total} {total===1?say('fila','row'):say('filas','rows')}</span></div>
   {search.trim()&&<p className="reportSearchScope">{say('La búsqueda filtra las filas siguientes; no cambia los indicadores ni la gráfica.','Search filters the rows below; it does not change the metrics or chart.')}</p>}
   {rows.length?app?<div className="appRecords">{rows.map((row,index)=><AppRecord key={`${sourceKey}-${analysis.grouping}-${page}-${index}`} title={cell(columns[0],row)} subtitle={columns[1]?`${reportColumnLabel(columns[1],language)}: ${cell(columns[1],row)}`:undefined}><dl>{columns.map(key=><div key={key}><dt>{reportColumnLabel(key,language)}</dt><dd>{cell(key,row)}</dd></div>)}</dl></AppRecord>)}</div>:<div className="reportTable"><table><thead><tr>{columns.map(key=><th scope="col" key={key}>{reportColumnLabel(key,language)}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={`${sourceKey}-${page}-${index}`}>{columns.map(key=><td key={key}>{cell(key,row)}</td>)}</tr>)}</tbody></table></div>:<div className="empty">{say('No hay información para este desglose.','No data for this breakdown.')}</div>}
   {total>PAGE_SIZE&&<Pagination total={total} page={page} language={language} onPage={value=>{if(!busy)setFilters(previous=>({...previous,page:value}))}}/>}
  </section>}
  <AppOptions title={say('Cómo se calcula este reporte','How this report is calculated')}><p className="reportNote">{note}</p></AppOptions>
 </div>;
}
