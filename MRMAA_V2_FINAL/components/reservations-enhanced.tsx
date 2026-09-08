"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { printHtml } from "@/lib/print";
import type { Quote, Reservation } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(
    n || 0,
  );
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ]!,
  );

export function ReservationsEnhanced({
  rows,
  quotes,
  restaurantId,
  restaurantName,
  edit,
  openQuote,
  reload,
  remove,
}: {
  rows: Reservation[];
  quotes: Quote[];
  restaurantId: string;
  restaurantName: string;
  edit: (r: Reservation) => void;
  openQuote: (q: Quote) => void;
  reload: () => Promise<void>;
  remove: (r: Reservation) => void;
}) {
  const [mode, setMode] = useState<"today" | "single" | "range" | "all">(
      "today",
    ),
    [date, setDate] = useState(today()),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [printMode, setPrintMode] = useState("both"),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [settings, setSettings] = useState({
      reservation_show_people: true,
      reservation_show_deposits: true,
    });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    supabase
      .from("v2_restaurants")
      .select("settings")
      .eq("id", restaurantId)
      .single()
      .then(({ data }) =>
        setSettings((old) => ({ ...old, ...(data?.settings || {}) })),
      );
  }, [restaurantId]);
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchesDate =
          mode === "all"
            ? true
            : mode === "today"
              ? r.event_date === today()
              : mode === "single"
                ? r.event_date === date
                : r.event_date >= from && r.event_date <= to;
        const q = search.trim().toLowerCase(),
          matchesSearch =
            !q ||
            [r.client_name, r.phone, r.area, r.menu, r.notes, r.status].some(
              (v) =>
                String(v || "")
                  .toLowerCase()
                  .includes(q),
            );
        return matchesDate && matchesSearch;
      }),
    [rows, mode, date, from, to, search],
  );
  const people = filtered.reduce((s, r) => s + Number(r.guests || 0), 0),
    deposits = filtered.reduce((s, r) => s + Number(r.deposit || 0), 0);
  function exportRows() {
    const data = filtered.map((r) => ({
      Fecha: r.event_date,
      Hora: r.event_time?.slice(0, 5) || "",
      Cliente: r.client_name,
      Telefono: r.phone,
      Area: r.area,
      Invitados: r.guests,
      Menu: r.menu,
      Anticipo: r.deposit,
      MetodoPago: r.payment_method || "",
      Saldo: r.balance,
      Estado: r.status,
      Observaciones: r.notes,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Reservaciones",
    );
    XLSX.writeFile(wb, `reservaciones-${today()}.xlsx`);
  }
  function template() {
    const data = [
      {
        Fecha: "2026-12-15",
        Hora: "19:00",
        Cliente: "Nombre del cliente",
        Telefono: "+502 5555 5555",
        Area: "Salón",
        Invitados: 12,
        Menu: "Menú seleccionado",
        Anticipo: 500,
        MetodoPago: "transferencia",
        Estado: "pendiente",
        Observaciones: "Solicitud especial",
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      "Plantilla",
    );
    XLSX.writeFile(wb, "plantilla-importacion-reservaciones.xlsx");
  }
  async function importRows(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const book = XLSX.read(await file.arrayBuffer()),
        sheet = book.Sheets[book.SheetNames[0]],
        data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
      const payload = data
        .filter((x) => x.Fecha && x.Cliente)
        .map((x) => ({
          restaurant_id: restaurantId,
          client_name: String(x.Cliente),
          phone: String(x.Telefono || ""),
          event_date: excelDate(x.Fecha),
          event_time: String(x.Hora || "") || null,
          area: String(x.Area || ""),
          guests: Number(x.Invitados) || 0,
          menu: String(x.Menu || ""),
          deposit: Number(x.Anticipo) || 0,
          payment_method: String(x.MetodoPago || ""),
          status: String(x.Estado || "pendiente").toLowerCase(),
          notes: String(x.Observaciones || ""),
          subtotal: 0,
          discount_pct: 0,
          tip_pct: 0,
          total: 0,
          balance: 0,
          client_id: null as string | null,
        }));
      if (!payload.length) throw new Error("No se encontraron filas válidas.");
      const existingClients = await supabase
        .from("v2_clients")
        .select("id,name,phone")
        .eq("restaurant_id", restaurantId);
      if (existingClients.error) throw existingClients.error;
      for (const row of payload) {
        const found = existingClients.data?.find(
          (c) =>
            (row.phone && c.phone === row.phone) ||
            c.name.toLowerCase() === row.client_name.toLowerCase(),
        );
        if (found) row.client_id = found.id;
        else {
          const created = await supabase
            .from("v2_clients")
            .insert({
              restaurant_id: restaurantId,
              name: row.client_name,
              phone: row.phone || null,
              email: null,
              notes: "Creado desde importación de reservaciones",
            })
            .select("id")
            .single();
          if (created.error) throw created.error;
          row.client_id = created.data.id;
          existingClients.data?.push({
            id: created.data.id,
            name: row.client_name,
            phone: row.phone,
          });
        }
      }
      const r = await supabase.from("v2_reservations").insert(payload);
      if (r.error) throw r.error;
      setNotice(`${payload.length} reservaciones importadas.`);
      await reload();
    } catch (err: any) {
      setNotice(err.message || "No se pudo importar el archivo.");
    } finally {
      e.target.value = "";
    }
  }
  function print() {
    const metrics =
      printMode !== "reservations"
        ? `<section class="metrics"><div><b>${filtered.length}</b><span>Reservaciones</span></div>${settings.reservation_show_people ? `<div><b>${people}</b><span>Personas</span></div>` : ""}${settings.reservation_show_deposits ? `<div><b>${escape(money(deposits))}</b><span>Anticipos</span></div>` : ""}</section>`
        : "";
    const table =
      printMode !== "summary"
        ? `<table><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Área</th><th>Inv.</th><th>Menú</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>${filtered.map((r) => `<tr><td>${escape(r.event_date)}</td><td>${escape(r.event_time?.slice(0, 5))}</td><td>${escape(r.client_name)}<small>${escape(r.phone)}</small></td><td>${escape(r.area)}</td><td>${r.guests}</td><td>${escape(r.menu)}</td><td>${escape(r.status)}</td><td>${escape(r.notes)}</td></tr>`).join("")}</tbody></table>`
        : "";
    printHtml(
      `<html><head><title>Reservaciones</title><style>body{font-family:Arial;padding:30px;color:#18181b}h1{font-family:Georgia}.metrics{display:flex;gap:15px;margin:20px 0}.metrics div{border:1px solid #ddd;padding:14px;min-width:140px}.metrics b,.metrics span,small{display:block}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#18181b;color:white}small{color:#666;margin-top:3px}@media print{body{padding:0}}</style></head><body><h1>${escape(restaurantName)}</h1><p>Reporte de reservaciones · ${escape(new Date().toLocaleDateString("es-GT"))}</p>${metrics}${table}</body></html>`,
    );
  }
  return (
    <div className="moduleStack">
      <section className="reservationToolbar moduleCard">
        <div className="filterButtons">
          <button
            className={mode === "today" ? "active" : ""}
            onClick={() => setMode("today")}
          >
            Hoy
          </button>
          <button
            className={mode === "single" ? "active" : ""}
            onClick={() => setMode("single")}
          >
            Una fecha
          </button>
          <button
            className={mode === "range" ? "active" : ""}
            onClick={() => setMode("range")}
          >
            De–a
          </button>
          <button
            className={mode === "all" ? "active" : ""}
            onClick={() => setMode("all")}
          >
            Todas
          </button>
        </div>
        <div className="filterDates">
          <input
            className="moduleSearch"
            placeholder="Buscar cliente, área, menú…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {mode === "single" && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}{" "}
          {mode === "range" && (
            <>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <span>a</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="exportButtons">
          <button className="secondary" onClick={template}>
            <Download />
            Plantilla
          </button>
          <button
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            Importar
          </button>
          <input
            hidden
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={importRows}
          />
          <button className="secondary" onClick={exportRows}>
            <FileSpreadsheet />
            Excel
          </button>
          <select
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value)}
          >
            <option value="both">Imprimir reservas + resumen</option>
            <option value="reservations">Solo reservaciones</option>
            <option value="summary">Solo resumen</option>
          </select>
          <button className="primary" onClick={print}>
            <Printer />
            Imprimir
          </button>
        </div>
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
      <section className="reservationMetrics">
        <article>
          <small>Reservaciones</small>
          <strong>{filtered.length}</strong>
        </article>
        {settings.reservation_show_people && (
          <article>
            <small>Total de personas</small>
            <strong>{people}</strong>
          </article>
        )}
        {settings.reservation_show_deposits && (
          <article>
            <small>Total de anticipos</small>
            <strong>{money(deposits)}</strong>
          </article>
        )}
      </section>
      {filtered.length ? (
        <div className="reservationCards">
          {filtered.map((r) => (
            <article key={r.id}>
              <div className="reservationTime">
                <small>Fecha</small>
                <span>{r.event_date}</span>
                <small>Hora</small>
                <strong>{r.event_time?.slice(0, 5) || "—"}</strong>
              </div>
              <div className="reservationMain">
                <h3>{r.client_name}</h3>
                <p>
                  {r.area || "Sin área"} · {r.guests} invitados · {r.status}
                </p>
                {r.menu && (
                  <small>
                    <b>Menú:</b> {r.menu}
                  </small>
                )}
                {r.notes && (
                  <div className="reservationNotes">
                    <b>Observaciones:</b> {r.notes}
                  </div>
                )}
              </div>
              <div className="rowActions">
                {r.quote_id && quotes.find((q) => q.id === r.quote_id) && (
                  <button
                    title="Ver cotización"
                    onClick={() =>
                      openQuote(quotes.find((q) => q.id === r.quote_id)!)
                    }
                  >
                    <FileText />
                    Cotización
                  </button>
                )}
                <button title="Editar reservación" onClick={() => edit(r)}>
                  <Pencil />
                  Editar
                </button>
                <button title="Enviar a la papelera" onClick={() => remove(r)}>
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          No hay reservaciones en las fechas seleccionadas.
        </div>
      )}
    </div>
  );
}

function excelDate(value: unknown) {
  if (typeof value === "number") {
    const p = XLSX.SSF.parse_date_code(value);
    return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10);
}
