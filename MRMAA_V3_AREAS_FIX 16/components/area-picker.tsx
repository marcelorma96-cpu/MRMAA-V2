"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useAppPreferences } from "./app-preferences";
export const normalizeArea = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
type AreaOption = { id: string; name: string };
export function AreaPicker({ areas, value, areaId, onChange, required = false }: {
  areas: AreaOption[]; value: string; areaId?: string;
  onChange: (name: string, id: string) => void; required?: boolean;
}) {
  const {language}=useAppPreferences();
  const en=language==='en';
  const matches=areas.filter(a=>normalizeArea(a.name)===normalizeArea(value || ''));
  const selected=areas.find(a=>a.id===areaId) || (matches.length===1 ? matches[0] : undefined);
  const signature=selected ? `${selected.id}|${selected.name}` : '';
  const lastSelection=useRef(signature);
  const [search,setSearch]=useState(selected?.name || '');
  const [open,setOpen]=useState(false);
  const [highlight,setHighlight]=useState(-1);
  const input=useRef<HTMLInputElement>(null);
  const listId=useId();
  const filtered=areas.filter(a=>normalizeArea(a.name).includes(normalizeArea(search)));
  useEffect(()=>{
    if (signature!==lastSelection.current) {
      lastSelection.current=signature;
      setSearch(selected?.name || '');
    }
  },[signature,selected?.name]);
  useEffect(()=>{
    input.current?.setCustomValidity(search.trim() && !selected
      ? (en?'Select an area from the suggestions or the list.':'Seleccione un área de las sugerencias o del listado.') : '');
  },[search,selected,en]);
  function choose(area?: AreaOption) {
    lastSelection.current=area ? `${area.id}|${area.name}` : '';
    setSearch(area?.name || '');setOpen(false);setHighlight(-1);
    onChange(area?.name || '',area?.id || '');
  }
  return <span style={{display:'grid',gap:6}}>
    <input ref={input} type="search" role="combobox" aria-autocomplete="list"
      aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open && highlight>=0 && filtered[highlight] ? `${listId}-${highlight}` : undefined}
      aria-label={en?'Search area':'Buscar área'} placeholder={en?'Type to search areas':'Escriba para buscar áreas'}
      autoComplete="off" value={search}
      onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}
      onChange={e=>{
        const text=e.target.value;setSearch(text);setOpen(true);setHighlight(-1);
        const exact=normalizeArea(text) ? areas.find(a=>normalizeArea(a.name)===normalizeArea(text)) : undefined;
        lastSelection.current=exact ? `${exact.id}|${exact.name}` : '';
        onChange(exact?.name || '',exact?.id || '');
      }}
      onKeyDown={e=>{
        if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setHighlight(i=>Math.min(i+1,filtered.length-1));}
        if(e.key==='ArrowUp'){e.preventDefault();setHighlight(i=>Math.max(i-1,0));}
        if(e.key==='Escape'){e.preventDefault();setOpen(false);}
        if(e.key==='Enter' && open){e.preventDefault();const option=filtered[highlight>=0?highlight:0];if(option)choose(option);}
      }} />
    {open && <span id={listId} role="listbox" aria-label={en?'Matching areas':'Áreas coincidentes'}
      style={{display:'grid',maxHeight:180,overflowY:'auto',border:'1px solid currentColor',borderRadius:8,padding:4}}>
      {filtered.map((a,i)=><button key={a.id} id={`${listId}-${i}`} type="button" role="option"
        aria-selected={selected?.id===a.id} tabIndex={-1}
        style={{textAlign:'left',outline:i===highlight?'2px solid #f26500':undefined}}
        onPointerDown={e=>e.preventDefault()} onClick={()=>choose(a)}>{a.name}</button>)}
      {!filtered.length && <small role="status">{en?'No matching areas.':'No hay áreas coincidentes.'}</small>}
    </span>}
    <select aria-label={en?'Area list':'Listado de áreas'} required={required} value={selected?.id || ''}
      onChange={e=>choose(areas.find(a=>a.id===e.target.value))}>
      <option value="">{en?'Select area':'Seleccionar área'}</option>
      {areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
    <small>{en?'Search and select a suggestion, or choose from the list. Both fields show the same area.':'Busque y seleccione una sugerencia, o escoja del listado. Ambos campos muestran la misma área.'}</small>
    {!selected && value && <small>{en?'Previous area':'Área anterior'}: {value}. {en?'Select a configured area.':'Seleccione un área configurada.'}</small>}
    {!areas.length && <small>{en?'Add areas in Settings → Reservations.':'Agregue áreas en Configuración → Reservaciones.'}</small>}
  </span>;
}
