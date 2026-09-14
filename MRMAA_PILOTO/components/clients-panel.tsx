"use client";
import { useEffect, useState, useId } from "react";
import { Trash2, Pencil, Printer, FileSpreadsheet } from "lucide-react";
import type { Client } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useDataRefresh } from "@/components/restaurant-sync";
import { useExcelExportAccess } from "@/components/excel-permission";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { userMessage } from "@/lib/user-message";
import { currentAppLanguage } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
import { localDateISO } from "@/lib/local-date";
import { printHtml } from "@/lib/print";
import { recordAuditActivity } from "@/lib/audit-activity";
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
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [rows, setRows] = useState<Client[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const normalizedSearch = search.trim().replace(/[%(),]/g, " ");
  const querySearch = useListSearch(search, () => setPage(1));
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, querySearch, page]) : undefined,
    version: `${refreshToken}:${remoteVersion}`,
    read: async signal => {
      const from = (page - 1) * 50;
      let query = supabase.from("v2_clients").select("*", { count: "exact" })
        .eq("restaurant_id", restaurantId).is("deleted_at", null);
      if (querySearch)
        query = query.or(`name.ilike.%${querySearch}%,phone.ilike.%${querySearch}%,email.ilike.%${querySearch}%,notes.ilike.%${querySearch}%`);
      const result = await query.order("name").range(from, from + 49).abortSignal(signal);
      if (result.error) throw result.error;
      return result;
    },
    onData: result => { setRows((result.data || []) as Client[]); setTotal(result.count || 0); setLoadError(""); },
    onError: error => setLoadError(userMessage(error)),
    onLoading: setLoading,
  });
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = rows.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  async function allMatchingClients() {
    const result: Client[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase.from("v2_clients").select("*").eq("restaurant_id", restaurantId).is("deleted_at", null);
      if (normalizedSearch)
        query = query.or(`name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,notes.ilike.%${normalizedSearch}%`);
      const batch = await query.order("name").range(from, from + 999);
      if (batch.error) throw batch.error;
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
    const outputRows = await allMatchingClients();
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
    printHtml(`<html><head><title>Clientes</title><style>@page{margin:12mm}body{font-family:Arial;color:#18181b}h1{font-family:Georgia;margin-bottom:4px}p{color:#71717a}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:11px;vertical-align:top}th{background:#18181b;color:#fff}</style></head><body><h1>Clientes</h1><p>${outputRows.length} cliente(s)</p><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Notas</th></tr></thead><tbody>${outputRows.map((client) => `<tr><td>${esc(client.name)}</td><td>${esc(client.phone)}</td><td>${esc(client.email)}</td><td>${esc(client.notes)}</td></tr>`).join("")}</tbody></table></body></html>`);
    await recordAuditActivity(restaurantId, "impresion", "clientes", { label: "Listado de clientes", rows: outputRows.length });
  }
  return (
    <div className="moduleStack">
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
      <Pagination total={total} page={page} onPage={setPage} />
    </div>
  );
}
export function ClientSearchSelect({
  restaurantId,
  value,
  initialLabel,
  onSelect,
}: {
  restaurantId: string;
  value: string;
  initialLabel?: string;
  onSelect: (client: Client | null) => void;
}) {
  const listId = useId();
  const label = (client: Client) =>
    [client.name, client.phone, client.email].filter(Boolean).join(" · ");
  const remoteVersion = useDataRefresh(restaurantId, "v2_clients");
  const [query, setQuery] = useState(initialLabel || "");
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);
  useEffect(() => {
    const term = query.trim().replace(/[%(),]/g, " ");
    if (term.length < 2) return setClients([]);
    const timer = window.setTimeout(async () => {
      const result = await supabase.from("v2_clients").select("id,restaurant_id,name,phone,email,notes")
        .eq("restaurant_id", restaurantId).is("deleted_at", null)
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
        .order("name").limit(20);
      setClients((result.data || []) as Client[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, restaurantId, remoteVersion]);
  return (
    <>
      <input
        type="search"
        list={listId}
        placeholder="Buscar nombre, teléfono o correo…"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          const normalized = next.trim().toLowerCase();
          const match = clients.find((client) =>
            label(client).toLowerCase() === normalized,
          );
          if (match) onSelect(match);
          else if (!next) onSelect(null);
        }}
      />
      <datalist id={listId}>
        {clients.map((client) => (
          <option key={client.id} value={label(client)} />
        ))}
      </datalist>
    </>
  );
}

