'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { PublicCard } from '@/lib/restaurant-public';
import type { CatalogItem } from '@/lib/public-catalog';
import s from './restaurant-public.module.css';

const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function PublicCatalogPicker({kind, rows, selected, en, onSelect, onCapacity, onRemove, renderDetails}: {
  kind: 'menus' | 'areas'; rows: CatalogItem[]; selected: PublicCard[]; en: boolean;
  onSelect: (ids: string[], checked: boolean) => void; onCapacity: (id: string, value: string) => void;
  onRemove: (id: string) => void; renderDetails: (card: PublicCard) => ReactNode;
}) {
  const [query, setQuery] = useState(''), [expanded, setExpanded] = useState('');
  useEffect(() => { const newCard=selected.find(card=>!card.name); if(newCard){setQuery('');setExpanded(newCard.id);} }, [selected]);
  const t = (es: string, eng: string) => en ? eng : es;
  const chosen = new Map(selected.filter(card=>card.source_id).map(card => [card.source_id,card]));
  const available = Math.max(0, 60 - selected.length);
  const catalogIds = new Set(rows.map(row=>row.id));
  // Manual or previously selected inactive catalog items remain editable in this same list.
  const entries = [...rows.map(row=>({key:`catalog:${row.id}`,name:row.name,sourceId:row.id,card:chosen.get(row.id)})),
    ...selected.filter(card=>!card.source_id||!catalogIds.has(card.source_id)).map(card=>({key:`card:${card.id}`,name:card.name||t('Nuevo elemento','New item'),sourceId:'',card}))];
  const visible = entries.filter(row=>searchText(row.name).includes(searchText(query.trim())));
  const missing = visible.filter(row=>!row.card);
  const details=(card:PublicCard,name:string)=><>
    {kind==='areas'&&<label className={s.capacityInput}>{t('Capacidad máxima (personas)','Maximum capacity (guests)')}
      <input aria-label={`${name} · ${t('Capacidad máxima','Maximum capacity')}`} type="number" inputMode="numeric" min={1} max={100000} step={1} placeholder={t('Ej. 40','e.g. 40')} value={card.capacity} onChange={event=>onCapacity(card.id,event.target.value)}/>
    </label>}
    <button type="button" className={s.detailsToggle} aria-expanded={expanded===card.id} aria-controls={`public-card-${card.id}`} onClick={()=>setExpanded(expanded===card.id?'':card.id)}>{expanded===card.id?t('Cerrar detalles','Close details'):t('Editar detalles','Edit details')}</button>
    {expanded===card.id&&<div id={`public-card-${card.id}`} className={s.inlineDetails}>{renderDetails(card)}</div>}
  </>;
  return <div className={s.catalogPicker} role="group" aria-label={kind==='menus'?t('Seleccionar menús','Select menus'):t('Seleccionar salones','Select spaces')}>
    <label>{kind==='menus'?t('Buscar menús del catálogo','Search catalog menus'):t('Buscar salones','Search spaces')}
      <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Escriba para filtrar…','Type to filter…')}/>
    </label>
    <div className={s.row}><small aria-live="polite">{selected.length} / 60 {t('seleccionados para publicar','selected for publication')}</small>
      <div className={s.catalogActions}>
        <button type="button" disabled={!missing.length||!available} onClick={()=>onSelect(missing.slice(0,available).map(row=>row.sourceId),true)}>{query?t('Seleccionar resultados','Select results'):t('Seleccionar todos','Select all')}</button>
        <button type="button" disabled={!visible.some(row=>row.card&&row.sourceId)} onClick={()=>onSelect(visible.filter(row=>row.sourceId).map(row=>row.sourceId),false)}>{query?t('Deseleccionar resultados','Deselect results'):t('Deseleccionar lista','Deselect list')}</button>
      </div>
    </div>
    <div className={s.catalogList}>
      {visible.map(row=><div key={row.key} className={s.catalogEntry}>
        <label className={s.catalogChoice}><input type="checkbox" checked={!!row.card} disabled={!row.card&&!available} onChange={event=>row.sourceId?onSelect([row.sourceId],event.target.checked):onRemove(row.card!.id)}/><span>{row.name}</span></label>
        {row.card&&details(row.card,row.name)}
      </div>)}
      {!visible.length&&<p className={s.muted}>{entries.length?t('No hay coincidencias.','No matches.'):t('Su catálogo está vacío. Puede agregar un elemento manualmente.','Your catalog is empty. You can add an item manually.')}</p>}
    </div>
    {!available&&<p role="status" className={s.muted}>{t('Llegó al máximo de 60. Deseleccione un elemento para agregar otro.','You reached the limit of 60. Deselect an item to add another.')}</p>}
    <small className={s.muted}>{t('Marque qué publicar. Edite los detalles desde la misma fila y guarde los cambios.','Choose what to publish. Edit details in the same row and save changes.')}</small>
  </div>;
}
