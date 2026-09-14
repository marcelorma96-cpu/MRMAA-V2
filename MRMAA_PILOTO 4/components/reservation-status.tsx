export function ReservationStatus({ status }: { status?: string | null }) {
  const cancelled = ["cancelada", "cancelado", "cancelled", "canceled"].includes(
    (status || "").trim().toLowerCase(),
  );
  return (
    <span className={cancelled ? "status reservationStatusCancelled" : undefined}>
      {cancelled ? "Cancelada" : status || "Sin estado"}
    </span>
  );
}
