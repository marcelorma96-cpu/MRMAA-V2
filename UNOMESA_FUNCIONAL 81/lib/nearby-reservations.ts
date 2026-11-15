import type { SupabaseClient } from '@supabase/supabase-js';
import { isCancelledReservation } from './reservation-totals';
import type { ReservationAreaOption } from './reservation-area';
import { floorDefaultDuration, validFloorDuration } from './restaurant-map';
import { missingFloorFunction } from './floor-plan';

export type NearbyReservation = {
  id: string; client_name: string; event_date: string; event_time: string;
  guests: number; area: string; area_id?: string | null; area_ids?: string[] | null;
  status: string | null;
};

const columns = 'id,client_name,event_date,event_time,guests,area,area_id,status';
const pageSize = 250;
const areaKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

export function reservationWarningWindowLabel(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}

/** Read the restaurant's saved default afresh, including changes from another device.
 * The checked floor RPC owns access to this setting; its table is not client-readable.
 */
export async function readReservationWarning(client: SupabaseClient, restaurantId: string,
  areas: ReservationAreaOption[], date: string, time: string, exclude?: string) {
  const setting = await client.rpc('v2_floor_read', { p_restaurant_id: restaurantId, p_date: date });
  if (setting.error && !missingFloorFunction(setting.error, 'v2_floor_read')) throw setting.error;
  const windowMinutes = floorDefaultDuration(setting.data?.layout || { areas: [], tables: [] });
  const reservations = await readNearbyReservations(client, restaurantId, areas, date, time, exclude, windowMinutes);
  return { reservations, windowMinutes };
}

function clock(microseconds: number) {
  const value = Math.min(86400e6 - 1, Math.max(0, microseconds));
  const hours = Math.floor(value / 3600e6), minutes = Math.floor(value / 60e6) % 60;
  const seconds = Math.floor(value / 1e6) % 60, fraction = value % 1e6;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(6, '0')}`;
}

/** Read current reservations under the caller's RLS, including pending bookings.
 * The advisory window is the restaurant's saved duration before/after on the same day;
 * table occupancy/duration is checked separately by the existing save RPC.
 */
export async function readNearbyReservations(client: SupabaseClient, restaurantId: string,
  areas: ReservationAreaOption[], date: string, time: string, exclude?: string, windowMinutes = 180): Promise<NearbyReservation[]> {
  const parts = time.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d(?:\.\d{1,6})?))?$/);
  if (!restaurantId || !areas.length || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !parts)
    throw new Error('Indique fecha, hora y área para revisar las reservaciones cercanas.');
  const center = Math.round((Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3] || 0)) * 1e6);
  const margin = (validFloorDuration(windowMinutes) ? windowMinutes : 180) * 60e6;
  const from = clock(center - margin), to = clock(center + margin);
  const areaIds = new Set(areas.map(area => area.id));
  const areaNames = new Set(areas.map(area => areaKey(area.name)).filter(Boolean));
  const matches: NearbyReservation[] = [];
  let after: string | undefined, multiArea = true;
  while (true) {
    let query = client.from('v2_reservations').select(columns + (multiArea ? ',area_ids' : ''))
      .eq('restaurant_id', restaurantId).is('deleted_at', null).eq('event_date', date)
      .gte('event_time', from).lte('event_time', to).order('id').limit(pageSize);
    if (exclude) query = query.neq('id', exclude);
    if (after) query = query.gt('id', after);
    const result = await query;
    // Older installations have a single area_id. Do not fall back to an older
    // RPC whose installed status filter may omit pending reservations.
    if (multiArea && result.error && ['42703', 'PGRST204'].includes(result.error.code)
      && /\barea_ids\b/.test(result.error.message)) {
      multiArea = false;
      continue;
    }
    if (result.error) throw result.error;
    const rows = (result.data || []) as unknown as NearbyReservation[];
    for (const row of rows) {
      if (isCancelledReservation(row.status)) continue;
      if ((row.area_id && areaIds.has(row.area_id)) || row.area_ids?.some(id => areaIds.has(id))
        || areaNames.has(areaKey(row.area || ''))) matches.push(row);
    }
    // A warning needs at most 250 matches, but unrelated areas must not hide
    // matches on later pages. No list/search/status UI filters are reused here.
    if (rows.length < pageSize || matches.length >= pageSize) break;
    const last = rows.at(-1)!.id;
    if (after && last <= after) throw new Error('No se pudo comprobar las reservaciones cercanas.');
    after = last;
  }
  return matches.sort((a, b) => a.event_time.localeCompare(b.event_time) || a.id.localeCompare(b.id)).slice(0, pageSize);
}
