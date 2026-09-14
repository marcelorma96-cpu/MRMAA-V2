"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Quote } from "@/lib/types";
import { useDataRefresh } from "@/components/restaurant-sync";
import { readQuoteDetail, readQuotePage, type QuoteSummary } from "@/lib/quote-data";
import { userMessage } from "@/lib/user-message";
import { Pagination } from "@/components/pagination";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { money, displayDate } from "@/components/dashboard-ui";

// Extracted verbatim from components/dashboard.tsx — no behavior change, only
// moved to its own file so it's a separate bundle chunk from the main
// Dashboard shell and can be lazy-loaded independently.
//
// Note: the original file also had a small `Reservations` table component
// here. It was never actually rendered anywhere (the reservations tab uses
// ReservationsEnhanced, a different, separate component) — dead code, so it
// was dropped rather than moved.

export function Quotes({
  canEdit = false,
  canDelete = false,
  restaurantId,
  refreshToken = 0,
  rows: initialRows = [],
  edit,
  preview,
  convert,
  remove,
  removeMany,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId?: string;
  refreshToken?: number;
  rows?: Quote[];
  edit: (q: Quote) => void;
  preview: (q: Quote) => void;
  convert: (q: Quote) => void;
  remove: (q: QuoteSummary) => void;
  removeMany: (ids: string[]) => Promise<void>;
}) {
  const remoteVersion = useDataRefresh(restaurantId, "v2_quotes,v2_quote_items,v2_reservations");
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [rows, setRows] = useState<QuoteSummary[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const querySearch = useListSearch(search, () => setPage(1));
  const actionRequest = useRef<AbortController | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  useEffect(() => () => { actionRequest.current?.abort(); }, [restaurantId]);
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, querySearch, page]) : undefined,
    version: `${refreshToken}:${remoteVersion}`,
    read: signal => readQuotePage(supabase, restaurantId!, querySearch, page, signal),
    onData: result => { setRows(result.rows); setTotal(result.total); setLoadError(""); },
    onError: error => setLoadError(userMessage(error)),
    onLoading: setLoading,
  });
  async function openAction(row: QuoteSummary, action: (quote: Quote) => void) {
    if (actionRequest.current) return;
    const controller = new AbortController();
    actionRequest.current = controller;
    setActionId(row.id); setLoadError("");
    try {
      const quote = restaurantId
        ? await readQuoteDetail(supabase, restaurantId, row.id, controller.signal)
        : initialRows.find(quote => quote.id === row.id);
      if (controller.signal.aborted) return;
      if (!quote) throw new Error("No se pudo abrir la cotización.");
      await action(quote);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(userMessage(error));
    } finally {
      if (actionRequest.current === controller) actionRequest.current = null;
      if (!controller.signal.aborted) setActionId(null);
    }
  }
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id && row.status !== "convertida"))), [rows]);
  const visibleIds = rows.filter((row) => row.status !== "convertida").map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  return (
    <div className="moduleStack">
      <div className="listToolbar">
        <input className="moduleSearch moduleCard" placeholder="Buscar cotización, cliente, área o estado…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
        {canDelete && selected.length > 0 && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionadas ({selected.length})</button>}
      </div>
      {loadError && <p className="moduleNotice moduleError" role="alert">{userMessage(loadError)}</p>}
      {actionId && <p role="status">Cargando cotización…</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="table">
          <div className="tr head quoteRow">
            <span aria-hidden="true" />
            <span>Número</span>
            <span>Cliente</span>
            <span>Fecha</span>
            <span>Hora</span>
            <span>Área</span>
            <span>Total</span>
            <span>Estado</span>
            <span />
          </div>
          {rows.map((q) => (
            <div className={`tr quoteRow ${selected.includes(q.id) ? "selectedRecord" : ""}`} key={q.id}>
              <div className="quoteIdentity">
                {canDelete ? (<input className="recordCheckbox quoteCheckbox" type="checkbox" aria-label={`Seleccionar cotización ${q.quote_number}`} disabled={q.status === "convertida"} checked={selected.includes(q.id)} onChange={() => setSelected((ids) => ids.includes(q.id) ? ids.filter((id) => id !== q.id) : [...ids, q.id])} />) : <span aria-hidden="true" />}
                <strong>#{q.quote_number}</strong>
              </div>
              <span className="quoteClient"><small className="quoteFieldLabel">Cliente</small><span className="quoteFieldValue">{q.client_name || "—"}</span></span>
              <span className="quoteDate"><small className="quoteFieldLabel">Fecha</small><span className="quoteFieldValue">{displayDate(q.event_date)}</span></span>
              <span className="quoteTime"><small className="quoteFieldLabel">Hora</small><span className="quoteFieldValue">{q.event_time?.slice(0, 5) || "—"}</span></span>
              <span className="quoteArea"><small className="quoteFieldLabel">Área</small><span className="quoteFieldValue">{q.area || "—"}</span></span>
              <span className="quoteTotal"><small className="quoteFieldLabel">Total</small><strong className="quoteFieldValue">{money(q.total)}</strong></span>
              <span className="status quoteStatus">{q.status === "convertida" ? <><span>Convertida</span>{" · "}<span className="status statusConfirmed">Confirmada</span></> : q.status === "confirmada" ? <span className="status statusConfirmed">Confirmada</span> : q.status}</span>
              <div className="rowActions">
                {canEdit && <button title="Editar cotización" disabled={Boolean(actionId)} onClick={() => { void openAction(q, edit); }}>
                  <Pencil />
                  Editar
                </button>}
                <button title="Ver cotización" disabled={Boolean(actionId)} onClick={() => { void openAction(q, preview); }}>
                  <FileText />
                  Ver
                </button>
                {canEdit && q.status !== "convertida" && (
                  <button
                    className="convertAction"
                    title="Convertir en reservación"
                    disabled={Boolean(actionId)}
                    onClick={() => { void openAction(q, convert); }}
                  >
                    <ArrowRight />
                    Convertir en reserva
                  </button>
                )}
                {canDelete && q.status !== "convertida" && <button className="quoteDeleteAction" title="Enviar a la papelera" aria-label={`Enviar cotización ${q.quote_number} a la papelera`} onClick={() => remove(q)}>
                  <Trash2 />
                </button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Todavía no hay cotizaciones.</div>
      )}
      <Pagination total={total} page={page} onPage={setPage} />
    </div>
  );
}
