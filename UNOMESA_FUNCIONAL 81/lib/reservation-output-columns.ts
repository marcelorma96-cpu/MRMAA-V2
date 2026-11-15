import type {ReservationReport} from './reservation-report';

const labels = {
  date: ['Fecha', 'Date'], time: ['Hora', 'Time'], duration: ['Duración', 'Duration'],
  client: ['Cliente', 'Customer'], phone: ['Teléfono', 'Phone'], area: ['Área', 'Area'],
  guests: ['Invitados', 'Guests'], menu: ['Menú', 'Menu'], deposit: ['Anticipo', 'Deposit'],
  payment_method: ['Método de pago', 'Payment method'], balance: ['Saldo', 'Balance'],
  status: ['Estado', 'Status'], quote: ['Cotización vinculada', 'Linked quote'], notes: ['Observaciones', 'Notes'],
} as const;

export type ReservationOutputColumn = keyof typeof labels;
export type ReservationColumnSelection = Partial<Record<ReservationOutputColumn, boolean>>;
export const reservationColumnLabel = (key: ReservationOutputColumn, en: boolean) => labels[key][en ? 1 : 0];

export function reservationListColumns(showDeposits: boolean): ReservationOutputColumn[] {
  return ['date', 'time', 'client', 'phone', 'area', 'guests', 'menu',
    ...(showDeposits ? ['deposit', 'payment_method'] as const : []), 'status', 'notes'];
}
export const reservationExcelColumns: ReservationOutputColumn[] = ['date', 'time', 'client', 'phone', 'area', 'guests', 'menu', 'deposit', 'payment_method', 'balance', 'status', 'notes'];
export function reservationFloorColumns(full: boolean, showDeposits: boolean): ReservationOutputColumn[] {
  return ['date', 'time', 'duration', 'client', 'phone', 'guests', 'area', 'status',
    ...(full ? ['menu', ...(showDeposits ? ['deposit', 'payment_method'] as const : []), 'quote', 'notes'] as const : [])];
}

/** Missing choices retain the existing document defaults. Store only column preferences, never customer data. */
export function parseReservationColumnSelection(raw: string | null): ReservationColumnSelection {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.keys(labels).filter(key => typeof (value as Record<string, unknown>)[key] === 'boolean')
      .map(key => [key, (value as Record<string, boolean>)[key]]));
  } catch { return {}; }
}
export const reservationColumnsStorageKey = (restaurantId: string) => `unomesa:${restaurantId}:reservation-output-columns:v1`;
export const reservationColumnIndexes = (keys: ReservationOutputColumn[], selection: ReservationColumnSelection) =>
  keys.flatMap((key, index) => selection[key] === false ? [] : [index]);
export function reservationColumnsError(keys: ReservationOutputColumn[], selection: ReservationColumnSelection, en: boolean) {
  return reservationColumnIndexes(keys, selection).length ? '' : en ? 'Select at least one column.' : 'Seleccione al menos una columna.';
}

/** Remove headings AND values before HTML, PDF or XLSX generation. Never hide data with CSS. */
export function selectReservationTableColumns<T>(keys: ReservationOutputColumn[], rows: T[][], selection: ReservationColumnSelection) {
  const indexes = reservationColumnIndexes(keys, selection);
  if (!indexes.length) throw new Error('RESERVATION_COLUMNS_EMPTY');
  if (rows.some(row => row.length !== keys.length)) throw new Error('Invalid reservation report columns');
  return {indexes, keys: indexes.map(index => keys[index]), rows: rows.map(row => indexes.map(index => row[index]))};
}
export function selectReservationReportColumns(report: ReservationReport, keys: ReservationOutputColumn[], selection: ReservationColumnSelection): ReservationReport {
  if (report.mode === 'summary') return {...report, columns: [], rows: [], repeatColumns: 0};
  if (report.columns.length !== keys.length) throw new Error('Invalid reservation report columns');
  const selected = selectReservationTableColumns(keys, report.rows, selection);
  return {...report, columns: selected.indexes.map(index => report.columns[index]), rows: selected.rows,
    repeatColumns: selected.indexes.filter(index => index < (report.repeatColumns ?? 3)).length};
}
