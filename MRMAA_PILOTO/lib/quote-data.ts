import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote, QuoteAdjustment, QuoteItem } from "./types";

export type QuoteSummary = Pick<Quote, "id" | "restaurant_id" | "quote_number" | "client_name" | "event_date" | "event_time" | "area" | "total" | "status">;
const SUMMARY_COLUMNS = "id,restaurant_id,quote_number,client_name,event_date,event_time,area,total,status";

/** A bounded list contains only displayed fields; descriptions are read on demand. */
export async function readQuotePage(client: SupabaseClient, restaurantId: string, search: string, page: number, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!restaurantId) throw new Error("No se pudo cargar la información.");
  const from = (Math.max(1, Math.trunc(page) || 1) - 1) * 50;
  const term = search.trim().replace(/[%(),]/g, " ");
  let query = client.from("v2_quotes").select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("restaurant_id", restaurantId).is("deleted_at", null);
  if (term) {
    const filters = [
      `client_name.ilike.%${term}%`, `client_phone.ilike.%${term}%`,
      `area.ilike.%${term}%`, `status.ilike.%${term}%`,
    ];
    if (/^\d+$/.test(term)) filters.push(`quote_number.eq.${term}`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(term)) filters.push(`event_date.eq.${term}`);
    query = query.or(filters.join(","));
  }
  const result = await query.order("quote_number", { ascending: false }).range(from, from + 49).abortSignal(signal);
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
 * Postgres RPC (v2_save_quote, see 08_COTIZACIONES_GUARDADO_ATOMICO.sql)
 * instead of the previous read-increment-insert-retry loop done from the
 * browser. One round trip, no client-visible collision after 3 attempts.
 */
export async function saveQuote(
  client: SupabaseClient, restaurantId: string, quoteId: string | null,
  payload: QuoteSavePayload, items: QuoteItem[],
) {
  const validItems = items.filter(item => item.name.trim()).map(item => ({
    name: item.name.trim(), description: item.description.trim() || null,
    quantity: item.quantity, unit_price: item.unit_price,
  }));
  const result = await client.rpc("v2_save_quote", {
    p_restaurant: restaurantId, p_quote_id: quoteId, p_payload: payload, p_items: validItems,
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.id) throw new Error("No se pudo guardar la cotización.");
  return { id: row.id as string, quoteNumber: Number(row.quote_number) };
}
