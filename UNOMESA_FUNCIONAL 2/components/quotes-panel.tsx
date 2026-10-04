"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ArrowRight, FileText, Link2, Pencil, Trash2 } from "lucide-react";
import { QuoteReservationLink } from "@/components/reservation-quote-link";
import {useFloorAreaLabels} from './use-floor-area-labels';
import { useSuccessToast } from "@/components/success-toast";
import { supabase } from "@/lib/supabase";
import type { Quote } from "@/lib/types";
import { useDataRefresh } from "@/components/restaurant-sync";
import { readQuoteDetail, readSavedQuoteCount, readUpcomingQuotePage, readDismissedQuoteCount, restoreDismissedQuoteReminders, dismissQuoteReminder, quoteDisplayStatus, compareQuotes, type QuoteSummary, type QuoteSortField } from "@/lib/quote-data";
import { userMessage } from "@/lib/user-message";
import { readListPage, useCursorPagination } from "@/lib/cursor-pagination";
import { Pagination } from "@/components/pagination";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { localDateISO, localTimestampDate, localTimestampTime, formatEventTime } from "@/lib/local-date";
import { useAppPreferences } from "@/components/app-preferences";
import { money, displayDate } from "@/components/dashboard-ui";

const EMPTY_QUOTES: Quote[] = [];

// Keep horizontal navigation within reach while the page scrolls through long lists.
function QuoteTableViewport({ children, language }: { children: ReactNode; language: string }) {
  const tableId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0 });
  const label = language === "en" ? "Scroll quotes horizontally" : "Desplazar cotizaciones horizontalmente";
  useEffect(() => {
    const table = viewport.current, rows = content.current;
    if (!table || !rows) return;
    function measure() {
      if (!table) return;
      const max = Math.max(0, table.scrollWidth - table.clientWidth);
      const left = Math.max(0, Math.min(table.scrollLeft, max));
      setScroll(previous => previous.left === left && previous.max === max ? previous : { left, max });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(table); observer.observe(rows);
    table.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => { observer.disconnect(); table.removeEventListener("scroll", measure); };
  }, []);
  return <div className="quoteTableFrame">
    <div id={tableId} ref={viewport} className="table quoteTableViewport">
      <div ref={content} className="quoteTableContent">{children}</div>
    </div>
    <div className="quoteHorizontalScroll" hidden={scroll.max < 2}>
      <ArrowLeftRight aria-hidden="true" />
      <input type="range" min={0} max={Math.max(1, scroll.max)} step={1} value={scroll.left}
        aria-label={label} title={label} aria-controls={tableId}
        aria-valuetext={`${Math.round(scroll.max ? scroll.left / scroll.max * 100 : 0)}%`}
        onChange={event => {
          if (viewport.current) viewport.current.scrollLeft = Number(event.target.value);
          setScroll(previous => ({ ...previous, left: Number(event.target.value) }));
        }} />
    </div>
  </div>;
}

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
  const showSuccess = useSuccessToast();
  const [linkQuote, setLinkQuote] = useState<QuoteSummary | null>(null);
  useEffect(() => { setLinkQuote(null); }, [restaurantId]);
  const remoteVersion = useDataRefresh(restaurantId, "v2_quotes,v2_quote_items,v2_reservations");
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [loadedRows, setRows] = useState<QuoteSummary[]>([]),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const [sortBy, setSortBy] = useState<QuoteSortField>("created_at");
  const [ascending, setAscending] = useState(false);
  const [savedCount, setSavedCount] = useState<{ restaurantId: string; total: number | null } | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const countVersion = useDataRefresh(restaurantId, "v2_quotes");
  const rows = useMemo(() => restaurantId ? loadedRows : [...initialRows].sort((a, b) => compareQuotes(a, b, sortBy, ascending)), [restaurantId, loadedRows, initialRows, sortBy, ascending]);
  const areaLabels=useFloorAreaLabels(restaurantId||'','quote',rows,language==='en',`${refreshToken}:${remoteVersion}`);
  const [reminderBusy, setReminderBusy] = useState(false);
  const reminderLock = useRef(false);
  const [today, setToday] = useState(() => localDateISO());
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcoming, setUpcoming] = useState<{ rows: QuoteSummary[]; total: number }>({ rows: [], total: 0 });
  const [upcomingError, setUpcomingError] = useState("");
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [dismissedError, setDismissedError] = useState("");
  const [dismissedLoading, setDismissedLoading] = useState(false);
  const [reminderActionError, setReminderActionError] = useState("");
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
  useEffect(() => {
    setUpcomingPage(1); setUpcoming({ rows: [], total: 0 });
    setDismissedCount(0); setDismissedError(""); setReminderActionError("");
  }, [restaurantId, today]);
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, "saved-quote-count"]) : undefined,
    version: `${refreshToken}:${countVersion}:${focusVersion}`,
    read: signal => readSavedQuoteCount(supabase, restaurantId!, signal),
    onData: total => setSavedCount({ restaurantId: restaurantId!, total }),
    onError: () => setSavedCount({ restaurantId: restaurantId!, total: null }),
    onLoading: setCountLoading,
  });
  const currentCount = restaurantId && savedCount?.restaurantId === restaurantId ? savedCount : null;
  const savedTotal = restaurantId ? currentCount?.total : initialRows.length;
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, today, upcomingPage]) : undefined,
    version: `${refreshToken}:${remoteVersion}:${focusVersion}`,
    read: signal => readUpcomingQuotePage(supabase, restaurantId!, today, upcomingPage, signal),
    onData: result => {
      setUpcoming(result); setUpcomingError("");
      if (upcomingPage > 1 && result.rows.length === 0) setUpcomingPage(1);
    },
    onError: error => { setUpcoming({ rows: [], total: 0 }); setUpcomingError(userMessage(error)); },
    onLoading: setUpcomingLoading,
  });
  const reminderRows = restaurantId ? upcoming.rows : initialRows.filter(q => quoteDisplayStatus(q, today) === "Contactar");
  const reminderTotal = restaurantId ? upcoming.total : reminderRows.length;
  useListQuery({
    queryKey: restaurantId && canEdit ? JSON.stringify([restaurantId, today, "dismissed-reminders"]) : undefined,
    version: `${refreshToken}:${remoteVersion}:${focusVersion}`,
    read: signal => readDismissedQuoteCount(supabase, restaurantId!, today, signal),
    onData: total => { setDismissedCount(total); setDismissedError(""); },
    onError: error => { setDismissedCount(0); setDismissedError(userMessage(error)); },
    onLoading: setDismissedLoading,
  });
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
  async function dismissReminder(row: QuoteSummary) {
    if (!restaurantId || !canEdit || reminderLock.current) return;
    reminderLock.current = true; setReminderBusy(true); setReminderActionError("");
    try {
      await dismissQuoteReminder(supabase, restaurantId, row);
      setFocusVersion(value => value + 1);
      showSuccess(language === "en" ? "Reminder dismissed. The quote stays saved." : "Aviso quitado. La cotización se conserva.");
    } catch (error) { setReminderActionError(userMessage(error)); }
    finally { reminderLock.current = false; setReminderBusy(false); }
  }
  async function recoverReminders() {
    if (!restaurantId || !canEdit || reminderLock.current) return;
    reminderLock.current = true; setReminderBusy(true); setReminderActionError("");
    try {
      const restored = await restoreDismissedQuoteReminders(supabase, restaurantId, today);
      setUpcomingPage(1); setFocusVersion(value => value + 1);
      showSuccess(language === "en" ? `${restored} reminders restored.` : `${restored} avisos recuperados.`);
    } catch (error) { setReminderActionError(userMessage(error)); }
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
        close={() => setLinkQuote(null)} linked={() => { setLinkQuote(null); showSuccess(language === "en" ? "Quote linked to the existing reservation." : "Cotización vinculada a la reservación existente."); setFocusVersion(value => value + 1); onLinked(); }} />}
      {upcomingError && <p className="moduleNotice moduleError" role="alert"><span>No se pudieron cargar los avisos.</span> {upcomingError}</p>}
      {reminderActionError && <p className="moduleNotice moduleError" role="alert">{reminderActionError}</p>}
      <section className="quoteReminders" translate="no" aria-label={language === "en" ? "Upcoming quotes" : "Próximas cotizaciones"} aria-busy={upcomingLoading}>
        <div role="status"><strong>{language === "en" ? "Upcoming quotes" : "Próximas cotizaciones"}</strong> <span>({upcomingError ? "—" : upcomingLoading && !reminderTotal ? "…" : reminderTotal})</span><p>{language === "en" ? "Contact these customers: their event is today or within the next 5 days." : "Contacte a estos clientes: su evento es hoy o en los próximos 5 días."}</p></div>
        {upcomingLoading && !reminderTotal && <p role="status">{language === "en" ? "Checking upcoming quotes…" : "Revisando próximas cotizaciones…"}</p>}
        {!upcomingLoading && !upcomingError && !reminderTotal && <p>{language === "en" ? "No pending reminders for these dates." : "No hay avisos pendientes para estas fechas."}</p>}
        <ul>{reminderRows.map(q => <li key={q.id}>
          <span><strong translate="no">{q.client_name || "—"}</strong> · #{q.quote_number} · {displayDate(q.event_date)}</span>
          <div className="quoteReminderActions">
          <button type="button" disabled={Boolean(actionId) || upcomingLoading} onClick={() => { void openAction(q, preview); }}>{language === "en" ? "Review" : "Revisar"}</button>
          {canEdit && restaurantId && <button type="button" disabled={reminderBusy || upcomingLoading} onClick={() => { void dismissReminder(q); }}>{language === "en" ? "Dismiss" : "Quitar"}</button>}
          </div>
        </li>)}</ul>
        {canEdit && reminderTotal > 0 && <small>{language === "en" ? "Dismissing removes the reminder for the team; the quote stays saved." : "Quitar descarta el aviso para el equipo; la cotización se conserva."}</small>}
        {restaurantId && <Pagination total={reminderTotal} page={upcomingPage} onPage={setUpcomingPage} hasNext={upcomingPage * 50 < reminderTotal} shown={upcoming.rows.length} loading={upcomingLoading} language={language} />}
        {canEdit && restaurantId && dismissedCount > 0 && <div className="quoteReminderRecovery">
          <small>{language === "en" ? `${dismissedCount} reminders were previously dismissed. You can show them again without changing the quotes.` : `${dismissedCount} avisos se quitaron anteriormente. Puede volver a mostrarlos sin cambiar el contenido de las cotizaciones.`}</small>
          <button type="button" disabled={reminderBusy || dismissedLoading || upcomingLoading} onClick={() => { void recoverReminders(); }}>{language === "en" ? "Restore dismissed reminders" : "Recuperar avisos quitados"}</button>
          {dismissedCount > 50 && <small>{language === "en" ? "Up to 50 reminders are restored each time." : "Se recuperan hasta 50 avisos cada vez."}</small>}
        </div>}
        {canEdit && dismissedError && <p role="alert">{language === "en" ? "Could not check dismissed reminders." : "No se pudieron revisar los avisos quitados."} {dismissedError}</p>}
      </section>
      <div className="listToolbar">
        <input className="moduleSearch moduleCard" placeholder="Buscar cotización, cliente, área o estado…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={selectPage} /> Seleccionar esta página</label>}
        {canDelete && selected.length > 0 && <button className="dangerButton" onClick={() => void removeMany(selected)}><Trash2 /> Eliminar seleccionadas ({selected.length})</button>}
      </div>
      <div className="quoteListHeader" translate="no">
      <div className="quoteSortControls">
        <label><span>{language === "en" ? "Sort by" : "Ordenar por"}</span>
          <select aria-label={language === "en" ? "Sort by" : "Ordenar por"} value={sortBy} onChange={e => { setSortBy(e.target.value as QuoteSortField); setPage(1); setSelected([]); }}>
            <option value="event_date">{language === "en" ? "Event date" : "Fecha del evento"}</option>
            <option value="quote_number">{language === "en" ? "Quote number" : "Número de cotización"}</option>
            <option value="created_at">{language === "en" ? "Creation date" : "Fecha de creación"}</option>
          </select>
        </label>
        <label><span>{language === "en" ? "Order" : "Orden"}</span>
          <select aria-label={language === "en" ? "Order" : "Orden"} value={ascending ? "asc" : "desc"} onChange={e => { setAscending(e.target.value === "asc"); setPage(1); setSelected([]); }}>
            <option value="asc">{sortBy === "quote_number" ? (language === "en" ? "Lowest first" : "Menor a mayor") : (language === "en" ? "Oldest first" : "Más antiguas primero")}</option>
            <option value="desc">{sortBy === "quote_number" ? (language === "en" ? "Highest first" : "Mayor a menor") : (language === "en" ? "Newest first" : "Más recientes primero")}</option>
          </select>
        </label>
      </div>
      <p className="quoteSavedCount" role="status" aria-busy={restaurantId ? countLoading : false}
        title={language === "en" ? "All saved quotes for this restaurant, including converted quotes. Excludes trash; unaffected by search or pagination." : "Todas las cotizaciones guardadas de este restaurante, incluidas las convertidas. Excluye la papelera; no cambia con la búsqueda ni la página."}>
        <span>{language === "en" ? "Saved quotes:" : "Cotizaciones guardadas:"}</span>{" "}
        <span>{typeof savedTotal === "number" ? new Intl.NumberFormat(language === "en" ? "en-US" : "es-GT").format(savedTotal)
          : currentCount?.total === null ? (language === "en" ? "Unavailable" : "No disponible") : "…"}</span>
      </p>
      </div>
      {areaLabels.error&&<p className="moduleNotice moduleError" role="alert">{language==='en'?'Could not load table selections. Refresh to retry.':'No se pudieron consultar las mesas seleccionadas. Actualice para reintentar.'}</p>}
      {loadError && <p className="moduleNotice moduleError" role="alert">{userMessage(loadError)}</p>}
      {actionId && <p role="status">Cargando cotización…</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <QuoteTableViewport language={language}>
          <div className="tr head quoteRow">
            <span aria-hidden="true" />
            <span>Número</span>
            <span>Cliente</span>
            <span translate="no">{language === "en" ? "Event date" : "Fecha del evento"}</span>
            <span>Hora</span>
            <span>Área</span>
            <span>Total</span>
            <span>Estado</span>
            <span translate="no">{language === "en" ? "Actions" : "Acciones"}</span>
          </div>
          {rows.map((q) => (
            <div className={`tr quoteRow ${selected.includes(q.id) ? "selectedRecord" : ""}`} key={q.id}>
              <div className="quoteIdentity">
                {canDelete ? (<input className="recordCheckbox quoteCheckbox" type="checkbox" aria-label={`Seleccionar cotización ${q.quote_number}`} checked={selected.includes(q.id)} onChange={() => selectQuote(q)} />) : <span aria-hidden="true" />}
                <strong>#{q.quote_number}</strong>
              </div>
              <span className="quoteClient"><small className="quoteFieldLabel">Cliente</small><span className="quoteFieldValue" translate="no">{q.client_name || "—"}</span><small className="quoteCreated" translate="no">{language === "en" ? "Created:" : "Creada:"} {localTimestampDate(q.created_at) ? <time dateTime={q.created_at} title={language === "en" ? "Device local time" : "Hora local del dispositivo"}>{displayDate(localTimestampDate(q.created_at))} · {localTimestampTime(q.created_at, timeFormat)}</time> : "—"}</small></span>
              <span className="quoteDate"><small className="quoteFieldLabel" translate="no">{language === "en" ? "Event date" : "Fecha del evento"}</small><span className="quoteFieldValue">{displayDate(q.event_date)}</span></span>
              <span className="quoteTime"><small className="quoteFieldLabel">Hora</small><span className="quoteFieldValue">{formatEventTime(q.event_time, timeFormat)}</span></span>
              <span className="quoteArea"><small className="quoteFieldLabel">Área</small><span className="quoteFieldValue">{areaLabels.labels[q.id] || q.area || "—"}</span></span>
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
                  disabled={Boolean(actionId)} onClick={() => { setLinkQuote(q); }}>
                  <Link2 />{language === "en" ? "Link to existing reservation" : "Vincular a reservación"}
                </button>}
                {canDelete && <button className="quoteDeleteAction" title="Enviar a la papelera" aria-label={`Enviar cotización ${q.quote_number} a la papelera`} onClick={() => remove(q)}>
                  <Trash2 />
                </button>}
              </div>
            </div>
          ))}
        </QuoteTableViewport>
      ) : (
        <div className="empty">Todavía no hay cotizaciones.</div>
      )}
      <Pagination total={initialRows.length} page={page} onPage={setPage} hasNext={restaurantId ? pager.hasNext : undefined} shown={rows.length} loading={loading} language={language} />
    </div>
  );
}
