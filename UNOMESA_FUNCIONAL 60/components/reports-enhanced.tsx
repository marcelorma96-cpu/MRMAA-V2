"use client";
import {useRefreshRegistration} from "./pull-refresh";
import {useModulePending} from "./presentation-loading";
import {AppOptions,AppRecord,useAppMode} from "./app-context";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { useDataRefresh } from "@/components/restaurant-sync";
import { useExcelExportAccess } from "@/components/excel-permission";
import { useAppPreferences } from "@/components/app-preferences";
import { Pagination, PAGE_SIZE } from "@/components/pagination";
import { supabase } from "@/lib/supabase";
import { printHtml } from "@/lib/print";
import { recordAuditActivity } from "@/lib/audit-activity";
import { localDateISO } from "@/lib/local-date";
import { exportBudget, PRINT_ROW_LIMIT, EXPORT_ROW_LIMIT } from "@/lib/export-limits";
import { userMessage } from "@/lib/user-message";
import { filterReport, localReport, readLocalReport, readReportPage, readReportExport, requireReportAccess, validateReportQuery, type ReportKind, type ReportRow, type ReportQuery } from "@/lib/report-data";
import { moneyColumn, percentColumn, reportCell, reportColumnLabel, reportColumns, reportNote, reportTitles } from "@/lib/report-presentation";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
export function EnhancedReports({ restaurantId, restaurantName = "", timeFormat }: { restaurantId: string; restaurantName?: string; timeFormat?: unknown }) {
  const app=useAppMode();
  const remoteVersion = useDataRefresh(restaurantId, "v2_clients,v2_reservations,v2_quotes,v2_quote_items,v2_employees,v2_schedules,v2_areas,v2_shifts");
  const { language, currency, t, money } = useAppPreferences(), en = language === "en";
  const excelAccess = useExcelExportAccess(restaurantId);
  const [filters, setFilters] = useState(() => { const now = new Date(); return { kind: "frequent" as ReportKind, from: localDateISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDateISO(now), search: "", page: 1 }; });
  const { kind, from, to, search, page } = filters;
  const [revision, setRevision] = useState(0), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const exporting = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const query: ReportQuery = { restaurantId, kind, from, to, search, timezone };
  const sourceKey = JSON.stringify([restaurantId, kind, from, to, timezone, remoteVersion, revision]);
  const registerRefresh=useRefreshRegistration();
  const requestKey = JSON.stringify([sourceKey, search, page, language, timeFormat]);
  const cache = useRef<{ key: string; rows: ReportRow[] } | null>(null);
  const [result, setResult] = useState<{ key: string; rows: ReportRow[]; total: number; error?: string } | null>(null);
  const current = result?.key === requestKey ? result : null, loading = !current;
  useModulePending(loading);
  const rows = current?.rows || [], total = current?.total || 0;
  const note = reportNote(kind, en), columns = reportColumns[kind];
  const change = (update: Partial<typeof filters>) => { setNotice(""); setFilters(previous => ({ ...previous, ...update, page: 1 })); };

  useEffect(() => {
    const controller = new AbortController();
    const read=async () => {
      try {
        validateReportQuery(query);
        let next: { rows: ReportRow[]; total: number };
        if (localReport(kind) || search.trim()) {
          if (cache.current?.key !== sourceKey) {
            const data = localReport(kind)
              ? await readLocalReport(supabase, { ...query, search: "" }, controller.signal)
              : await readReportExport(supabase, { ...query, search: "" });
            controller.signal.throwIfAborted();
            cache.current = { key: sourceKey, rows: data };
          }
          const filtered = filterReport(cache.current.rows, search, (key, value) => reportCell(key, value, language, timeFormat));
          next = { rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: filtered.length };
        } else next = await readReportPage(supabase, query, (page - 1) * PAGE_SIZE, PAGE_SIZE, controller.signal);
        if (controller.signal.aborted) return;
        if (!next.rows.length && page > 1) { setFilters(previous => ({ ...previous, page: 1 })); return; }
        setResult({ key: requestKey, ...next });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key: requestKey, rows: [], total: 0, error: userMessage(error) });
      }
    };
    let reading=Promise.resolve();
    const timer=window.setTimeout(()=>{reading=read()},250);
    const unregister=registerRefresh(async()=>{window.clearTimeout(timer);await reading;if(controller.signal.aborted)return;cache.current=null;reading=read();await reading});
    return () => { unregister();controller.abort(); window.clearTimeout(timer); };
    // Keys include every query value and refresh version; obsolete requests cannot publish rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey,registerRefresh]);

  function cell(key: string, row: ReportRow) {
    const value = reportCell(key, row[key], language, timeFormat);
    return typeof value === "number" && moneyColumn(key) ? money(value) : String(value);
  }
  function metadata(count: number) {
    const data: (string | number)[][] = [
      [en ? "Report" : "Reporte", t(reportTitles[kind])], [en ? "Restaurant" : "Restaurante", restaurantName],
      [en ? "From" : "Desde", from], [en ? "Through" : "Hasta", to], [en ? "Search" : "Búsqueda", search.trim() || "—"],
      [en ? "Rows" : "Filas", count], [en ? "Currency" : "Moneda", currency],
      [en ? "Device time zone" : "Zona horaria del dispositivo", timezone], [en ? "Generated" : "Generado", new Date().toLocaleString(en ? "en-US" : "es-GT")],
      [en ? "Dates in rows" : "Fechas en las filas", "DD/MM/YYYY"], [en ? "Calculation basis" : "Criterios", note],
    ];
    if (kind === "comparison") {
      const duration = Date.parse(to) - Date.parse(from) + 86400000;
      data.push([en ? "Previous period" : "Período anterior", `${new Date(Date.parse(from) - duration).toISOString().slice(0, 10)} – ${new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10)}`]);
    }
    return data;
  }
  async function outputRows(maxRows: number) {
    await requireReportAccess(supabase, restaurantId);
    if ((localReport(kind) || search.trim()) && cache.current?.key === sourceKey) {
      const output = filterReport(cache.current.rows, search, (key, value) => reportCell(key, value, language, timeFormat)); exportBudget(maxRows).add(output); return output;
    }
    return readReportExport(supabase, query, maxRows);
  }
  async function exportReport(format: "print" | "excel") {
    if (exporting.current || loading || current?.error) return;
    exporting.current = true; setBusy(true); setNotice("");
    try {
      if (format === "excel") await excelAccess.ensureAllowed();
      const output = await outputRows(format === "print" ? PRINT_ROW_LIMIT : EXPORT_ROW_LIMIT);
      if (format === "print") {
        printHtml(`<html lang="${language}"><head><title>${esc(t(reportTitles[kind]))}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#18181b}h1{font-size:20px}p{font-size:11px}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left;font-size:10px}th{background:#eee}td{overflow-wrap:anywhere}</style></head><body translate="no"><h1>${esc(t(reportTitles[kind]))}</h1>${metadata(output.length).slice(1).map(([key, value]) => `<p><b>${esc(key)}:</b> ${esc(value)}</p>`).join("")}<table><thead><tr>${columns.map(key => `<th>${esc(reportColumnLabel(key, language))}</th>`).join("")}</tr></thead><tbody>${output.map(row => `<tr>${columns.map(key => `<td>${esc(cell(key, row))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`, { translated: true });
      } else {
        const XLSX = await import("xlsx");
        const sheet = XLSX.utils.aoa_to_sheet([columns.map(key => reportColumnLabel(key, language)), ...output.map(row => columns.map(key => row[key] == null ? null : reportCell(key, row[key], language, timeFormat)))]);
        sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: output.length, c: columns.length - 1 }) };
        sheet["!cols"] = columns.map(key => ({ wch: ["Cliente", "Empleado", "Area", "Origen", "Indicador"].includes(key) ? 28 : 20 }));
        for (let index = 0; index < output.length; index++) for (let column = 0; column < columns.length; column++) {
          const value = sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })];
          if (value?.t === "n") value.z = moneyColumn(columns[column]) ? `"${currency}" #,##0.00` : percentColumn(columns[column]) ? '0.00"%"' : ["HorasNetas", "HorasComida", "Actual", "Anterior", "Diferencia"].includes(columns[column]) ? "0.00" : "0";
        }
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, en ? "Report" : "Reporte");
        const info = XLSX.utils.aoa_to_sheet(metadata(output.length)); info["!cols"] = [{ wch: 28 }, { wch: 110 }];
        XLSX.utils.book_append_sheet(workbook, info, en ? "Details" : "Detalles");
        await excelAccess.ensureAllowed();
        XLSX.writeFile(workbook, `${en ? "report" : "reporte"}-${kind}-${from}-${to}.xlsx`);
      }
      // Audit failures must not report a successfully generated file as failed.
      void recordAuditActivity(restaurantId, format === "excel" ? "excel_exportado" : "impresion", "reportes", { label: reportTitles[kind], from, to, rows: output.length }).catch(() => {});
    } catch (error) { setNotice(userMessage(error)); }
    finally { exporting.current = false; setBusy(false); }
  }

  return <div className="moduleStack reportsModule" translate="no">
    <AppOptions title={en?"Report and filters":"Reporte y filtros"} summary={`${t(reportTitles[kind])} · ${from} — ${to}`}>
    <section className="moduleCard reportControls">
      <select aria-label={en ? "Report type" : "Tipo de reporte"} disabled={busy} value={kind} onChange={e => change({ kind: e.target.value as ReportKind })}>{Object.entries(reportTitles).map(([key, value]) => <option value={key} key={key}>{t(value)}</option>)}</select>
      <label className="reportDate"><span>{en ? "From" : "Desde"}</span><input aria-label={en ? "From date" : "Fecha inicial"} type="date" disabled={busy} value={from} onChange={e => change({ from: e.target.value })} /></label><label className="reportDate"><span>{en ? "Through" : "Hasta"}</span><input aria-label={en ? "Through date" : "Fecha final"} type="date" disabled={busy} value={to} onChange={e => change({ to: e.target.value })} /></label>
      <input aria-label={en ? "Search report" : "Buscar en reporte"} className="moduleSearch" placeholder={en ? "Search report…" : "Buscar en reporte…"} disabled={busy} value={search} onChange={e => change({ search: e.target.value })} />
      <button type="button" className="secondary" disabled={busy} onClick={() => { setNotice(""); setRevision(value => value + 1); }}><RefreshCw />{en ? "Refresh" : "Actualizar"}</button>
      <button type="button" className="primary" disabled={loading || busy || !!current?.error} onClick={() => void exportReport("print")}><Printer />{t("Imprimir")}</button>
      <button type="button" className="secondary" disabled={loading || busy || !!current?.error || !excelAccess.allowed} title={excelAccess.allowed ? undefined : t(excelAccess.hint)} onClick={() => void exportReport("excel")}><FileSpreadsheet />{busy ? (en ? "Preparing…" : "Preparando…") : "Excel"}</button>
    </section>
    </AppOptions>
    {(current?.error || notice) && <p role="alert" className="moduleNotice moduleError">{t(current?.error || notice)}</p>}
    <AppOptions title={en?"How this report is calculated":"Cómo se calcula este reporte"}><p className="reportNote">{note}</p></AppOptions>
    <section className="moduleCard" aria-busy={loading}><div className="moduleTitle"><div><h2>{t(reportTitles[kind])}</h2><p>{loading ? (en ? "Loading information…" : "Cargando información…") : current?.error ? (en ? "Report unavailable." : "Reporte no disponible.") : `${total} ${en ? "results in the period." : "resultados en el período."}`}</p></div></div>
      {loading ? <div className="empty" role="status">{en ? "Loading information…" : "Cargando información…"}</div> : current?.error ? <div className="empty">{en ? "Check the dates and press Refresh to retry." : "Revise las fechas y presione Actualizar para reintentar."}</div> : rows.length ? app?<div className="appRecords">{rows.map((row,index)=><AppRecord key={`${requestKey}-${index}`} title={cell(columns[0],row)} subtitle={columns[1]?`${reportColumnLabel(columns[1],language)}: ${cell(columns[1],row)}`:undefined}><dl>{columns.map(key=><div key={key}><dt>{reportColumnLabel(key,language)}</dt><dd>{cell(key,row)}</dd></div>)}</dl></AppRecord>)}</div>:<div className="reportTable"><table><thead><tr>{columns.map(key => <th scope="col" key={key}>{reportColumnLabel(key, language)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${requestKey}-${index}`}>{columns.map(key => <td key={key}>{cell(key, row)}</td>)}</tr>)}</tbody></table></div> : <div className="empty">{en ? "No information matches this report." : "No hay información para este reporte."}</div>}
      {!loading && !current?.error && <Pagination total={total} page={page} language={language} onPage={value => setFilters(previous => ({ ...previous, page: value }))} />}
    </section>
  </div>;
}
