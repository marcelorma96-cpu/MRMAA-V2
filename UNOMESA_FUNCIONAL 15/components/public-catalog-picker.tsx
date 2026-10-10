'use client';
import { useState } from 'react';
import type { PublicCard } from '@/lib/restaurant-public';
import type { CatalogItem } from '@/lib/public-catalog';
import s from './restaurant-public.module.css';

const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function PublicCatalogPicker({kind, rows, selected, en, onSelect}: {kind: 'menus' | 'areas'; rows: CatalogItem[]; selected: PublicCard[]; en: boolean; onSelect: (ids: string[], checked: boolean) => void}) {
  const [query, setQuery] = useState('');
  const t = (es: string, eng: string) => en ? eng : es;
  const chosen = new Set(selected.map(card => card.source_id));
  const visible = rows.filter(row => searchText(row.name).includes(searchText(query.trim())));
  const available = Math.max(0, 60 - selected.length);
  const missing = visible.filter(row => !chosen.has(row.id));
  return <div className={s.catalogPicker} role="group" aria-label={kind === 'menus' ? t('Seleccionar menús', 'Select menus') : t('Seleccionar salones', 'Select spaces')}>
    <label>{kind === 'menus' ? t('Buscar menús del catálogo', 'Search catalog menus') : t('Buscar salones', 'Search spaces')}
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Escriba para filtrar…', 'Type to filter…')}/>
    </label>
    <div className={s.row}><small aria-live="polite">{selected.length} / 60 {t('seleccionados para publicar', 'selected for publication')}</small>
      <div className={s.catalogActions}>
        <button type="button" disabled={!missing.length || !available} onClick={() => onSelect(missing.slice(0, available).map(row => row.id), true)}>{query ? t('Seleccionar resultados', 'Select results') : t('Seleccionar todos', 'Select all')}</button>
        <button type="button" disabled={!visible.some(row => chosen.has(row.id))} onClick={() => onSelect(visible.map(row => row.id), false)}>{query ? t('Deseleccionar resultados', 'Deselect results') : t('Deseleccionar lista', 'Deselect list')}</button>
      </div>
    </div>
    <div className={s.catalogList}>
      {visible.map(row => <label key={row.id} className={s.catalogChoice}>
        <input type="checkbox" checked={chosen.has(row.id)} disabled={!chosen.has(row.id) && !available} onChange={event => onSelect([row.id], event.target.checked)}/>
        <span>{row.name}</span>
      </label>)}
      {!visible.length && <p className={s.muted}>{rows.length ? t('No hay coincidencias.', 'No matches.') : t('Su catálogo está vacío. Puede agregar un elemento manualmente.', 'Your catalog is empty. You can add an item manually.')}</p>}
    </div>
    {!available && <p role="status" className={s.muted}>{t('Llegó al máximo de 60. Deseleccione un elemento para agregar otro.', 'You reached the limit of 60. Deselect an item to add another.')}</p>}
    <small className={s.muted}>{t('Las casillas eligen qué mostrar. Guarde los cambios para aplicarlos a su página pública.', 'Checkboxes choose what to show. Save changes to apply them to your public page.')}</small>
  </div>;
}
