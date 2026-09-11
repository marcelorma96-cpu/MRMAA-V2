"use client";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import type { Client, Quote, Reservation } from "@/lib/types";
import { printHtml } from "@/lib/print";
import { Pagination, pageItems } from "@/components/pagination";
import { currentAppLanguage, formatAppMoney } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
const money = (n: number) => formatAppMoney(n),
  esc = (v: unknown) =>
    String(v ?? "").replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c]!,
    );
const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
type Kind = "frequent" | "reserved" | "pending" | "approved" | "deposits" | "employees";
type EmployeeReportRow = { Empleado: string; Codigo: string; Area: string; Dias: number; HorasNetas: number; HorasComida: number; Descansos: number; Permisos: number };
export function EnhancedReports({
  restaurantId,
  clients,
  quotes,
  reservations,
}: {
  restaurantId: string;
  clients: Client[];
  quotes: Quote[];
  reservations: Reservation[];
}) {
  const now = new Date(),
    [from, setFrom] = useState(
      new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(now.toISOString().slice(0, 10)),
    [kind, setKind] = useState<Kind>("frequent"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [employeeRows, setEmployeeRows] = useState<EmployeeReportRow[]>([]);
  useEffect(() => {
    const loadEmployees = async () => {
      const [employees, schedules, areas, shifts] = await Promise.all([
        supabase.from("v2_employees").select("id,name,employee_code,area_id").eq("restaurant_id", restaurantId),
        supabase.from("v2_schedules").select("employee_id,area_id,shift_id,work_date,notes").eq("restaurant_id", restaurantId).gte("work_date", from).lte("work_date", to),
        supabase.from("v2_areas").select("id,name").eq("restaurant_id", restaurantId),
        supabase.from("v2_shifts").select("id,start_time,end_time,break_minutes").eq("restaurant_id", restaurantId),
      ]);
      const areaMap = new Map((areas.data || []).map((x: any) => [x.id, x.name]));
      const shiftMap = new Map((shifts.data || []).map((x: any) => [x.id, x]));
      const minutes = (value: string) => { const [h, m] = String(value || "0:0").split(":").map(Number); return h * 60 + m; };
      setEmployeeRows((employees.data || []).map((employee: any) => {
        const assigned = (schedules.data || []).filter((s: any) => s.employee_id === employee.id);
        let workDays = 0, netMinutes = 0, mealMinutes = 0, rest = 0, permits = 0;
        assigned.forEach((schedule: any) => {
          const note = String(schedule.notes || "").toLowerCase();
          if (note.includes("descanso") || note.includes("día libre") || note.includes("dia libre")) { rest++; return; }
          if (note.includes("permiso")) { permits++; return; }
          const shift: any = shiftMap.get(schedule.shift_id);
          if (!shift) return;
          let duration = minutes(shift.end_time) - minutes(shift.start_time);
          if (duration < 0) duration += 24 * 60;
          const meal = Math.max(0, Number(shift.break_minutes) || 0);
          workDays++; mealMinutes += meal; netMinutes += Math.max(0, duration - meal);
        });
        const mostRecentArea = [...assigned].reverse().find((s: any) => s.area_id)?.area_id || employee.area_id;
        return { Empleado: employee.name, Codigo: employee.employee_code || "", Area: areaMap.get(mostRecentArea) || "Sin área", Dias: workDays, HorasNetas: Number((netMinutes / 60).toFixed(2)), HorasComida: Number((mealMinutes / 60).toFixed(2)), Descansos: rest, Permisos: permits };
      }));
    };
    void loadEmployees();
  }, [restaurantId, from, to]);
  const rv = reservations.filter(
      (x) => x.event_date >= from && x.event_date <= to,
    ),
    qs = quotes.filter((x) => x.event_date >= from && x.event_date <= to);
  const reports = useMemo(() => {
    const frequent = clients
      .map((c) => {
        const x = rv.filter(
          (r) =>
            r.client_id === c.id || (!r.client_id && r.client_name === c.name),
        );
        return {
          Cliente: c.name,
          Telefono: c.phone || "",
          Reservaciones: x.length,
          Invitados: x.reduce((s, r) => s + Number(r.guests), 0),
          Ultima:
            x
              .map((r) => r.event_date)
              .sort()
              .at(-1) || "—",
        };
      })
      .filter((x) => x.Reservaciones)
      .sort((a, b) => b.Reservaciones - a.Reservaciones);
    const reserved = rv.map((r) => ({
      Fecha: displayDate(r.event_date),
      Hora: r.event_time?.slice(0, 5) || "",
      Cliente: r.client_name,
      Telefono: r.phone,
      Area: r.area,
      Invitados: r.guests,
      Estado: r.status,
    }));
    const pending = qs
      .filter((q) => !["convertida", "aprobada"].includes(q.status))
      .map((q) => ({
        Numero: `#${q.quote_number}`,
        Fecha: displayDate(q.event_date),
        Cliente: q.client_name,
        Telefono: q.client_phone,
        Total: money(q.total),
        Estado: q.status,
      }));
    const approved = qs
      .filter((q) => ["convertida", "aprobada"].includes(q.status))
      .map((q) => ({
        Numero: `#${q.quote_number}`,
        Fecha: displayDate(q.event_date),
        Cliente: q.client_name,
        Venta: money(q.total),
        Anticipo: money(q.deposit),
        Saldo: money(q.balance),
      }));
    const linked = new Set(rv.map((r) => r.quote_id).filter(Boolean)),
      deposits = [
        ...rv
          .filter((r) => Number(r.deposit) > 0)
          .map((r) => ({
            Fecha: displayDate(r.event_date),
            Cliente: r.client_name,
            Origen: "Reservación",
            Anticipo: money(r.deposit),
            Metodo: r.payment_method || "Sin especificar",
          })),
        ...qs
          .filter((q) => Number(q.deposit) > 0 && !linked.has(q.id))
          .map((q) => ({
            Fecha: displayDate(q.event_date),
            Cliente: q.client_name,
            Origen: `Cotización #${q.quote_number}`,
            Anticipo: money(q.deposit),
            Metodo: q.payment_method || "Sin especificar",
          })),
      ];
    return { frequent, reserved, pending, approved, deposits, employees: employeeRows };
  }, [clients, rv, qs, employeeRows]);
  const titles = {
      frequent: "Clientes más frecuentes",
      reserved: "Clientes que han reservado",
      pending: "Cotizaciones pendientes",
      approved: "Cotizaciones aprobadas y valor de venta",
      deposits: "Anticipos pagados por cliente",
      employees: "Empleados, días y horas programadas",
    },
    raw = reports[kind],
    rows = raw.filter(
      (row) =>
        !search ||
        Object.values(row).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ),
    ),
    columns = rows.length ? Object.keys(rows[0]) : [],
    visible = pageItems(rows, page);
  useEffect(() => setPage(1), [kind, from, to, search, rows.length]);
  function print() {
    const cols = columns.length ? columns : Object.keys(raw[0] || {});
    printHtml(
      `<html><head><title>${titles[kind]}</title><style>body{font-family:Arial;padding:24px;color:#18181b}h1{font-family:Georgia}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:11px}th{background:#18181b;color:#fff}</style></head><body><h1>${titles[kind]}</h1><p>${from} a ${to}</p><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${cols.map((c) => `<td>${esc((row as any)[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`,
    );
  }
  function exportExcel() {
    const language = currentAppLanguage();
    const localizedRows = rows.map((row) => translateRecord(row as Record<string, unknown>, language));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(localizedRows), translate("Reporte", language));
    XLSX.writeFile(wb, `${language === "en" ? "report" : "reporte"}-${kind}-${from}-${to}.xlsx`);
  }
  return (
    <div className="moduleStack">
      <section className="moduleCard reportControls">
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {Object.entries(titles).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span>a</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <input
          className="moduleSearch"
          placeholder="Buscar en reporte…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="primary" onClick={print}>
          <Printer />
          Imprimir
        </button>
        <button className="secondary" onClick={exportExcel}><FileSpreadsheet /> Excel</button>
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>{titles[kind]}</h2>
            <p>{rows.length} resultados en el periodo.</p>
          </div>
        </div>
        {rows.length ? (
          <div className="reportTable">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, i) => (
                  <tr key={`${page}-${i}`}>
                    {columns.map((c) => (
                      <td key={c}>{String((row as any)[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No hay información para este reporte.</div>
        )}
        <Pagination total={rows.length} page={page} onPage={setPage} />
      </section>
    </div>
  );
}
