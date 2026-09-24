/** One private, tenant-scoped invalidation stream. Business rows always come from RLS queries. */
export const SYNC_TABLES = [
  'v2_restaurants', 'v2_members', 'v2_clients', 'v2_quotes', 'v2_quote_items',
  'v2_reservations', 'v2_reservation_areas', 'v2_quote_products', 'v2_areas',
  'v2_employees', 'v2_shifts', 'v2_schedules', 'v2_audit_log',
  'v2_communication_settings', 'v2_message_templates',
] as const;
export type SyncTable = typeof SYNC_TABLES[number];
export type SyncStatus = 'connecting' | 'live' | 'reconnecting';
export const SYNC_EVENT = 'mrmaa-data-changed';
export type DataChange = { restaurantId: string; tables: SyncTable[] };
const allowed = new Set<string>(SYNC_TABLES);
export function validSyncChange(value: unknown, restaurantId: string): SyncTable | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  return data.v === 1 && data.restaurant_id === restaurantId && typeof data.table === 'string' && allowed.has(data.table)
    ? data.table as SyncTable : null;
}
// Structural interface keeps the transport testable without a live service.
type Transport = { channel: (topic: string, options: any) => any; removeChannel: (channel: any) => Promise<unknown>; realtime: { setAuth: () => Promise<unknown> } };
type Options = {
  client: Transport; restaurantId: string;
  onChange: (tables: SyncTable[]) => void; onStatus: (status: SyncStatus) => void;
  available: () => boolean;
};
export function connectRestaurantSync({ client, restaurantId, onChange, onStatus, available }: Options) {
  let disposed = false, channel: any, generation = 0, attempts = 0;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<SyncTable>();
  const flush = () => {
    flushTimer = undefined;
    if (disposed || !available() || !pending.size) return;
    const tables = [...pending]; pending.clear(); onChange(tables);
  };
  const enqueue = (tables: readonly SyncTable[]) => {
    if (disposed) return;
    tables.forEach(table => pending.add(table));
    // Fixed window, not trailing debounce: sustained imports cannot starve the UI.
    if (!flushTimer) flushTimer = setTimeout(flush, 400);
  };
  const fallback = () => {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (disposed) return;
      enqueue(SYNC_TABLES); fallback();
    }, 60_000);
  };
  const failed = (ticket: number) => {
    if (disposed || ticket !== generation || retryTimer) return;
    onStatus('reconnecting');
    if (!fallbackTimer) fallback();
    const delay = Math.min(30_000, 1500 * 2 ** Math.min(attempts++, 5)) + Math.floor(Math.random() * 500);
    retryTimer = setTimeout(() => { retryTimer = undefined; void open(); }, delay);
  };
  async function open() {
    const ticket = ++generation;
    const old = channel; channel = undefined;
    if (old) await client.removeChannel(old).catch(() => undefined);
    if (disposed || ticket !== generation) return;
    if (!available()) { failed(ticket); return; }
    try {
      await client.realtime.setAuth();
      if (disposed || ticket !== generation) return;
      channel = client.channel(`mrmaa:${restaurantId}`, { config: { private: true, broadcast: { self: false } } });
      channel.on('broadcast', { event: 'changed' }, (event: any) => {
        if (disposed || ticket !== generation) return;
        const table = validSyncChange(event?.payload, restaurantId);
        if (table) enqueue([table]);
      }).subscribe((status: string) => {
        if (disposed || ticket !== generation) return;
        if (status === 'SUBSCRIBED') {
          attempts = 0; clearTimeout(retryTimer); retryTimer = undefined;
          clearTimeout(fallbackTimer); fallbackTimer = undefined;
          onStatus('live');
          // Covers the initial query/subscribe race and changes missed while disconnected.
          enqueue(SYNC_TABLES);
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) failed(ticket);
      });
    } catch { failed(ticket); }
  }
  onStatus('connecting'); void open();
  return {
    refresh() {
      enqueue(SYNC_TABLES);
      if (retryTimer && available()) { clearTimeout(retryTimer); retryTimer = undefined; void open(); }
    },
    stop() {
      disposed = true; generation++;
      clearTimeout(flushTimer); clearTimeout(retryTimer); clearTimeout(fallbackTimer); pending.clear();
      if (channel) void client.removeChannel(channel).catch(() => undefined);
    },
  };
}
