"use client";
import { useListSearch } from "@/lib/list-search";
import { exportBudget } from "@/lib/export-limits";
import { useDataRefresh, useOnDataRefresh } from "@/components/restaurant-sync";

import { confirmApp } from "@/components/app-preferences";

import { userMessage } from "@/lib/user-message";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  History,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { requirePermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { currentAppLanguage, appLocale, useAppPreferences } from "@/components/app-preferences";
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
    soporte: "Soporte",
  })[String(role || "").toLowerCase()] || "Usuario";

const tableLabels: Record<string, string> = {
  v2_support_grants: "Acceso de soporte",
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
  soporte_autorizado: "Soporte autorizado", soporte_revocado: "Soporte revocado",
  soporte_ingreso: "Ingreso de soporte", soporte_insert: "Creado por soporte",
  soporte_update: "Modificado por soporte", soporte_delete: "Eliminado por soporte",
};

export function SecurityCenter({ restaurantId, exportOnly = false }: { restaurantId: string; exportOnly?: boolean }) {
  const remoteVersion = useDataRefresh(restaurantId, "v2_audit_log,v2_clients,v2_quotes,v2_reservations,v2_members,v2_restaurants");
  const loadGeneration = useRef(0);
  const [deleted, setDeleted] = useState<DeletedRow[]>([]),
    [audit, setAudit] = useState<AuditRow[]>([]),
    [identities, setIdentities] = useState<Record<string, { name: string; role: string }>>({}),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [auditPage, setAuditPage] = useState(1),
    [deletedPage, setDeletedPage] = useState(1),
    [deletedTotal, setDeletedTotal] = useState(0),
    [deletedSearch, setDeletedSearch] = useState(""),
    [isAdmin, setIsAdmin] = useState(false);

  const querySearch = useListSearch(deletedSearch, () => setDeletedPage(1));
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const [member, trash, history, members] = await Promise.all([
      supabase
        .from("v2_members")
        .select("role")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      supabase.rpc("v2_trash_page", { p_restaurant: restaurantId, p_search: querySearch, p_offset: (deletedPage - 1) * 50, p_limit: 50 }),
      supabase
        .from("v2_audit_log")
        .select("id,table_name,action,changed_by,actor_name,actor_role,changed_at,old_data,new_data")
        .eq("restaurant_id", restaurantId)
        .order("changed_at", { ascending: false })
        .limit(200),
      supabase.from("v2_members").select("user_id,name,email,role").eq("restaurant_id", restaurantId),
    ]);
    if (generation !== loadGeneration.current) return;
    const failure = member.error || trash.error || history.error || members.error;
    if (failure) throw failure;
    const role = member.data?.role || "";
    setIsAdmin(role === "administrador" || role === "admin");
    const rows = (trash.data || []) as { row_data: DeletedRow; total_count: number }[];
    setDeleted(rows.map(value => value.row_data));
    setDeletedTotal(Number(rows[0]?.total_count || 0));
    if (!rows.length && deletedPage > 1) setDeletedPage(deletedPage - 1);
    setAudit((history.data || []) as AuditRow[]);
    setIdentities(Object.fromEntries(((members.data || []) as MemberIdentity[]).map((x) => [x.user_id, { name: x.name || x.email || x.user_id, role: x.role }])));
    } catch (error) { if (generation === loadGeneration.current) setNotice(userMessage(error)); }
  }, [restaurantId, querySearch, deletedPage]);
  useEffect(() => () => { loadGeneration.current++; }, [load]);
  useOnDataRefresh(remoteVersion, () => { void load(); });

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
    setNotice(error ? userMessage(error) : `${row.label} fue restaurado.`);
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
      error ? userMessage(error) : `${row.label} fue eliminado definitivamente.`,
    );
    if (!error) load();
  }

  async function fetchAll(
    table: string,
    filterField: string | null = "restaurant_id",
    quoteIds: string[] = [],
    budget = exportBudget(),
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
      budget.add(data || []);
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return all;
  }

  async function exportBackup(format: "xlsx" | "json") {
    setBusy(true);
    setNotice("Preparando respaldo completo…");
    try {
      await requirePermission(supabase, restaurantId, "isAdmin");
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
      const budget = exportBudget();
      const data: Record<string, unknown[]> = {};
      for (const [table, filterField] of tables) {
        data[table] = await fetchAll(table, filterField, [], budget);
      }
      const quoteIds = (data.v2_quotes as { id: string }[]).map(row => row.id);
      data.v2_quote_items = [];
      for (let index = 0; index < quoteIds.length; index += 200) {
        data.v2_quote_items.push(...await fetchAll("v2_quote_items", null, quoteIds.slice(index, index + 200), budget));
      }
      if (format === "xlsx") {
        const { downloadBackupExcel } = await import("@/lib/backup-excel");
        await requirePermission(supabase, restaurantId, "isAdmin");
        downloadBackupExcel(data, currentAppLanguage() === "en");
        await recordAuditActivity(restaurantId, "excel_exportado", "respaldo", { label: "Respaldo completo", format: "xlsx" });
        setNotice("Respaldo descargado. Guárdelo también fuera de esta computadora.");
        load();
        return;
      }
      await requirePermission(supabase, restaurantId, "isAdmin");
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
      setNotice(userMessage(error, "No se pudo generar el respaldo."));
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
      <SessionManager restaurantId={restaurantId} />
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
          <span className="securityCount">{deletedTotal}</span>
        </div>
        <input type="search" aria-label="Buscar en la papelera" placeholder="Buscar por cliente, número, fecha o tipo…" value={deletedSearch} onChange={event => { setDeletedSearch(event.target.value); setDeletedPage(1); }} />
        <div className="compactList">
          {deleted.length ? (
            deleted.map((row) => {
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
        <Pagination total={deletedTotal} page={deletedPage} onPage={setDeletedPage} />
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

// Independently available to every role. Database RPCs enforce ownership.
type ActiveSession = { id:string; user_id:string; name:string; email:string; device:string; created_at:string; last_seen_at:string; current:boolean };
export function SessionManager({restaurantId}:{restaurantId?:string}) {
 const {language}=useAppPreferences(),en=language==='en';
 const [team,setTeam]=useState(false),[owner,setOwner]=useState(false),[search,setSearch]=useState('');
 const [rows,setRows]=useState<ActiveSession[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const generation=useRef(0),lock=useRef(false);
 const [after,setAfter]=useState<string|null>(null),[back,setBack]=useState<(string|null)[]>([]);
 const term=useListSearch(search,()=>{setAfter(null);setBack([]);});
 const reset=()=>{setAfter(null);setBack([]);};
 useEffect(()=>{let alive=true;setOwner(false);setTeam(false);reset();
  if(restaurantId)void supabase.rpc('v2_session_list',{p_restaurant:restaurantId}).then(r=>{if(alive)setOwner(!r.error);});
  return()=>{alive=false;};
 },[restaurantId]);
 const load=useCallback(async()=>{const g=++generation.current;setBusy(true);setNotice('');setRows([]);
  const r=await supabase.rpc('v2_session_list',{p_restaurant:team?restaurantId:null,p_after:after,p_search:term});
  if(g!==generation.current)return;
  setBusy(false);
  if(r.error){setNotice(en?'Could not load sessions. Retry.':'No se pudieron cargar las sesiones. Reintente.');return;}
  const data=(r.data||[]) as ActiveSession[];setRows(data.slice(0,50));setMore(data.length>50);
 },[team,restaurantId,after,term,en]);
 useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
 async function revoke(row?:ActiveSession){
  if(lock.current)return;
  if(!confirmApp(row?(en?'End this session? This browser must sign in again to MRMAA, including any other restaurant accessed with the same session.':'¿Cerrar esta sesión? Ese navegador deberá ingresar nuevamente a MRMAA, incluso a otros restaurantes abiertos con la misma sesión.'):(en?'End all your other sessions? This session will stay open.':'¿Cerrar todas sus demás sesiones? Esta permanecerá abierta.')))return;
  lock.current=true;setBusy(true);setNotice('');
  try{
   const r=await supabase.rpc('v2_session_revoke',{p_session:row?.id||null,p_restaurant:row&&team?restaurantId:null,p_others:!row});
   if(r.error)throw r.error;
   if(row?.current){await supabase.auth.signOut({scope:'local'});return;}
   await load();setNotice(en?'Session access ended. Signing in again is allowed.':'Acceso de sesión cerrado. Puede volver a iniciar sesión.');
  }catch{setNotice(en?'Could not end the session. Retry.':'No se pudo cerrar la sesión. Reintente.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="moduleCard sessionManager" translate="no">
  <h2>{en?'Active sessions':'Sesiones activas'}</h2>
  <p>{en?'View browsers signed in to MRMAA. Ending a session does not permanently block the device.':'Consulte los navegadores con acceso a MRMAA. Cerrar una sesión no bloquea el dispositivo permanentemente.'}</p>
  <p className="muted">{en?'Device names are approximate. Last activity is updated about every 5 minutes while the page is visible; an open session does not mean someone is currently using it. Separate tabs may share a session.':'Los nombres de dispositivos son aproximados. La última actividad se actualiza aproximadamente cada 5 minutos con la página visible; una sesión abierta no significa que alguien la esté usando en ese momento. Varias pestañas pueden compartir una sesión.'}</p>
  <div className="rowActions">
   {owner&&<label>{en?'Show':'Mostrar'}<select value={team?'team':'self'} disabled={busy} onChange={e=>{setTeam(e.target.value==='team');reset();}}><option value="self">{en?'My sessions':'Mis sesiones'}</option><option value="team">{en?'Restaurant team':'Equipo del restaurante'}</option></select></label>}
   <button type="button" disabled={busy} onClick={()=>void load()}>{en?'Refresh':'Actualizar'}</button>
   <button type="button" disabled={busy} onClick={()=>void revoke()}>{en?'End my other sessions':'Cerrar mis demás sesiones'}</button>
  </div>
  <input type="search" aria-label={en?'Search sessions':'Buscar sesiones'} placeholder={en?'Name, email or device…':'Nombre, correo o dispositivo…'} value={search} onChange={e=>{setSearch(e.target.value);reset();}} />
  {notice&&<p role="status">{notice}</p>}
  {busy&&<p role="status">{en?'Loading…':'Cargando…'}</p>}
  <div className="sessionList">{rows.map(row=><article key={row.id}>
   <div><strong>{row.device}</strong>{row.current&&<span className="status">{en?'This session':'Esta sesión'}</span>}
    <div>{row.name} {row.name!==row.email&&<span>· {row.email}</span>}</div>
    <small>{en?'Last activity':'Última actividad'}: {new Date(row.last_seen_at).toLocaleString(en?'en-US':'es-GT')}</small>
   </div>
   <button type="button" className="secondary" disabled={busy} onClick={()=>void revoke(row)}>{en?'End session':'Cerrar sesión'}</button>
  </article>)}</div>
  {!busy&&!rows.length&&!notice&&<p>{en?'No sessions match this search.':'No hay sesiones para esta búsqueda.'}</p>}
  <div className="rowActions"><button type="button" disabled={busy||!back.length} onClick={()=>{setAfter(back[back.length-1]);setBack(back.slice(0,-1));}}>{en?'Previous':'Anterior'}</button><button type="button" disabled={busy||!more} onClick={()=>{setBack([...back,after]);setAfter(rows[rows.length-1].id);}}>{en?'Next':'Siguiente'}</button></div>
 </section>;
}
