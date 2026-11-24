export function isCancelledReservation(status?: string | null) {
  return ['cancelada', 'cancelado', 'cancelled', 'canceled'].includes((status || '').trim().toLowerCase());
}

export function reservationGuestTotal(rows: readonly { status?: string | null; guests?: number | string | null }[]) {
  return rows.reduce((total, row) => total + (isCancelledReservation(row.status) ? 0 : Number(row.guests || 0)), 0);
}
