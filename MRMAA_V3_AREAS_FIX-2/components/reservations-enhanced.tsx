"use client";

import { userMessage } from "@/lib/user-message";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requirePermission, ACCESS_DENIED } from "@/lib/permissions";
import { printHtml } from "@/lib/print";
import type { Reservation } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { appLocale, currentAppLanguage, formatAppMoney } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
import { recordAuditActivity } from "@/lib/audit-activity";

const today = () => new Date().toISOString().slice(0, 10);
const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const money = (n: number) => formatAppMoney(n);
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ]!,
  );

export function ReservationsEnhanced({
  canEdit = false,
  canDelete = false,
  restaurantId,
  restaurantName,
  refreshToken = 0,
  rows: initialRows = [],
  edit,
  openQuote,
  reload,
  remove,
  removeMany,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId: string;
  restaurantName: string;
  refreshToken?: number;
  rows?: Reservation[];
  edit: (r: Reservation) => void;
  openQuote: (quoteId: string) => void;
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
    [rows, setRows] = useState<Reservation[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [people, setPeople] = useState(0),
    [deposits, setDeposits] = useState(0),
    [loading, setLoading] = useState(false),
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
  const normalizedSearch = search.trim().replace(/[%(),]/g, " ");
  const applyFilters = (query: any) => {
    if (mode === "today") query = query.eq("event_date", today());
    else if (mode === "single") query = query.eq("event_date", date);
    else if (mode === "range") query = query.gte("event_date", from).lte("event_date", to);
    if (normalizedSearch)
      query = query.or(`client_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,area.ilike.%${normalizedSearch}%,menu.ilike.%${normalizedSearch}%,notes.ilike.%${normalizedSearch}%,status.ilike.%${normalizedSearch}%`);
    return query;
  };
  useEffect(() => setPage(1), [mode, date, from, to, search]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const first = (page - 1) * 50;
      const result = await applyFilters(supabase.from("v2_reservations").select("*", { count: "exact" })
        .eq("restaurant_id", restaurantId).is("deleted_at", null))
        .order("event_date").order("event_time").range(first, first + 49);
      if (result.error) {
        setRows([]); setTotal(0); setPeople(0); setDeposits(0);
        setNotice(result.error.message || "No se pudieron cargar las reservaciones.");
        setLoading(false); return;
      }
      setRows((result.data || []) as Reservation[]);
      setTotal(result.count || 0);
      const summary = await supabase.rpc("v2_reservation_summary", {
        p_restaurant_id: restaurantId,
        p_mode: mode,
        p_date: mode === "today" ? today() : date,
        p_from: from,
        p_to: to,
        p_search: normalizedSearch,
      });
      if (summary.error) setNotice("Ejecute SUPABASE_ESCALABILIDAD_50000.sql para activar los totales escalables.");
      const metrics: any = Array.isArray(summary.data) ? summary.data[0] : summary.data;
      setPeople(Number(metrics?.people ?? 0));
      setDeposits(Number(metrics?.deposits ?? 0));
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [restaurantId, refreshToken, mode, date, from, to, normalizedSearch, page]);
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = rows.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  async function allMatchingReservations() {
    const output: Reservation[] = [];
    for (let first = 0; ; first += 1000) {
      const batch = await applyFilters(supabase.from("v2_reservations").select("*")
        .eq("restaurant_id", restaurantId).is("deleted_at", null))
        .order("event_date").order("event_time").range(first, first + 999);
      if (batch.error) throw batch.error;
      output.push(...((batch.data || []) as Reservation[]));
      if ((batch.data || []).length < 1000) return output;
    }
  }
  async function exportRows() {
    const XLSX = await import("xlsx");
    const outputRows = await allMatchingReservations();
    const language = currentAppLanguage();
    const data = outputRows.map((r) => translateRecord({
      Fecha: r.event_date,
      Hora: r.event_time?.slice(0, 5) || "",
      Cliente: r.client_name,
      Telefono: r.phone,
      Area: r.area,
      Invitados: r.guests,
      Menu: r.menu,
      Anticipo: money(Number(r.deposit || 0)),
      MetodoPago: r.payment_method || "",
      Saldo: money(Number(r.balance || 0)),
      Estado: translate(r.status, language),
      Observaciones: r.notes,
    }, language));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      translate("Reservaciones", language),
    );
    XLSX.writeFile(wb, `${language === "en" ? "reservations" : "reservaciones"}-${today()}.xlsx`);
    await recordAuditActivity(restaurantId, "excel_exportado", "reservaciones", { label: "Listado de reservaciones", rows: outputRows.length, mode, date, from, to });
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
  async function template() {
    const XLSX = await import("xlsx");
    const language = currentAppLanguage();
    const data = [translateRecord({
        Fecha: "2026-12-15",
        Hora: "19:00",
        Cliente: translate("Nombre del cliente", language),
        Telefono: "+502 5555 5555",
        Area: language === "en" ? "Dining room" : "Salón",
        Invitados: 12,
        Menu: language === "en" ? "Selected menu" : "Menú seleccionado",
        Anticipo: 500,
        MetodoPago: "transferencia",
        Estado: language === "en" ? "pending" : "pendiente",
        Observaciones: language === "en" ? "Special request" : "Solicitud especial",
      }, language),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      translate("Plantilla", language),
    );
    XLSX.writeFile(wb, language === "en" ? "reservation-import-template.xlsx" : "plantilla-importacion-reservaciones.xlsx");
  }
  async function importRows(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!canEdit) throw new Error(ACCESS_DENIED);
      await requirePermission(supabase, restaurantId, "canOperate");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("El archivo supera el límite de 5 MB.");
      if (!/\.(xlsx|xls|csv)$/i.test(file.name))
        throw new Error("Use únicamente archivos XLSX, XLS o CSV.");
      const XLSX = await import("xlsx");
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
      let created = 0, updated = 0, unchanged = 0;
      for (let start = 0; start < payload.length; start += 500) {
        const result = await supabase.rpc("v2_import_reservations", {
          p_restaurant_id: restaurantId,
          p_rows: payload.slice(start, start + 500),
        });
        if (result.error) throw result.error;
        const counts: any = Array.isArray(result.data) ? result.data[0] : result.data;
        created += Number(counts?.created || 0);
        updated += Number(counts?.updated || 0);
        unchanged += Number(counts?.unchanged || 0);
      }
      setNotice(`Importación terminada: ${created} nuevas, ${updated} actualizadas, ${unchanged} sin cambios y ${omitted.length} omitidas.`);
      await reload();
    } catch (err: any) {
      setNotice(err.message || "No se pudo importar el archivo.");
    } finally {
      e.target.value = "";
    }
  }
  async function print() {
    const outputRows = await allMatchingReservations();
    const metrics =
      printMode !== "reservations"
        ? `<section class="metrics"><div><b>${total}</b><span>Reservaciones</span></div>${settings.reservation_show_people ? `<div><b>${people}</b><span>Personas</span></div>` : ""}${settings.reservation_show_deposits ? `<div><b>${escape(money(deposits))}</b><span>Anticipos</span></div>` : ""}</section>`
        : "";
    const table =
      printMode !== "summary"
        ? `<table><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Área</th><th>Inv.</th><th>Menú</th><th>Anticipo</th><th>Método</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>${outputRows.map((r) => `<tr><td>${escape(displayDate(r.event_date))}</td><td>${escape(r.event_time?.slice(0, 5))}</td><td>${escape(r.client_name)}<small>${escape(r.phone)}</small></td><td>${escape(r.area)}</td><td>${r.guests ?? ""}</td><td>${escape(r.menu)}</td><td>${r.deposit == null ? "" : escape(money(Number(r.deposit)))}</td><td>${escape(paymentMethodLabel(r.payment_method))}</td><td>${escape(r.status)}</td><td>${escape(r.notes)}</td></tr>`).join("")}</tbody></table>`
        : "";
    printHtml(
      `<html><head><title>Reservaciones</title><style>body{font-family:Arial;padding:30px;color:#18181b}h1{font-family:Georgia}.metrics{display:flex;gap:15px;margin:20px 0}.metrics div{border:1px solid #ddd;padding:14px;min-width:140px}.metrics b,.metrics span,small{display:block}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:12px}th{background:#18181b;color:white}small{color:#666;margin-top:3px}@media print{body{padding:0}}</style></head><body><h1>${escape(restaurantName)}</h1><p>Reporte de reservaciones · ${escape(new Date().toLocaleDateString(appLocale()))}</p>${metrics}${table}</body></html>`,
    );
    await recordAuditActivity(restaurantId, "impresion", "reservaciones", { label: "Reporte de reservaciones", rows: outputRows.length, mode, date, from, to, print_mode: printMode });
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
          {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
          {canDelete && selected.length > 0 && removeMany && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionadas ({selected.length})</button>}
          {canEdit && <>
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
          </>}
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
        {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      </section>
      <section className="reservationMetrics">
        <article>
          <small>Reservaciones</small>
          <strong>{total}</strong>
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
      {loading ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="reservationCards">
          {rows.map((r) => (
            <article key={r.id} className={selected.includes(r.id) ? "selectedRecord" : ""}>
              {canDelete && <input className="recordCheckbox" type="checkbox" aria-label={`Seleccionar reservación de ${r.client_name}`} checked={selected.includes(r.id)} onChange={() => setSelected((ids) => ids.includes(r.id) ? ids.filter((id) => id !== r.id) : [...ids, r.id])} />}
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
                {r.quote_id && (
                  <button
                    title="Ver cotización"
                    onClick={() => openQuote(r.quote_id!)}
                  >
                    <FileText />
                    Cotización
                  </button>
                )}
                {canEdit && <button title="Editar reservación" onClick={() => edit(r)}>
                  <Pencil />
                  Editar
                </button>}
                {canDelete && <button title="Enviar a la papelera" onClick={() => remove(r)}>
                  <Trash2 />
                </button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          No hay reservaciones en las fechas seleccionadas.
        </div>
      )}
      <Pagination total={total} page={page} onPage={setPage} />
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
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86400000),
      year = parsed.getUTCFullYear(), month = parsed.getUTCMonth() + 1, day = parsed.getUTCDate();
    return year >= 1900 && year <= 2999 && validImportDate(String(year), String(month), String(day))
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
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
