"use client";
import { useCallback, useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
type Member = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};
export function UsersModule() {
  const [rows, setRows] = useState<Member[]>([]),
    [search, setSearch] = useState(""),
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
      await request("POST", { ...form, origin: window.location.origin });
      setNotice("Invitación enviada por correo.");
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
  const filtered = rows.filter(
    (x) =>
      !search ||
      [x.name, x.email, x.role].some((v) =>
        v?.toLowerCase().includes(search.toLowerCase()),
      ),
  );
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
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
      <input
        className="moduleSearch moduleCard"
        placeholder="Buscar usuario…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="compactList moduleCard">
        {filtered.map((x) => (
          <article key={x.user_id}>
            <div>
              <b>{x.name || "Usuario"}</b>
              <small>
                {x.email || "Correo pendiente"} · {x.role} · {x.status}
              </small>
            </div>
            <button title="Eliminar acceso" onClick={() => remove(x.user_id)}>
              <Trash2 />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
