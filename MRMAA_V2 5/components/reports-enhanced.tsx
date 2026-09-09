"use client";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import type { Client, Quote, Reservation } from "@/lib/types";
import { printHtml } from "@/lib/print";
const money = (n: number) =>
    new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: "GTQ",
    }).format(n || 0),
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
type Kind = "frequent" | "reserved" | "pending" | "approved" | "deposits";
export function EnhancedReports({
  clients,
  quotes,
  reservations,
}: {
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
    [search, setSearch] = useState("");
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
    return { frequent, reserved, pending, approved, deposits };
  }, [clients, rv, qs]);
  const titles = {
      frequent: "Clientes más frecuentes",
      reserved: "Clientes que han reservado",
      pending: "Cotizaciones pendientes",
      approved: "Cotizaciones aprobadas y valor de venta",
      deposits: "Anticipos pagados por cliente",
    },
    raw = reports[kind],
    rows = raw.filter(
      (row) =>
        !search ||
        Object.values(row).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ),
    ),
    columns = rows.length ? Object.keys(rows[0]) : [];
  function print() {
    const cols = columns.length ? columns : Object.keys(raw[0] || {});
    printHtml(
      `<html><head><title>${titles[kind]}</title><style>body{font-family:Arial;padding:24px;color:#18181b}h1{font-family:Georgia}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:11px}th{background:#18181b;color:#fff}</style></head><body><h1>${titles[kind]}</h1><p>${from} a ${to}</p><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${cols.map((c) => `<td>${esc((row as any)[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`,
    );
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
                {rows.map((row, i) => (
                  <tr key={i}>
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
      </section>
    </div>
  );
}
