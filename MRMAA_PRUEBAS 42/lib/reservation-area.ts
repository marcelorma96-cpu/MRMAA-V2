export type ReservationAreaOption = { id: string; name: string };

export function reservationAreaKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function reservationAreasAreSimilar(left: unknown, right: unknown) {
  const a = reservationAreaKey(left), b = reservationAreaKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const leftTokens = a.split(" "), rightTokens = b.split(" ");
  // Complete words only: Salón 1 and Salón 2 are different areas.
  return Math.min(a.length, b.length) >= 3 && (
    leftTokens.every((token) => rightTokens.includes(token)) ||
    rightTokens.every((token) => leftTokens.includes(token))
  );
}

export function findExactReservationArea<T extends ReservationAreaOption>(areas: T[], value: unknown) {
  const exact = areas.filter((area) => reservationAreaKey(area.name) === reservationAreaKey(value));
  // Similarity produces advisory warnings, never silent reassignment.
  return exact.length === 1 ? exact[0] : undefined;
}
