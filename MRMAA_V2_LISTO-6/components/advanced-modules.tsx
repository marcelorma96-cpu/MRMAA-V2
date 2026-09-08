"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Printer, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Client, Quote, Reservation } from "@/lib/types";

type Area = { id: string; name: string; color: string; active: boolean };
type Employee = {
  id: string;
  name: string;
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
  employee_id: string;
  area_id: string | null;
  shift_id: string | null;
  work_date: string;
  entry_type: string;
  break_start: string | null;
  break_end: string | null;
  notes: string;
};
type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const daysIn = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function MonthlySchedules({ restaurantId }: { restaurantId: string }) {
  const [month, setMonth] = useState(monthStart()),
    [areas, setAreas] = useState<Area[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [shifts, setShifts] = useState<Shift[]>([]),
    [rows, setRows] = useState<Schedule[]>([]),
    [notice, setNotice] = useState(""),
    [printFrom, setPrintFrom] = useState(`${month}-01`),
    [printTo, setPrintTo] = useState(
      `${month}-${String(daysIn(month)).padStart(2, "0")}`,
    ),
    [form, setForm] = useState({
      employee_id: "",
      work_date: iso(new Date()),
      area_id: "",
      shift_id: "",
      entry_type: "work",
      break_start: "",
      break_end: "",
      notes: "",
    });
  const load = useCallback(async () => {
    const start = `${month}-01`,
      end = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
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
        .eq("active", true)
        .order("name"),
      supabase
        .from("v2_shifts")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("active", true)
        .order("start_time"),
      supabase
        .from("v2_schedules")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("work_date", start)
        .lte("work_date", end),
    ]);
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    setRows((w.data || []) as Schedule[]);
  }, [restaurantId, month]);
  useEffect(() => {
    load();
    setPrintFrom(`${month}-01`);
    setPrintTo(`${month}-${String(daysIn(month)).padStart(2, "0")}`);
  }, [load, month]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      restaurant_id: restaurantId,
      ...form,
      area_id: form.area_id || null,
      shift_id: form.entry_type === "work" ? form.shift_id || null : null,
      break_start: form.break_start || null,
      break_end: form.break_end || null,
    };
    const r = await supabase
      .from("v2_schedules")
      .upsert(payload, { onConflict: "restaurant_id,employee_id,work_date" });
    if (r.error) return setNotice(r.error.message);
    setNotice("Horario guardado.");
    load();
  }
  async function generate() {
    const shift = shifts[0];
    if (!shift || !employees.length)
      return setNotice("Agregue empleados y turnos antes de generar.");
    const payload = [];
    for (const e of employees)
      for (let d = 1; d <= daysIn(month); d++) {
        const date = `${month}-${String(d).padStart(2, "0")}`,
          sunday = new Date(`${date}T12:00:00`).getDay() === 0;
        payload.push({
          restaurant_id: restaurantId,
          employee_id: e.id,
          area_id: e.area_id,
          shift_id: sunday ? null : shift.id,
          work_date: date,
          entry_type: sunday ? "rest" : "work",
          break_start: sunday ? null : "14:00",
          break_end: sunday ? null : "15:00",
          notes: "",
        });
      }
    const r = await supabase
      .from("v2_schedules")
      .upsert(payload, { onConflict: "restaurant_id,employee_id,work_date" });
    if (r.error) return setNotice(r.error.message);
    setNotice("Mes generado. Puede ajustar cada excepción.");
    load();
  }
  async function copyPrevious() {
    const d = new Date(`${month}-01T12:00:00`);
    d.setMonth(d.getMonth() - 1);
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const r = await supabase
      .from("v2_schedules")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("work_date", `${prev}-01`)
      .lte("work_date", `${prev}-${String(daysIn(prev)).padStart(2, "0")}`);
    if (r.error || !r.data?.length)
      return setNotice("El mes anterior no tiene horarios para copiar.");
    const payload = r.data
      .filter((x) => Number(x.work_date.slice(8, 10)) <= daysIn(month))
      .map(({ id, created_at, ...x }) => ({
        ...x,
        work_date: `${month}-${x.work_date.slice(8, 10)}`,
      }));
    const saved = await supabase
      .from("v2_schedules")
      .upsert(payload, { onConflict: "restaurant_id,employee_id,work_date" });
    if (saved.error) return setNotice(saved.error.message);
    setNotice("Horario del mes anterior copiado.");
    load();
  }
  function print() {
    const selected = rows.filter(
        (x) => x.work_date >= printFrom && x.work_date <= printTo,
      ),
      win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Horarios</title><style>body{font-family:Arial;padding:24px}h1{font-family:Georgia}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#222;color:#fff}</style></head><body><h1>Horarios</h1><p>${esc(printFrom)} a ${esc(printTo)}</p><table><tr><th>Área</th><th>Empleado</th><th>Fecha</th><th>Asignación</th><th>Comida</th><th>Notas</th></tr>${selected.map((x) => `<tr><td>${esc(areas.find((a) => a.id === x.area_id)?.name)}</td><td>${esc(employees.find((e) => e.id === x.employee_id)?.name)}</td><td>${x.work_date}</td><td>${esc(x.entry_type === "work" ? shifts.find((s) => s.id === x.shift_id)?.name : x.entry_type === "rest" ? "Descanso" : "Permiso")}</td><td>${esc(x.break_start?.slice(0, 5))}–${esc(x.break_end?.slice(0, 5))}</td><td>${esc(x.notes)}</td></tr>`).join("")}</table></body></html>`,
    );
    win.document.close();
    win.print();
  }
  const grouped = useMemo(
    () =>
      [
        ...areas,
        { id: "unassigned", name: "Sin área", color: "#71717a", active: true },
      ]
        .map((a) => ({
          area: a,
          people: employees.filter((e) =>
            a.id === "unassigned" ? !e.area_id : e.area_id === a.id,
          ),
        }))
        .filter((g) => g.people.length),
    [areas, employees],
  );
  return (
    <div className="moduleStack">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Horario mensual</h2>
            <p>
              Empleados agrupados por área. Genere, copie y ajuste excepciones.
            </p>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="buttonRow">
          <button className="secondary" onClick={copyPrevious}>
            <Copy />
            Copiar mes anterior
          </button>
          <button className="primary" onClick={generate}>
            <Sparkles />
            Generar automáticamente
          </button>
        </div>
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
      <section className="moduleCard">
        <form className="scheduleEditor" onSubmit={save}>
          <select
            required
            value={form.employee_id}
            onChange={(e) => {
              const emp = employees.find((x) => x.id === e.target.value);
              setForm({
                ...form,
                employee_id: e.target.value,
                area_id: emp?.area_id || "",
              });
            }}
          >
            <option value="">Empleado</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {areas.find((a) => a.id === e.area_id)?.name || "Sin área"} ·{" "}
                {e.name}
              </option>
            ))}
          </select>
          <input
            required
            type="date"
            value={form.work_date}
            onChange={(e) => setForm({ ...form, work_date: e.target.value })}
          />
          <select
            value={form.entry_type}
            onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
          >
            <option value="work">Turno</option>
            <option value="rest">Descanso</option>
            <option value="permission">Permiso</option>
          </select>
          {form.entry_type === "work" && (
            <select
              required
              value={form.shift_id}
              onChange={(e) => setForm({ ...form, shift_id: e.target.value })}
            >
              <option value="">Turno</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </option>
              ))}
            </select>
          )}
          <input
            type="time"
            title="Inicio comida"
            value={form.break_start}
            onChange={(e) => setForm({ ...form, break_start: e.target.value })}
          />
          <input
            type="time"
            title="Fin comida"
            value={form.break_end}
            onChange={(e) => setForm({ ...form, break_end: e.target.value })}
          />
          <input
            placeholder="Notas o motivo"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button className="primary">Guardar</button>
        </form>
      </section>
      <section className="monthlyWrap">
        {grouped.map((g) => (
          <div className="monthlyArea" key={g.area.id}>
            <h3>
              <i style={{ background: g.area.color }} />
              {g.area.name}
            </h3>
            <div className="monthlyTable">
              <div
                className="monthHeader"
                style={{
                  gridTemplateColumns: `140px repeat(${daysIn(month)}, minmax(18px, 1fr))`,
                }}
              >
                <b>Empleado</b>
                {Array.from({ length: daysIn(month) }, (_, i) => (
                  <span key={i}>
                    <small>
                      {
                        ["D", "L", "M", "X", "J", "V", "S"][
                          new Date(
                            `${month}-${String(i + 1).padStart(2, "0")}T12:00:00`,
                          ).getDay()
                        ]
                      }
                    </small>
                    {i + 1}
                  </span>
                ))}
              </div>
              {g.people.map((e) => (
                <div
                  className="monthRow"
                  key={e.id}
                  style={{
                    gridTemplateColumns: `140px repeat(${daysIn(month)}, minmax(18px, 1fr))`,
                  }}
                >
                  <b>{e.name}</b>
                  {Array.from({ length: daysIn(month) }, (_, i) => {
                    const date = `${month}-${String(i + 1).padStart(2, "0")}`,
                      x = rows.find(
                        (r) => r.employee_id === e.id && r.work_date === date,
                      );
                    return (
                      <button
                        key={date}
                        className={x?.entry_type || "empty"}
                        title={
                          x
                            ? `${x.entry_type} ${x.break_start || ""} ${x.notes || ""}`
                            : "Sin asignar"
                        }
                        onClick={() =>
                          setForm({
                            ...form,
                            employee_id: e.id,
                            area_id: e.area_id || "",
                            work_date: date,
                            shift_id: x?.shift_id || "",
                            entry_type: x?.entry_type || "work",
                            break_start: x?.break_start?.slice(0, 5) || "",
                            break_end: x?.break_end?.slice(0, 5) || "",
                            notes: x?.notes || "",
                          })
                        }
                      >
                        {x?.entry_type === "rest"
                          ? "D"
                          : x?.entry_type === "permission"
                            ? "P"
                            : shifts
                                .find((s) => s.id === x?.shift_id)
                                ?.name.slice(0, 1) || "·"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="moduleCard printBar">
        <div>
          <b>Imprimir horarios</b>
          <span>Seleccione el rango necesario.</span>
        </div>
        <input
          type="date"
          value={printFrom}
          onChange={(e) => setPrintFrom(e.target.value)}
        />
        <input
          type="date"
          value={printTo}
          onChange={(e) => setPrintTo(e.target.value)}
        />
        <button className="primary" onClick={print}>
          <Printer />
          Imprimir
        </button>
      </section>
    </div>
  );
}

export function SimpleCommunication({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [form, setForm] = useState({
      channel: "whatsapp",
      provider: "wati",
      connection_status: "disconnected",
      reservation_confirmed: true,
      reservation_tomorrow: true,
      pending_quote: true,
    }),
    [notice, setNotice] = useState("");
  useEffect(() => {
    supabase
      .from("v2_communication_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm({ ...form, ...data });
      });
  }, [restaurantId]);
  async function save() {
    const r = await supabase
      .from("v2_communication_settings")
      .upsert(
        { restaurant_id: restaurantId, ...form },
        { onConflict: "restaurant_id" },
      );
    setNotice(r.error ? r.error.message : "Preferencias guardadas.");
  }
  const automations: [
    [keyof typeof form, string, string],
    ...Array<[keyof typeof form, string, string]>,
  ] = [
    [
      "reservation_confirmed",
      "Reservación confirmada",
      "Se envía cuando una reservación queda confirmada.",
    ],
    [
      "reservation_tomorrow",
      "Su reservación es mañana",
      "Recordatorio automático un día antes.",
    ],
    [
      "pending_quote",
      "Cotización pendiente",
      "Seguimiento para cotizaciones aún no convertidas.",
    ],
  ];
  return (
    <div className="communicationSimple">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Canal de comunicación</h2>
            <p>Elija un solo canal para los recordatorios.</p>
          </div>
          <span className={`connectionBadge ${form.connection_status}`}>
            {form.connection_status === "connected"
              ? "Conectado"
              : "Sin conectar"}
          </span>
        </div>
        <div className="channelChoices">
          <button
            className={form.channel === "whatsapp" ? "active" : ""}
            onClick={() =>
              setForm({ ...form, channel: "whatsapp", provider: "wati" })
            }
          >
            WhatsApp
          </button>
          <button
            className={form.channel === "sms" ? "active" : ""}
            onClick={() =>
              setForm({ ...form, channel: "sms", provider: "twilio" })
            }
          >
            SMS
          </button>
        </div>
        <label className="providerField">
          Proveedor
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            {form.channel === "whatsapp" ? (
              <>
                <option value="wati">WATI</option>
                <option value="meta">WhatsApp Cloud API</option>
                <option value="twilio_whatsapp">Twilio WhatsApp</option>
              </>
            ) : (
              <option value="twilio">Twilio SMS</option>
            )}
          </select>
        </label>
        <div className="integrationNotice">
          La conexión se activa al agregar las credenciales privadas del
          proveedor en Vercel. Nunca se guardan en el navegador.
        </div>
      </section>
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Recordatorios automáticos</h2>
            <p>Active únicamente los mensajes que desea enviar.</p>
          </div>
        </div>
        <div className="automationList">
          {automations.map(([key, title, desc]) => (
            <article key={key}>
              <div>
                <b>{title}</b>
                <p>{desc}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.checked })
                  }
                />
                <span />
              </label>
            </article>
          ))}
        </div>
        <button className="primary" onClick={save}>
          Guardar comunicación
        </button>
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
    </div>
  );
}

export function EnhancedSettings({
  restaurantId,
  restaurantName,
  onNameChange,
  onSettingsChange,
}: {
  restaurantId: string;
  restaurantName: string;
  onNameChange: (x: string) => void;
  onSettingsChange: (x: any) => void;
}) {
  const [tab, setTab] = useState("general"),
    [form, setForm] = useState<any>({
      name: restaurantName,
      phone: "",
      country: "Guatemala",
      language: "es",
      currency: "GTQ",
      quote_number_start: 2000,
      settings: {
        reservation_show_people: true,
        reservation_show_deposits: true,
        discounts: true,
        tips: true,
        deposits: true,
        quote_font: "Georgia",
        quote_color: "#18181b",
        quote_accent: "#ea580c",
        fixed_customer_note: true,
        customer_note: "",
        logo_data_url: "",
      },
    }),
    [areas, setAreas] = useState<Area[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [shifts, setShifts] = useState<Shift[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [areaName, setAreaName] = useState(""),
    [employee, setEmployee] = useState({ name: "", phone: "", area_id: "" }),
    [shift, setShift] = useState({
      name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 60,
    }),
    [product, setProduct] = useState({ name: "", description: "", price: 0 }),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [r, a, e, s, p] = await Promise.all([
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
        .from("v2_quote_products")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
    ]);
    if (r.data)
      setForm((old: any) => ({
        ...old,
        ...r.data,
        settings: { ...old.settings, ...(r.data.settings || {}) },
      }));
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    setProducts((p.data || []) as Product[]);
  }, [restaurantId]);
  useEffect(() => {
    load();
  }, [load]);
  async function save() {
    const r = await supabase
      .from("v2_restaurants")
      .update(form)
      .eq("id", restaurantId);
    if (r.error) return setNotice(r.error.message);
    onNameChange(form.name);
    onSettingsChange(form.settings);
    setNotice("Configuración guardada.");
  }
  function selectLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setNotice("Seleccione una imagen válida.");
    if (file.size > 700000)
      return setNotice("El logo debe pesar menos de 700 KB.");
    const reader = new FileReader();
    reader.onload = () => setting("logo_data_url", String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase
      .from("v2_areas")
      .insert({ restaurant_id: restaurantId, name: areaName });
    if (r.error) return setNotice(r.error.message);
    setAreaName("");
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
  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase.from("v2_employees").insert({
      restaurant_id: restaurantId,
      ...employee,
      area_id: employee.area_id || null,
    });
    if (r.error) return setNotice(r.error.message);
    setEmployee({ name: "", phone: "", area_id: "" });
    load();
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const r = await supabase
      .from("v2_quote_products")
      .insert({ restaurant_id: restaurantId, ...product });
    if (r.error) return setNotice(r.error.message);
    setProduct({ name: "", description: "", price: 0 });
    load();
  }
  async function del(table: string, id: string) {
    if (!window.confirm("¿Desea eliminar este elemento?")) return;
    const r = await supabase.from(table).delete().eq("id", id);
    if (r.error) return setNotice(r.error.message);
    load();
  }
  const setting = (key: string, value: any) =>
    setForm({ ...form, settings: { ...form.settings, [key]: value } });
  const tabs = ["general", "reservaciones", "cotizaciones", "horarios"];
  return (
    <div className="settingsLayout">
      <aside>
        {tabs.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </aside>
      <section className="moduleCard settingsPanel">
        <div className="moduleTitle">
          <div>
            <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
            <p>Preferencias de esta sección.</p>
          </div>
        </div>
        {tab === "general" && (
          <div className="formStack">
            <div className="grid2">
              <label>
                Restaurante
                <input
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
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </label>
              <label>
                Idioma
                <select
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                >
                  <option>GTQ</option>
                  <option>USD</option>
                  <option>MXN</option>
                </select>
              </label>
            </div>
            <label className="logoUploader">
              Logo del negocio
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={selectLogo}
              />
              {form.settings.logo_data_url && (
                <img
                  src={form.settings.logo_data_url}
                  alt="Vista previa del logo"
                />
              )}
            </label>
          </div>
        )}
        {tab === "reservaciones" && (
          <div className="automationList">
            <Toggle
              title="Mostrar total de personas"
              checked={form.settings.reservation_show_people}
              set={(v) => setting("reservation_show_people", v)}
            />
            <Toggle
              title="Mostrar total de anticipos"
              checked={form.settings.reservation_show_deposits}
              set={(v) => setting("reservation_show_deposits", v)}
            />
            <Toggle
              title="Permitir anticipos"
              checked={form.settings.deposits}
              set={(v) => setting("deposits", v)}
            />
          </div>
        )}
        {tab === "cotizaciones" && (
          <div className="formStack">
            <div className="grid2">
              <label>
                Numeración inicial
                <input
                  type="number"
                  value={form.quote_number_start}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quote_number_start: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Tipografía
                <select
                  value={form.settings.quote_font}
                  onChange={(e) => setting("quote_font", e.target.value)}
                >
                  <option>Georgia</option>
                  <option>Arial</option>
                  <option>Helvetica</option>
                  <option>Times New Roman</option>
                </select>
              </label>
              <label>
                Color principal
                <input
                  type="color"
                  value={form.settings.quote_color}
                  onChange={(e) => setting("quote_color", e.target.value)}
                />
              </label>
              <label>
                Color de acento
                <input
                  type="color"
                  value={form.settings.quote_accent}
                  onChange={(e) => setting("quote_accent", e.target.value)}
                />
              </label>
            </div>
            <Toggle
              title="Permitir descuentos"
              checked={form.settings.discounts}
              set={(v) => setting("discounts", v)}
            />
            <Toggle
              title="Calcular propina"
              checked={form.settings.tips}
              set={(v) => setting("tips", v)}
            />
            <Toggle
              title="Mensaje fijo para cliente"
              checked={form.settings.fixed_customer_note}
              set={(v) => setting("fixed_customer_note", v)}
            />
            {form.settings.fixed_customer_note && (
              <label>
                Mensaje fijo
                <textarea
                  value={form.settings.customer_note}
                  onChange={(e) => setting("customer_note", e.target.value)}
                />
              </label>
            )}
            <h3>Menús y productos</h3>
            <form className="productForm" onSubmit={addProduct}>
              <input
                required
                placeholder="Nombre"
                value={product.name}
                onChange={(e) =>
                  setProduct({ ...product, name: e.target.value })
                }
              />
              <input
                placeholder="Descripción"
                value={product.description}
                onChange={(e) =>
                  setProduct({ ...product, description: e.target.value })
                }
              />
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="Precio"
                value={product.price}
                onChange={(e) =>
                  setProduct({ ...product, price: Number(e.target.value) })
                }
              />
              <button className="primary">Agregar</button>
            </form>
            <div className="compactList">
              {products.map((p) => (
                <article key={p.id}>
                  <div>
                    <b>
                      {p.name} · Q {p.price}
                    </b>
                    <small>{p.description}</small>
                  </div>
                  <button onClick={() => del("v2_quote_products", p.id)}>
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === "horarios" && (
          <div className="formStack">
            <div>
              <h3>Empleados</h3>
              <form className="productForm" onSubmit={addEmployee}>
                <input
                  required
                  placeholder="Nombre"
                  value={employee.name}
                  onChange={(e) =>
                    setEmployee({ ...employee, name: e.target.value })
                  }
                />
                <input
                  placeholder="Teléfono"
                  value={employee.phone}
                  onChange={(e) =>
                    setEmployee({ ...employee, phone: e.target.value })
                  }
                />
                <select
                  required
                  value={employee.area_id}
                  onChange={(e) =>
                    setEmployee({ ...employee, area_id: e.target.value })
                  }
                >
                  <option value="">Seleccione área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button className="primary">Agregar empleado</button>
              </form>
              <div className="compactList">
                {employees.map((e) => (
                  <article key={e.id}>
                    <div>
                      <b>{e.name}</b>
                      <small>
                        {areas.find((a) => a.id === e.area_id)?.name ||
                          "Sin área"}{" "}
                        · {e.phone}
                      </small>
                    </div>
                    <button onClick={() => del("v2_employees", e.id)}>
                      <Trash2 />
                    </button>
                  </article>
                ))}
              </div>
            </div>
            <div className="settingsColumns">
              <div>
                <h3>Áreas</h3>
                <form className="inlineForm" onSubmit={addArea}>
                  <input
                    required
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    placeholder="Nombre del área"
                  />
                  <button className="primary">Agregar</button>
                </form>
                <div className="compactList">
                  {areas.map((a) => (
                    <article key={a.id}>
                      <b>{a.name}</b>
                      <button onClick={() => del("v2_areas", a.id)}>
                        <Trash2 />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
              <div>
                <h3>Turnos</h3>
                <form className="formStack" onSubmit={addShift}>
                  <input
                    required
                    placeholder="Nombre"
                    value={shift.name}
                    onChange={(e) =>
                      setShift({ ...shift, name: e.target.value })
                    }
                  />
                  <div className="grid2">
                    <input
                      type="time"
                      value={shift.start_time}
                      onChange={(e) =>
                        setShift({ ...shift, start_time: e.target.value })
                      }
                    />
                    <input
                      type="time"
                      value={shift.end_time}
                      onChange={(e) =>
                        setShift({ ...shift, end_time: e.target.value })
                      }
                    />
                  </div>
                  <label>
                    Minutos de comida
                    <input
                      type="number"
                      min="0"
                      value={shift.break_minutes}
                      onChange={(e) =>
                        setShift({
                          ...shift,
                          break_minutes: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <button className="primary">Agregar turno</button>
                </form>
                <div className="compactList">
                  {shifts.map((s) => (
                    <article key={s.id}>
                      <div>
                        <b>{s.name}</b>
                        <small>
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                        </small>
                      </div>
                      <button onClick={() => del("v2_shifts", s.id)}>
                        <Trash2 />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <button className="primary settingsSave" onClick={save}>
          Guardar configuración
        </button>
        {notice && <p className="moduleNotice">{notice}</p>}
      </section>
    </div>
  );
}
function Toggle({
  title,
  checked,
  set,
}: {
  title: string;
  checked: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <article>
      <b>{title}</b>
      <label className="switch">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => set(e.target.checked)}
        />
        <span />
      </label>
    </article>
  );
}
