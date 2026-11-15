"use client";
import {useEffect, useState} from 'react';
import {parseReservationColumnSelection, reservationColumnsStorageKey, type ReservationColumnSelection} from '@/lib/reservation-output-columns';

export function useReservationOutputColumns(restaurantId: string) {
  const key = reservationColumnsStorageKey(restaurantId);
  const [saved, setSaved] = useState<{key: string; value: ReservationColumnSelection}>({key: '', value: {}});
  useEffect(() => {
    const read = () => {
      try { setSaved({key, value: parseReservationColumnSelection(localStorage.getItem(key))}); }
      catch { setSaved({key, value: {}}); }
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);
  const update = (value: ReservationColumnSelection) => {
    setSaved({key, value});
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The current document still uses the selection. */ }
  };
  return [saved.key === key ? saved.value : {}, update] as const;
}
