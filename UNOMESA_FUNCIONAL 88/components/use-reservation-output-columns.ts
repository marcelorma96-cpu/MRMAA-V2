"use client";
import {useState} from 'react';
import type {ReservationColumnSelection} from '@/lib/reservation-output-columns';

// Choices belong to the open document. An empty override includes every available column.
export function useReservationOutputColumns() {
  return useState<ReservationColumnSelection>({});
}
