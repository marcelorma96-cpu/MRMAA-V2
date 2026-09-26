"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { connectRestaurantSync, SYNC_EVENT, type DataChange, type SyncStatus } from '@/lib/restaurant-sync';

export function useRestaurantSync(restaurantId: string, userId: string, allowed: boolean) {
  const enabled = process.env.NEXT_PUBLIC_MRMAA_REALTIME === 'true';
  const [status, setStatus] = useState<SyncStatus>('connecting');
  useEffect(() => {
    if (!enabled || !allowed || !restaurantId || !userId) return;
    const connection = connectRestaurantSync({
      client: supabase, restaurantId, onStatus: setStatus,
      available: () => navigator.onLine && document.visibilityState !== 'hidden',
      onChange: tables => {
        window.dispatchEvent(new CustomEvent<DataChange>(SYNC_EVENT, { detail: { restaurantId, tables } }));
        if (tables.includes('v2_members') || tables.includes('v2_restaurants'))
          window.dispatchEvent(new Event('mrmaa-excel-permission-changed'));
      },
    });
    let lastWake = 0;
    const wake = () => {
      if (!navigator.onLine || document.visibilityState === 'hidden' || Date.now() - lastWake < 3000) return;
      lastWake = Date.now(); connection.refresh();
    };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('online', wake); window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake); connection.stop();
    };
  }, [restaurantId, userId, allowed, enabled]);
  return { enabled, status };
}

/** Only mounted views reload. A module's normal initial read handles changes while unmounted. */
export function useDataRefresh(restaurantId: string | undefined, tables: string) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const selected = new Set(tables.split(','));
    const changed = (event: Event) => {
      const value = (event as CustomEvent<DataChange>).detail;
      if (value?.restaurantId === restaurantId && value.tables.some(table => selected.has(table)))
        setVersion(current => current + 1);
    };
    window.addEventListener(SYNC_EVENT, changed);
    return () => window.removeEventListener(SYNC_EVENT, changed);
  }, [restaurantId, tables]);
  return version;
}

/** Run only after an invalidation, leaving each module's initial load unchanged. */
export function useOnDataRefresh(version: number, refresh: () => void) {
  const callback = useRef(refresh); callback.current = refresh;
  useEffect(() => { if (version) callback.current(); }, [version]);
}
