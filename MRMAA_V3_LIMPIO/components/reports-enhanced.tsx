"use client";
import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { printHtml } from "@/lib/print";
import { Pagination } from "@/components/pagination";
import { currentAppLanguage, formatAppMoney } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";

type Kind = "frequent" | "reserved" | "pending" | "approved" | "deposits" | "employees";
type ReportRow = Record<string, unknown>;
const esc = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
const titles: Record<Kind, string> = {
  frequent: "Clientes más frecuentes",
  reserved: "Clientes que han reservado",
  pending: "Cotizaciones pendientes",
  approved: "Cotizaciones aprobadas y valor de venta",
  deposits: "Anticipos pagados por cliente",
  employees: "Empleados, días y horas programadas",
};
const reportColumns: Record<Kind, string[]> = {
  frequent: ["Cliente", "Telefono", "Reservaciones", "Invitados", "Ultima"],
  reserved: ["Fecha", "Hora", "Cliente", "Telefono", "Area", "Invitados", "Estado"],
  pending: ["Numero", "Fecha", "Cliente", "Telefono", "Total", "Estado"],
  approved: ["Numero", "Fecha", "Cliente", "Venta", "Anticipo", "Saldo"],
  deposits: ["Fecha", "Cliente", "Origen", "Anticipo", "Metodo"],
  employees: ["Empleado", "Codigo", "Area", "Dias", "HorasNetas", "HorasComida", "Descansos", "Permisos"],
};
function displayRows(kind: Kind, rows: ReportRow[]) {
  const monetary = kind === "pending" ? ["Total"] : kind === "approved" ? ["Venta", "Anticipo", "Saldo"] : kind === "deposits" ? ["Anticipo"] : [];
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, monetary.includes(key) ? formatAppMoney(Number(value || 0)) : value])));
}

export function EnhancedReports({ restaurantId }: { restaurantId: string }) {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [kind, setKind] = useState<Kind>("frequent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => setPage(1), [kind, from, to, search]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true); setNotice("");
      const result = await supabase.rpc("v2_report_rows", { p_restaurant_id: restaurantId, p_kind: kind, p_from: from, p_to: to, p_search: search.trim(), p_offset: (page - 1) * 50, p_limit: 50 });
      if (result.error) { setRows([]); setTotal(0); setNotice("Ejecute SUPABASE_ESCALABILIDAD_50000.sql para activar los reportes escalables."); }
      else {
        const values = (result.data || []) as { row_data: ReportRow; total_count: number }[];
        setRows(displayRows(kind, values.map((value) => value.row_data)));
        setTotal(Number(values[0]?.total_count || 0));
      }
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [restaurantId, kind, from, to, search, page]);

  async function allRows() {
    const output: ReportRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await supabase.rpc("v2_report_rows", { p_restaurant_id: restaurantId, p_kind: kind, p_from: from, p_to: to, p_search: search.trim(), p_offset: offset, p_limit: 1000 });
      if (result.error) throw result.error;
      const batch = (result.data || []) as { row_data: ReportRow }[];
      output.push(...batch.map((value) => value.row_data));
      if (batch.length < 1000) return displayRows(kind, output);
    }
  }
  async function print() {
    try {
      const output = await allRows(), columns = reportColumns[kind];
      printHtml(`<html><head><title>${esc(titles[kind])}</title><style>body{font-family:Arial;padding:24px;color:#18181b}h1{font-family:Georgia}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:11px}th{background:#18181b;color:#fff}</style></head><body><h1>${esc(titles[kind])}</h1><p>${esc(from)} a ${esc(to)}</p><table><thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join("")}</tr></thead><tbody>${output.map((row) => `<tr>${columns.map((column) => `<td>${esc(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
    } catch (error: any) { setNotice(error.message || "No se pudo imprimir el reporte."); }
  }
  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const language = currentAppLanguage(), output = (await allRows()).map((row) => translateRecord(row, language));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(output), translate("Reporte", language));
      XLSX.writeFile(workbook, `${language === "en" ? "report" : "reporte"}-${kind}-${from}-${to}.xlsx`);
    } catch (error: any) { setNotice(error.message || "No se pudo exportar el reporte."); }
  }
  const columns = reportColumns[kind];
  return <div className="moduleStack">
    <section className="moduleCard reportControls">
      <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{Object.entries(titles).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>a</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <input className="moduleSearch" placeholder="Buscar en reporte…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <button className="primary" onClick={print}><Printer /> Imprimir</button><button className="secondary" onClick={exportExcel}><FileSpreadsheet /> Excel</button>
    </section>
    {notice && <p className="moduleNotice">{notice}</p>}
    <section className="moduleCard"><div className="moduleTitle"><div><h2>{titles[kind]}</h2><p>{total} resultados en el periodo.</p></div></div>
      {loading ? <div className="empty">Cargando información…</div> : rows.length ? <div className="reportTable"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${page}-${index}`}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div> : <div className="empty">No hay información para este reporte.</div>}
      <Pagination total={total} page={page} onPage={setPage} />
    </section>
  </div>;
}
