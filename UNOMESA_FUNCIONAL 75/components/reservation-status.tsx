import { isCancelledReservation } from '@/lib/reservation-totals';

export function ReservationStatus({ status }: { status?: string | null }) {
  const confirmed = ["confirmada", "confirmado", "confirmed"].includes((status || "").trim().toLowerCase());
  const cancelled = isCancelledReservation(status);
  return (
    <span className={cancelled ? "status reservationStatusCancelled" : confirmed ? "status statusConfirmed" : undefined}>
      {cancelled ? "Cancelada" : confirmed ? "Confirmada" : status || "Sin estado"}
    </span>
  );
}
