"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Printer, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { printHtml } from "@/lib/print";
import type { Client, Quote, Reservation } from "@/lib/types";
import { UsersModule } from "@/components/users-module";
import { SecurityCenter } from "@/components/security-center";
import { TransparentLogo } from "@/components/transparent-logo";

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
    [search, setSearch] = useState(""),
    [dragged, setDragged] = useState<Schedule | null>(null),
    [printFrom, setPrintFrom] = useState(`${month}-01`),
    [printTo, setPrintTo] = useState(
      `${month}-${String(daysIn(month)).padStart(2, "0")}`,
    ),
    [form, setForm] = useState({
      employee_id: "",
      work_date: iso(new Date()),
      work_date_to: iso(new Date()),
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
    const employee = employees.find((x) => x.id === form.employee_id),
      start = new Date(`${form.work_date}T12:00:00`),
      end = new Date(`${form.work_date_to || form.work_date}T12:00:00`),
      payload = [];
    if (end < start)
      return setNotice("La fecha final no puede ser anterior a la inicial.");
    for (
      const day = new Date(start);
      day <= end;
      day.setDate(day.getDate() + 1)
    )
      payload.push({
        restaurant_id: restaurantId,
        employee_id: form.employee_id,
        work_date: iso(day),
        area_id: employee?.area_id || form.area_id || null,
        shift_id: form.entry_type === "work" ? form.shift_id || null : null,
        entry_type: form.entry_type,
        break_start:
          form.entry_type === "work" ? form.break_start || null : null,
        break_end: form.entry_type === "work" ? form.break_end || null : null,
        notes: form.notes,
      });
    const r = await supabase
      .from("v2_schedules")
      .upsert(payload, { onConflict: "restaurant_id,employee_id,work_date" });
    if (r.error) return setNotice(r.error.message);
    setNotice(
      payload.length === 1
        ? "Horario guardado."
        : `${payload.length} días asignados.`,
    );
    load();
  }
  async function deleteAssignment() {
    if (
      !form.employee_id ||
      !form.work_date ||
      !window.confirm("¿Eliminar la asignación de este día?")
    )
      return;
    const r = await supabase
      .from("v2_schedules")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("employee_id", form.employee_id)
      .eq("work_date", form.work_date);
    if (r.error) return setNotice(r.error.message);
    setNotice("Asignación eliminada.");
    load();
  }
  async function copyByDrag(employee: Employee, date: string) {
    if (!dragged) return;
    const { id, ...source } = dragged;
    const r = await supabase.from("v2_schedules").upsert(
      {
        ...source,
        restaurant_id: restaurantId,
        employee_id: employee.id,
        area_id: employee.area_id,
        work_date: date,
      },
      { onConflict: "restaurant_id,employee_id,work_date" },
    );
    if (r.error) return setNotice(r.error.message);
    setNotice(`Horario copiado a ${employee.name} · ${date}.`);
    setDragged(null);
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
      dates: string[] = [];
    for (
      const d = new Date(`${printFrom}T12:00:00`),
        end = new Date(`${printTo}T12:00:00`);
      d <= end;
      d.setDate(d.getDate() + 1)
    )
      dates.push(iso(d));
    const printGroups = [
      ...areas,
      { id: "unassigned", name: "Sin área", color: "#71717a", active: true },
    ]
      .map((area) => ({
        area,
        people: employees.filter((e) =>
          area.id === "unassigned" ? !e.area_id : e.area_id === area.id,
        ),
      }))
      .filter((g) =>
        g.people.some((e) => selected.some((x) => x.employee_id === e.id)),
      );
    const cell = (employeeId: string, date: string) => {
      const x = selected.find(
        (r) => r.employee_id === employeeId && r.work_date === date,
      );
      if (!x) return "—";
      if (x.entry_type === "rest") return "DESCANSO";
      if (x.entry_type === "permission")
        return `PERMISO${x.notes ? `<small>${esc(x.notes)}</small>` : ""}`;
      const s = shifts.find((v) => v.id === x.shift_id);
      return `<b>${esc(s?.name || "Turno")}</b><span>${esc(s?.start_time?.slice(0, 5))}–${esc(s?.end_time?.slice(0, 5))}</span>${x.break_start && x.break_end ? `<small>Comida ${esc(x.break_start.slice(0, 5))}–${esc(x.break_end.slice(0, 5))}</small>` : ""}${x.notes ? `<small>${esc(x.notes)}</small>` : ""}`;
    };
    printHtml(
      `<html><head><title>Horarios</title><style>@page{size:landscape;margin:8mm}body{font-family:Arial;color:#18181b}h1{font-family:Georgia;margin:0}h2{margin:18px 0 5px;font-size:14px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7px;page-break-inside:avoid}th,td{border:1px solid #aaa;padding:4px;text-align:center;vertical-align:top;overflow-wrap:anywhere}th{background:#222;color:#fff}.employee{width:90px;text-align:left;font-weight:bold}td b,td span,td small{display:block}td small{font-size:6px;margin-top:2px}.date{font-size:6px}</style></head><body><h1>Horario de empleados</h1><p>Periodo: ${esc(printFrom)} a ${esc(printTo)}</p>${printGroups.map((g) => `<section><h2>${esc(g.area.name)}</h2><table><thead><tr><th class="employee">Empleado</th>${dates.map((d) => `<th><span>${new Date(`${d}T12:00:00`).toLocaleDateString("es-GT", { weekday: "short" })}</span><span class="date">${d.slice(8, 10)}/${d.slice(5, 7)}</span></th>`).join("")}</tr></thead><tbody>${g.people.map((e) => `<tr><td class="employee">${esc(e.name)}</td>${dates.map((d) => `<td>${cell(e.id, d)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`).join("")}</body></html>`,
    );
  }
  const grouped = useMemo(
    () =>
      [
        ...areas,
        { id: "unassigned", name: "Sin área", color: "#71717a", active: true },
      ]
        .map((a) => ({
          area: a,
          people: employees.filter(
            (e) =>
              (a.id === "unassigned" ? !e.area_id : e.area_id === a.id) &&
              (!search.trim() ||
                e.name.toLowerCase().includes(search.toLowerCase())),
          ),
        }))
        .filter((g) => g.people.length),
    [areas, employees, search],
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
          <div className="monthSelectors">
            <select
              value={month.slice(5, 7)}
              onChange={(e) =>
                setMonth(`${month.slice(0, 4)}-${e.target.value}`)
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1).padStart(2, "0")}>
                  {new Date(2026, i, 1).toLocaleDateString("es-GT", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
            <select
              value={month.slice(0, 4)}
              onChange={(e) =>
                setMonth(`${e.target.value}-${month.slice(5, 7)}`)
              }
            >
              {Array.from(
                { length: 7 },
                (_, i) => new Date().getFullYear() - 2 + i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="buttonRow">
          <input
            className="moduleSearch"
            placeholder="Buscar empleado…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
      <section className="moduleCard scheduleAssignmentCard">
        <p className="scheduleHelp">
          Asigne un día o periodo. Arrastre una celda con horario hacia otro día
          o empleado para copiarla; también puede tocarla para editar o borrar.
        </p>
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
          <span className="areaIndicator">
            Área:{" "}
            {areas.find((a) => a.id === form.area_id)?.name || "Sin asignar"}
          </span>
          <input
            required
            type="date"
            value={form.work_date}
            onChange={(e) =>
              setForm({
                ...form,
                work_date: e.target.value,
                work_date_to: e.target.value,
              })
            }
          />
          <input
            required
            type="date"
            title="Aplicar hasta"
            value={form.work_date_to}
            onChange={(e) => setForm({ ...form, work_date_to: e.target.value })}
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
          <label className="compactField">
            Inicio comida
            <input
              type="time"
              value={form.break_start}
              onChange={(e) =>
                setForm({ ...form, break_start: e.target.value })
              }
            />
          </label>
          <label className="compactField">
            Fin comida
            <input
              type="time"
              value={form.break_end}
              onChange={(e) => setForm({ ...form, break_end: e.target.value })}
            />
          </label>
          <input
            placeholder="Notas o motivo"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button className="primary">Guardar día o periodo</button>
          {rows.some(
            (x) =>
              x.employee_id === form.employee_id &&
              x.work_date === form.work_date,
          ) && (
            <button
              type="button"
              className="dangerButton"
              onClick={deleteAssignment}
            >
              <Trash2 /> Borrar este día
            </button>
          )}
        </form>
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
                  gridTemplateColumns: `150px repeat(${daysIn(month)}, minmax(48px, 1fr))`,
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
                    gridTemplateColumns: `150px repeat(${daysIn(month)}, minmax(48px, 1fr))`,
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
                        draggable={Boolean(x)}
                        onDragStart={() => x && setDragged(x)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => copyByDrag(e, date)}
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
                            work_date_to: date,
                            shift_id: x?.shift_id || "",
                            entry_type: x?.entry_type || "work",
                            break_start: x?.break_start?.slice(0, 5) || "",
                            break_end: x?.break_end?.slice(0, 5) || "",
                            notes: x?.notes || "",
                          })
                        }
                      >
                        {x?.entry_type === "rest" ? (
                          <b>D</b>
                        ) : x?.entry_type === "permission" ? (
                          <b>P</b>
                        ) : (
                          <>
                            <b>
                              {(() => {
                                const shift = shifts.find(
                                  (s) => s.id === x?.shift_id,
                                );
                                return shift
                                  ? `${shift.start_time.slice(0, 2)}–${shift.end_time.slice(0, 2)}`
                                  : "·";
                              })()}
                            </b>
                            {x?.break_start && x?.break_end && (
                              <small>
                                Comida {x.break_start.slice(0, 5)}–
                                {x.break_end.slice(0, 5)}
                              </small>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
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
        quote_style: "moderna",
        quote_color: "#18181b",
        quote_text_color: "#18181b",
        quote_header_color: "#18181b",
        quote_accent: "#ea580c",
        fixed_customer_note: true,
        customer_note: "",
        logo_data_url: "",
        business_address: "",
        business_email: "",
        business_country: "Guatemala",
        business_phone: "",
        business_currency: "GTQ",
        quote_show_client_name: true,
        quote_show_client_phone: true,
        quote_show_client_email: true,
        quote_show_event_date: true,
        quote_show_event_time: true,
        quote_show_area: true,
        quote_show_guests: true,
        quote_show_customer_note: true,
        quote_custom_client_fields: [],
        quote_custom_adjustments: [],
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
      break_minutes: 0,
    }),
    [product, setProduct] = useState({ name: "", description: "", price: 0 }),
    [notice, setNotice] = useState(""),
    [removeLogoBackground, setRemoveLogoBackground] = useState(true);
  const [customClientField, setCustomClientField] = useState({
    label: "",
    type: "text",
  });
  const [customAdjustment, setCustomAdjustment] = useState({
    label: "",
    kind: "discount",
    mode: "fixed",
    default_value: 0,
  });
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
    const nextForm = {
      ...form,
      settings: {
        ...form.settings,
        business_phone: form.phone,
        business_country: form.country,
        business_currency: form.currency,
      },
    };
    const r = await supabase
      .from("v2_restaurants")
      .update(nextForm)
      .eq("id", restaurantId);
    if (r.error) return setNotice(r.error.message);
    onNameChange(form.name);
    setForm(nextForm);
    onSettingsChange(nextForm.settings);
    setNotice("Configuración guardada.");
  }
  function selectLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return setNotice("Seleccione una imagen válida.");
    if (file.size > 8000000)
      return setNotice("El logo debe pesar menos de 8 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas
          .getContext("2d")
          ?.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (removeLogoBackground) removeConnectedLogoBackground(canvas);
        setting("logo_data_url", canvas.toDataURL("image/png"));
        setNotice("Logo cargado. Presione Guardar configuración.");
      };
      image.src = String(reader.result || "");
    };
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
      break_minutes: 0,
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
  const configId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `field-${Date.now()}`;
  function addCustomClientField(e: React.FormEvent) {
    e.preventDefault();
    const label = customClientField.label.trim();
    if (!label) return;
    setting("quote_custom_client_fields", [
      ...(form.settings.quote_custom_client_fields || []),
      { id: configId(), label, type: customClientField.type, active: true },
    ]);
    setCustomClientField({ label: "", type: "text" });
  }
  function addCustomAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const label = customAdjustment.label.trim();
    if (!label) return;
    setting("quote_custom_adjustments", [
      ...(form.settings.quote_custom_adjustments || []),
      { ...customAdjustment, id: configId(), label, active: true },
    ]);
    setCustomAdjustment({
      label: "",
      kind: "discount",
      mode: "fixed",
      default_value: 0,
    });
  }
  const tabs = [
    "general",
    "reservaciones",
    "cotizaciones",
    "horarios",
    "usuarios",
    "seguridad",
  ];
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
      {tab === "usuarios" ? (
        <UsersModule />
      ) : tab === "seguridad" ? (
        <SecurityCenter restaurantId={restaurantId} />
      ) : (
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
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
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
                  Dirección del negocio
                  <input
                    placeholder="Dirección que aparecerá en la cotización"
                    value={form.settings.business_address || ""}
                    onChange={(e) =>
                      setting("business_address", e.target.value)
                    }
                  />
                </label>
                <label>
                  Correo del negocio
                  <input
                    type="email"
                    placeholder="Correo que aparecerá en la cotización"
                    value={form.settings.business_email || ""}
                    onChange={(e) => setting("business_email", e.target.value)}
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
                Logo del negocio (hasta 8 MB)
                <span className="checkLine">
                  <input
                    type="checkbox"
                    checked={removeLogoBackground}
                    onChange={(e) => setRemoveLogoBackground(e.target.checked)}
                  />
                  Quitar automáticamente el fondo blanco
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={selectLogo}
                />
                {form.settings.logo_data_url && (
                  <TransparentLogo
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
              <div>
                <h3>Estilo de cotización</h3>
                <div className="styleChoices">
                  {[
                    ["moderna", "Moderna", "Limpia, visual y contemporánea"],
                    ["clasica", "Clásica", "Formal, elegante y tradicional"],
                    ["basica", "Básica", "Directa, compacta y sencilla"],
                  ].map(([value, title, description]) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        form.settings.quote_style === value ? "active" : ""
                      }
                      onClick={() => setting("quote_style", value)}
                    >
                      <b>{title}</b>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
              </div>
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
                  Color de la letra
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_text_color || form.settings.quote_color}
                      onChange={(e) => setting("quote_text_color", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_text_color || form.settings.quote_color} />
                  </span>
                </label>
                <label>
                  Color del encabezado
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_header_color || form.settings.quote_color}
                      onChange={(e) => setting("quote_header_color", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_header_color || form.settings.quote_color} />
                  </span>
                </label>
                <label>
                  Color de acento
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_accent}
                      onChange={(e) => setting("quote_accent", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_accent} />
                  </span>
                </label>
              </div>
              <div>
                <h3>Campos visibles en la cotización</h3>
                <p className="sectionHint">
                  Quite los campos que no desea mostrar al cliente en el
                  preview y PDF.
                </p>
                <div className="automationList quoteFieldToggles">
                  {[
                    ["quote_show_client_name", "Nombre del cliente"],
                    ["quote_show_client_phone", "Teléfono del cliente"],
                    ["quote_show_client_email", "Correo del cliente"],
                    ["quote_show_event_date", "Fecha del evento"],
                    ["quote_show_event_time", "Hora del evento"],
                    ["quote_show_area", "Área del evento"],
                    ["quote_show_guests", "Número de invitados"],
                    ["quote_show_customer_note", "Nota para el cliente"],
                  ].map(([key, title]) => (
                    <Toggle
                      key={key}
                      title={title}
                      checked={form.settings[key] !== false}
                      set={(value) => setting(key, value)}
                    />
                  ))}
                </div>
              </div>
              <div className="configBuilder">
                <div>
                  <h3>Campos adicionales del cliente</h3>
                  <p className="sectionHint">
                    Agregue datos como empresa, NIT, dirección o notas. Se
                    completarán por separado en cada cotización.
                  </p>
                </div>
                <form className="customConfigForm" onSubmit={addCustomClientField}>
                  <input
                    required
                    placeholder="Nombre del campo"
                    value={customClientField.label}
                    onChange={(e) =>
                      setCustomClientField({
                        ...customClientField,
                        label: e.target.value,
                      })
                    }
                  />
                  <select
                    value={customClientField.type}
                    onChange={(e) =>
                      setCustomClientField({
                        ...customClientField,
                        type: e.target.value,
                      })
                    }
                  >
                    <option value="text">Texto corto</option>
                    <option value="textarea">Notas</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                  </select>
                  <button className="secondary" type="submit">Agregar campo</button>
                </form>
                <div className="configRows">
                  {(form.settings.quote_custom_client_fields || []).map((field: any) => (
                    <article key={field.id}>
                      <div><b>{field.label}</b><small>{field.type}</small></div>
                      <Toggle
                        title="Mostrar"
                        checked={field.active !== false}
                        set={(active) =>
                          setting(
                            "quote_custom_client_fields",
                            form.settings.quote_custom_client_fields.map((x: any) =>
                              x.id === field.id ? { ...x, active } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="iconButton"
                        aria-label={`Eliminar ${field.label}`}
                        onClick={() =>
                          setting(
                            "quote_custom_client_fields",
                            form.settings.quote_custom_client_fields.filter((x: any) => x.id !== field.id),
                          )
                        }
                      ><Trash2 /></button>
                    </article>
                  ))}
                </div>
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
              <div className="configBuilder">
                <div>
                  <h3>Cobros y descuentos adicionales</h3>
                  <p className="sectionHint">
                    Estos conceptos aparecerán debajo de la propina y afectarán
                    el total, el saldo, el preview y el PDF.
                  </p>
                </div>
                <form className="customConfigForm adjustmentBuilder" onSubmit={addCustomAdjustment}>
                  <input
                    required
                    placeholder="Ej. Descuento de anticipo de evento"
                    value={customAdjustment.label}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, label: e.target.value })}
                  />
                  <select
                    value={customAdjustment.kind}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, kind: e.target.value })}
                  >
                    <option value="discount">Descuento</option>
                    <option value="charge">Cobro</option>
                  </select>
                  <select
                    value={customAdjustment.mode}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, mode: e.target.value })}
                  >
                    <option value="fixed">Monto fijo</option>
                    <option value="percent">Porcentaje</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Valor predeterminado"
                    value={customAdjustment.default_value}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, default_value: Number(e.target.value) })}
                  />
                  <button className="secondary" type="submit">Agregar concepto</button>
                </form>
                <div className="configRows">
                  {(form.settings.quote_custom_adjustments || []).map((charge: any) => (
                    <article key={charge.id}>
                      <div>
                        <b>{charge.label}</b>
                        <small>{charge.kind === "discount" ? "Descuento" : "Cobro"} · {charge.mode === "percent" ? "Porcentaje" : "Monto fijo"}</small>
                      </div>
                      <Toggle
                        title="Usar"
                        checked={charge.active !== false}
                        set={(active) =>
                          setting(
                            "quote_custom_adjustments",
                            form.settings.quote_custom_adjustments.map((x: any) =>
                              x.id === charge.id ? { ...x, active } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="iconButton"
                        aria-label={`Eliminar ${charge.label}`}
                        onClick={() =>
                          setting(
                            "quote_custom_adjustments",
                            form.settings.quote_custom_adjustments.filter((x: any) => x.id !== charge.id),
                          )
                        }
                      ><Trash2 /></button>
                    </article>
                  ))}
                </div>
              </div>
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
      )}
    </div>
  );
}
function removeConnectedLogoBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
    data = image.data,
    width = canvas.width,
    height = canvas.height,
    corners = [0, width - 1, (height - 1) * width, height * width - 1],
    background = corners
      .reduce(
        (sum, pixel) => {
          const i = pixel * 4;
          return [sum[0] + data[i], sum[1] + data[i + 1], sum[2] + data[i + 2]];
        },
        [0, 0, 0],
      )
      .map((value) => value / corners.length),
    queue = [...corners],
    visited = new Uint8Array(width * height);
  const distance = (pixel: number) => {
    const i = pixel * 4;
    return Math.sqrt(
      (data[i] - background[0]) ** 2 +
        (data[i + 1] - background[1]) ** 2 +
        (data[i + 2] - background[2]) ** 2,
    );
  };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const pixel = queue[cursor];
    if (pixel < 0 || pixel >= width * height || visited[pixel]) continue;
    visited[pixel] = 1;
    const delta = distance(pixel);
    if (delta > 62) continue;
    const i = pixel * 4;
    data[i + 3] = delta < 24 ? 0 : Math.round(((delta - 24) / 38) * 255);
    const x = pixel % width;
    if (x > 0) queue.push(pixel - 1);
    if (x < width - 1) queue.push(pixel + 1);
    if (pixel >= width) queue.push(pixel - width);
    if (pixel < width * (height - 1)) queue.push(pixel + width);
  }
  ctx.putImageData(image, 0, 0);
  const refined = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < refined.data.length; i += 4) {
    const r = refined.data[i],
      g = refined.data[i + 1],
      b = refined.data[i + 2],
      lightest = Math.min(r, g, b),
      neutral = Math.max(r, g, b) - lightest < 24;
    if (neutral && lightest > 205) {
      const opacity = Math.max(0, Math.min(1, (245 - lightest) / 40));
      refined.data[i + 3] = Math.round(refined.data[i + 3] * opacity);
    }
  }
  ctx.putImageData(refined, 0, 0);
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
