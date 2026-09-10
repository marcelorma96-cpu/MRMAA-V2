"use client";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Power, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Pagination, pageItems } from "@/components/pagination";
type Member = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  invited_at?: string;
  last_invited_at?: string;
};
export function UsersModule() {
  const [rows, setRows] = useState<Member[]>([]),
    [currentUserId, setCurrentUserId] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [notice, setNotice] = useState(""),
    [form, setForm] = useState({ name: "", email: "", role: "operacion" }),
    [editing, setEditing] = useState<Member | null>(null),
    [editForm, setEditForm] = useState({ name: "", role: "operacion" });
  const request = useCallback(async (method = "GET", body?: unknown) => {
    const { data } = await supabase.auth.getSession(),
      r = await fetch("/api/users", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      json = await r.json();
    if (!r.ok)
      throw new Error(json.error || "No se pudo completar la operación.");
    return json;
  }, []);
  const load = useCallback(
    () =>
      request()
        .then(setRows)
        .catch((e) => setNotice(e.message)),
    [request],
  );
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || ""));
  }, [load]);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await request("POST", { ...form, origin: window.location.origin });
      setNotice(result.existingUser
        ? "El correo ya existía. Se vinculó al restaurante y se envió un enlace para crear o restablecer su contraseña."
        : "Invitación aceptada y enviada por Supabase. Revise también spam o correo no deseado.");
      setForm({ name: "", email: "", role: "operacion" });
      load();
    } catch (e: any) {
      setNotice(e.message);
    }
  }
  async function remove(id: string) {
    if (!window.confirm("¿Eliminar el acceso de este usuario?")) return;
    try {
      await request("DELETE", { user_id: id });
      setNotice("Acceso eliminado.");
      load();
    } catch (e: any) {
      setNotice(e.message);
    }
  }
  async function resend(id: string) {
    try {
      await request("PATCH", { user_id: id });
      setNotice("Invitación reenviada correctamente.");
      load();
    } catch (e: any) { setNotice(e.message); }
  }
  async function toggleStatus(id: string) {
    try {
      const result = await request("PATCH", { user_id: id, action: "toggle_status" });
      setNotice(result.status === "activo" ? "Acceso activado." : "Acceso desactivado.");
      load();
    } catch (e: any) { setNotice(e.message); }
  }
  function startEdit(member: Member) {
    setEditing(member);
    setEditForm({ name: member.name || "", role: member.role });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await request("PATCH", {
        user_id: editing.user_id,
        action: "update_member",
        name: editForm.name,
        role: editForm.role,
      });
      setNotice("Usuario actualizado correctamente.");
      setEditing(null);
      load();
    } catch (e: any) { setNotice(e.message); }
  }
  const filtered = rows.filter(
    (x) =>
      !search ||
      [x.name, x.email, x.role].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  useEffect(() => setPage(1), [search, rows.length]);
  return (
    <div className="moduleStack">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Usuarios</h2>
            <p>Invite al equipo y controle el tipo de acceso.</p>
          </div>
        </div>
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
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="administrador">Administrador</option>
            <option value="gerente">Gerente</option>
            <option value="operacion">Operación</option>
            <option value="lectura">Solo lectura</option>
          </select>
          <button className="primary">
            <UserPlus />
            Invitar
          </button>
        </form>
        <small className="inviteHelp">
          El colaborador recibirá un enlace por correo para crear y confirmar su
          propia contraseña. El enlace no comparte la contraseña del
          administrador.
        </small>
        {notice && (
          <p
            className={`moduleNotice ${notice.startsWith("Falta ") ? "moduleError" : ""}`}
          >
            {notice}
          </p>
        )}
      </section>
      <input
        className="moduleSearch moduleCard"
        placeholder="Buscar usuario…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="compactList moduleCard">
        {pageItems(filtered, page).map((x) => (
          <article key={x.user_id}>
            <div>
              <b>{x.name || "Usuario"}</b>
              <small>
                {x.email || "Correo pendiente"} · {x.role} · {x.status}
              </small>
            </div>
            <div className="rowActions">
              <button title="Editar usuario" onClick={() => startEdit(x)}><Pencil /> Editar</button>
              {x.status === "invitado" && <button title="Reenviar invitación" onClick={() => resend(x.user_id)}><RotateCcw /> Reenviar</button>}
              {x.user_id !== currentUserId && x.status !== "invitado" && <button title={x.status === "inactivo" ? "Activar acceso" : "Desactivar acceso"} onClick={() => toggleStatus(x.user_id)}><Power /> {x.status === "inactivo" ? "Activar" : "Desactivar"}</button>}
              {x.user_id !== currentUserId
                ? <button title={x.status === "invitado" ? "Cancelar invitación" : "Eliminar acceso"} onClick={() => remove(x.user_id)}><Trash2 /> {x.status === "invitado" ? "Cancelar" : "Eliminar"}</button>
                : <small className="protectedAdmin">Administrador principal</small>}
            </div>
          </article>
        ))}
      </div>
      <Pagination total={filtered.length} page={page} onPage={setPage} />
      {editing && (
        <div className="modalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <section className="modal" role="dialog" aria-modal="true">
            <header><h2>Editar usuario</h2><button className="icon" onClick={() => setEditing(null)}><X /></button></header>
            <form className="form" onSubmit={saveEdit}>
              <label className="field">Nombre<input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
              <label className="field">Rol<select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="administrador">Administrador</option><option value="gerente">Gerente</option><option value="operacion">Operación</option><option value="lectura">Solo lectura</option>
              </select></label>
              <small>Correo: {editing.email}. Para proteger el acceso, el correo no se modifica desde aquí.</small>
              <button className="primary">Guardar cambios</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
