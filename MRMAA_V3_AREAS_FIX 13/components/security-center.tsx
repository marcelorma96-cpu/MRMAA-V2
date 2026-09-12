"use client";
import { confirmApp } from "@/components/app-preferences";

import { userMessage } from "@/lib/user-message";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  History,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { currentAppLanguage, appLocale } from "@/components/app-preferences";
import { Pagination, pageItems } from "@/components/pagination";
import { recordAuditActivity } from "@/lib/audit-activity";

type RecycleEntity = "clientes" | "cotizaciones" | "reservaciones";
type DeletedRow = {
  id: string;
  entity: RecycleEntity;
  label: string;
  detail: string;
  deleted_at: string;
};
type AuditRow = {
  id: number;
  table_name: string;
  action: string;
  changed_by: string | null;
  actor_name: string | null;
  actor_role: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};
type MemberIdentity = { user_id: string; name: string; email: string; role: string };

const roleLabel = (role?: string | null) =>
  ({
    administrador: "Administrador",
    admin: "Administrador",
    gerente: "Gerente",
    operacion: "Operación",
    operador: "Operación",
    lectura: "Solo lectura",
  })[String(role || "").toLowerCase()] || "Usuario";

const tableLabels: Record<string, string> = {
  v2_clients: "Cliente",
  v2_quotes: "Cotización",
  v2_reservations: "Reservación",
  clientes: "Clientes",
  reservaciones: "Reservaciones",
  horarios: "Horarios",
  reportes: "Reportes",
  respaldo: "Respaldo completo",
};

const actionLabels: Record<string, string> = {
  excel_exportado: "Excel descargado",
  impresion: "Impresión",
};

export function SecurityCenter({ restaurantId, exportOnly = false }: { restaurantId: string; exportOnly?: boolean }) {
  const [deleted, setDeleted] = useState<DeletedRow[]>([]),
    [audit, setAudit] = useState<AuditRow[]>([]),
    [identities, setIdentities] = useState<Record<string, { name: string; role: string }>>({}),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [auditPage, setAuditPage] = useState(1),
    [deletedPage, setDeletedPage] = useState(1),
    [deletedSearch, setDeletedSearch] = useState(""),
    [isAdmin, setIsAdmin] = useState(false);

  const filteredDeleted = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const query = normalize(deletedSearch.trim());
    return deleted.filter(row => normalize(`${row.label} ${row.detail} ${row.entity}`).includes(query));
  }, [deleted, deletedSearch]);
  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const [member, clients, quotes, reservations, history, members] = await Promise.all([
      supabase
        .from("v2_members")
        .select("role")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      supabase
        .from("v2_clients")
        .select("id,name,phone,deleted_at")
        .eq("restaurant_id", restaurantId)
        .not("deleted_at", "is", null),
      supabase
        .from("v2_quotes")
        .select("id,quote_number,client_name,event_date,deleted_at")
        .eq("restaurant_id", restaurantId)
        .not("deleted_at", "is", null),
      supabase
        .from("v2_reservations")
        .select("id,client_name,event_date,event_time,deleted_at")
        .eq("restaurant_id", restaurantId)
        .not("deleted_at", "is", null),
      supabase
        .from("v2_audit_log")
        .select("id,table_name,action,changed_by,actor_name,actor_role,changed_at,old_data,new_data")
        .eq("restaurant_id", restaurantId)
        .order("changed_at", { ascending: false })
        .limit(200),
      supabase.from("v2_members").select("user_id,name,email,role").eq("restaurant_id", restaurantId),
    ]);
    const role = member.data?.role || "";
    setIsAdmin(role === "administrador" || role === "admin");
    const rows: DeletedRow[] = [
      ...(clients.data || []).map((x: any) => ({
        id: x.id,
        entity: "clientes" as const,
        label: x.name,
        detail: x.phone || "Cliente",
        deleted_at: x.deleted_at,
      })),
      ...(quotes.data || []).map((x: any) => ({
        id: x.id,
        entity: "cotizaciones" as const,
        label: `Cotización #${x.quote_number}`,
        detail: `${x.client_name} · ${x.event_date}`,
        deleted_at: x.deleted_at,
      })),
      ...(reservations.data || []).map((x: any) => ({
        id: x.id,
        entity: "reservaciones" as const,
        label: x.client_name,
        detail: `${x.event_date} · ${x.event_time?.slice(0, 5) || ""}`,
        deleted_at: x.deleted_at,
      })),
    ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    setDeleted(rows);
    setAudit((history.data || []) as AuditRow[]);
    setIdentities(Object.fromEntries(((members.data || []) as MemberIdentity[]).map((x) => [x.user_id, { name: x.name || x.email || x.user_id, role: x.role }])));
    const error =
      clients.error || quotes.error || reservations.error || history.error;
    if (error) setNotice(error.message);
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function restore(row: DeletedRow) {
    setBusy(true);
    const { error } = await supabase.rpc("v2_restore_record", {
      entity: row.entity,
      target_id: row.id,
    });
    setBusy(false);
    setNotice(error ? error.message : `${row.label} fue restaurado.`);
    if (!error) load();
  }

  async function purge(row: DeletedRow) {
    if (
      !confirmApp(
        `¿Eliminar definitivamente ${row.label}? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase.rpc("v2_purge_record", {
      entity: row.entity,
      target_id: row.id,
    });
    setBusy(false);
    setNotice(
      error ? error.message : `${row.label} fue eliminado definitivamente.`,
    );
    if (!error) load();
  }

  async function fetchAll(
    table: string,
    filterField: string | null = "restaurant_id",
    quoteIds: string[] = [],
  ) {
    const all: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase
        .from(table)
        .select("*")
        .range(from, from + 999);
      if (filterField) query = query.eq(filterField, restaurantId);
      else query = query.in("quote_id", quoteIds);
      query = query.order(table === "v2_members" ? "user_id" : "id");
      const { data, error } = await query;
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return all;
  }

  async function exportBackup(format: "xlsx" | "json") {
    setBusy(true);
    setNotice("Preparando respaldo completo…");
    try {
      const tables: Array<[string, string | null]> = [
        ["v2_restaurants", "id"],
        ["v2_members", "restaurant_id"],
        ["v2_clients", "restaurant_id"],
        ["v2_quotes", "restaurant_id"],
        ["v2_reservations", "restaurant_id"],
        ["v2_areas", "restaurant_id"],
        ["v2_reservation_areas", "restaurant_id"],
        ["v2_employees", "restaurant_id"],
        ["v2_shifts", "restaurant_id"],
        ["v2_schedules", "restaurant_id"],
        ["v2_quote_products", "restaurant_id"],
        ["v2_audit_log", "restaurant_id"],
      ];
      const entries = await Promise.all(
        tables.map(async ([table, filterField]) => [
          table,
          await fetchAll(table, filterField),
        ]),
      );
      const data = Object.fromEntries(entries);
      const quoteIds = (data.v2_quotes as { id: string }[]).map(row => row.id);
      data.v2_quote_items = [];
      for (let index = 0; index < quoteIds.length; index += 200) {
        data.v2_quote_items.push(...await fetchAll("v2_quote_items", null, quoteIds.slice(index, index + 200)));
      }
      if (format === "xlsx") {
        const { downloadBackupExcel } = await import("@/lib/backup-excel");
        downloadBackupExcel(data, currentAppLanguage() === "en");
        await recordAuditActivity(restaurantId, "excel_exportado", "respaldo", { label: "Respaldo completo", format: "xlsx" });
        setNotice("Respaldo descargado. Guárdelo también fuera de esta computadora.");
        load();
        return;
      }
      const
        payload = JSON.stringify(data),
        digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(payload),
        ),
        checksum = Array.from(new Uint8Array(digest))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join(""),
        backup = JSON.stringify(
          {
            manifest: {
              product: "MRMAA",
              format_version: 1,
              restaurant_id: restaurantId,
              exported_at: new Date().toISOString(),
              payload_sha256: checksum,
            },
            data,
          },
          null,
          2,
        ),
        url = URL.createObjectURL(
          new Blob([backup], { type: "application/json" }),
        ),
        link = document.createElement("a"),
        date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `MRMAA-respaldo-${date}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(
        "Respaldo descargado. Guárdelo también fuera de esta computadora.",
      );
    } catch (error: any) {
      setNotice(error.message || "No se pudo generar el respaldo.");
    } finally { setBusy(false); }
  }

  const auditRows = useMemo(
    () =>
      audit.map((row) => {
        const values = row.new_data || row.old_data || {};
        return {
          ...row,
          label:
            String(values.label || values.client_name || values.name || "") ||
            (values.quote_number
              ? `#${values.quote_number}`
              : String(values.id || "Registro")),
        };
      }),
    [audit],
  );

  if (!isAdmin)
    return (
      <section className="moduleCard securityEmpty">
        <ShieldCheck />
        <h2>Centro de seguridad</h2>
        <p>
          Solo el administrador puede consultar respaldos, papelera e historial.
        </p>
        {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      </section>
    );

  return (
    <div className="moduleStack securityCenter">
      <section className="moduleCard securityHero">
        <div>
          <span className="eyebrow">Protección de información</span>
          <h2>Centro de seguridad</h2>
          <p>Respalde la información y recupere eliminaciones accidentales.</p>
        </div>
        <div className="rowActions">
          <button className="primary" disabled={busy} onClick={() => exportBackup("xlsx")}>
            <Download /> Descargar respaldo Excel
          </button>
          <button className="secondary" disabled={busy} onClick={() => exportBackup("json")}>
            <Download /> Respaldo técnico JSON
          </button>
        </div>
      </section>
      {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      {exportOnly && (
        <section className="moduleCard securityEmpty">
          <p>El acceso operativo está restringido. La descarga del respaldo continúa disponible durante el periodo de exportación.</p>
        </section>
      )}
      {!exportOnly && <>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Papelera</h2>
            <p>
              Los registros permanecen restaurables durante 365 días. Después
              de ese plazo, solo un administrador puede eliminarlos definitivamente.
            </p>
          </div>
          <span className="securityCount">{filteredDeleted.length}</span>
        </div>
        <input type="search" aria-label="Buscar en la papelera" placeholder="Buscar por cliente, número, fecha o tipo…" value={deletedSearch} onChange={event => { setDeletedSearch(event.target.value); setDeletedPage(1); }} />
        <div className="compactList">
          {filteredDeleted.length ? (
            pageItems(filteredDeleted, deletedPage).map((row) => {
              const days = Math.floor(
                  (Date.now() - new Date(row.deleted_at).getTime()) / 86400000,
                ),
                canPurge = days >= 365;
              return (
                <article key={`${row.entity}-${row.id}`}>
                  <div>
                    <b>{row.label}</b>
                    <small>
                      {row.detail} · En papelera hace {days} día(s)
                    </small>
                  </div>
                  <div className="rowActions">
                    <button disabled={busy} onClick={() => restore(row)}>
                      <RotateCcw /> Restaurar
                    </button>
                    <button
                      disabled={busy || !canPurge}
                      title={
                        canPurge
                          ? "Eliminar definitivamente"
                          : "Disponible después de 365 días"
                      }
                      onClick={() => purge(row)}
                    >
                      <Trash2 /> Eliminar
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty">{deletedSearch ? "No hay resultados para esta búsqueda." : "La papelera está vacía."}</div>
          )}
        </div>
        <Pagination total={filteredDeleted.length} page={deletedPage} onPage={setDeletedPage} />
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Historial reciente</h2>
            <p>Últimos 200 cambios registrados por la base de datos.</p>
          </div>
          <History />
        </div>
        <div className="auditTable">
          {pageItems(auditRows, auditPage).map((row) => (
            <article key={row.id}>
              <div>
                <b>{tableLabels[row.table_name] || row.table_name}</b>
                <span>{row.label}</span>
              </div>
              <span className="status">{actionLabels[row.action] || row.action.replaceAll("_", " ")}</span>
              <small>
                {row.changed_by
                  ? `${roleLabel(row.actor_role || identities[row.changed_by]?.role)} — ${row.actor_name || identities[row.changed_by]?.name || "Usuario anterior"}`
                  : "Sistema"} · {new Date(row.changed_at).toLocaleString(appLocale())}
              </small>
            </article>
          ))}
          {!auditRows.length && (
            <div className="empty">
              El historial comenzará después de ejecutar la actualización SQL.
            </div>
          )}
        </div>
        <Pagination total={auditRows.length} page={auditPage} onPage={setAuditPage} />
      </section>
      </>}
    </div>
  );
}
