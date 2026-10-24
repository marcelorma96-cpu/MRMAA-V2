"use client";
import {TeamBranchAccess} from "./team-branch-access";
import {type PermissionDraft} from "@/lib/team-access";
import {useRefreshTask} from "./pull-refresh";
import {useModulePending} from "./presentation-loading";
import {AppOptions,AppRecord,useAppMode} from "./app-context";
import { useDataRefresh, useOnDataRefresh } from "@/components/restaurant-sync";

import { ExcelExportControl } from "@/components/excel-permission";
import { confirmApp, useAppPreferences } from "@/components/app-preferences";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges, useDraftBaseline } from "@/lib/unsaved-changes";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Power, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Pagination, pageItems } from "@/components/pagination";
import { EMAIL_LANGUAGES, emailLanguage, type EmailLanguage } from "@/lib/email-language";
type Member = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  invited_at?: string;
  last_invited_at?: string;
  is_owner?: boolean;
  language: EmailLanguage;
};
type UserNotice = { kind: "success"; message: string } | { kind: "error"; error: unknown };

export function UsersNotice({ notice }: { notice: UserNotice | null }) {
  const { t } = useAppPreferences();
  if (!notice) return null;
  const failed = notice.kind === "error";
  return (
    <p className={`moduleNotice${failed ? " moduleError" : ""}`} role={failed ? "alert" : "status"}>
      {t(failed ? userMessage(notice.error) : notice.message)}
    </p>
  );
}

export function UsersModule({ restaurantId, defaultLanguage = "es" }: { restaurantId: string; defaultLanguage?: EmailLanguage }) {
  const app=useAppMode(),{language}=useAppPreferences(),en=language==='en';
  const remoteVersion = useDataRefresh(restaurantId, "v2_members,v2_restaurants");
  const loadGeneration = useRef(0);
  const [initialLoading,setInitialLoading]=useState(true);
  useModulePending(initialLoading);
  const [rows, setRows] = useState<Member[]>([]),
    [currentUserId, setCurrentUserId] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [notice, setNotice] = useState<UserNotice | null>(null),
    [listError, setListError] = useState(false),
    [form, setForm] = useState({ name: "", email: "", role: "operacion", language: defaultLanguage }),
    [editing, setEditing] = useState<Member | null>(null),
    [editForm, setEditForm] = useState({ name: "", role: "operacion", language: "es" as EmailLanguage }),
    [inviting, setInviting] = useState(false);
  const initialAccess=():PermissionDraft=>({[restaurantId]:{id:restaurantId,selected:true,role:"operacion"}});
  const [inviteAccess,setInviteAccess]=useState<PermissionDraft>(initialAccess),[editAccess,setEditAccess]=useState<PermissionDraft>({}),[inviteReady,setInviteReady]=useState(false),[editReady,setEditReady]=useState(false),[saving,setSaving]=useState(false),[inviteRevision,setInviteRevision]=useState(0);
  const inviteDraft = useDraftBaseline({form,access:inviteAccess});
  const editDraft = useDraftBaseline({form:editForm,access:editAccess}, Boolean(editing));
  useUnsavedChanges(inviteDraft.dirty || editDraft.dirty, () => {
    setForm({ name: "", email: "", role: "operacion", language: defaultLanguage });
    setInviteAccess(initialAccess());setEditAccess({});setEditing(null);
  });
  const request = useCallback(async (method = "GET", body?: unknown) => {
    const { data } = await supabase.auth.getSession(),
      r = await fetch("/api/users", {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Unomesa-Restaurant":restaurantId,
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      json = await r.json();
    if (!r.ok)
      throw new Error(json.error || "No se pudo completar la operación.");
    return json;
  }, [restaurantId]);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const rows = await request();
      if (generation === loadGeneration.current) {
        setRows(rows);
        setListError(false);
      }
    } catch {
      // Refresh failures must not overwrite a completed invitation or discard the last list.
      if (generation === loadGeneration.current) setListError(true);
    } finally {
      if(generation===loadGeneration.current)setInitialLoading(false);
    }
  }, [request]);
  useRefreshTask(()=>load());
  useEffect(() => () => { loadGeneration.current++; }, [load]);
  useOnDataRefresh(remoteVersion, () => { void load(); });
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || ""));
  }, [load]);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (inviting || !inviteReady) return;
    if (!Object.values(inviteAccess).some(x=>x.selected)) {setNotice({kind:"error",error:new Error(en?"Select at least one location.":"Seleccione al menos una sucursal.")});return;}
    setInviting(true);
    setNotice(null);
    try {
      const result = await request("POST", { ...form, branches:Object.values(inviteAccess).filter(x=>x.selected), origin: window.location.origin });
      setNotice({ kind: "success", message: result.linked ? "Accesos asignados. El usuario puede ingresar con su cuenta actual." : result.existingUser
        ? "El correo ya existía. Se vinculó al restaurante y se envió un enlace para crear o restablecer su contraseña."
        : "Invitación enviada. Revise también spam o correo no deseado." });
      setForm({ name: "", email: "", role: "operacion", language: defaultLanguage });
      setInviteAccess(initialAccess());setInviteRevision(x=>x+1);
      load();
    } catch (error) {
      setNotice({ kind: "error", error });
    } finally { setInviting(false); }
  }
  async function remove(id: string) {
    if (!confirmApp("¿Eliminar el acceso a esta sucursal? Los accesos a otras sucursales se conservan.")) return;
    setNotice(null);
    try {
      await request("DELETE", { user_id: id });
      setNotice({ kind: "success", message: "Acceso eliminado." });
      load();
    } catch (error) {
      setNotice({ kind: "error", error });
    }
  }
  async function resend(id: string) {
    setNotice(null);
    try {
      await request("PATCH", { user_id: id, action: "resend_team" });
      setNotice({ kind: "success", message: "Invitación reenviada correctamente." });
      load();
    } catch (error) { setNotice({ kind: "error", error }); }
  }
  async function toggleStatus(id: string) {
    setNotice(null);
    try {
      const result = await request("PATCH", { user_id: id, action: "toggle_status" });
      setNotice({ kind: "success", message: result.status === "activo" ? "Acceso activado." : "Acceso desactivado." });
      load();
    } catch (error) { setNotice({ kind: "error", error }); }
  }
  function startEdit(member: Member) {
    setEditAccess({});setEditReady(Boolean(member.is_owner));setEditing(member);
    setEditForm({ name: member.name || "", role: member.role, language: emailLanguage(member.language) });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || saving || !editReady) return;
    setSaving(true);
    setNotice(null);
    try {
      await request("PATCH", {
        user_id: editing.user_id,
        action: "update_member",
        name: editForm.name,
        role: editForm.role,
        branches:Object.values(editAccess),
        ...(!editing.is_owner && { language: editForm.language }),
      });
      setNotice({ kind: "success", message: "Usuario actualizado correctamente." });
      setEditing(null);
      load();
    } catch (error) { setNotice({ kind: "error", error }); } finally {setSaving(false);}
  }
  const filtered = rows.filter(
    (x) =>
      !search ||
      [x.name, x.email, x.role].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  useEffect(() => setPage(1), [search]);
  const userActions=(x:Member)=>(            <div className="rowActions">
              <button title="Editar usuario" onClick={() => startEdit(x)}><Pencil /> Editar</button>
              {x.status === "invitado" && <button title="Reenviar invitación" onClick={() => resend(x.user_id)}><RotateCcw /> Reenviar</button>}
              {x.user_id !== currentUserId && x.status !== "invitado" && <button title={x.status === "inactivo" ? "Activar acceso" : "Desactivar acceso"} onClick={() => toggleStatus(x.user_id)}><Power /> {x.status === "inactivo" ? "Activar" : "Desactivar"}</button>}
              {x.user_id !== currentUserId
                ? <button title={x.status === "invitado" ? "Cancelar invitación" : "Eliminar acceso"} onClick={() => remove(x.user_id)}><Trash2 /> {x.status === "invitado" ? "Cancelar" : "Eliminar"}</button>
                : <small className="protectedAdmin">{x.is_owner?"Administrador principal":"Su usuario"}</small>}
            </div>);
  return (
    <div className="moduleStack">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Usuarios</h2>
            <p>Invite al equipo y controle el tipo de acceso.</p>
          </div>
        </div>
        <AppOptions title={en?"Export permissions":"Permisos de exportación"}><ExcelExportControl key={restaurantId} restaurantId={restaurantId} /></AppOptions>
        <AppOptions title={en?"Invite team member":"Invitar usuario"}>
        <form className="userInviteForm" onSubmit={invite}>
          <input
            required
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Correo electrónico"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <label className="inviteLanguage">Idioma del correo
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as EmailLanguage })}>
              {EMAIL_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <TeamBranchAccess key={`${restaurantId}:${inviteRevision}`} restaurantId={restaurantId} en={en} changes={inviteAccess} onChange={setInviteAccess} onReady={setInviteReady} disabled={inviting}/>
          <button className="primary" disabled={inviting||!inviteReady}>
            <UserPlus />
            {inviting ? "Enviando…" : "Invitar"}
          </button>
        </form>
        <small className="inviteHelp">
          El colaborador recibirá un enlace por correo para crear y confirmar su
          propia contraseña. El enlace no comparte la contraseña del
          administrador.
        </small>
        <UsersNotice notice={notice} />
        </AppOptions>
        {app&&<UsersNotice notice={notice}/>} 
      </section>
      <input
        className="moduleSearch moduleCard"
        placeholder="Buscar usuario…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="compactList moduleCard">
        {listError && <div>
          <p className="moduleNotice moduleError" role="alert">No se pudo actualizar la lista de usuarios. Puede reintentar sin volver a enviar la invitación.</p>
          <button type="button" onClick={() => { void load(); }}>Reintentar</button>
        </div>}
        {pageItems(filtered, page).map((x) => app?<AppRecord key={x.user_id} title={x.name|| (en?"User":"Usuario")} subtitle={x.email||"—"} meta={`${x.role} · ${x.status}`} actions={userActions(x)}><dl><dt>{en?"Role":"Rol"}</dt><dd>{x.role}</dd><dt>{en?"Access":"Acceso"}</dt><dd>{x.status}</dd><dt>{en?"Email language":"Idioma de correo"}</dt><dd>{EMAIL_LANGUAGES.find(item=>item.value===x.language)?.label||"Español"}</dd></dl></AppRecord>:( 
          <article key={x.user_id}>
            <div>
              <b>{x.name || "Usuario"}</b>
              <small>
                {x.email || "Correo pendiente"} · {x.role} · {x.status} · {EMAIL_LANGUAGES.find((item) => item.value === x.language)?.label || "Español"}
              </small>
            </div>
            {userActions(x)}
          </article>
        ))}
      </div>
      <Pagination total={filtered.length} page={page} onPage={setPage} />
      {editing && (
        <div className="modalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && confirmDiscardChanges() && setEditing(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-label={en?"Edit user":"Editar usuario"} style={{width:"min(680px,calc(100vw - 24px))",maxHeight:"calc(100dvh - 32px)",overflowY:"auto"}}>
            <header><h2>Editar usuario</h2><button className="icon" onClick={() => { if (!saving && confirmDiscardChanges()) setEditing(null); }}><X /></button></header>
            <form className="form" onSubmit={saveEdit}>
              <label className="field">Nombre<input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
              {editing.is_owner ? <div className="field"><span>Rol</span><strong>Administrador principal</strong><small>Acceso a las sucursales de esta empresa. Para cambiarlo use Configuración → Cuenta → Transferir administración.</small></div> : <TeamBranchAccess key={editing.user_id} restaurantId={restaurantId} userId={editing.user_id} en={en} changes={editAccess} onChange={setEditAccess} onReady={setEditReady} disabled={saving}/>}
              {!editing.is_owner && <label className="field">Idioma de los correos<select value={editForm.language} onChange={(e) => setEditForm({ ...editForm, language: e.target.value as EmailLanguage })}>
                {EMAIL_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select></label>}
              <small>Correo: {editing.email}. Para proteger el acceso, el correo no se modifica desde aquí.</small>
              <UsersNotice notice={notice?.kind==="error"?notice:null}/><button className="primary" disabled={saving||!editReady}>{saving?"Guardando…":"Guardar cambios"}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
