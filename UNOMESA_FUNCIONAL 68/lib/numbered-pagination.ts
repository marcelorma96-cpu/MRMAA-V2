"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NumberedPage<T> = { rows: T[]; total: number; page: number; has_more: boolean };
type PageResponse<T> = { data: T[] | null; count: number | null; error: unknown };

/** Read only the requested window. An exact filtered count makes both ends reachable.
 * Re-clamp once if deletions made the requested page disappear. No page-by-page scan. */
export async function readNumberedPage<T>(
  read: (from: number, to: number, signal: AbortSignal) => PromiseLike<PageResponse<T>>,
  page: number, pageSize: number, signal: AbortSignal,
): Promise<NumberedPage<T>> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !Number.isSafeInteger(page * pageSize)) throw new Error("Página inválida.");
  const fetchPage = async (value: number) => {
    const from = (value - 1) * pageSize;
    const result = await read(from, from + pageSize - 1, signal);
    signal.throwIfAborted();
    if (result.error) throw result.error;
    if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0 || !Array.isArray(result.data))
      throw new Error("No se pudo cargar el listado.");
    return { rows: result.data, total: result.count };
  };
  let result;
  try { result = await fetchPage(page); }
  catch (error) {
    // PostgREST can return 416 when deletions remove a later page. Recover its
    // current filtered count through page one, then jump directly to the new end.
    if (page === 1 || (error as { code?: string })?.code !== "PGRST103") throw error;
    result = await fetchPage(1);
  }
  const availablePage = Math.max(1, Math.ceil(result.total / pageSize));
  if (page > availablePage) {
    page = availablePage;
    result = result.total ? await fetchPage(page) : { rows: [], total: 0 };
  }
  return { ...result, page, has_more: page * pageSize < result.total };
}

/** Page and count belong to one restaurant, filter and order. */
export function useNumberedPagination(scope: string) {
  const initial = () => ({ scope, page: 1, total: 0, hasNext: false });
  const [stored, setStored] = useState(initial);
  const state = stored.scope === scope ? stored : initial();
  if (stored.scope !== scope) setStored(state);
  return {
    ...state,
    setPage(page: number) {
      if (!Number.isSafeInteger(page) || page < 1) return;
      setStored(old => old.scope === scope ? { ...old, page } : old);
    },
    accept<T>(result: NumberedPage<T>) {
      setStored(old => old.scope === scope && old.page === state.page
        ? { ...old, page: result.page, total: result.total, hasNext: result.has_more } : old);
    },
  };
}

/** Existing table permissions/RLS still apply. Filters match the corresponding list/export. */
export async function readNumberedListPage<T>(client: SupabaseClient, restaurant: string,
  resource: "clients" | "reservations", filters: Record<string, unknown>, page: number, signal: AbortSignal) {
  if (!restaurant) throw new Error("No se pudo cargar la información.");
  return readNumberedPage<T>((from, to, abort) => {
    let query = client.from(resource === "clients" ? "v2_clients" : "v2_reservations")
      .select("*", { count: "exact" }).eq("restaurant_id", restaurant).is("deleted_at", null);
    const term = String(filters.search || "").trim().replace(/[%(),]/g, " ");
    if (resource === "reservations" && filters.id) query = query.eq("id", filters.id);
    else {
      if (resource === "reservations") {
        if (filters.mode === "today" || filters.mode === "single") query = query.eq("event_date", filters.date);
        else if (filters.mode === "range") query = query.gte("event_date", filters.from).lte("event_date", filters.to);
      }
      if (term) {
        const fields = resource === "clients" ? ["name", "phone", "email", "notes"]
          : ["client_name", "phone", "area", "menu", "notes", "status"];
        const pattern = JSON.stringify(`%${term.replace(/\\/g, "\\\\")}%`);
        query = query.or(fields.map(field => `${field}.ilike.${pattern}`).join(","));
      }
    }
    query = resource === "clients" ? query.order("name", { nullsFirst: false })
      : query.order("event_date").order("event_time", { nullsFirst: false });
    return query.order("id").range(from, to).abortSignal(abort);
  }, page, 50, signal);
}
