"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  Clipboard,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Client, Quote, Reservation } from "@/lib/types";

type Area = { id: string; name: string; color: string; active: boolean };
type Employee = {
  id: string;
  name: string;
  employee_code: string;
  phone: string;
  area_id: string | null;
  active: boolean;
};
type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  active: boolean;
};
type Schedule = {
  id: string;
  work_date: string;
  employee_id: string;
  area_id: string | null;
  shift_id: string | null;
  notes: string;
  employee?: Employee;
  area?: Area;
  shift?: Shift;
};
type Template = {
  id: string;
  name: string;
  category: string;
  body: string;
  active: boolean;
};
const colors = [
  "#ea580c",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#475569",
];
const monday = () => {
  const d = new Date();
  const n = d.getDay() || 7;
  d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
};
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("es-GT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${d}T12:00:00`));
const money = (n: number) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(
    n || 0,
  );

export function SchedulesModule({ restaurantId }: { restaurantId: string }) {
  const [areas, setAreas] = useState<Area[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [shifts, setShifts] = useState<Shift[]>([]),
    [schedules, setSchedules] = useState<Schedule[]>([]),
    [week, setWeek] = useState(monday()),
    [notice, setNotice] = useState("");
  const [employeeForm, setEmployeeForm] = useState({
      id: "",
      name: "",
      employee_code: "",
      phone: "",
      area_id: "",
    }),
    [assignment, setAssignment] = useState({
      employee_id: "",
      area_id: "",
      shift_id: "",
      work_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  const load = useCallback(async () => {
    const [a, e, s, w] = await Promise.all([
      supabase
        .from("v2_areas")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
      supabase
        .from("v2_employees")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
      supabase
        .from("v2_shifts")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("start_time"),
      supabase
        .from("v2_schedules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("work_date", week)
        .lte("work_date", addDays(week, 6)),
    ]);
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    const ee = (e.data || []) as Employee[],
      aa = (a.data || []) as Area[],
      ss = (s.data || []) as Shift[];
    setSchedules(
      ((w.data || []) as Schedule[]).map((x) => ({
        ...x,
        employee: ee.find((y) => y.id === x.employee_id),
        area: aa.find((y) => y.id === x.area_id),
        shift: ss.find((y) => y.id === x.shift_id),
      })),
    );
  }, [restaurantId, week]);
  useEffect(() => {
    load();
  }, [load]);
  async function saveEmployee(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      restaurant_id: restaurantId,
      name: employeeForm.name.trim(),
      employee_code: employeeForm.employee_code.trim(),
      phone: employeeForm.phone.trim(),
      area_id: employeeForm.area_id || null,
    };
    const r = employeeForm.id
      ? await supabase
          .from("v2_employees")
          .update(payload)
          .eq("id", employeeForm.id)
      : await supabase.from("v2_employees").insert(payload);
    if (r.error) return setNotice(r.error.message);
    setEmployeeForm({
      id: "",
      name: "",
      employee_code: "",
      phone: "",
      area_id: "",
    });
    setNotice("Empleado guardado.");
    load();
  }
  async function toggleEmployee(x: Employee) {
    await supabase
      .from("v2_employees")
      .update({ active: !x.active })
      .eq("id", x.id);
    load();
  }
  async function saveAssignment(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase
      .from("v2_schedules")
      .upsert(
        {
          restaurant_id: restaurantId,
          ...assignment,
          area_id: assignment.area_id || null,
          shift_id: assignment.shift_id || null,
        },
        { onConflict: "restaurant_id,employee_id,work_date" },
      );
    if (r.error) return setNotice(r.error.message);
    setNotice("Horario asignado.");
    load();
  }
  async function removeAssignment(id: string) {
    await supabase.from("v2_schedules").delete().eq("id", id);
    load();
  }
  return (
    <div className="moduleStack">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Horario semanal</h2>
            <p>Asigne turnos y áreas por empleado.</p>
          </div>
          <div className="weekPicker">
            <button onClick={() => setWeek(addDays(week, -7))}>←</button>
            <input
              type="date"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
            <button onClick={() => setWeek(addDays(week, 7))}>→</button>
          </div>
        </div>
        <form className="inlineForm scheduleForm" onSubmit={saveAssignment}>
          <select
            required
            value={assignment.employee_id}
            onChange={(e) =>
              setAssignment({ ...assignment, employee_id: e.target.value })
            }
          >
            <option value="">Empleado</option>
            {employees
              .filter((x) => x.active)
              .map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <input
            required
            type="date"
            value={assignment.work_date}
            onChange={(e) =>
              setAssignment({ ...assignment, work_date: e.target.value })
            }
          />
          <select
            value={assignment.area_id}
            onChange={(e) =>
              setAssignment({ ...assignment, area_id: e.target.value })
            }
          >
            <option value="">Área</option>
            {areas
              .filter((x) => x.active)
              .map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <select
            required
            value={assignment.shift_id}
            onChange={(e) =>
              setAssignment({ ...assignment, shift_id: e.target.value })
            }
          >
            <option value="">Turno</option>
            {shifts
              .filter((x) => x.active)
              .map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name} · {x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)}
                </option>
              ))}
          </select>
          <button className="primary">
            <Plus />
            Asignar
          </button>
        </form>
        {notice && <p className="moduleNotice">{notice}</p>}
        <div className="scheduleGrid">
          {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((day) => (
            <div className="scheduleDay" key={day}>
              <strong>{shortDate(day)}</strong>
              {schedules
                .filter((x) => x.work_date === day)
                .map((x) => (
                  <article
                    key={x.id}
                    style={{ borderLeftColor: x.area?.color || "#ea580c" }}
                  >
                    <div>
                      <b>{x.employee?.name}</b>
                      <small>
                        {x.shift?.name || "Sin turno"} ·{" "}
                        {x.area?.name || "Sin área"}
                      </small>
                    </div>
                    <button onClick={() => removeAssignment(x.id)}>
                      <Trash2 />
                    </button>
                  </article>
                ))}
              {!schedules.some((x) => x.work_date === day) && (
                <span>Sin asignaciones</span>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Empleados</h2>
            <p>Personal disponible para la programación.</p>
          </div>
        </div>
        <form className="inlineForm employeeForm" onSubmit={saveEmployee}>
          <input
            required
            placeholder="Nombre"
            value={employeeForm.name}
            onChange={(e) =>
              setEmployeeForm({ ...employeeForm, name: e.target.value })
            }
          />
          <input
            placeholder="ID de empleado"
            value={employeeForm.employee_code}
            onChange={(e) =>
              setEmployeeForm({
                ...employeeForm,
                employee_code: e.target.value,
              })
            }
          />
          <input
            placeholder="Teléfono"
            value={employeeForm.phone}
            onChange={(e) =>
              setEmployeeForm({ ...employeeForm, phone: e.target.value })
            }
          />
          <select
            value={employeeForm.area_id}
            onChange={(e) =>
              setEmployeeForm({ ...employeeForm, area_id: e.target.value })
            }
          >
            <option value="">Área principal</option>
            {areas.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <button className="primary">
            {employeeForm.id ? "Actualizar" : "Agregar"}
          </button>
        </form>
        <div className="compactList">
          {employees.map((x) => (
            <article key={x.id} className={!x.active ? "inactive" : ""}>
              <div>
                <b>{x.name}</b>
                <small>
                  {x.employee_code || "Sin ID"} ·{" "}
                  {areas.find((a) => a.id === x.area_id)?.name || "Sin área"}
                </small>
              </div>
              <div className="listActions">
                <button
                  onClick={() =>
                    setEmployeeForm({
                      id: x.id,
                      name: x.name,
                      employee_code: x.employee_code || "",
                      phone: x.phone || "",
                      area_id: x.area_id || "",
                    })
                  }
                >
                  <Pencil />
                </button>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={x.active}
                    onChange={() => toggleEmployee(x)}
                  />
                  <span />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CommunicationModule({
  restaurantId,
  clients,
}: {
  restaurantId: string;
  clients: Client[];
}) {
  const [templates, setTemplates] = useState<Template[]>([]),
    [form, setForm] = useState({
      id: "",
      name: "",
      category: "confirmacion",
      body: "Hola {cliente}, confirmamos su reservación para el {fecha} a las {hora}.",
    }),
    [compose, setCompose] = useState({
      client_id: "",
      template_id: "",
      message: "",
    }),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const r = await supabase
      .from("v2_message_templates")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setTemplates((r.data || []) as Template[]);
  }, [restaurantId]);
  useEffect(() => {
    load();
  }, [load]);
  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      category: form.category,
      body: form.body.trim(),
    };
    const r = form.id
      ? await supabase
          .from("v2_message_templates")
          .update(payload)
          .eq("id", form.id)
      : await supabase.from("v2_message_templates").insert(payload);
    if (r.error) return setNotice(r.error.message);
    setForm({ id: "", name: "", category: "confirmacion", body: "" });
    setNotice("Plantilla guardada.");
    load();
  }
  function chooseTemplate(id: string) {
    const t = templates.find((x) => x.id === id),
      c = clients.find((x) => x.id === compose.client_id);
    setCompose({
      ...compose,
      template_id: id,
      message: (t?.body || "").replaceAll("{cliente}", c?.name || "cliente"),
    });
  }
  async function copy() {
    await navigator.clipboard.writeText(compose.message);
    setNotice("Mensaje copiado.");
  }
  const client = clients.find((x) => x.id === compose.client_id);
  const whatsapp = client?.phone
    ? `https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(compose.message)}`
    : "";
  return (
    <div className="communicationGrid">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Preparar mensaje</h2>
            <p>Use una plantilla y personalice antes de enviar.</p>
          </div>
        </div>
        <div className="formStack">
          <label>
            Cliente
            <select
              value={compose.client_id}
              onChange={(e) =>
                setCompose({ ...compose, client_id: e.target.value })
              }
            >
              <option value="">Seleccione cliente</option>
              {clients.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plantilla
            <select
              value={compose.template_id}
              onChange={(e) => chooseTemplate(e.target.value)}
            >
              <option value="">Seleccione plantilla</option>
              {templates
                .filter((x) => x.active)
                .map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Mensaje
            <textarea
              rows={8}
              value={compose.message}
              onChange={(e) =>
                setCompose({ ...compose, message: e.target.value })
              }
            />
          </label>
          <div className="buttonRow">
            <button
              className="secondary"
              onClick={copy}
              disabled={!compose.message}
            >
              <Clipboard />
              Copiar
            </button>
            {whatsapp && (
              <a
                className="primary"
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle />
                Abrir WhatsApp
              </a>
            )}
          </div>
        </div>
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Plantillas</h2>
            <p>Confirmaciones, recordatorios y seguimientos.</p>
          </div>
        </div>
        <form className="formStack" onSubmit={saveTemplate}>
          <label>
            Nombre
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Categoría
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="confirmacion">Confirmación</option>
              <option value="recordatorio">Recordatorio</option>
              <option value="cotizacion">Cotización</option>
              <option value="agradecimiento">Agradecimiento</option>
              <option value="cancelacion">Cancelación</option>
            </select>
          </label>
          <label>
            Contenido
            <textarea
              required
              rows={5}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <small>
              Variables disponibles: {"{cliente}"}, {"{fecha}"}, {"{hora}"}
            </small>
          </label>
          <button className="primary">
            {form.id ? "Actualizar plantilla" : "Guardar plantilla"}
          </button>
        </form>
        <div className="compactList">
          {templates.map((x) => (
            <article key={x.id}>
              <div>
                <b>{x.name}</b>
                <small>{x.category}</small>
              </div>
              <button
                onClick={() =>
                  setForm({
                    id: x.id,
                    name: x.name,
                    category: x.category,
                    body: x.body,
                  })
                }
              >
                <Pencil />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ReportsModule({
  clients,
  quotes,
  reservations,
}: {
  clients: Client[];
  quotes: Quote[];
  reservations: Reservation[];
}) {
  const [from, setFrom] = useState(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10),
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const filtered = useMemo(
    () =>
      reservations.filter((x) => x.event_date >= from && x.event_date <= to),
    [reservations, from, to],
  );
  const qFiltered = useMemo(
    () => quotes.filter((x) => x.event_date >= from && x.event_date <= to),
    [quotes, from, to],
  );
  const confirmed = filtered.filter((x) => x.status === "confirmada").length,
    total = qFiltered.reduce((s, x) => s + Number(x.total), 0),
    deposits = filtered.reduce((s, x) => s + Number(x.deposit), 0),
    guests = filtered.reduce((s, x) => s + Number(x.guests), 0);
  const statuses = ["confirmada", "pendiente", "completada", "cancelada"];
  return (
    <div className="moduleStack">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Resumen operativo</h2>
            <p>Resultados del periodo seleccionado.</p>
          </div>
          <div className="dateRange">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span>a</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="reportCards">
          <article>
            <BarChart3 />
            <small>Reservaciones</small>
            <strong>{filtered.length}</strong>
            <span>{confirmed} confirmadas</span>
          </article>
          <article>
            <Users />
            <small>Invitados</small>
            <strong>{guests}</strong>
            <span>{clients.length} clientes registrados</span>
          </article>
          <article>
            <FileText />
            <small>Valor cotizado</small>
            <strong>{money(total)}</strong>
            <span>{qFiltered.length} cotizaciones</span>
          </article>
          <article>
            <Check />
            <small>Anticipos</small>
            <strong>{money(deposits)}</strong>
            <span>Registrados en reservaciones</span>
          </article>
        </div>
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Estado de reservaciones</h2>
          </div>
        </div>
        <div className="statusBars">
          {statuses.map((s) => {
            const count = filtered.filter((x) => x.status === s).length,
              pct = filtered.length ? (count / filtered.length) * 100 : 0;
            return (
              <div key={s}>
                <span>
                  <b>{s}</b>
                  <em>{count}</em>
                </span>
                <div>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function SettingsModule({
  restaurantId,
  restaurantName,
  onNameChange,
}: {
  restaurantId: string;
  restaurantName: string;
  onNameChange: (x: string) => void;
}) {
  const [form, setForm] = useState({
      name: restaurantName,
      phone: "",
      country: "Guatemala",
      language: "es",
      currency: "GTQ",
      quote_number_start: 2000,
      settings: { discounts: true, deposits: true, tips: true },
    }),
    [areas, setAreas] = useState<Area[]>([]),
    [shifts, setShifts] = useState<Shift[]>([]),
    [areaName, setAreaName] = useState(""),
    [shift, setShift] = useState({
      name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 60,
    }),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [r, a, s] = await Promise.all([
      supabase
        .from("v2_restaurants")
        .select(
          "name,phone,country,language,currency,quote_number_start,settings",
        )
        .eq("id", restaurantId)
        .single(),
      supabase
        .from("v2_areas")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
      supabase
        .from("v2_shifts")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("start_time"),
    ]);
    if (r.data)
      setForm({
        ...form,
        ...r.data,
        settings: { ...form.settings, ...(r.data.settings || {}) },
      });
    setAreas((a.data || []) as Area[]);
    setShifts((s.data || []) as Shift[]);
  }, [restaurantId]);
  useEffect(() => {
    load();
  }, [load]);
  async function saveGeneral(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase
      .from("v2_restaurants")
      .update(form)
      .eq("id", restaurantId);
    if (r.error) return setNotice(r.error.message);
    onNameChange(form.name);
    setNotice("Configuración guardada.");
  }
  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase
      .from("v2_areas")
      .insert({
        restaurant_id: restaurantId,
        name: areaName.trim(),
        color: colors[areas.length % colors.length],
      });
    if (r.error) return setNotice(r.error.message);
    setAreaName("");
    load();
  }
  async function toggleArea(x: Area) {
    await supabase
      .from("v2_areas")
      .update({ active: !x.active })
      .eq("id", x.id);
    load();
  }
  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase
      .from("v2_shifts")
      .insert({ restaurant_id: restaurantId, ...shift });
    if (r.error) return setNotice(r.error.message);
    setShift({
      name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 60,
    });
    load();
  }
  async function toggleShift(x: Shift) {
    await supabase
      .from("v2_shifts")
      .update({ active: !x.active })
      .eq("id", x.id);
    load();
  }
  return (
    <div className="settingsGrid">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>General</h2>
            <p>Identidad y preferencias del restaurante.</p>
          </div>
        </div>
        <form className="formStack" onSubmit={saveGeneral}>
          <div className="grid2">
            <label>
              Nombre del restaurante
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Teléfono
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              País
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </label>
            <label>
              Idioma
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </label>
            <label>
              Moneda
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="GTQ">Quetzal (GTQ)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="MXN">Peso mexicano (MXN)</option>
              </select>
            </label>
            <label>
              Iniciar cotizaciones en
              <input
                type="number"
                min="1"
                value={form.quote_number_start}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quote_number_start: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="toggleList">
            {[
              ["discounts", "Permitir descuentos"],
              ["tips", "Calcular propina"],
              ["deposits", "Registrar anticipos"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(
                      form.settings[key as keyof typeof form.settings],
                    )}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        settings: { ...form.settings, [key]: e.target.checked },
                      })
                    }
                  />
                  <i />
                </span>
              </label>
            ))}
          </div>
          <button className="primary">Guardar configuración</button>
        </form>
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Áreas</h2>
            <p>Actívelas o desactívelas sin perder información.</p>
          </div>
        </div>
        <form className="inlineForm" onSubmit={addArea}>
          <input
            required
            placeholder="Nueva área"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
          />
          <button className="primary">
            <Plus />
            Agregar
          </button>
        </form>
        <div className="compactList">
          {areas.map((x) => (
            <article key={x.id} className={!x.active ? "inactive" : ""}>
              <div className="areaLabel">
                <i style={{ background: x.color }} />
                <b>{x.name}</b>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={x.active}
                  onChange={() => toggleArea(x)}
                />
                <span />
              </label>
            </article>
          ))}
        </div>
        <div className="moduleTitle subTitle">
          <div>
            <h2>Turnos</h2>
          </div>
        </div>
        <form className="inlineForm shiftForm" onSubmit={addShift}>
          <input
            required
            placeholder="Nombre"
            value={shift.name}
            onChange={(e) => setShift({ ...shift, name: e.target.value })}
          />
          <input
            type="time"
            value={shift.start_time}
            onChange={(e) => setShift({ ...shift, start_time: e.target.value })}
          />
          <input
            type="time"
            value={shift.end_time}
            onChange={(e) => setShift({ ...shift, end_time: e.target.value })}
          />
          <input
            type="number"
            min="0"
            title="Minutos de comida"
            value={shift.break_minutes}
            onChange={(e) =>
              setShift({ ...shift, break_minutes: Number(e.target.value) })
            }
          />
          <button className="primary">Agregar</button>
        </form>
        <div className="compactList">
          {shifts.map((x) => (
            <article key={x.id} className={!x.active ? "inactive" : ""}>
              <div>
                <b>{x.name}</b>
                <small>
                  {x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)} ·{" "}
                  {x.break_minutes} min comida
                </small>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={x.active}
                  onChange={() => toggleShift(x)}
                />
                <span />
              </label>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
