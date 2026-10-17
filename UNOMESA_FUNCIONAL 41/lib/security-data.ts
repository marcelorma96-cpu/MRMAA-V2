import type { SupabaseClient } from '@supabase/supabase-js';
import type { ListCursor, ListPage } from './cursor-pagination';
export const SECURITY_PAGE_SIZE = 10;
export async function readAuditPage<T extends { id: number; changed_at: string }>(client: SupabaseClient, restaurant: string, after: ListCursor | null, signal: AbortSignal): Promise<ListPage<T>> {
 signal.throwIfAborted();
 if (!restaurant) throw new Error('No se pudo cargar el historial.');
 let query = client.from('v2_audit_log')
  .select('id,table_name,action,changed_by,actor_name,actor_role,changed_at,old_data,new_data')
  .eq('restaurant_id', restaurant);
 if (after) {
  if (!/^\d+$/.test(String(after.id)) || typeof after.changed_at !== 'string' || !Number.isFinite(Date.parse(after.changed_at))) throw new Error('Cursor inválido.');
  const stamp = JSON.stringify(after.changed_at);
  query = query.or(`changed_at.lt.${stamp},and(changed_at.eq.${stamp},id.lt.${after.id})`);
 }
 const result = await query.order('changed_at', { ascending: false }).order('id', { ascending: false }).limit(SECURITY_PAGE_SIZE + 1).abortSignal(signal);
 signal.throwIfAborted();
 if (result.error) throw result.error;
 const all = (result.data || []) as T[], rows = all.slice(0, SECURITY_PAGE_SIZE), last = rows.at(-1);
 return { rows, has_more: all.length > SECURITY_PAGE_SIZE, next: all.length > SECURITY_PAGE_SIZE && last ? { changed_at: last.changed_at, id: last.id } : null };
}
export async function readTrashPage<T>(client: SupabaseClient, restaurant: string, search: string, page: number, signal: AbortSignal) {
 signal.throwIfAborted();
 if (!restaurant) throw new Error('No se pudo cargar la papelera.');
 const result = await client.rpc('v2_trash_page', { p_restaurant: restaurant, p_search: search,
  p_offset: (Math.max(1, Math.trunc(page)) - 1) * SECURITY_PAGE_SIZE, p_limit: SECURITY_PAGE_SIZE }).abortSignal(signal);
 signal.throwIfAborted();
 if (result.error) throw result.error;
 const rows = (result.data || []) as { row_data: T; total_count: number }[];
 return { rows: rows.map(value => value.row_data), total: Number(rows[0]?.total_count || 0) };
}
