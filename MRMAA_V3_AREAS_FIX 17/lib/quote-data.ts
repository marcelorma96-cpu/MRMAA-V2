import type { SupabaseClient } from "@supabase/supabase-js";
import type { Quote } from "./types";

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
  const rows = (result.data || []) as QuoteSummary[];
  if (!rows.length) return { rows, total: result.count || 0 };
  // Keep the reservation link as the source of truth for conversion/deletion controls.
  const links = await client.from("v2_reservations").select("quote_id")
    .eq("restaurant_id", restaurantId).is("deleted_at", null).in("quote_id", rows.map(row => row.id)).abortSignal(signal);
  signal.throwIfAborted();
  if (links.error) throw links.error;
  const converted = new Set((links.data || []).map(row => row.quote_id));
  return {
    rows: rows.map(row => ({ ...row, status: converted.has(row.id) ? "convertida" : row.status === "convertida" ? "pendiente" : row.status })),
    total: result.count || 0,
  };
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
