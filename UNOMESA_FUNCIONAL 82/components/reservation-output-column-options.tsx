"use client";
import {reservationColumnIndexes, reservationColumnLabel, reservationColumnsError, type ReservationOutputColumn, type ReservationColumnSelection} from '@/lib/reservation-output-columns';
import styles from './reservation-output-column-options.module.css';

export function ReservationOutputColumnOptions({columns, value, onChange, en, disabled = false}: {
  columns: ReservationOutputColumn[]; value: ReservationColumnSelection; onChange: (value: ReservationColumnSelection) => void; en: boolean; disabled?: boolean;
}) {
  const count = reservationColumnIndexes(columns, value).length, error = reservationColumnsError(columns, value, en);
  const all = (checked: boolean) => onChange({...value, ...Object.fromEntries(columns.map(key => [key, checked]))});
  return <details className={styles.options}>
    <summary><span>{en ? 'Columns to include' : 'Columnas a incluir'}</span><small>{count} {en ? 'of' : 'de'} {columns.length}</small></summary>
    <fieldset className={styles.fields} disabled={disabled}>
      <legend className={styles.visuallyHidden}>{en ? 'Reservation columns' : 'Columnas de reservaciones'}</legend>
      <p>{en ? 'Uncheck a field to remove its heading and data from the document.' : 'Desmarque un campo para quitar su encabezado y sus datos del documento.'}</p>
      <div className={styles.actions}><button type="button" onClick={() => all(true)}>{en ? 'Select all' : 'Marcar todas'}</button><button type="button" onClick={() => all(false)}>{en ? 'Clear all' : 'Quitar todas'}</button></div>
      <div className={styles.grid}>{columns.map(key => <label className={styles.choice} key={key}>
        <input type="checkbox" checked={value[key] !== false} onChange={event => onChange({...value, [key]: event.target.checked})}/>
        <span>{reservationColumnLabel(key, en)}</span>
      </label>)}</div>
      <small>{en ? 'Remembered on this device for this restaurant. Applies to printing, PDF and Excel.' : 'Se recuerda en este dispositivo para este restaurante. Aplica a impresión, PDF y Excel.'}</small>
    </fieldset>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </details>;
}
