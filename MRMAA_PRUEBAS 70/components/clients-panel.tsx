"use client";
import { exportBudget, EXPORT_ROW_LIMIT, PRINT_ROW_LIMIT } from "@/lib/export-limits";
import { useEffect, useState, useId, useRef } from "react";
import { Trash2, Pencil, Printer, FileSpreadsheet, Search } from "lucide-react";
import type { Client } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useDataRefresh } from "@/components/restaurant-sync";
import { useExcelExportAccess } from "@/components/excel-permission";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { userMessage } from "@/lib/user-message";
import { currentAppLanguage, useAppPreferences } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
import { localDateISO } from "@/lib/local-date";
import { printHtml } from "@/lib/print";
import { recordAuditActivity } from "@/lib/audit-activity";
import { ClientImport } from "@/components/client-import";
import { readListPage, useCursorPagination } from "@/lib/cursor-pagination";
import { Pagination } from "@/components/pagination";
export function Clients({
  canEdit = false,
  canDelete = false,
  restaurantId,
  refreshToken = 0,
  rows: initialRows = [],
  edit,
  remove,
  removeMany,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId?: string;
  refreshToken?: number;
  rows?: Client[];
  edit: (c: Client) => void;
  remove: (c: Client) => void;
  removeMany: (ids: string[]) => Promise<void>;
}) {
  const remoteVersion = useDataRefresh(restaurantId, "v2_clients");
  const excelAccess = useExcelExportAccess(restaurantId);
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [rows, setRows] = useState<Client[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const [importVersion, setImportVersion] = useState(0);
  const normalizedSearch = search.trim().replace(/[%(),]/g, " ");
  const querySearch = useListSearch(search, () => {});
  const pager = useCursorPagination(JSON.stringify([restaurantId, querySearch]));
  const { page, setPage } = pager;
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, querySearch, page]) : undefined,
    version: `${refreshToken}:${remoteVersion}:${importVersion}`,
    read: signal => readListPage<Client>(supabase, restaurantId!, "clients", { search: querySearch }, pager.after, signal),
    onData: result => { setRows(result.rows); pager.accept(result); setLoadError(""); },
    onError: error => setLoadError(userMessage(error)),
    onLoading: setLoading,
  });
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = rows.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  async function allMatchingClients(maxRows = EXPORT_ROW_LIMIT) {
    const budget = exportBudget(maxRows);
    const result: Client[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase.from("v2_clients").select("*").eq("restaurant_id", restaurantId).is("deleted_at", null);
      if (normalizedSearch)
        query = query.or(`name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,notes.ilike.%${normalizedSearch}%`);
      const batch = await query.order("name").order("id").range(from, from + 999);
      if (batch.error) throw batch.error;
      budget.add(batch.data || []);
      result.push(...((batch.data || []) as Client[]));
      if ((batch.data || []).length < 1000) return result;
    }
  }
  async function exportClients() {
    try {
      await excelAccess.ensureAllowed();
      const [XLSX, outputRows] = await Promise.all([import("xlsx"), allMatchingClients()]);
      const language = currentAppLanguage();
      const data = outputRows.map((client) => translateRecord({
        Nombre: client.name,
        Telefono: client.phone || "",
        Correo: client.email || "",
        Notas: client.notes || "",
      }, language));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), translate("Clientes", language));
      await excelAccess.ensureAllowed();
      XLSX.writeFile(workbook, `${language === "en" ? "customers" : "clientes"}-${localDateISO()}.xlsx`);
      await recordAuditActivity(restaurantId, "excel_exportado", "clientes", { label: "Listado de clientes", rows: outputRows.length });
    } catch (error) { setLoadError(userMessage(error)); }
  }
  async function printClients() {
    try {
    const outputRows = await allMatchingClients(PRINT_ROW_LIMIT);
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
    printHtml(`<html><head><title>Clientes</title><style>@page{margin:12mm}body{font-family:Arial;color:#18181b}h1{font-family:Georgia;margin-bottom:4px}p{color:#71717a}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:11px;vertical-align:top}th{background:#18181b;color:#fff}</style></head><body><h1>Clientes</h1><p>${outputRows.length} cliente(s)</p><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Notas</th></tr></thead><tbody>${outputRows.map((client) => `<tr><td>${esc(client.name)}</td><td>${esc(client.phone)}</td><td>${esc(client.email)}</td><td>${esc(client.notes)}</td></tr>`).join("")}</tbody></table></body></html>`);
    await recordAuditActivity(restaurantId, "impresion", "clientes", { label: "Listado de clientes", rows: outputRows.length });
    } catch (error) { setLoadError(userMessage(error)); }
  }
  return (
    <div className="moduleStack">
      {canEdit && restaurantId && <ClientImport restaurantId={restaurantId} onImported={() => setImportVersion(value => value + 1)}/>}
      <div className="listToolbar">
        <input className="moduleSearch moduleCard" placeholder="Buscar cliente, teléfono o correo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
        {canDelete && selected.length > 0 && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionados ({selected.length})</button>}
        <button type="button" className="secondary" disabled={!excelAccess.allowed} title={excelAccess.allowed ? undefined : excelAccess.hint} onClick={exportClients}><FileSpreadsheet /> Descargar Excel</button>
        <button type="button" className="secondary" onClick={printClients}><Printer /> Imprimir</button>
      </div>
      {loadError && <p className="moduleNotice">{userMessage(loadError)}</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="cards">
          {rows.map((c) => (
            <article key={c.id} className={selected.includes(c.id) ? "selectedRecord" : ""}>
              {canDelete ? (<input className="recordCheckbox" type="checkbox" aria-label={`Seleccionar ${c.name}`} checked={selected.includes(c.id)} onChange={() => setSelected((ids) => ids.includes(c.id) ? ids.filter((id) => id !== c.id) : [...ids, c.id])} />) : null}
              <div>
                <h3>{c.name}</h3>
                <p>
                  {c.phone || "Sin teléfono"} · {c.email || "Sin email"}
                </p>
                {c.notes && <small>{c.notes}</small>}
              </div>
              <div className="rowActions">
                {canEdit && <button title="Editar cliente" onClick={() => edit(c)}>
                  <Pencil /> Editar
                </button>}
                {canDelete && <button title="Enviar a la papelera" onClick={() => remove(c)}>
                  <Trash2 /> Papelera
                </button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">Todavía no hay clientes.</div>
      )}
      <Pagination total={total} page={page} onPage={setPage} hasNext={pager.hasNext} shown={rows.length} loading={loading} />
    </div>
  );
}
export type ClientSuggestion = Pick<Client, "id" | "name" | "phone" | "email">;

export async function readClientSuggestions(client: SupabaseClient, restaurantId: string, value: string, signal: AbortSignal): Promise<ClientSuggestion[]> {
  signal.throwIfAborted();
  const term = value.trim().slice(0, 200);
  if (!restaurantId || term.length < 2) return [];
  const pattern = JSON.stringify(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
  const response = await client.from("v2_clients").select("id,name,phone,email")
    .eq("restaurant_id", restaurantId).is("deleted_at", null)
    .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    .order("name").order("id").limit(20).abortSignal(signal);
  signal.throwIfAborted();
  if (response.error) throw response.error;
  return (response.data || []) as ClientSuggestion[];
}

/** A single controlled name field: choosing a suggestion links its ID; typing is a draft. */
export function ClientSearchSelect({ restaurantId, value, selectedId, onType, onSelect }: {
  restaurantId: string;
  value: string;
  selectedId: string;
  onType: (name: string) => void;
  onSelect: (client: ClientSuggestion) => void;
}) {
  const { language } = useAppPreferences();
  const en = language === "en";
  const inputId = useId(), listId = `${inputId}-matches`, hintId = `${inputId}-hint`;
  const input = useRef<HTMLInputElement>(null);
  const remoteVersion = useDataRefresh(restaurantId, "v2_clients");
  const [open, setOpen] = useState(false), [highlight, setHighlight] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; clients: ClientSuggestion[]; failed: boolean } | null>(null);
  const term = value.trim();
  const searchKey = JSON.stringify([restaurantId, term, remoteVersion, retry]);
  const canSearch = Boolean(restaurantId && term.length >= 2);
  // A previous query's results never remain selectable while a new query is pending.
  const current = result?.key === searchKey ? result : null;
  const clients = canSearch ? current?.clients || [] : [];
  const loading = open && canSearch && !current;
  useEffect(() => {
    setHighlight(-1);
    if (!open || !canSearch) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const clients = await readClientSuggestions(supabase, restaurantId, term, controller.signal);
        if (!controller.signal.aborted) setResult({ key: searchKey, clients, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ key: searchKey, clients: [], failed: true });
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, canSearch, term, restaurantId, searchKey]);
  useEffect(() => {
    if (open && highlight >= 0) document.getElementById(`${listId}-${highlight}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlight, listId]);
  function choose(client: ClientSuggestion) {
    onSelect(client); setOpen(false); setHighlight(-1); input.current?.focus();
  }
  return <div className="field clientNameSearch" translate="no">
    <label htmlFor={inputId}>{en ? "Customer name" : "Nombre del cliente"}</label>
    <span className="quoteProductInput">
      <Search size={16} aria-hidden="true" />
      <input ref={input} id={inputId} required maxLength={200} type="text" role="combobox"
        aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-describedby={hintId}
        aria-activedescendant={open && highlight >= 0 && clients[highlight] ? `${listId}-${highlight}` : undefined}
        placeholder={en ? "Type a name or search customers…" : "Escriba un nombre o busque clientes…"}
        autoComplete="off" value={value}
        onFocus={() => { setOpen(true); setHighlight(-1); }} onBlur={() => setOpen(false)}
        onChange={event => { onType(event.target.value); setOpen(true); setHighlight(-1); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setHighlight(index => Math.min(index + 1, clients.length - 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setHighlight(index => Math.max(index - 1, 0)); }
          else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          else if (event.key === "Enter" && open) {
            event.preventDefault();
            // Never silently choose the first person, especially when names are repeated.
            if (highlight >= 0 && clients[highlight]) choose(clients[highlight]); else setOpen(false);
          }
        }} />
    </span>
    {open && <div className="clientNameSuggestions">
      <div id={listId} role="listbox" className="quoteProductMatches" aria-busy={loading}
        aria-label={en ? "Matching customers" : "Clientes coincidentes"}>
        {clients.map((client, index) => <button key={client.id} id={`${listId}-${index}`} type="button"
          role="option" tabIndex={-1} aria-selected={selectedId === client.id}
          className={highlight === index ? "highlighted" : ""}
          onPointerDown={event => event.preventDefault()} onClick={() => choose(client)}>
          <span>{client.name}</span>
          <small>{[client.phone, client.email].filter(Boolean).join(" · ") || (en ? "No contact details" : "Sin datos de contacto")}</small>
        </button>)}
      </div>
      {!canSearch && <small role="status">{en ? "Type at least 2 characters to search by name, phone or email." : "Escriba al menos 2 caracteres para buscar por nombre, teléfono o correo."}</small>}
      {loading && <small role="status">{en ? "Searching customers…" : "Buscando clientes…"}</small>}
      {current?.failed && <div role="alert"><small>{en ? "Customer search is unavailable. Your draft is preserved." : "No se pudo buscar clientes. Su borrador se conserva."}</small>
        <button type="button" className="secondary" onPointerDown={event => event.preventDefault()}
          onClick={() => { setResult(null); setRetry(number => number + 1); input.current?.focus(); }}>{en ? "Retry" : "Reintentar"}</button></div>}
      {canSearch && current && !current.failed && !clients.length && <small role="status">{en ? "No matches. You can enter a new customer's name." : "Sin coincidencias. Puede escribir el nombre de un cliente nuevo."}</small>}
      {clients.length === 20 && <small>{en ? "Showing up to 20 matches. Keep typing to narrow your search." : "Se muestran hasta 20 coincidencias. Siga escribiendo para precisar la búsqueda."}</small>}
    </div>}
    <small id={hintId}>{selectedId
      ? (en ? "Saved customer selected. Check the contact details." : "Cliente guardado seleccionado. Revise los datos de contacto.")
      : (en ? "Enter a new name or choose a saved customer." : "Escriba un nombre nuevo o elija un cliente guardado.")}</small>
  </div>;
}
