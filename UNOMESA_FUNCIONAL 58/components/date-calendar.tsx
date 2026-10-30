"use client";
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays, ChevronLeft, ChevronRight, X} from 'lucide-react';
import {calendarDate, calendarISO, calendarKeyDate, calendarMonthDays, clampCalendarDate, shiftCalendarDay, shiftCalendarMonth} from '@/lib/calendar-date';
import styles from './date-calendar.module.css';

type Props = {date: string; en: boolean; min?: string; max?: string; onChange: (date: string) => void; onToday?: () => void; onClose: () => void};

/** Browsing a month never changes the active date; choosing a day applies it. */
export function DateCalendar({date, en, min, max, onChange, onToday, onClose}: Props) {
  const lower = min || '0001-01-01', upper = max || '9999-12-31';
  const initial = clampCalendarDate(date, lower, upper);
  const [focused, setFocused] = useState(initial);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [today] = useState(() => calendarISO(new Date()));
  const dialog = useRef<HTMLDialogElement>(null), grid = useRef<HTMLTableElement>(null);
  const focusDay = useRef(false), id = useId(), locale = en ? 'en-US' : 'es-GT';
  const say = (es: string, english: string) => en ? english : es;
  const allowed = (value: string) => value === clampCalendarDate(value, lower, upper);
  const fullLabel = (value: string) => new Intl.DateTimeFormat(locale, {dateStyle: 'full'}).format(calendarDate(value));
  const monthLabel = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(calendarDate(`${month}-01`));
  const days = calendarMonthDays(`${month}-01`);
  const year = Number(month.slice(0, 4)), monthNumber = Number(month.slice(5, 7));
  const yearStart = Math.max(Number(lower.slice(0, 4)), Math.min(year, Number(today.slice(0, 4))) - 100);
  const yearEnd = Math.min(Number(upper.slice(0, 4)), Math.max(year, Number(today.slice(0, 4))) + 100);
  const monthAllowed = (value: string) => value >= lower.slice(0, 7) && value <= upper.slice(0, 7);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = dialog.current;
    element?.showModal();
    grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({preventScroll: true});
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus({preventScroll: true});
    };
  }, []);

  useLayoutEffect(() => {
    if (!focusDay.current) return;
    grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({preventScroll: true});
    focusDay.current = false;
  }, [focused, month]);

  const browse = (value: string, focus = false) => {
    const next = clampCalendarDate(value, lower, upper);
    focusDay.current = focus;
    setFocused(next);
    setMonth(next.slice(0, 7));
  };
  const changeMonth = (value: string) => {
    const difference = (Number(value.slice(0, 4)) - year) * 12 + Number(value.slice(5, 7)) - monthNumber;
    browse(shiftCalendarMonth(focused, difference));
  };
  const choose = (value: string, isToday = false) => {
    if (!allowed(value)) return;
    if (isToday && onToday) onToday(); else onChange(value);
    onClose();
  };

  return createPortal(<dialog ref={dialog} className={styles.calendar} aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}
    data-menu-swipe="off" translate="no"
    onCancel={event => {event.preventDefault(); onClose();}}
    onKeyDown={event => event.stopPropagation()}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header className={styles.header}>
      <div><h2 id={`${id}-title`}><CalendarDays size={20}/>{say('Elegir fecha', 'Choose date')}</h2><p id={`${id}-hint`}>{say('Toca un día para seleccionarlo.', 'Select a day to apply it.')}</p></div>
      <button type="button" className={styles.icon} onClick={onClose} aria-label={say('Cerrar calendario', 'Close calendar')}><X size={22}/></button>
    </header>
    <div className={styles.monthControls}>
      <button type="button" className={styles.icon} aria-label={say('Mes anterior', 'Previous month')} disabled={month <= lower.slice(0, 7)} onClick={() => browse(shiftCalendarMonth(focused, -1))}><ChevronLeft size={22}/></button>
      <div className={styles.selects}>
        <select aria-label={say('Mes', 'Month')} value={monthNumber} onChange={event => changeMonth(`${String(year).padStart(4, '0')}-${event.target.value.padStart(2, '0')}`)}>
          {Array.from({length: 12}, (_, index) => <option key={index} value={index + 1} disabled={!monthAllowed(`${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`)}>{new Intl.DateTimeFormat(locale, {month: 'long'}).format(new Date(2024, index, 1, 12))}</option>)}
        </select>
        <select aria-label={say('Año', 'Year')} value={year} onChange={event => changeMonth(`${event.target.value.padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}`)}>
          {Array.from({length: yearEnd - yearStart + 1}, (_, index) => yearStart + index).map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <button type="button" className={styles.icon} aria-label={say('Mes siguiente', 'Next month')} disabled={month >= upper.slice(0, 7)} onClick={() => browse(shiftCalendarMonth(focused, 1))}><ChevronRight size={22}/></button>
    </div>
    <span className={styles.srOnly} aria-live="polite" aria-atomic="true">{monthLabel}</span>
    <table ref={grid} className={styles.grid} role="grid" aria-label={monthLabel}>
      <thead><tr>{Array.from({length: 7}, (_, index) => {
        const day = calendarDate(shiftCalendarDay('2024-01-07', index));
        return <th key={index} scope="col" aria-label={new Intl.DateTimeFormat(locale, {weekday: 'long'}).format(day)}>{new Intl.DateTimeFormat(locale, {weekday: 'short'}).format(day)}</th>;
      })}</tr></thead>
      <tbody>{Array.from({length: 6}, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(value => <td key={value} role="gridcell" aria-selected={value === date}>
        <button type="button" className={styles.day} data-outside={value.slice(0, 7) !== month} data-selected={value === date} aria-current={value === today ? 'date' : undefined}
          disabled={!allowed(value)} tabIndex={value === focused ? 0 : -1} aria-label={fullLabel(value)} onClick={() => choose(value)}
          onKeyDown={event => {
            const next = calendarKeyDate(value, event.key, event.shiftKey, lower, upper);
            if (next === null) return;
            event.preventDefault();
            browse(next, true);
          }}>{calendarDate(value).getDate()}</button>
      </td>)}</tr>)}</tbody>
    </table>
    <p className={styles.selection}>{say('Seleccionada', 'Selected')}: <strong>{fullLabel(date)}</strong></p>
    <footer className={styles.shortcuts}>
      <button type="button" disabled={!allowed(today)} onClick={() => choose(today, true)}>{say('Hoy', 'Today')}</button>
      <button type="button" disabled={!allowed(shiftCalendarDay(today, 1))} onClick={() => choose(shiftCalendarDay(today, 1))}>{say('Mañana', 'Tomorrow')}</button>
      <button type="button" className={styles.cancel} onClick={onClose}>{say('Cancelar', 'Cancel')}</button>
    </footer>
  </dialog>, document.body);
}
