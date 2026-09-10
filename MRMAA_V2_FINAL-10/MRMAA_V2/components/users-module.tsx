"use client";
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2, UserPlus } from "lucide-react";
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
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [notice, setNotice] = useState(""),
    [form, setForm] = useState({ name: "", email: "", role: "operacion" });
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
              {x.status === "invitado" && <button title="Reenviar invitación" onClick={() => resend(x.user_id)}><RotateCcw /> Reenviar</button>}
              <button title={x.status === "invitado" ? "Cancelar invitación" : "Eliminar acceso"} onClick={() => remove(x.user_id)}><Trash2 /> {x.status === "invitado" ? "Cancelar" : "Eliminar"}</button>
            </div>
          </article>
        ))}
      </div>
      <Pagination total={filtered.length} page={page} onPage={setPage} />
    </div>
  );
}
