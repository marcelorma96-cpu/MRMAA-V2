"use client";
import {useFloorConflictConfirmation} from "./floor-conflict-confirmation";
import {saveWithFloorConfirmation} from "@/lib/floor-conflict-confirmation";
import { useCursorPagination } from "@/lib/cursor-pagination";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./dashboard-ui";
import { useAppPreferences, formatAppMoney } from "./app-preferences";
import {readLinkableQuotePage,eventLinkError} from "@/lib/event-linking";
import {notifyFloorChange} from "@/lib/floor-sync";
import {useDataRefresh} from "./restaurant-sync";
import { supabase } from "@/lib/supabase";
import { readAvailableReservationPage, type AvailableReservation, type QuoteSummary } from "@/lib/quote-data";
import { formatEventTime } from "@/lib/local-date";
import { useListSearch } from "@/lib/list-search";
const displayDate = (value: string | null | undefined) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
import type { Reservation } from "@/lib/types";

export function ReservationQuoteLink({ reservation, restaurantId, close, linked }: {
  reservation: Pick<Reservation,"id"|"client_name"|"event_date"|"area">; restaurantId: string; close: () => void; linked: () => void;
}) {
  const { language, t } = useAppPreferences();
  const en = language === "en";
  const [search, setSearch] = useState("");
  const term = useListSearch(search, () => {});
  const pager = useCursorPagination(JSON.stringify([restaurantId, term]));
  const { page, setPage } = pager;
  const [rows, setRows] = useState<QuoteSummary[]>([]);
  const [chosen, setChosen] = useState<QuoteSummary | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false),floorConfirmation=useFloorConflictConfirmation(en);
  const remoteVersion=useDataRefresh(restaurantId,"v2_reservations,v2_quotes");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]); setChosen(null);
    readLinkableQuotePage(supabase, restaurantId, term, pager.after, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setRows(result.rows); pager.accept(result); } })
      .catch(error => { if (!controller.signal.aborted) setError(eventLinkError(error,en)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [restaurantId, term, page, remoteVersion]);
  async function save() {
    if (!chosen || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await saveWithFloorConfirmation((confirmed,extraSeats)=>supabase.rpc("v2_link_existing_events", {
        p_allow_conflict:confirmed,p_allow_extra_seats:extraSeats, p_restaurant: restaurantId, p_reservation: reservation.id, p_quote: chosen.id,
      }),floorConfirmation.confirm);
      if(!result)return;
      if (result.error) throw result.error;
      notifyFloorChange(restaurantId);linked();
    } catch (error) { setError(eventLinkError(error,en)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><Modal title={en ? "Link an existing quote" : "Vincular cotización existente"} close={() => { if (!lock.current) close(); }}>
    <div className="formStack" translate="no">
      <p><b>{reservation.client_name}</b> · {displayDate(reservation.event_date)} · {reservation.area}</p>
      <p>{en ? "Choose a quote for this event. Its customer, date, time, area, guests, menu, amounts and internal notes will replace the reservation details. Linking confirms it, including a canceled reservation, without creating another."
        : "Elija una cotización de este evento. Sus datos de cliente, fecha, hora, área, invitados, menú, importes y notas internas reemplazarán los de la reserva. Al vincular se confirma, incluso si estaba cancelada, sin crear otra reserva."}</p>
      <label>{en ? "Find quote" : "Buscar cotización"}
        <input value={search} disabled={busy} onChange={e => setSearch(e.target.value)} placeholder={en ? "Number, customer or phone…" : "Número, cliente o teléfono…"} />
      </label>
      <p className="floorFootnote">{en ? "The quote’s table selection replaces the reservation’s selection. Availability is checked for the quote date and time; an overlap requires Save anyway." : "La selección de mesas de la cotización reemplaza la de la reserva. Se revisa disponibilidad en la fecha y hora cotizadas; un cruce requiere Guardar de todos modos."}</p>
      {error && <p role="alert" className="moduleNotice moduleError">{t(error)}</p>}
      {loading ? <p role="status">{en ? "Loading…" : "Cargando…"}</p> : <div className="reservationQuoteChoices">
        {rows.map(q => <label key={q.id} className="reservationQuoteChoice">
          <input type="radio" name="reservation-quote" disabled={busy} checked={chosen?.id === q.id} onChange={() => setChosen(q)} />
          <span><b>#{q.quote_number} · {q.client_name}</b><br />{displayDate(q.event_date)} · {q.area} · {formatAppMoney(q.total)} · {t(q.status)}</span>
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
  </Modal>{floorConfirmation.dialog}</>;
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
  const lock = useRef(false),floorConfirmation=useFloorConflictConfirmation(en);
  const remoteVersion=useDataRefresh(restaurantId,"v2_reservations,v2_quotes");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]); setChosen(null);
    readAvailableReservationPage(supabase, restaurantId, term, date, pager.after, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setRows(result.rows); pager.accept(result); } })
      .catch(error => { if (!controller.signal.aborted) setError(eventLinkError(error,en)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [restaurantId, quote.id, term, date, pager.page, remoteVersion]);
  async function save() {
    if (!chosen || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await saveWithFloorConfirmation((confirmed,extraSeats)=>supabase.rpc("v2_link_existing_events", {
        p_allow_conflict:confirmed,p_allow_extra_seats:extraSeats, p_restaurant: restaurantId, p_reservation: chosen.id, p_quote: quote.id,
      }),floorConfirmation.confirm);
      if(!result)return;
      if (result.error) throw result.error;
      notifyFloorChange(restaurantId);linked();
    } catch (error) { setError(eventLinkError(error,en)); }
    finally { lock.current = false; setBusy(false); }
  }
  const event = (row: Pick<AvailableReservation, "event_date" | "event_time" | "area">) =>
    `${displayDate(row.event_date)} · ${formatEventTime(row.event_time, timeFormat)} · ${row.area || "—"}`;
  return <><Modal title={copy("Vincular a reservación", "Link to existing reservation")} close={() => { if (!lock.current) close(); }}>
    <div className="formStack" translate="no">
      <p><b>#{quote.quote_number} · {quote.client_name}</b><br />{event(quote)}</p>
      <p>{copy("Seleccione una reserva existente sin cotización, de cualquier estado o cantidad de invitados. La cotización actualizará sus datos y mesas. La reserva quedará Confirmada, incluso si estaba cancelada, y la cotización Convertida. No se crea otra reserva.",
        "Select an existing reservation without a quote, regardless of status or guest count. The quote will update its details and tables. The reservation becomes Confirmed, including a canceled one, and the quote Converted. No second reservation is created.")}</p>
      <div className="grid2">
        <label>{copy("Buscar reservación", "Find reservation")}<input value={search} maxLength={150} disabled={busy}
          onChange={e => { setSearch(e.target.value); setChosen(null); }} placeholder={copy("Cliente, teléfono o área…", "Customer, phone or area…")} /></label>
        <label>{copy("Fecha del evento (opcional)", "Event date (optional)")}<input type="date" value={date} disabled={busy}
          onChange={e => { setDate(e.target.value); setChosen(null); }} /></label>
      </div>
      {date && <button type="button" className="secondary" disabled={busy} onClick={() => { setDate(""); setChosen(null); }}>{copy("Ver todas las fechas", "All dates")}</button>}
      <p className="floorFootnote">{en ? "The quote’s table selection replaces the reservation’s selection. Availability is checked for the quote date and time; an overlap requires Save anyway." : "La selección de mesas de la cotización reemplaza la de la reserva. Se revisa disponibilidad en la fecha y hora cotizadas; un cruce requiere Guardar de todos modos."}</p>
      {error && <p role="alert" className="moduleNotice moduleError">{t(error)}</p>}
      {loading ? <p role="status">{copy("Cargando…", "Loading…")}</p> : <div className="reservationQuoteChoices">
        {rows.map(row => <label key={row.id} className="reservationQuoteChoice">
          <input type="radio" name="quote-reservation" disabled={busy} checked={chosen?.id === row.id} onChange={() => setChosen(row)} />
          <span><b>{row.client_name}</b><br />{event(row)}<br />{row.phone || "—"} · {row.guests} {copy("invitados", "guests")} · {t(row.status)} · {copy("Anticipo", "Deposit")}: {formatAppMoney(row.deposit || 0)}</span>
        </label>)}
        {!rows.length && <p>{copy("No se encontraron reservas sin cotización con estos filtros. Se incluyen todos los estados y cantidades de invitados; los registros en papelera no aparecen.", "No unlinked reservations match these filters. All statuses and guest counts are included; records in trash are excluded.")}</p>}
      </div>}
      <div className="rowActions">
        <button type="button" disabled={busy || loading || pager.page <= 1} onClick={() => { setChosen(null); pager.setPage(pager.page - 1); }}>{copy("Anterior", "Previous")}</button>
        <span>{copy("Página", "Page")} {pager.page}</span>
        <button type="button" disabled={busy || loading || !pager.hasNext} onClick={() => { setChosen(null); pager.setPage(pager.page + 1); }}>{copy("Siguiente", "Next")}</button>
      </div>
      {chosen && <p role="status"><b>{copy("Reservación elegida", "Selected reservation")}: {chosen.client_name}</b><br />{event(chosen)}<br />
        {copy("Compruebe que es el mismo evento. Al confirmar, cliente, teléfono, fecha, hora, área, invitados, menú, importes, anticipo, notas internas y mesas se tomarán de la cotización.", "Check that this is the same event. Customer, phone, date, time, area, guests, menu, amounts, deposit, internal notes and tables will be taken from the quote.")}</p>}
      <div className="rowActions">
        <button type="button" className="secondary" disabled={busy} onClick={close}>{copy("Cancelar", "Cancel")}</button>
        <button type="button" className="primary" disabled={!chosen || busy || loading} onClick={() => void save()}>
          {busy ? copy("Vinculando…", "Linking…") : copy("Vincular y confirmar reserva", "Link and confirm reservation")}
        </button>
      </div>
    </div>
  </Modal>{floorConfirmation.dialog}</>;
}
