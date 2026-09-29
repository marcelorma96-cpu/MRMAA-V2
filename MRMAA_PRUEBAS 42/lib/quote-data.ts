import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote, QuoteAdjustment, QuoteItem, Reservation } from "./types";
import type { ListCursor, ListPage } from "./cursor-pagination";
import { localDateISO } from "./local-date";
import { numberValue } from "./calculations";

export type QuoteSummary = Pick<Quote, "id" | "restaurant_id" | "quote_number" | "client_name" | "event_date" | "event_time" | "area" | "total" | "status" | "created_at">;
const SUMMARY_COLUMNS = "id,restaurant_id,quote_number,client_name,event_date,event_time,area,total,status,created_at";

export type AvailableReservation = Pick<Reservation, "id" | "client_name" | "phone" | "event_date" | "event_time" | "area" | "guests" | "deposit" | "status">;

/** Filter before cursor pagination; never load all reservations to find unlinked ones. */
export async function readAvailableReservationPage(client: SupabaseClient, restaurantId: string, search: string,
  date: string, after: ListCursor | null, signal: AbortSignal): Promise<ListPage<AvailableReservation>> {
  signal.throwIfAborted();
  if (!restaurantId) throw new Error("No se pudo cargar la información.");
  let query = client.from("v2_reservations")
    .select("id,client_name,phone,event_date,event_time,area,guests,deposit,status")
    .eq("restaurant_id", restaurantId).is("deleted_at", null).is("quote_id", null).neq("status", "cancelada");
  // Escape the PostgREST quoted pattern and treat SQL wildcard characters literally.
  const term = search.trim().slice(0, 150).replace(/[\\%_]/g, value => `\\${value}`);
  if (term) {
    const pattern = JSON.stringify(`%${term}%`);
    query = query.or(["client_name", "phone", "area"].map(field => `${field}.ilike.${pattern}`).join(","));
  }
  if (date) query = query.eq("event_date", date);
  if (after) {
    const day = String(after.event_date), id = String(after.id), time = after.event_time;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[a-f0-9-]{36}$/i.test(id)
      || (time != null && !/^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(String(time))))
      throw new Error("No se pudo cargar la información.");
    const later = [`event_date.gt.${day}`];
    if (time != null) {
      later.push(`and(event_date.eq.${day},event_time.gt.${time})`,
        `and(event_date.eq.${day},event_time.is.null)`,
        `and(event_date.eq.${day},event_time.eq.${time},id.gt.${id})`);
    } else later.push(`and(event_date.eq.${day},event_time.is.null,id.gt.${id})`);
    query = query.gte("event_date", day).or(later.join(","));
  }
  const result = await query.order("event_date").order("event_time", { nullsFirst: false }).order("id")
    .limit(51).abortSignal(signal);
  signal.throwIfAborted();
  if (result.error) throw result.error;
  const all = (result.data || []) as AvailableReservation[], rows = all.slice(0, 50), last = rows.at(-1);
  return { rows, has_more: all.length > 50, next: all.length > 50 && last
    ? { event_date: last.event_date, event_time: last.event_time ?? null, id: last.id } : null };
}

export type QuoteDeleteBlocker = { id: string; quote_id: string; client_name: string; event_date: string };
export function linkedQuoteDeleteMessage(language: string) {
  return language === "en"
    ? "This quote is linked to an existing reservation. First delete the reservation or unlink the quote before deleting it."
    : "Esta cotización tiene una reservación vinculada. Primero debe eliminar la reservación o desvincular la cotización para poder borrarla.";
}
/** Check current relationships, including canceled reservations that still exist. */
export async function readQuoteDeleteBlockers(client: SupabaseClient, restaurantId: string, quoteIds: string[]) {
  const ids = [...new Set(quoteIds)];
  if (!ids.length) return [];
  const blockers: QuoteDeleteBlocker[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const result = await client.from("v2_reservations").select("id,quote_id,client_name,event_date")
      .eq("restaurant_id", restaurantId).is("deleted_at", null).in("quote_id", batch).limit(batch.length);
    if (result.error) throw result.error;
    blockers.push(...(result.data || []) as QuoteDeleteBlocker[]);
  }
  return blockers;
}
/** Existing triggers reset the quote to Pending atomically. Do not change event data. */
export async function unlinkQuoteReservation(client: SupabaseClient, restaurantId: string, link: Pick<QuoteDeleteBlocker, "id" | "quote_id">) {
  const result = await client.from("v2_reservations").update({ quote_id: null })
    .eq("restaurant_id", restaurantId).eq("id", link.id).eq("quote_id", link.quote_id)
    .is("deleted_at", null).select("id").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("La reservación cambió. Actualice e intente nuevamente.");
}

export type QuoteSortField = "event_date" | "quote_number" | "created_at";

/** Match server ordering for callers supplying local rows, with missing dates last. */
export function compareQuotes(a: QuoteSummary, b: QuoteSummary, field: QuoteSortField = "event_date", ascending = true) {
  const direction = ascending ? 1 : -1;
  const compare = (left: string | number | null | undefined, right: string | number | null | undefined) => {
    if (left == null || left === "") return right == null || right === "" ? 0 : 1;
    if (right == null || right === "") return -1;
    return (left < right ? -1 : left > right ? 1 : 0) * direction;
  };
  const created = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const primary = field === "created_at" ? compare(created(a.created_at), created(b.created_at))
    : compare(a[field], b[field]);
  return primary || (field === "event_date" ? compare(a.event_time, b.event_time) : 0)
    || compare(a.quote_number, b.quote_number) || compare(a.id, b.id);
}

/** Calendar dates in the user's local day; never parse ISO dates as UTC midnight. */
export function quoteReminderEnd(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  return localDateISO(new Date(year, month - 1, day + 5));
}

export function quoteDisplayStatus(quote: Pick<Quote, "status" | "event_date">, today = localDateISO()) {
  if (quote.status !== "pendiente") return quote.status;
  if (!quote.event_date) return "Pendiente";
  if (quote.event_date < today) return "No realizada";
  return quote.event_date <= quoteReminderEnd(today) ? "Contactar" : "Pendiente";
}

/** Separate pagination ensures reminders do not depend on the main list's search or page. */
export async function readUpcomingQuotePage(client: SupabaseClient, restaurantId: string, today: string, page: number, signal: AbortSignal, hidden = false) {
  signal.throwIfAborted();
  if (!restaurantId) throw new Error("No se pudo cargar la información.");
  const from = (Math.max(1, Math.trunc(page) || 1) - 1) * 50;
  const result = await client.from("v2_quotes").select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("restaurant_id", restaurantId).is("deleted_at", null).eq("status", "pendiente").eq("reminder_dismissed", hidden)
    .gte("event_date", today).lte("event_date", quoteReminderEnd(today))
    .order("event_date").order("event_time").order("quote_number").order("id")
    .range(from, from + 49).abortSignal(signal);
  signal.throwIfAborted();
  if (result.error) throw result.error;
  return { rows: (result.data || []) as QuoteSummary[], total: result.count || 0 };
}

/** A bounded list contains only displayed fields; descriptions are read on demand. */
export async function readQuotePage(client: SupabaseClient, restaurantId: string, search: string, page: number, signal: AbortSignal, today = localDateISO(), sortBy: QuoteSortField = "event_date", ascending = true, availableOnly = false) {
  signal.throwIfAborted();
  if (!restaurantId) throw new Error("No se pudo cargar la información.");
  const from = (Math.max(1, Math.trunc(page) || 1) - 1) * 50;
  const term = search.trim().replace(/[%(),]/g, " ");
  let query = client.from("v2_quotes").select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("restaurant_id", restaurantId).is("deleted_at", null);
  if (availableOnly) query = query.neq("status", "convertida");
  if (term) {
    const filters = [
      `client_name.ilike.%${term}%`, `client_phone.ilike.%${term}%`,
      `area.ilike.%${term}%`,
      `and(status.neq.pendiente,status.ilike.%${term}%)`,
    ];
    const normalized = term.toLowerCase();
    if (["contactar", "contact"].some(label => label.includes(normalized)))
      filters.push(`and(status.eq.pendiente,event_date.gte.${today},event_date.lte.${quoteReminderEnd(today)})`);
    if (["no realizada", "not held"].some(label => label.includes(normalized)))
      filters.push(`and(status.eq.pendiente,event_date.lt.${today})`);
    if (["pendiente", "pending"].some(label => label.includes(normalized)))
      filters.push(`and(status.eq.pendiente,or(event_date.gt.${quoteReminderEnd(today)},event_date.is.null))`);
    if (/^\d+$/.test(term)) filters.push(`quote_number.eq.${term}`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(term)) filters.push(`event_date.eq.${term}`);
    query = query.or(filters.join(","));
  }
  // Order in the database before pagination, with deterministic tie breakers.
  const field = sortBy === "created_at" || sortBy === "quote_number" ? sortBy : "event_date";
  query = query.order(field, { ascending, nullsFirst: false });
  if (field === "event_date") query = query.order("event_time", { ascending, nullsFirst: false });
  if (field !== "quote_number") query = query.order("quote_number", { ascending });
  const result = await query.order("id", { ascending }).range(from, from + 49).abortSignal(signal);
  signal.throwIfAborted();
  if (result.error) throw result.error;
  // v2_sync_quote_conversion (trigger on v2_reservations, see 01_SUPABASE_INSTALACION_COMPLETA.sql
  // Bloque 22) keeps v2_quotes.status in lockstep with the presence of an active
  // reservation on every insert/update/delete, inside the same transaction. There is
  // no window where status can disagree with the reservation link, so re-deriving it
  // here with a second round trip was redundant — this trusts the column directly.
  const rows = (result.data || []) as QuoteSummary[];
  return { rows, total: result.count || 0 };
}

/** Fresh data for a single preview, edit or conversion; no cross-user cache. */
export async function readQuoteDetail(client: SupabaseClient, restaurantId: string, quoteId: string, signal?: AbortSignal): Promise<Quote | null> {
  signal?.throwIfAborted();
  if (!restaurantId || !quoteId) throw new Error("No se pudo abrir la cotización.");
  let quoteQuery = client.from("v2_quotes").select("*").eq("restaurant_id", restaurantId)
    .eq("id", quoteId).is("deleted_at", null);
  let itemsQuery = client.from("v2_quote_items").select("id,name,description,quantity,unit_price")
    .eq("quote_id", quoteId).order("position");
  if (signal) { quoteQuery = quoteQuery.abortSignal(signal); itemsQuery = itemsQuery.abortSignal(signal); }
  const [quote, items] = await Promise.all([quoteQuery.maybeSingle(), itemsQuery]);
  signal?.throwIfAborted();
  if (quote.error) throw quote.error;
  if (items.error) throw items.error;
  if (!quote.data) return null;
  return {
    ...quote.data,
    items: (items.data || []).map(item => ({
      id: item.id, name: item.name, description: item.description || "",
      quantity: Number(item.quantity), unit_price: Number(item.unit_price),
    })),
  } as Quote;
}

export type QuoteSavePayload = {
  client_id: string | null; client_name: string; client_phone: string; client_email: string;
  event_date: string; event_time: string | null; area: string; area_id: string | null;
  guests: number; discount_pct: number; tip_pct: number; subtotal: number; total: number;
  deposit: number; payment_method: string; balance: number; customer_note: string;
  internal_notes: string; custom_fields: Record<string, unknown>; adjustments: QuoteAdjustment[];
};

/**
 * Number allocation, the quote row and its items are written by a single
 * Postgres RPC (v2_save_quote_once, migration 12 wrapping migration 08)
 * instead of the previous read-increment-insert-retry loop done from the
 * browser. One round trip, no client-visible collision after 3 attempts.
 */
export async function saveQuote(
  client: SupabaseClient, restaurantId: string, quoteId: string | null,
  payload: QuoteSavePayload, items: QuoteItem[], requestId: string | null, reservationId?: string | null,
) {
  const validItems = items.filter(item => item.name.trim()).map(item => ({
    name: item.name.trim(), description: item.description.trim() || null,
    quantity: numberValue(item.quantity), unit_price: numberValue(item.unit_price),
  }));
  if (!quoteId && !requestId) throw new Error("No se pudo identificar el borrador. Abra una nueva cotización.");
  const result = await client.rpc(reservationId ? "v2_save_reservation_quote" : "v2_save_quote_once", {
    ...(reservationId ? { p_reservation: reservationId } : {}),
    p_restaurant: restaurantId, p_quote_id: quoteId, p_request_id: requestId, p_payload: payload, p_items: validItems,
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.id) throw new Error("No se pudo guardar la cotización.");
  return { id: row.id as string, quoteNumber: Number(row.quote_number) };
}
