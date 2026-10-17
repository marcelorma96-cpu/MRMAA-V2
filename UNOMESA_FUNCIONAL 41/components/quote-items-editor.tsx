"use client";

import { useId, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useAppPreferences } from "./app-preferences";
import { numberValue } from "@/lib/calculations";
import type { QuoteItem } from "@/lib/types";

type Product = { id: string; name: string; description?: string | null; price: number | string };
type UpdateItems = (update: (items: QuoteItem[]) => QuoteItem[]) => void;
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export const newQuoteItem = (): QuoteItem => ({
  id: crypto.randomUUID(), name: "", description: "", quantity: 1, unit_price: 0,
});

function ProductSearch({ value, products, line, onType, onSelect }: {
  value: string; products: Product[]; line: number;
  onType: (name: string) => void; onSelect: (product: Product) => void;
}) {
  const { language, money } = useAppPreferences();
  const en = language === "en";
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const terms = normalize(value).split(/\s+/).filter(Boolean);
  const matches = products.filter(product => {
    const text = normalize(`${product.name} ${product.description || ""}`);
    return terms.every(term => text.includes(term));
  }).slice(0, 10);
  function select(product: Product) {
    onSelect(product); setOpen(false); setHighlight(-1);
  }
  return <div className="quoteProductSearch">
    <span className="quoteProductInput">
      <Search size={16} aria-hidden="true" />
      <input required role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && highlight >= 0 && matches[highlight] ? `${listId}-${highlight}` : undefined}
        aria-label={`${en ? "Product or service" : "Producto o servicio"} ${line}`}
        placeholder={en ? "Search or type a product…" : "Buscar o escribir producto…"}
        autoComplete="off" value={value}
        onFocus={() => { setOpen(true); setHighlight(-1); }}
        onBlur={() => setOpen(false)}
        onChange={event => { onType(event.target.value); setOpen(true); setHighlight(-1); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown") {
            event.preventDefault(); setOpen(true); setHighlight(index => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true); setHighlight(index => Math.max(index - 1, 0));
          } else if (event.key === "Escape" && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const match = matches[highlight >= 0 ? highlight : 0];
            if (match) select(match); else setOpen(false);
          }
        }} />
    </span>
    {open && <div id={listId} role="listbox" className="quoteProductMatches"
      aria-label={en ? "Matching products" : "Productos coincidentes"}>
      {matches.map((product, index) => <button key={product.id} id={`${listId}-${index}`}
        type="button" role="option" tabIndex={-1} aria-selected={highlight === index}
        className={highlight === index ? "highlighted" : ""}
        onPointerDown={event => event.preventDefault()} onClick={() => select(product)}>
        <span translate="no">{product.name}</span>
        <small translate="no">{money(numberValue(product.price))}{product.description ? ` · ${product.description}` : ""}</small>
      </button>)}
      {!matches.length && <small role="status">{en ? "No matches. You can enter a custom product." : "Sin coincidencias. Puede escribir un producto personalizado."}</small>}
    </div>}
  </div>;
}

export function QuoteItemsEditor({ items, products, onChange }: {
  items: QuoteItem[]; products: Product[]; onChange: UpdateItems;
}) {
  const { language, money } = useAppPreferences();
  const en = language === "en";
  function patch(index: number, values: Partial<QuoteItem>) {
    onChange(current => current.map((item, position) => position === index ? { ...item, ...values } : item));
  }
  return <section className="quoteItemsEditor" aria-label={en ? "Quote products" : "Productos de la cotización"}>
    <p className="quoteItemsHint">{en ? "Type in Product to search your menus and products, or enter a custom item." : "Escriba en Producto para buscar sus menús y productos, o agregue uno personalizado."}</p>
    <div className="quoteEditorHead" aria-hidden="true">
      <span>{en ? "Product or service" : "Producto o servicio"}</span>
      <span>{en ? "Description" : "Descripción"}</span>
      <span>{en ? "Quantity" : "Cantidad"}</span>
      <span>{en ? "Price" : "Precio"}</span>
      <span>Total</span><span />
    </div>
    {items.map((item, index) => <div className="quoteEditorRow" key={item.id || index}>
      <div className="quoteEditorProduct"><span className="quoteEditorMobileLabel">{en ? "Product or service" : "Producto o servicio"}</span>
        <ProductSearch value={item.name} products={products} line={index + 1}
          onType={name => patch(index, { name })}
          onSelect={product => patch(index, { name: product.name, description: product.description || "", unit_price: numberValue(product.price) })} />
      </div>
      <label className="quoteEditorDescription"><span className="quoteEditorMobileLabel">{en ? "Description" : "Descripción"}</span>
        <textarea rows={3} aria-label={`${en ? "Description" : "Descripción"} ${index + 1}`} value={item.description}
          onChange={event => patch(index, { description: event.target.value })} />
      </label>
      <label><span className="quoteEditorMobileLabel">{en ? "Quantity" : "Cantidad"}</span>
        <input type="number" min="0" step="0.01" aria-label={`${en ? "Quantity" : "Cantidad"} ${index + 1}`} value={item.quantity}
          onChange={event => patch(index, { quantity: event.target.value === "" ? "" as unknown as number : numberValue(event.target.value) })} />
      </label>
      <label><span className="quoteEditorMobileLabel">{en ? "Price" : "Precio"}</span>
        <input type="number" min="0" step="0.01" aria-label={`${en ? "Price" : "Precio"} ${index + 1}`} value={item.unit_price}
          onChange={event => patch(index, { unit_price: event.target.value === "" ? "" as unknown as number : numberValue(event.target.value) })} />
      </label>
      <strong className="quoteEditorTotal"><span className="quoteEditorMobileLabel">Total</span>{money(numberValue(item.quantity) * numberValue(item.unit_price))}</strong>
      <button type="button" className="quoteEditorDelete" aria-label={`${en ? "Remove line" : "Eliminar línea"} ${index + 1}`}
        onClick={() => onChange(current => current.filter((_, position) => position !== index))}>
        <Trash2 size={16} aria-hidden="true" /><span>{en ? "Remove" : "Eliminar"}</span>
      </button>
    </div>)}
    {!items.length && <p className="quoteItemsEmpty" role="status">{en ? "No lines. Add a line to continue." : "Sin líneas. Agregue una línea para continuar."}</p>}
    <button type="button" className="secondary quoteEditorAdd" onClick={() => onChange(current => [...current, newQuoteItem()])}>
      <Plus size={18} aria-hidden="true" />{en ? "Add line" : "Agregar línea"}
    </button>
  </section>;
}
