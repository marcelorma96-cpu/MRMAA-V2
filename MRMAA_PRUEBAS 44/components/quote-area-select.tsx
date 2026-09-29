"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useAppPreferences } from "./app-preferences";
import { normalizeArea } from "./area-picker";

type Area = { id: string; name: string };

/** Search and browse share one configured area (name + ID), never a free-text area. */
export function QuoteAreaSelect({ areas, value, areaId, onChange, required = false }: {
  areas: Area[]; value: string; areaId?: string; required?: boolean;
  onChange: (name: string, id: string) => void;
}) {
  const { language } = useAppPreferences();
  const en = language === "en";
  const id = useId(), listId = `${id}-list`, hintId = `${id}-hint`;
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const matches = areas.filter(area => normalizeArea(area.name) === normalizeArea(value || ""));
  const selected = areas.find(area => area.id === areaId) || (matches.length === 1 ? matches[0] : undefined);
  const selectionKey = JSON.stringify([areaId || "", value, selected?.name || ""]);
  const lastSelection = useRef(selectionKey);
  const [search, setSearch] = useState(selected?.name || value || "");
  const [mode, setMode] = useState<"search" | "all" | null>(null);
  const [highlight, setHighlight] = useState(-1);
  const terms = normalizeArea(search).split(" ").filter(Boolean);
  const options = mode === "all" ? areas : areas.filter(area => terms.every(term => normalizeArea(area.name).includes(term)));

  useEffect(() => {
    if (lastSelection.current !== selectionKey) {
      lastSelection.current = selectionKey;
      setSearch(selected?.name || value || "");
      setHighlight(-1);
    }
  }, [selectionKey, selected?.name, value]);
  useEffect(() => {
    input.current?.setCustomValidity(search.trim() && !selected
      ? (en ? "Select a configured area from the list." : "Seleccione un área configurada del listado.") : "");
  }, [search, selected, en]);
  useEffect(() => {
    if (mode && highlight >= 0) document.getElementById(`${listId}-${highlight}`)?.scrollIntoView({ block: "nearest" });
  }, [mode, highlight, listId]);
  useEffect(() => {
    if (!mode) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMode(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [mode]);

  function choose(area: Area) {
    lastSelection.current = JSON.stringify([area.id, area.name, area.name]);
    setSearch(area.name);
    onChange(area.name, area.id);
    input.current?.focus();
    setMode(null); setHighlight(-1);
  }
  function browse() {
    const close = mode === "all";
    input.current?.focus();
    setMode(close ? null : "all");
    setHighlight(close ? -1 : areas.findIndex(area => area.id === selected?.id));
  }

  return <div ref={root} className="field quoteAreaSelect" translate="no"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMode(null); }}>
    <label htmlFor={id}>{en ? "Area" : "Área"}</label>
    <div className="quoteAreaAnchor">
    <div className="quoteAreaControl">
      <span className="quoteAreaInput">
        <Search size={17} aria-hidden="true" />
        <input ref={input} id={id} type="search" role="combobox" required={required} autoComplete="off"
          value={search} placeholder={en ? "Search areas…" : "Buscar áreas…"}
          aria-autocomplete="list" aria-expanded={mode !== null} aria-controls={mode ? listId : undefined}
          aria-describedby={hintId}
          aria-activedescendant={mode && highlight >= 0 && options[highlight] ? `${listId}-${highlight}` : undefined}
          onFocus={() => { setMode(current => current || "search"); setHighlight(-1); }}
          onChange={event => {
            const text = event.target.value;
            setSearch(text); setMode("search"); setHighlight(-1);
            const exact = normalizeArea(text) ? areas.filter(area => normalizeArea(area.name) === normalizeArea(text)) : [];
            const area = exact.length === 1 ? exact[0] : undefined;
            lastSelection.current = JSON.stringify([area?.id || "", area?.name || "", area?.name || ""]);
            onChange(area?.name || "", area?.id || "");
          }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" && event.altKey) { event.preventDefault(); browse(); }
            else if (event.key === "ArrowDown") { event.preventDefault(); setMode(current => current || "search"); setHighlight(index => Math.min(index + 1, options.length - 1)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setMode(current => current || "search"); setHighlight(index => Math.max(index - 1, 0)); }
            else if (event.key === "Escape" && mode) { event.preventDefault(); event.stopPropagation(); setMode(null); setHighlight(-1); }
            else if (event.key === "Enter" && mode) {
              event.preventDefault();
              if (highlight >= 0 && options[highlight]) choose(options[highlight]); else setMode(null);
            }
          }} />
      </span>
      <button type="button" className="quoteAreaBrowse" aria-label={en ? "Show all areas" : "Mostrar todas las áreas"}
        title={en ? "Show all areas" : "Mostrar todas las áreas"} aria-haspopup="listbox"
        aria-expanded={mode === "all"} aria-controls={mode ? listId : undefined} onClick={browse}>
        <span>{en ? "All" : "Todas"}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
    </div>
    {mode && <div className="quoteAreaDropdown">
      <div className="quoteAreaListHeading"><span>{mode === "all" ? (en ? "All areas" : "Todas las áreas") : (en ? "Matching areas" : "Áreas coincidentes")}</span><span>{options.length}</span></div>
      <div id={listId} role="listbox" className="quoteAreaOptions" aria-label={en ? "Areas" : "Áreas"}>
        {options.map((area, index) => <button key={area.id} id={`${listId}-${index}`} type="button" role="option"
          tabIndex={-1} aria-selected={selected?.id === area.id} className={highlight === index ? "highlighted" : ""}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(area)}>
          <span>{area.name}</span>{selected?.id === area.id && <Check size={17} aria-hidden="true" />}
        </button>)}
      </div>
      {!options.length && <p role="status">{en ? "No matching areas." : "No hay áreas coincidentes."}</p>}
    </div>}
    </div>
    <small id={hintId}>{en ? "Type to search or open the full list." : "Escriba para buscar o abra la lista completa."}</small>
    {!selected && value && <small>{en ? "Previous area" : "Área anterior"}: {value}. {en ? "Select a configured area." : "Seleccione un área configurada."}</small>}
    {!areas.length && <small>{en ? "Add areas in Settings → Reservations." : "Agregue áreas en Configuración → Reservaciones."}</small>}
  </div>;
}
