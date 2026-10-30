import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoreProvider } from './store-catalog';

export const STORE_RECHECK_MS = 6 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 10 * 60 * 1000;
type Store = { provider: StoreProvider; mode: 'test' | 'live' };
type Purchase = Store & { restaurant_id: string; external_id: string; purchase_reference: string; checked_at: string };

/** Bounded concurrency; one unavailable provider must not hold up every tenant. */
export async function runStoreReconciliation(admin: SupabaseClient, stores: Store[],
  reconcile: (admin: SupabaseClient, restaurant: string, provider: StoreProvider, reference: string) => Promise<unknown>,
  deadline: number) {
  const batches: Purchase[][] = [];
  const cutoff = new Date(Date.now() - STORE_RECHECK_MS).toISOString();
  const recent = new Date(Date.now() - 60 * 86400000).toISOString();
  for (const store of stores) {
    const due = await admin.from('v2_store_purchases')
      .select('provider,mode,restaurant_id,external_id,purchase_reference,checked_at')
      .eq('provider', store.provider).eq('mode', store.mode)
      .or('is_ended.eq.false,verified_until.gt.' + recent).lt('checked_at', cutoff)
      .order('checked_at').order('external_id').limit(Math.floor(100 / stores.length));
    if (due.error) throw new Error('RECONCILIATION_UNAVAILABLE');
    batches.push((due.data || []) as Purchase[]);
  }
  // Interleave providers so a slow queue cannot occupy every initial worker.
  const rows: Purchase[] = [];
  for (let i = 0; batches.some(batch => i < batch.length); i++) {
    for (const batch of batches) if (batch[i]) rows.push(batch[i]);
  }
  let next = 0, checked = 0, failed = 0, queueFailed = 0;
  async function worker() {
    while (next < rows.length && Date.now() < deadline) {
      const row = rows[next++];
      let success = false;
      try { await reconcile(admin, row.restaurant_id, row.provider, row.purchase_reference); checked++; success = true; }
      catch { failed++; }
      // An unchanged failed row is eligible again in 10 minutes, not six hours.
      // Compare-and-set preserves fresher verification by a webhook/owner request.
      const when = new Date(Date.now() - (success ? 0 : STORE_RECHECK_MS - FAILURE_RETRY_MS)).toISOString();
      const saved = await admin.from('v2_store_purchases').update({ checked_at: when })
        .eq('provider', row.provider).eq('mode', row.mode).eq('external_id', row.external_id)
        .eq('checked_at', row.checked_at);
      if (saved.error) queueFailed++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
  return { checked, failed, queue_failed: queueFailed, deferred: rows.length - next };
}
