"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText, Link2, Pencil, Trash2 } from "lucide-react";
import { QuoteReservationLink } from "@/components/reservation-quote-link";
import { supabase } from "@/lib/supabase";
import type { Quote } from "@/lib/types";
import { useDataRefresh } from "@/components/restaurant-sync";
import { readQuoteDetail, quoteDisplayStatus, compareQuotes, type QuoteSummary, type QuoteSortField } from "@/lib/quote-data";
import { userMessage } from "@/lib/user-message";
import { readListPage, useCursorPagination, type ListPage } from "@/lib/cursor-pagination";
import { Pagination } from "@/components/pagination";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { localDateISO, localTimestampDate, formatEventTime } from "@/lib/local-date";
import { useAppPreferences } from "@/components/app-preferences";
import { money, displayDate } from "@/components/dashboard-ui";

const EMPTY_QUOTES: Quote[] = [];

export function Quotes({
  canEdit = false,
  canDelete = false,
  restaurantId,
  refreshToken = 0,
  timeFormat,
  rows: initialRows = EMPTY_QUOTES,
  edit,
  preview,
  convert,
  remove,
  removeMany,
  checkLinked = () => {},
  onLinked = () => {},
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId?: string;
  refreshToken?: number;
  timeFormat?: unknown;
  rows?: Quote[];
  edit: (q: Quote) => void;
  preview: (q: Quote) => void;
  convert: (q: Quote) => void;
  remove: (q: QuoteSummary) => void;
  removeMany: (ids: string[]) => Promise<void>;
  checkLinked?: (ids: string[]) => void;
  onLinked?: () => void;
}) {
  const { language } = useAppPreferences();
  const [linkQuote, setLinkQuote] = useState<QuoteSummary | null>(null);
  const [linkNotice, setLinkNotice] = useState(false);
  useEffect(() => { setLinkQuote(null); setLinkNotice(false); }, [restaurantId]);
  const remoteVersion = useDataRefresh(restaurantId, "v2_quotes,v2_quote_items,v2_reservations");
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [loadedRows, setRows] = useState<QuoteSummary[]>([]),
    [total, setTotal] = useState(initialRows.length),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const [sortBy, setSortBy] = useState<QuoteSortField>("event_date");
  const [ascending, setAscending] = useState(true);
  const rows = useMemo(() => restaurantId ? loadedRows : [...initialRows].sort((a, b) => compareQuotes(a, b, sortBy, ascending)), [restaurantId, loadedRows, initialRows, sortBy, ascending]);
  const [showHidden, setShowHidden] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const reminderLock = useRef(false);
  const [today, setToday] = useState(() => localDateISO());
  const upcomingPager = useCursorPagination(JSON.stringify([restaurantId, today, showHidden]));
  const { page: upcomingPage, setPage: setUpcomingPage } = upcomingPager;
  const [upcoming, setUpcoming] = useState<ListPage<QuoteSummary>>({ rows: [], has_more: false, next: null });
  const [upcomingError, setUpcomingError] = useState("");
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [focusVersion, setFocusVersion] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function updateDay() {
      setToday(localDateISO());
      clearTimeout(timer);
      const now = new Date();
      timer = setTimeout(updateDay, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 100);
    }
    function onFocus() { updateDay(); setFocusVersion(value => value + 1); }
    updateDay(); window.addEventListener("focus", onFocus);
    return () => { clearTimeout(timer); window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => { setUpcomingPage(1); setUpcoming({ rows: [], has_more: false, next: null }); }, [restaurantId, today, showHidden]);
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, today, upcomingPage, showHidden]) : undefined,
    version: `${refreshToken}:${remoteVersion}:${focusVersion}`,
    read: signal => readListPage<QuoteSummary>(supabase, restaurantId!, "quotes", { today, upcoming: true, hidden: showHidden }, upcomingPager.after, signal),
    onData: result => {
      setUpcoming(result); upcomingPager.accept(result); setUpcomingError("");
      if (upcomingPage > 1 && result.rows.length === 0) setUpcomingPage(1);
    },
    onError: error => { setUpcoming({ rows: [], has_more: false, next: null }); setUpcomingError(userMessage(error)); },
    onLoading: setUpcomingLoading,
  });
  const reminderRows = restaurantId ? upcoming.rows : initialRows.filter(q => quoteDisplayStatus(q, today) === "Contactar");
  const reminderTotal = restaurantId ? upcoming.rows.length : reminderRows.length;
  const querySearch = useListSearch(search, () => {});
  const pager = useCursorPagination(JSON.stringify([restaurantId, querySearch, today, sortBy, ascending]));
  const { page, setPage } = pager;
  const actionRequest = useRef<AbortController | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  useEffect(() => () => { actionRequest.current?.abort(); }, [restaurantId]);
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, querySearch, page, today, sortBy, ascending]) : undefined,
    version: `${refreshToken}:${remoteVersion}:${focusVersion}`,
    read: signal => readListPage<QuoteSummary>(supabase, restaurantId!, "quotes", { search: querySearch, today, sort: sortBy, ascending }, pager.after, signal),
    onData: result => { setRows(result.rows); pager.accept(result); setLoadError(""); },
    onError: error => setLoadError(userMessage(error)),
    onLoading: setLoading,
  });
  async function toggleReminder(row: QuoteSummary) {
    if (!restaurantId || !canEdit || reminderLock.current) return;
    reminderLock.current = true; setReminderBusy(true); setUpcomingError("");
    try {
      const result = await supabase.from("v2_quotes").update({ reminder_dismissed: !showHidden })
        .eq("restaurant_id", restaurantId).eq("id", row.id).eq("event_date", row.event_date)
        .eq("status", "pendiente").is("deleted_at", null).select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("La cotización cambió. Actualice e intente nuevamente.");
      setFocusVersion(value => value + 1);
    } catch (error) { setUpcomingError(userMessage(error)); }
    finally { reminderLock.current = false; setReminderBusy(false); }
  }
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
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = rows.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  function selectQuote(quote: QuoteSummary) {
    const adding = !selected.includes(quote.id);
    setSelected(ids => adding ? [...ids, quote.id] : ids.filter(id => id !== quote.id));
    if (adding && quote.status === "convertida") checkLinked([quote.id]);
  }
  function selectPage() {
    setSelected(allVisibleSelected ? selected.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])));
    if (!allVisibleSelected) {
      const converted = rows.filter(row => row.status === "convertida").map(row => row.id);
      if (converted.length) checkLinked(converted);
    }
  }
  return (
    <div className="moduleStack">
      {canEdit && restaurantId && linkQuote && <QuoteReservationLink key={`${restaurantId}:${linkQuote.id}`} restaurantId={restaurantId} quote={linkQuote} timeFormat={timeFormat}
        close={() => setLinkQuote(null)} linked={() => { setLinkQuote(null); setLinkNotice(true); setFocusVersion(value => value + 1); onLinked(); }} />}
      {linkNotice && <p role="status" className="success" translate="no">{language === "en" ? "Quote linked to the existing reservation." : "Cotización vinculada a la reservación existente."}</p>}
      {restaurantId && <button type="button" className="secondary" disabled={reminderBusy} onClick={() => { setShowHidden(value => !value); setUpcomingPage(1); }}>{showHidden ? "Ver avisos activos" : "Ver avisos ocultos"}</button>}
      {showHidden && !upcomingLoading && !reminderTotal && !upcomingError && <p>No hay avisos ocultos próximos.</p>}
      {upcomingError && <p className="moduleNotice moduleError" role="alert"><span>No se pudieron cargar los avisos.</span> {upcomingError}</p>}
      {upcomingLoading && !reminderTotal && <p role="status">Revisando próximas cotizaciones…</p>}
      {reminderTotal > 0 && <section className="quoteReminders" aria-label="Próximas cotizaciones" aria-busy={upcomingLoading}>
        <div role="status"><strong>{showHidden ? "Avisos ocultos" : "Próximas cotizaciones"}</strong> <span>({reminderTotal}{upcoming.has_more ? "+" : ""})</span><p>Contacte a estos clientes: su evento es hoy o en los próximos 5 días.</p></div>
        <ul>{reminderRows.map(q => <li key={q.id}>
          <span><strong translate="no">{q.client_name || "—"}</strong> · #{q.quote_number} · {displayDate(q.event_date)}</span>
          <button type="button" disabled={Boolean(actionId) || upcomingLoading} onClick={() => { void openAction(q, preview); }}>Ver</button>
          {canEdit && restaurantId && <button type="button" disabled={reminderBusy || upcomingLoading} onClick={() => { void toggleReminder(q); }}>{showHidden ? "Mostrar aviso" : "Quitar aviso"}</button>}
        </li>)}</ul>
        {canEdit && <small>Quitar el aviso lo oculta para el equipo; la cotización se conserva.</small>}
        {restaurantId && <Pagination total={reminderTotal} page={upcomingPage} onPage={setUpcomingPage} hasNext={upcomingPager.hasNext} shown={upcoming.rows.length} loading={upcomingLoading} language={language} />}
      </section>}
      <div className="listToolbar">
        <input className="moduleSearch moduleCard" placeholder="Buscar cotización, cliente, área o estado…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={selectPage} /> Seleccionar esta página</label>}
        {canDelete && selected.length > 0 && <button className="dangerButton" onClick={() => void removeMany(selected)}><Trash2 /> Eliminar seleccionadas ({selected.length})</button>}
      </div>
      <div className="quoteSortControls" translate="no">
        <label><span>{language === "en" ? "Sort by" : "Ordenar por"}</span>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value as QuoteSortField); setPage(1); setSelected([]); }}>
            <option value="event_date">{language === "en" ? "Event date" : "Fecha del evento"}</option>
            <option value="quote_number">{language === "en" ? "Quote number" : "Número de cotización"}</option>
            <option value="created_at">{language === "en" ? "Creation date" : "Fecha de creación"}</option>
          </select>
        </label>
        <label><span>{language === "en" ? "Order" : "Orden"}</span>
          <select value={ascending ? "asc" : "desc"} onChange={e => { setAscending(e.target.value === "asc"); setPage(1); setSelected([]); }}>
            <option value="asc">{sortBy === "quote_number" ? (language === "en" ? "Lowest first" : "Menor a mayor") : (language === "en" ? "Oldest first" : "Más antiguas primero")}</option>
            <option value="desc">{sortBy === "quote_number" ? (language === "en" ? "Highest first" : "Mayor a menor") : (language === "en" ? "Newest first" : "Más recientes primero")}</option>
          </select>
        </label>
      </div>
      {loadError && <p className="moduleNotice moduleError" role="alert">{userMessage(loadError)}</p>}
      {actionId && <p role="status">Cargando cotización…</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="table">
          <div className="tr head quoteRow">
            <span aria-hidden="true" />
            <span>Número</span>
            <span>Cliente</span>
            <span translate="no">{language === "en" ? "Event date" : "Fecha del evento"}</span>
            <span>Hora</span>
            <span>Área</span>
            <span>Total</span>
            <span>Estado</span>
            <span />
          </div>
          {rows.map((q) => (
            <div className={`tr quoteRow ${selected.includes(q.id) ? "selectedRecord" : ""}`} key={q.id}>
              <div className="quoteIdentity">
                {canDelete ? (<input className="recordCheckbox quoteCheckbox" type="checkbox" aria-label={`Seleccionar cotización ${q.quote_number}`} checked={selected.includes(q.id)} onChange={() => selectQuote(q)} />) : <span aria-hidden="true" />}
                <strong>#{q.quote_number}</strong>
              </div>
              <span className="quoteClient"><small className="quoteFieldLabel">Cliente</small><span className="quoteFieldValue" translate="no">{q.client_name || "—"}</span><small className="quoteCreated" translate="no">{language === "en" ? "Created:" : "Creada:"} {localTimestampDate(q.created_at) ? <time dateTime={q.created_at}>{displayDate(localTimestampDate(q.created_at))}</time> : "—"}</small></span>
              <span className="quoteDate"><small className="quoteFieldLabel" translate="no">{language === "en" ? "Event date" : "Fecha del evento"}</small><span className="quoteFieldValue">{displayDate(q.event_date)}</span></span>
              <span className="quoteTime"><small className="quoteFieldLabel">Hora</small><span className="quoteFieldValue">{formatEventTime(q.event_time, timeFormat)}</span></span>
              <span className="quoteArea"><small className="quoteFieldLabel">Área</small><span className="quoteFieldValue">{q.area || "—"}</span></span>
              <span className="quoteTotal"><small className="quoteFieldLabel">Total</small><strong className="quoteFieldValue">{money(q.total)}</strong></span>
              <span className="quoteStatus">
                {q.status === "convertida" ? <><span className="status quoteStatusBadge">Convertida</span><span className="status quoteStatusBadge statusConfirmed">Confirmada</span></>
                  : q.status === "confirmada" ? <span className="status quoteStatusBadge statusConfirmed">Confirmada</span>
                  : <span className={`status quoteStatusBadge ${quoteDisplayStatus(q, today) === "Contactar" ? "quoteContact" : quoteDisplayStatus(q, today) === "No realizada" ? "quoteNotHeld" : ""}`}>{quoteDisplayStatus(q, today)}</span>}
              </span>
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
                {canEdit && restaurantId && q.status !== "convertida" && <button type="button" className="linkReservationAction" translate="no"
                  disabled={Boolean(actionId)} onClick={() => { setLinkNotice(false); setLinkQuote(q); }}>
                  <Link2 />{language === "en" ? "Link to existing reservation" : "Vincular a reservación"}
                </button>}
                {canDelete && <button className="quoteDeleteAction" title="Enviar a la papelera" aria-label={`Enviar cotización ${q.quote_number} a la papelera`} onClick={() => remove(q)}>
                  <Trash2 />
                </button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Todavía no hay cotizaciones.</div>
      )}
      <Pagination total={total} page={page} onPage={setPage} hasNext={restaurantId ? pager.hasNext : undefined} shown={rows.length} loading={loading} language={language} />
    </div>
  );
}
