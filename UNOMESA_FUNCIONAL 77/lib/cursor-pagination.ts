"use client";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ListCursor = Record<string, string | number | null>;
export type ListPage<T> = { rows: T[]; has_more: boolean; next: ListCursor | null };

/** No total count or deep OFFSET. Filters and RLS are applied in PostgreSQL. */
export async function readListPage<T>(client: SupabaseClient, restaurant: string,
  resource: "clients" | "quotes" | "reservations", filters: Record<string, unknown>,
  after: ListCursor | null, signal: AbortSignal): Promise<ListPage<T>> {
  signal.throwIfAborted();
  const result = await client.rpc("v2_list_page", {
    p_restaurant: restaurant, p_resource: resource, p_filters: filters, p_after: after,
  }).abortSignal(signal);
  signal.throwIfAborted();
  if (result.error) throw result.error;
  if (!result.data || !Array.isArray(result.data.rows)) throw new Error("No se pudo cargar la información.");
  return result.data;
}

/** Cursors belong to a single tenant/filter/sort. Never reuse across searches. */
export function useCursorPagination(scope: string) {
  type State = { scope: string; page: number; cursors: (ListCursor | null)[]; hasNext: boolean };
  const initial = (): State => ({ scope, page: 1, cursors: [null], hasNext: false });
  const [stored, setStored] = useState<State>(initial);
  const state = stored.scope === scope ? stored : initial();
  if (stored.scope !== scope) setStored(state);
  return {
    page: state.page, after: state.cursors[state.page - 1], hasNext: state.hasNext,
    setPage(page: number) {
      setStored(old => old.scope !== scope || page < 1 || page > old.cursors.length ? old
        : { ...old, page, hasNext: false });
    },
    accept<T>(result: ListPage<T>) {
      setStored(old => {
        if (old.scope !== scope || old.page !== state.page) return old;
        const cursors = old.cursors.slice(0, old.page);
        if (result.has_more && result.next) cursors.push(result.next);
        return { ...old, cursors, hasNext: result.has_more && result.next !== null };
      });
    },
  };
}
