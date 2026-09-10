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
import { Pagination, pageItems } from "@/components/pagination";

const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
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
  removeMany,
}: {
  rows: Reservation[];
  quotes: Quote[];
  restaurantId: string;
  restaurantName: string;
  edit: (r: Reservation) => void;
  openQuote: (q: Quote) => void;
  reload: () => Promise<void>;
  remove: (r: Reservation) => void;
  removeMany?: (ids: string[]) => Promise<void>;
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
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
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
    deposits = filtered.reduce((s, r) => s + Number(r.deposit || 0), 0),
    visible = pageItems(filtered, page);
  useEffect(() => setPage(1), [mode, date, from, to, search, rows.length]);
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = visible.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
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
  function showNextDay() {
    const base = mode === "single" ? date : today();
    const next = new Date(`${base}T12:00:00`);
    next.setDate(next.getDate() + 1);
    setDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
    setMode("single");
  }
  function showPreviousDay() {
    const base = mode === "single" ? date : today();
    const previous = new Date(`${base}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    setDate(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}-${String(previous.getDate()).padStart(2, "0")}`);
    setMode("single");
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
      if (file.size > 5 * 1024 * 1024)
        throw new Error("El archivo supera el límite de 5 MB.");
      if (!/\.(xlsx|xls|csv)$/i.test(file.name))
        throw new Error("Use únicamente archivos XLSX, XLS o CSV.");
      const book = XLSX.read(await file.arrayBuffer()),
        sheet = book.Sheets[book.SheetNames[0]],
        data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
      if (!data.length) throw new Error("El archivo está vacío.");
      if (data.length > 5000)
        throw new Error("La importación admite un máximo de 5,000 filas por archivo.");
      const omitted: number[] = [];
      const payload = data
        .map((original, index) => {
          const x = Object.fromEntries(
              Object.entries(original).map(([key, value]) => [normalizeHeader(key), value]),
            ),
            rawDate = importCell(x, "fecha", "fechadelevento", "eventdate"),
            eventDate = excelDate(rawDate),
            clientName = String(importCell(x, "cliente", "nombre", "nombredecliente") || "").trim();
          if (!rawDate || !eventDate || !clientName) {
            omitted.push(index + 2);
            return null;
          }
          return {
            restaurant_id: restaurantId,
            client_name: clientName,
            phone: String(importCell(x, "telefono", "tel", "phone") || "").trim(),
            event_date: eventDate,
            event_time: excelTime(importCell(x, "hora", "horadelevento", "eventtime")),
            area: String(importCell(x, "area", "salon") || "").trim(),
            guests: importOptionalNumber(importCell(x, "invitados", "personas", "noinvitados"), true),
            menu: String(importCell(x, "menu", "producto", "servicio") || "").trim(),
            deposit: importOptionalNumber(importCell(x, "anticipo", "deposito", "deposit")),
            payment_method: String(importCell(x, "metodopago", "metododepago", "paymentmethod") || "").trim().toLowerCase(),
            status: String(importCell(x, "estado", "status") || "").trim().toLowerCase(),
            notes: String(importCell(x, "observaciones", "notas", "notes") || "").trim(),
            subtotal: 0,
            discount_pct: 0,
            tip_pct: 0,
            total: 0,
            balance: 0,
            client_id: null as string | null,
          };
        })
        .filter(Boolean) as any[];
      if (!payload.length) throw new Error("No se encontraron filas válidas.");
      const existingClients = await supabase
        .from("v2_clients")
        .select("id,name,phone,email")
        .eq("restaurant_id", restaurantId);
      if (existingClients.error) throw existingClients.error;
      for (const row of payload) {
        const normalizedPhone = row.phone.replace(/\D/g, "");
        const found = existingClients.data?.find(
          (c) =>
            (normalizedPhone && String(c.phone || "").replace(/\D/g, "") === normalizedPhone) ||
            c.name.trim().toLowerCase() === row.client_name.trim().toLowerCase(),
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
            email: null,
          });
        }
      }
      for (let start = 0; start < payload.length; start += 250) {
        const r = await supabase
          .from("v2_reservations")
          .insert(payload.slice(start, start + 250));
        if (r.error)
          throw new Error(`Error desde la fila ${start + 2}: ${r.error.message}`);
      }
      setNotice(`${payload.length} reservaciones importadas correctamente.${omitted.length ? ` Se omitieron las filas ${omitted.slice(0, 10).join(", ")} porque no tenían fecha o cliente${omitted.length > 10 ? "…" : ""}.` : ""}`);
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
        ? `<table><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Área</th><th>Inv.</th><th>Menú</th><th>Anticipo</th><th>Método</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>${filtered.map((r) => `<tr><td>${escape(displayDate(r.event_date))}</td><td>${escape(r.event_time?.slice(0, 5))}</td><td>${escape(r.client_name)}<small>${escape(r.phone)}</small></td><td>${escape(r.area)}</td><td>${r.guests ?? ""}</td><td>${escape(r.menu)}</td><td>${r.deposit == null ? "" : escape(money(Number(r.deposit)))}</td><td>${escape(paymentMethodLabel(r.payment_method))}</td><td>${escape(r.status)}</td><td>${escape(r.notes)}</td></tr>`).join("")}</tbody></table>`
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
            onClick={() => {
              setDate(today());
              setMode("today");
            }}
          >
            Hoy
          </button>
          <button
            onClick={showPreviousDay}
            title="Mostrar el día anterior"
          >
            ‹ Anterior
          </button>
          <button
            onClick={showNextDay}
            title="Mostrar el día siguiente"
          >
            Siguiente ›
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
          {filtered.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
          {selected.length > 0 && removeMany && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionadas ({selected.length})</button>}
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
          {visible.map((r) => (
            <article key={r.id} className={selected.includes(r.id) ? "selectedRecord" : ""}>
              <input className="recordCheckbox" type="checkbox" aria-label={`Seleccionar reservación de ${r.client_name}`} checked={selected.includes(r.id)} onChange={() => setSelected((ids) => ids.includes(r.id) ? ids.filter((id) => id !== r.id) : [...ids, r.id])} />
              <div className="reservationTime">
                <small>Fecha</small>
                <span>{displayDate(r.event_date)}</span>
                <small>Hora</small>
                <strong>{r.event_time?.slice(0, 5) || "—"}</strong>
              </div>
              <div className="reservationMain">
                <h3>{r.client_name}</h3>
                <p>
                  {r.area || "Sin área"} · {r.guests ?? "—"} invitados · {r.status || "Sin estado"}
                </p>
                {r.menu && (
                  <small>
                    <b>Menú:</b> {r.menu}
                  </small>
                )}
                <div className="reservationDeposit">
                  <span>
                    <b>Anticipo:</b> {r.deposit == null ? "—" : money(Number(r.deposit))}
                  </span>
                  <span>
                    <b>Método:</b> {paymentMethodLabel(r.payment_method)}
                  </span>
                </div>
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
      <Pagination total={filtered.length} page={page} onPage={setPage} />
    </div>
  );
}

function paymentMethodLabel(value?: string | null) {
  return (
    {
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      transferencia: "Transferencia",
      deposito: "Depósito bancario",
      otro: "Otro",
    }[String(value || "").toLowerCase()] || "Sin especificar"
  );
}

function excelDate(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    return year >= 1900 && year <= 2999
      ? `${year}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
      : "";
  }
  if (typeof value === "number") {
    const digits = String(Math.trunc(value));
    if (/^(19|20)\d{6}$/.test(digits)) {
      const year = digits.slice(0, 4), month = digits.slice(4, 6), day = digits.slice(6, 8);
      return validImportDate(year, month, day) ? `${year}-${month}-${day}` : "";
    }
    const p = XLSX.SSF.parse_date_code(value);
    return p?.y >= 1900 && p?.y <= 2999 && validImportDate(String(p.y), String(p.m), String(p.d))
      ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`
      : "";
  }
  const text = String(value || "").trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return validImportDate(isoDate[1], isoDate[2], isoDate[3]) ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}` : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (local) {
    const [, day, month, year] = local,
      result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      date = new Date(`${result}T12:00:00`);
    return Number.isNaN(date.getTime()) || !validImportDate(year, month, day) ? "" : result;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function validImportDate(year: string, month: string, day: string) {
  const y = Number(year), m = Number(month), d = Number(day);
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function importCell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function importNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") && text.includes(".") ? text.replace(/,/g, "") : text.replace(",", "."),
    result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}

function importOptionalNumber(value: unknown, integer = false) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Math.max(0, importNumber(value));
  return integer ? Math.trunc(number) : number;
}

function excelTime(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") {
    const totalMinutes = Math.round((value % 1) * 1440) % 1440;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  const text = String(value).trim(),
    match = text.match(/^(\d{1,2})(?::(\d{1,2}))?(?:\s*([ap])\.?\s*m\.?)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0), period = match[3]?.toLowerCase();
  if (period === "p" && hours < 12) hours += 12;
  if (period === "a" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
