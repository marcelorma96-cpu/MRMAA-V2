"use client";
import { readListPage, useCursorPagination } from "@/lib/cursor-pagination";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./dashboard-ui";
import { useAppPreferences, formatAppMoney } from "./app-preferences";
import { supabase } from "@/lib/supabase";
import { readAvailableReservationPage, type AvailableReservation, type QuoteSummary } from "@/lib/quote-data";
import { formatEventTime } from "@/lib/local-date";
import { useListSearch } from "@/lib/list-search";
import { userMessage } from "@/lib/user-message";
const displayDate = (value: string | null | undefined) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
import type { Reservation } from "@/lib/types";

export function ReservationQuoteLink({ reservation, restaurantId, close, linked }: {
  reservation: Reservation; restaurantId: string; close: () => void; linked: () => void;
}) {
  const { language, t } = useAppPreferences();
  const en = language === "en";
  const [search, setSearch] = useState("");
  const term = useListSearch(search, () => {});
  const pager = useCursorPagination(JSON.stringify([restaurantId, term]));
  const { page, setPage } = pager;
  const [rows, setRows] = useState<QuoteSummary[]>([]), [total, setTotal] = useState(0);
  const [chosen, setChosen] = useState<QuoteSummary | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]); setChosen(null);
    readListPage<QuoteSummary>(supabase, restaurantId, "quotes", { search: term, available: true }, pager.after, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setRows(result.rows); pager.accept(result); } })
      .catch(error => { if (!controller.signal.aborted) setError(userMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [restaurantId, term, page]);
  async function save() {
    if (!chosen || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await supabase.rpc("v2_link_reservation_quote", {
        p_restaurant: restaurantId, p_reservation: reservation.id, p_quote: chosen.id,
      });
      if (result.error) throw result.error;
      linked();
    } catch (error) { setError(userMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal title={en ? "Link an existing quote" : "Vincular cotización existente"} close={() => { if (!lock.current) close(); }}>
    <div className="formStack" translate="no">
      <p><b>{reservation.client_name}</b> · {displayDate(reservation.event_date)} · {reservation.area}</p>
      <p>{en ? "Choose a quote for this event. Linking confirms the existing reservation and keeps its customer, date, area, deposit and other details. No second reservation is created."
        : "Elija una cotización de este evento. Al vincular se confirma la reserva existente y se conservan su cliente, fecha, área, anticipo y demás datos. No se crea otra reserva."}</p>
      <label>{en ? "Find quote" : "Buscar cotización"}
        <input value={search} disabled={busy} onChange={e => setSearch(e.target.value)} placeholder={en ? "Number, customer or phone…" : "Número, cliente o teléfono…"} />
      </label>
      {error && <p role="alert" className="moduleNotice moduleError">{t(error)}</p>}
      {loading ? <p role="status">{en ? "Loading…" : "Cargando…"}</p> : <div className="reservationQuoteChoices">
        {rows.map(q => <label key={q.id} className="reservationQuoteChoice">
          <input type="radio" name="reservation-quote" disabled={busy} checked={chosen?.id === q.id} onChange={() => setChosen(q)} />
          <span><b>#{q.quote_number} · {q.client_name}</b><br />{displayDate(q.event_date)} · {q.area} · {formatAppMoney(q.total)}</span>
        </label>)}
        {!rows.length && <p>{en ? "No available quotes found." : "No se encontraron cotizaciones disponibles."}</p>}
      </div>}
      <div className="rowActions">
        <button type="button" disabled={busy || loading || page <= 1} onClick={() => setPage(page - 1)}>{en ? "Previous" : "Anterior"}</button>
        <span>{en ? "Page" : "Página"} {page}</span>
        <button type="button" disabled={busy || loading || !pager.hasNext} onClick={() => setPage(page + 1)}>{en ? "Next" : "Siguiente"}</button>
      </div>
      <button type="button" className="primary" disabled={!chosen || busy || loading} onClick={() => void save()}>
        {busy ? (en ? "Linking…" : "Vinculando…") : (en ? "Link and confirm reservation" : "Vincular y confirmar reserva")}
      </button>
    </div>
  </Modal>;
}

export function QuoteReservationLink({ quote, restaurantId, timeFormat, close, linked }: {
  quote: QuoteSummary; restaurantId: string; timeFormat?: unknown; close: () => void; linked: () => void;
}) {
  const { language, t } = useAppPreferences(), en = language === "en";
  const copy = (es: string, english: string) => en ? english : es;
  const [search, setSearch] = useState(""), [date, setDate] = useState("");
  const [chosen, setChosen] = useState<AvailableReservation | null>(null);
  const term = useListSearch(search, () => {});
  const pager = useCursorPagination(JSON.stringify([restaurantId, quote.id, term, date]));
  const [rows, setRows] = useState<AvailableReservation[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]); setChosen(null);
    readAvailableReservationPage(supabase, restaurantId, term, date, pager.after, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setRows(result.rows); pager.accept(result); } })
      .catch(error => { if (!controller.signal.aborted) setError(userMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [restaurantId, quote.id, term, date, pager.page]);
  async function save() {
    if (!chosen || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await supabase.rpc("v2_link_reservation_quote", {
        p_restaurant: restaurantId, p_reservation: chosen.id, p_quote: quote.id,
      });
      if (result.error) throw result.error;
      linked();
    } catch (error) { setError(userMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  const event = (row: Pick<AvailableReservation, "event_date" | "event_time" | "area">) =>
    `${displayDate(row.event_date)} · ${formatEventTime(row.event_time, timeFormat)} · ${row.area || "—"}`;
  return <Modal title={copy("Vincular a reservación", "Link to existing reservation")} close={() => { if (!lock.current) close(); }}>
    <div className="formStack" translate="no">
      <p><b>#{quote.quote_number} · {quote.client_name}</b><br />{event(quote)}</p>
      <p>{copy("Seleccione una reserva existente sin cotización. Se conservarán los datos de ambos registros; la reserva quedará Confirmada y la cotización Convertida. No se crea otra reserva.",
        "Select an existing reservation without a quote. Both records keep their details; the reservation becomes Confirmed and the quote Converted. No second reservation is created.")}</p>
      <div className="grid2">
        <label>{copy("Buscar reservación", "Find reservation")}<input value={search} maxLength={150} disabled={busy}
          onChange={e => { setSearch(e.target.value); setChosen(null); }} placeholder={copy("Cliente, teléfono o área…", "Customer, phone or area…")} /></label>
        <label>{copy("Fecha del evento (opcional)", "Event date (optional)")}<input type="date" value={date} disabled={busy}
          onChange={e => { setDate(e.target.value); setChosen(null); }} /></label>
      </div>
      {date && <button type="button" className="secondary" disabled={busy} onClick={() => { setDate(""); setChosen(null); }}>{copy("Ver todas las fechas", "All dates")}</button>}
      {error && <p role="alert" className="moduleNotice moduleError">{t(error)}</p>}
      {loading ? <p role="status">{copy("Cargando…", "Loading…")}</p> : <div className="reservationQuoteChoices">
        {rows.map(row => <label key={row.id} className="reservationQuoteChoice">
          <input type="radio" name="quote-reservation" disabled={busy} checked={chosen?.id === row.id} onChange={() => setChosen(row)} />
          <span><b>{row.client_name}</b><br />{event(row)}<br />{row.phone || "—"} · {row.guests} {copy("invitados", "guests")} · {copy("Anticipo", "Deposit")}: {formatAppMoney(row.deposit || 0)}</span>
        </label>)}
        {!rows.length && <p>{copy("No se encontraron reservas disponibles. Las canceladas o que ya tienen cotización no aparecen.", "No available reservations found. Canceled reservations and those already linked to a quote are excluded.")}</p>}
      </div>}
      <div className="rowActions">
        <button type="button" disabled={busy || loading || pager.page <= 1} onClick={() => { setChosen(null); pager.setPage(pager.page - 1); }}>{copy("Anterior", "Previous")}</button>
        <span>{copy("Página", "Page")} {pager.page}</span>
        <button type="button" disabled={busy || loading || !pager.hasNext} onClick={() => { setChosen(null); pager.setPage(pager.page + 1); }}>{copy("Siguiente", "Next")}</button>
      </div>
      {chosen && <p role="status"><b>{copy("Reservación elegida", "Selected reservation")}: {chosen.client_name}</b><br />{event(chosen)}<br />
        {copy("Compruebe que corresponde al mismo evento antes de confirmar. Vincular no reemplaza cliente, fecha, importes ni observaciones; las diferencias anteriores deben revisarse manualmente.", "Check that this is the same event before confirming. Linking does not replace customer, date, amounts or notes; review existing differences manually.")}</p>}
      <div className="rowActions">
        <button type="button" className="secondary" disabled={busy} onClick={close}>{copy("Cancelar", "Cancel")}</button>
        <button type="button" className="primary" disabled={!chosen || busy || loading} onClick={() => void save()}>
          {busy ? copy("Vinculando…", "Linking…") : copy("Vincular y confirmar reserva", "Link and confirm reservation")}
        </button>
      </div>
    </div>
  </Modal>;
}
