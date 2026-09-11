"use client";
import { useState } from "react";
import { useAppPreferences } from "./app-preferences";
export const normalizeArea = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
export function AreaPicker({ areas, value, areaId, onChange, required = false }: {
  areas: { id: string; name: string }[]; value: string; areaId?: string;
  onChange: (name: string, id: string) => void; required?: boolean;
}) {
  const [search,setSearch] = useState('');
  const {language}=useAppPreferences();
  const en=language==='en';
  const matches = areas.filter(a=>normalizeArea(a.name)===normalizeArea(value || ''));
  const selected = areas.find(a=>a.id===areaId) || (matches.length===1 ? matches[0] : undefined);
  return <span style={{display:'grid',gap:6}}>
    <select aria-label={en?'Area':'Área'} required={required} value={selected?.id || ''}
      onChange={e=>{const a=areas.find(a=>a.id===e.target.value);onChange(a?.name || '',a?.id || '');}}>
      <option value="">{en?'Select area':'Seleccionar área'}</option>
      {areas.filter(a=>a.id===selected?.id || normalizeArea(a.name).includes(normalizeArea(search))).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
    <details>
      <summary>{en ? 'Search the area list' : 'Buscar en el listado de áreas'}</summary>
      <input type="search" aria-label={en?'Filter available areas':'Filtrar áreas disponibles'} placeholder={en?'Type to filter the list':'Escriba para filtrar el listado'}
        value={search} onChange={e=>setSearch(e.target.value)} />
      <small>{en ? 'This field only filters. Select an area from the dropdown above.' : 'Este campo solo filtra. Seleccione un área del listado de arriba.'}</small>
      {search && !areas.some(a=>normalizeArea(a.name).includes(normalizeArea(search))) && <small>{en ? 'No matching areas.' : 'No hay áreas coincidentes.'}</small>}
    </details>
    {!selected && value && <small>Área anterior: {value}. Seleccione un área configurada.</small>}
    {!areas.length && <small>Agregue áreas en Configuración.</small>}
  </span>;
}
