"use client";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges, useDraftBaseline } from "@/lib/unsaved-changes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Copy, FileSpreadsheet, Info, Maximize2, Minimize2, Pencil, Printer, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requirePermission, ACCESS_DENIED } from "@/lib/permissions";
import { printHtml } from "@/lib/print";
import type { Client, Quote, Reservation } from "@/lib/types";
import { UsersModule } from "@/components/users-module";
import { SecurityCenter } from "@/components/security-center";
import { TransparentLogo } from "@/components/transparent-logo";
import { emailLanguage } from "@/lib/email-language";
import { appCurrency, appLanguage, appLocale, currentAppLanguage, formatAppMoney, useAppPreferences } from "@/components/app-preferences";
import { recordAuditActivity } from "@/lib/audit-activity";
import { localDateISO } from "@/lib/local-date";
import { readScheduleRange, readScheduleReferences } from "@/lib/schedule-range";

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
const iso = (d: Date) => localDateISO(d);
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

export function MonthlySchedules({ restaurantId, canEdit = false }: { restaurantId: string; canEdit?: boolean }) {
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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSelectionSearch, setEmployeeSelectionSearch] = useState("");
  const [assignmentDateMode, setAssignmentDateMode] = useState<"single" | "range">("single");
  const scheduleDraft = useDraftBaseline({ form, selectedEmployeeIds });
  useUnsavedChanges(canEdit && scheduleDraft.dirty, scheduleDraft.markSaved);

  const [assignmentPanelCollapsed, setAssignmentPanelCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const selectableEmployees = useMemo(() => {
    const query = employeeSelectionSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => {
      const areaName = areas.find((area) => area.id === employee.area_id)?.name || "Sin área";
      return [employee.name, employee.employee_code, areaName].some((value) =>
        String(value || "").toLowerCase().includes(query),
      );
    });
  }, [employees, areas, employeeSelectionSearch]);
  const load = useCallback(async () => {
    try {
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
      readScheduleRange(supabase, restaurantId, start, end),
    ]);
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    const error = a.error || e.error || s.error;
    if (error) throw error;
    setRows(w);
    } catch (error) {
      setNotice(userMessage(error));
    }
  }, [restaurantId, month]);
  useEffect(() => {
    void load().catch((error) => setNotice(userMessage(error)));
    setPrintFrom(`${month}-01`);
    setPrintTo(`${month}-${String(daysIn(month)).padStart(2, "0")}`);
  }, [load, month]);
  async function authorizeSchedule() {
    try {
      if (!canEdit) throw new Error(ACCESS_DENIED);
      await requirePermission(supabase, restaurantId, "canManageSchedules");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : ACCESS_DENIED);
      return false;
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorizeSchedule())) return;
    const targetIds = selectedEmployeeIds.length ? selectedEmployeeIds : [form.employee_id].filter(Boolean),
      start = new Date(`${form.work_date}T12:00:00`),
      end = new Date(`${form.work_date_to || form.work_date}T12:00:00`),
      payload = [];
    if (!targetIds.length) return setNotice("Seleccione uno o varios empleados.");
    if (end < start)
      return setNotice("La fecha final no puede ser anterior a la inicial.");
    for (const employeeId of targetIds) {
      const employee = employees.find((x) => x.id === employeeId);
      for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1))
        payload.push({
        restaurant_id: restaurantId,
        employee_id: employeeId,
        work_date: iso(day),
        area_id: employee?.area_id || form.area_id || null,
        shift_id: form.entry_type === "work" ? form.shift_id || null : null,
        entry_type: form.entry_type,
        break_start:
          form.entry_type === "work" ? form.break_start || null : null,
        break_end: form.entry_type === "work" ? form.break_end || null : null,
        notes: form.notes,
      });
    }
    const r = await supabase
      .from("v2_schedules")
      .upsert(payload, { onConflict: "restaurant_id,employee_id,work_date" });
    if (r.error) return setNotice(r.error.message);
    scheduleDraft.markSaved();
    setNotice(
      payload.length === 1
        ? "Horario guardado."
        : `${payload.length} días asignados.`,
    );
    load();
  }
  async function deleteAssignment() {
    if (!(await authorizeSchedule())) return;
    if (
      !(selectedEmployeeIds.length || form.employee_id) ||
      !form.work_date ||
      !window.confirm("¿Eliminar la asignación de este día?")
    )
      return;
    const targetIds = selectedEmployeeIds.length ? selectedEmployeeIds : [form.employee_id];
    const r = await supabase
      .from("v2_schedules")
      .delete()
      .eq("restaurant_id", restaurantId)
      .in("employee_id", targetIds)
      .eq("work_date", form.work_date);
    if (r.error) return setNotice(r.error.message);
    setNotice("Asignación eliminada.");
    load();
  }
  async function deletePeriod() {
    if (!(await authorizeSchedule())) return;
    const targetIds = selectedEmployeeIds.length ? selectedEmployeeIds : [form.employee_id].filter(Boolean);
    if (!targetIds.length || !form.work_date || !form.work_date_to)
      return setNotice("Seleccione empleado y rango de fechas.");
    if (!window.confirm(`¿Borrar los horarios de ${targetIds.length} empleado(s) entre ${form.work_date} y ${form.work_date_to}?`)) return;
    const r = await supabase.from("v2_schedules").delete()
      .eq("restaurant_id", restaurantId).in("employee_id", targetIds)
      .gte("work_date", form.work_date).lte("work_date", form.work_date_to);
    if (r.error) return setNotice(r.error.message);
    setNotice("Horarios del periodo eliminados.");
    load();
  }
  async function copyByDrag(employee: Employee, date: string) {
    if (!(await authorizeSchedule())) return;
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
    if (!(await authorizeSchedule())) return;
    if (!patternEligible)
      return setNotice("Necesito dos semanas completas para detectar el patrón. Complete los primeros 14 días de cada empleado.");
    const payload: any[] = [];
    for (const e of employees) {
      const template = rows.filter((x) => x.employee_id === e.id && Number(x.work_date.slice(8, 10)) <= 14);
      for (let d = 15; d <= daysIn(month); d++) {
        const sourceDay = ((d - 1) % 14) + 1,
          source = template.find((x) => Number(x.work_date.slice(8, 10)) === sourceDay),
          date = `${month}-${String(d).padStart(2, "0")}`;
        if (!source || rows.some((x) => x.employee_id === e.id && x.work_date === date)) continue;
        const { id, work_date, ...copy } = source;
        payload.push({ ...copy, restaurant_id: restaurantId, employee_id: e.id, work_date: date });
      }
    }
    if (!payload.length) return setNotice("No hay días vacíos que completar con el patrón detectado.");
    const r = await supabase
      .from("v2_schedules")
      .upsert(payload, { onConflict: "restaurant_id,employee_id,work_date" });
    if (r.error) return setNotice(r.error.message);
    setNotice(`${payload.length} días generados usando el patrón de las primeras dos semanas.`);
    load();
  }
  async function copyPrevious() {
    if (!(await authorizeSchedule())) return;
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
  async function print() {
    const { selected, exportEmployees, exportAreas, exportShifts } = await schedulesForSelectedRange(),
      dates: string[] = [];
    for (
      const d = new Date(`${printFrom}T12:00:00`),
        end = new Date(`${printTo}T12:00:00`);
      d <= end;
      d.setDate(d.getDate() + 1)
    )
      dates.push(iso(d));
    const printGroups = [
      ...exportAreas,
      { id: "unassigned", name: "Sin área", color: "#71717a", active: true },
    ]
      .map((area) => ({
        area,
        people: exportEmployees.filter((e) =>
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
      const s = exportShifts.find((v) => v.id === x.shift_id);
      return `<b>${esc(s?.name || "Turno")}</b><span>${esc(s?.start_time?.slice(0, 5))}–${esc(s?.end_time?.slice(0, 5))}</span>${x.break_start && x.break_end ? `<small>Comida ${esc(x.break_start.slice(0, 5))}–${esc(x.break_end.slice(0, 5))}</small>` : ""}${x.notes ? `<small>${esc(x.notes)}</small>` : ""}`;
    };
    printHtml(
      `<html><head><title>Horarios</title><style>@page{size:landscape;margin:8mm}body{font-family:Arial;color:#18181b}h1{font-family:Georgia;margin:0}h2{margin:18px 0 5px;font-size:14px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7px;page-break-inside:avoid}th,td{border:1px solid #aaa;padding:4px;text-align:center;vertical-align:top;overflow-wrap:anywhere}th{background:#222;color:#fff}.employee{width:90px;text-align:left;font-weight:bold}td b,td span,td small{display:block}td small{font-size:6px;margin-top:2px}.date{font-size:6px}</style></head><body><h1>Horario de empleados</h1><p>Periodo: ${esc(printFrom)} a ${esc(printTo)}</p>${printGroups.map((g) => `<section><h2>${esc(g.area.name)}</h2><table><thead><tr><th class="employee">Empleado</th>${dates.map((d) => `<th><span>${new Date(`${d}T12:00:00`).toLocaleDateString(appLocale(), { weekday: "short" })}</span><span class="date">${d.slice(8, 10)}/${d.slice(5, 7)}</span></th>`).join("")}</tr></thead><tbody>${g.people.map((e) => `<tr><td class="employee">${esc(e.name)}</td>${dates.map((d) => `<td>${cell(e.id, d)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`).join("")}</body></html>`,
    );
    await recordAuditActivity(restaurantId, "impresion", "horarios", { label: "Horario de empleados", from: printFrom, to: printTo, rows: selected.length });
  }
  async function schedulesForSelectedRange() {
    const selected = await readScheduleRange(supabase, restaurantId, printFrom, printTo);
    if (!selected.length) throw new Error("No hay horarios en el rango seleccionado.");
    const [exportEmployees, exportShifts] = await Promise.all([
      readScheduleReferences<Employee>(supabase, restaurantId, "v2_employees", "id,name,employee_code,area_id,active", selected.map((row) => row.employee_id)),
      readScheduleReferences<Shift>(supabase, restaurantId, "v2_shifts", "id,name,start_time,end_time,break_minutes,active", selected.flatMap((row) => row.shift_id ? [row.shift_id] : [])),
    ]);
    const exportAreas = await readScheduleReferences<Area>(supabase, restaurantId, "v2_areas", "id,name,color,active",
      [...selected.map((row) => row.area_id), ...exportEmployees.map((employee) => employee.area_id)].filter((id): id is string => Boolean(id)));
    exportEmployees.sort((a, b) => a.name.localeCompare(b.name, appLocale()));
    return { selected, exportEmployees, exportShifts, exportAreas };
  }
  async function performScheduleExport(action: () => Promise<void>) {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    setNotice("");
    try { await action(); }
    catch (error) { setNotice(userMessage(error)); }
    finally { exportLock.current = false; setExporting(false); }
  }
  async function exportScheduleExcel() {
    const { selected, exportEmployees, exportAreas, exportShifts } = await schedulesForSelectedRange();
    const language = currentAppLanguage();
    const employeeById = new Map(exportEmployees.map((item) => [item.id, item]));
    const areaById = new Map(exportAreas.map((item) => [item.id, item]));
    const shiftById = new Map(exportShifts.map((item) => [item.id, item]));
    const data = selected.map((row) => {
      const employee = employeeById.get(row.employee_id);
      const area = areaById.get(row.area_id || employee?.area_id || "");
      const shift = row.entry_type === "work" ? shiftById.get(row.shift_id || "") : undefined;
      return language === "en" ? {
        Date: row.work_date,
        Employee: employee?.name || "",
        "Employee ID": employee?.employee_code || "",
        Area: area?.name || "No area",
        Type: row.entry_type === "work" ? "Shift" : row.entry_type === "rest" ? "Day off" : "Leave",
        Shift: shift?.name || "",
        Start: shift?.start_time?.slice(0, 5) || "",
        End: shift?.end_time?.slice(0, 5) || "",
        "Meal start": row.break_start?.slice(0, 5) || "",
        "Meal end": row.break_end?.slice(0, 5) || "",
        Notes: row.notes || "",
      } : {
        Fecha: row.work_date,
        Empleado: employee?.name || "",
        "ID empleado": employee?.employee_code || "",
        Área: area?.name || "Sin área",
        Tipo: row.entry_type === "work" ? "Turno" : row.entry_type === "rest" ? "Descanso" : "Permiso",
        Turno: shift?.name || "",
        Entrada: shift?.start_time?.slice(0, 5) || "",
        Salida: shift?.end_time?.slice(0, 5) || "",
        "Inicio comida": row.break_start?.slice(0, 5) || "",
        "Fin comida": row.break_end?.slice(0, 5) || "",
        Notas: row.notes || "",
      };
    });
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [12, 24, 14, 18, 14, 20, 10, 10, 14, 14, 30].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, worksheet, language === "en" ? "Schedules" : "Horarios");
    XLSX.writeFile(workbook, `${language === "en" ? "schedules" : "horarios"}-${printFrom}-${printTo}.xlsx`);
    await recordAuditActivity(restaurantId, "excel_exportado", "horarios", { label: "Horario de empleados", from: printFrom, to: printTo, rows: selected.length });
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
  const scheduleByEmployeeAndDate = useMemo(
    () => new Map(rows.map((row) => [`${row.employee_id}|${row.work_date}`, row])),
    [rows],
  );
  const patternEligible = useMemo(() => {
    if (!employees.length) return false;
    return employees.every((employee) =>
      Array.from({ length: 14 }, (_, index) => index + 1).every((day) =>
        rows.some(
          (row) =>
            row.employee_id === employee.id &&
            Number(row.work_date.slice(8, 10)) === day,
        ),
      ),
    );
  }, [rows, employees]);
  return (
    <div className="moduleStack">
      <section className="moduleCard">
        <div className="moduleTitle">
          <div>
            <h2>Horario mensual</h2>
            <p>
              {canEdit ? "Empleados agrupados por área. Genere, copie y ajuste excepciones." : "Consulte los horarios por mes y empleado, o imprima el rango que necesite."}
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
                  {new Date(2026, i, 1).toLocaleDateString(appLocale(), {
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
          {canEdit && <>
          <button className="secondary" onClick={copyPrevious}>
            <Copy />
            Copiar mes anterior
          </button>
          <button className="primary" onClick={generate} title={patternEligible ? "Completar el mes con el patrón de 14 días" : "Necesito dos semanas completas para detectar el patrón"}>
            <Sparkles />
            Generar automáticamente
          </button>
          </>}
        </div>
        {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      </section>
      {canEdit && (
      <section className={`moduleCard scheduleAssignmentCard${assignmentPanelCollapsed ? " collapsed" : ""}`}>
        <div className="scheduleAssignmentHeader">
          <p className="scheduleHelp">
            <b>Asignar empleados y turnos</b>
            {!assignmentPanelCollapsed && (
              <span>Asigne un día o periodo. Puede cambiar la altura arrastrando la esquina inferior derecha.</span>
            )}
          </p>
          {!assignmentPanelCollapsed && <span className="scheduleCollapseHint"><Info /> Puede minimizar este cuadro para ver más del calendario.</span>}
          <button
            type="button"
            className="secondary schedulePanelToggle"
            aria-expanded={!assignmentPanelCollapsed}
            onClick={() => setAssignmentPanelCollapsed((collapsed) => !collapsed)}
          >
            {assignmentPanelCollapsed ? <Maximize2 /> : <Minimize2 />}
            {assignmentPanelCollapsed ? "Abrir" : "Minimizar"}
          </button>
        </div>
        {!assignmentPanelCollapsed && (
        <form className="scheduleEditor" onSubmit={save}>
          <div className="employeeMultiSelect">
            <div className="employeeMultiSelectHeader">
              <b>
                {selectedEmployeeIds.length
                  ? `${selectedEmployeeIds.length} empleado(s) seleccionado(s)`
                  : "Seleccione empleados"}
              </b>
              <span>
                <button
                  type="button"
                  onClick={() => {
                    const ids = Array.from(new Set([
                      ...selectedEmployeeIds,
                      ...selectableEmployees.map((employee) => employee.id),
                    ]));
                    setSelectedEmployeeIds(ids);
                    setForm({ ...form, employee_id: ids[0] || "", area_id: "" });
                  }}
                >
                  Todos visibles
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployeeIds([]);
                    setForm({ ...form, employee_id: "", area_id: "" });
                  }}
                >
                  Limpiar
                </button>
              </span>
            </div>
            <div className="employeeSelectionSearch">
              <input
                type="search"
                placeholder="Buscar por nombre, área o ID…"
                value={employeeSelectionSearch}
                onChange={(event) => setEmployeeSelectionSearch(event.target.value)}
              />
              {employeeSelectionSearch && (
                <button type="button" onClick={() => setEmployeeSelectionSearch("")} aria-label="Limpiar búsqueda">×</button>
              )}
            </div>
            <div className="employeeMultiSelectOptions">
              {selectableEmployees.map((employee) => {
                const checked = selectedEmployeeIds.includes(employee.id);
                return (
                  <label key={employee.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const ids = checked
                          ? selectedEmployeeIds.filter((id) => id !== employee.id)
                          : [...selectedEmployeeIds, employee.id];
                        const first = employees.find((item) => item.id === ids[0]);
                        setSelectedEmployeeIds(ids);
                        setForm({
                          ...form,
                          employee_id: ids[0] || "",
                          area_id: ids.length === 1 ? first?.area_id || "" : "",
                        });
                      }}
                    />
                    <span>
                      <small>{areas.find((area) => area.id === employee.area_id)?.name || "Sin área"}</small>
                      {employee.name}
                    </span>
                  </label>
                );
              })}
              {!selectableEmployees.length && (
                <p className="employeeSelectionEmpty">No se encontraron empleados.</p>
              )}
            </div>
          </div>
          <span className="areaIndicator">
            Área:{" "}
            {areas.find((a) => a.id === form.area_id)?.name || "Sin asignar"}
          </span>
          <div className="dateModeToggle">
            <button
              type="button"
              className={assignmentDateMode === "single" ? "active" : ""}
              onClick={() => {
                setAssignmentDateMode("single");
                setForm({ ...form, work_date_to: form.work_date });
              }}
            >
              Una fecha
            </button>
            <button
              type="button"
              className={assignmentDateMode === "range" ? "active" : ""}
              onClick={() => setAssignmentDateMode("range")}
            >
              Rango
            </button>
          </div>
          <label className="compactField">
            {assignmentDateMode === "single" ? "Fecha" : "Desde"}
            <input
              required
              type="date"
              value={form.work_date}
              onChange={(e) =>
                setForm({ ...form, work_date: e.target.value, work_date_to: e.target.value })
              }
            />
          </label>
          {assignmentDateMode === "range" && <label className="compactField">
            Hasta
            <input
              required
              type="date"
              value={form.work_date_to}
              min={form.work_date}
              onChange={(e) => setForm({ ...form, work_date_to: e.target.value })}
            />
          </label>}
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
          <button className="primary">{assignmentDateMode === "single" ? "Guardar o modificar fecha" : "Guardar o modificar rango"}</button>
          <button type="button" className="dangerButton" onClick={deletePeriod}>
            <Trash2 /> {assignmentDateMode === "single" ? "Borrar fecha" : "Borrar rango"}
          </button>
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
        )}
      </section>
      )}
      <section className="moduleCard printBar">
        <div>
          <b>Descargar o imprimir horarios</b>
          <span>Seleccione el rango necesario.</span>
        </div>
        <input
          type="date"
          value={printFrom}
          disabled={exporting}
          onChange={(e) => setPrintFrom(e.target.value)}
        />
        <input
          type="date"
          value={printTo}
          disabled={exporting}
          onChange={(e) => setPrintTo(e.target.value)}
        />
        <button className="primary" disabled={exporting} onClick={() => performScheduleExport(print)}>
          <Printer />
          Imprimir
        </button>
        <button className="secondary" disabled={exporting} onClick={() => performScheduleExport(exportScheduleExcel)}>
          <FileSpreadsheet />
          Excel
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
                      x = scheduleByEmployeeAndDate.get(`${e.id}|${date}`);
                    return (
                      <button
                        key={date}
                        draggable={canEdit && Boolean(x)}
                        aria-disabled={!canEdit}
                        onDragStart={() => canEdit && x && setDragged(x)}
                        onDragOver={(event) => { if (canEdit) event.preventDefault(); }}
                        onDrop={() => { if (canEdit) void copyByDrag(e, date); }}
                        className={x?.entry_type || "empty"}
                        title={
                          x
                            ? `${x.entry_type} ${x.break_start || ""} ${x.notes || ""}`
                            : "Sin asignar"
                        }
                        onClick={() => {
                          if (!canEdit) return;
                          setSelectedEmployeeIds([e.id]);
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
                          });
                        }}
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
        {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      </section>
    </div>
  );
}

function AccountSettings() {
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useUnsavedChanges(email !== savedEmail || Boolean(targetUserId || confirmation), () => {
    setEmail(savedEmail); setTargetUserId(""); setConfirmation("");
  });
  const authorizedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}`, ...(options.headers || {}) },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "No se pudo completar la operación.");
    return json;
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || "");
      setEmail(data.user?.email || "");
      setSavedEmail(data.user?.email || "");
    });
    authorizedFetch("/api/users").then(setMembers).catch((error) => setNotice(error.message));
  }, [authorizedFetch]);

  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    const result = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: "https://mrmaa.com/?login=1" });
    setBusy(false);
    if (!result.error) setSavedEmail(email);
    setNotice(result.error ? result.error.message : "Revise el correo nuevo y confirme el cambio desde el enlace recibido.");
  }

  async function accountAction(action: "transfer" | "delete_account", extra: Record<string, string>) {
    setBusy(true); setNotice("");
    try {
      await authorizedFetch("/api/account", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      if (action === "transfer") {
        setNotice("Administración transferida. Su cuenta ahora tiene rol de gerente.");
        window.setTimeout(() => window.location.reload(), 1200);
      } else {
        await supabase.auth.signOut();
        window.location.assign("/?login=1");
      }
    } catch (error: any) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  const eligible = members.filter((member) => member.user_id !== currentUserId && member.status === "activo");
  return <div className="moduleStack">
    <section className="moduleCard settingsPanel">
      <div className="moduleTitle"><div><h2>Cuenta</h2><p>Administre su correo y la propiedad del restaurante.</p></div></div>
      <form className="formStack" onSubmit={changeEmail}>
        <label>Correo de acceso
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <small>Supabase enviará una confirmación al nuevo correo. El cambio no se aplicará hasta confirmarlo.</small>
        <button className="primary" disabled={busy}>Cambiar correo electrónico</button>
      </form>
    </section>
    <section className="moduleCard settingsPanel">
      <div className="moduleTitle"><div><h2>Transferir administración</h2><p>Convierta a otro usuario activo en administrador principal. Su cuenta pasará a Gerente.</p></div></div>
      <div className="formStack">
        <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
          <option value="">Seleccione un usuario activo…</option>
          {eligible.map((member) => <option value={member.user_id} key={member.user_id}>{member.name} · {member.email}</option>)}
        </select>
        <button type="button" className="secondary" disabled={busy || !targetUserId} onClick={() => {
          if (window.confirm("¿Confirma que desea transferir la administración de este restaurante?"))
            accountAction("transfer", { target_user_id: targetUserId });
        }}>Transferir administración</button>
      </div>
    </section>
    <section className="moduleCard settingsPanel dangerZone">
      <div className="moduleTitle"><div><h2>Eliminar mi cuenta</h2><p>Primero debe existir otro administrador activo. Esta acción elimina su acceso personal, no los datos del restaurante.</p></div></div>
      <div className="formStack">
        <label>Escriba <b>ELIMINAR MRMAA</b> para confirmar
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        </label>
        <button type="button" className="dangerButton" disabled={busy || confirmation !== "ELIMINAR MRMAA"} onClick={() => {
          if (window.confirm("Esta acción eliminará permanentemente su cuenta de acceso. ¿Desea continuar?"))
            accountAction("delete_account", { confirmation });
        }}><Trash2 /> Eliminar definitivamente mi cuenta</button>
      </div>
    </section>
    {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
  </div>;
}

export function EnhancedSettings({
  restaurantId,
  restaurantName,
  onNameChange,
  onSettingsChange,
  onAreasChange,
  onProductsChange,
  productsOnly = false,
}: {
  restaurantId: string;
  restaurantName: string;
  onNameChange: (x: string) => void;
  onSettingsChange: (x: any) => void;
  onAreasChange?: (areas: Area[]) => void;
  onProductsChange?: (products: Product[]) => void;
  productsOnly?: boolean;
}) {
  const { setPreferences } = useAppPreferences();
  const persistedSettingsRef = useRef<any>({});
  const productSavingRef = useRef(false);
  const [tab, setTab] = useState(productsOnly ? "cotizaciones" : "general"),
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
        reservation_allow_deposits: true,
        discounts: true,
        tips: true,
        quote_font: "Georgia",
        quote_style: "moderna",
        quote_color: "#18181b",
        quote_text_color: "#18181b",
        quote_header_color: "#18181b",
        quote_middle_color: "#18181b",
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
    [reservationAreas, setReservationAreas] = useState<Area[]>([]),
    [reservationAreaName, setReservationAreaName] = useState(""),
    [reservationAreaEdit, setReservationAreaEdit] = useState(""),
    [areaBusy, setAreaBusy] = useState(false),
    [areaName, setAreaName] = useState(""),
    [employee, setEmployee] = useState({ name: "", employee_code: "", phone: "", area_id: "" }),
    [employeeEditId, setEmployeeEditId] = useState(""),
    [shift, setShift] = useState({
      name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 0,
    }),
    [product, setProduct] = useState<any>({ name: "", description: "", price: 0 }),
    [productEditId, setProductEditId] = useState(""),
    [productBusy, setProductBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [removeLogoBackground, setRemoveLogoBackground] = useState(true),
    [savedSignature, setSavedSignature] = useState("");
  const [customClientField, setCustomClientField] = useState({
    label: "",
    type: "text",
  });
  const [customAdjustment, setCustomAdjustment] = useState<any>({
    label: "",
    kind: "discount",
    mode: "fixed",
    default_value: 0,
  });
  const load = useCallback(async () => {
    const [r, a, e, s, p, ra] = await Promise.all([
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
      supabase.from("v2_reservation_areas").select("*").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
    ]);
    if (r.data) {
      const loadedLanguage = appLanguage(r.data.language);
      const loadedCurrency = appCurrency(r.data.currency);
      persistedSettingsRef.current = r.data.settings || {};
      setForm((old: any) => {
        const loaded = {
          ...old,
          ...r.data,
          language: loadedLanguage,
          currency: loadedCurrency,
          settings: { ...old.settings, ...(r.data.settings || {}) },
        };
        loaded.settings.business_currency = loaded.currency;
        setSavedSignature(JSON.stringify(loaded));
        return loaded;
      });
      setPreferences(loadedLanguage, loadedCurrency);
    }
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    setProducts((p.data || []) as Product[]);
    if (!p.error) onProductsChange?.(((p.data || []) as Product[]).filter(p => p.active));
    setReservationAreas((ra.data || []) as Area[]);
    if (!ra.error) onAreasChange?.((ra.data || []) as Area[]);
    if (ra.error) setNotice(ra.error.message);
  }, [restaurantId, setPreferences, onAreasChange, onProductsChange]);
  useEffect(() => {
    load();
  }, [load]);
  const sectionSignature = (source: any, section: string) => {
    const s = source?.settings || {};
    if (section === "general") return JSON.stringify({ name: source?.name, phone: source?.phone, country: source?.country, language: source?.language, currency: source?.currency, logo: s.logo_data_url, address: s.business_address, email: s.business_email });
    if (section === "reservaciones") return JSON.stringify({ people: s.reservation_show_people, deposits: s.reservation_show_deposits, allowDeposits: s.reservation_allow_deposits });
    if (section === "cotizaciones") return JSON.stringify({ quote_number_start: source?.quote_number_start, ...Object.fromEntries(Object.entries(s).filter(([key]) => key.startsWith("quote_") || ["discounts", "tips", "fixed_customer_note", "customer_note"].includes(key))) });
    return "saved-immediately";
  };
  const savedForm = savedSignature ? JSON.parse(savedSignature) : null;
  const sectionChanged = Boolean(savedForm && sectionSignature(form, tab) !== sectionSignature(savedForm, tab));
  const pendingDraft = tab === "horarios"
    ? Boolean(areaName.trim() || employee.name.trim() || employee.employee_code.trim() || employee.phone.trim() || employee.area_id || shift.name.trim() || shift.start_time !== "09:00" || shift.end_time !== "17:00" || shift.break_minutes !== 0)
    : tab === "cotizaciones"
      ? Boolean(product.name.trim() || product.description?.trim() || Number(product.price) || customClientField.label.trim() || customAdjustment.label.trim())
      : tab === "reservaciones" ? Boolean(reservationAreaName.trim()) : false;
  const settingsDirty = sectionChanged || pendingDraft;
  const anySettingsDirty = Boolean(savedForm && ["general", "reservaciones", "cotizaciones"].some((section) => sectionSignature(form, section) !== sectionSignature(savedForm, section))) || pendingDraft;
  useUnsavedChanges(anySettingsDirty, () => {
    ["general", "reservaciones", "cotizaciones", "horarios"].forEach(discardCurrentSection);
  });
  const settingBelongsToSection = (key: string, section: string) => {
    if (section === "general")
      return [
        "logo_data_url",
        "business_address",
        "business_email",
        "business_phone",
        "business_country",
        "business_currency",
      ].includes(key);
    if (section === "reservaciones")
      return [
        "reservation_show_people",
        "reservation_show_deposits",
        "reservation_allow_deposits",
      ].includes(key);
    if (section === "cotizaciones")
      return (
        key.startsWith("quote_") ||
        [
          "discounts",
          "tips",
          "fixed_customer_note",
          "customer_note",
        ].includes(key)
      );
    return false;
  };
  function discardCurrentSection(section: string) {
    if (section === "reservaciones") { setReservationAreaName(""); setReservationAreaEdit(""); }
    if (savedForm && ["general", "reservaciones", "cotizaciones"].includes(section)) {
      setForm((current: any) => {
        const restoredSettings = { ...(current.settings || {}) };
        const savedSettings = savedForm.settings || {};
        const keys = new Set([
          ...Object.keys(restoredSettings),
          ...Object.keys(savedSettings),
        ]);
        keys.forEach((key) => {
          if (!settingBelongsToSection(key, section)) return;
          if (Object.prototype.hasOwnProperty.call(savedSettings, key))
            restoredSettings[key] = savedSettings[key];
          else delete restoredSettings[key];
        });
        const restored = { ...current, settings: restoredSettings };
        if (section === "general") {
          restored.name = savedForm.name;
          restored.phone = savedForm.phone;
          restored.country = savedForm.country;
          restored.language = savedForm.language;
          restored.currency = savedForm.currency;
          setPreferences(savedForm.language, savedForm.currency);
        }
        if (section === "cotizaciones")
          restored.quote_number_start = savedForm.quote_number_start;
        return restored;
      });
    }
    if (section === "horarios") {
      setAreaName("");
      setEmployee({ name: "", employee_code: "", phone: "", area_id: "" });
      setEmployeeEditId("");
      setShift({
        name: "",
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: 0,
      });
    }
    if (section === "cotizaciones") {
      setProduct({ name: "", description: "", price: 0 });
      setProductEditId("");
      setCustomClientField({ label: "", type: "text" });
      setCustomAdjustment({
        label: "",
        kind: "discount",
        mode: "fixed",
        default_value: 0,
      });
    }
  }
  async function authorizeSettings() {
    try {
      await requirePermission(supabase, restaurantId, "isAdmin");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : ACCESS_DENIED);
      return false;
    }
  }
  async function authorizeProducts() {
    try {
      await requirePermission(supabase, restaurantId, "canManageQuoteProducts");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : ACCESS_DENIED);
      return false;
    }
  }
  async function save() {
    if (!(await authorizeSettings())) return;
    // Preserve assets from the settings loaded from Supabase without adding a
    // second network round trip every time the administrator presses Save.
    const currentSettings = persistedSettingsRef.current || {};
    const nextForm = {
      ...form,
      settings: {
        ...currentSettings,
        ...form.settings,
        logo_data_url:
          form.settings?.logo_data_url || currentSettings.logo_data_url || "",
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
    persistedSettingsRef.current = nextForm.settings;
    onNameChange(form.name);
    setForm(nextForm);
    setSavedSignature(JSON.stringify(nextForm));
    onSettingsChange(nextForm.settings);
    setPreferences(nextForm.language, nextForm.currency);
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
        const legacyDataUrl = canvas.toDataURL("image/png");
        canvas.toBlob(async (blob) => {
          if (!blob) return setNotice("No se pudo procesar el logo.");
          const path = `${restaurantId}/logo.png`;
          const uploaded = await supabase.storage.from("mrmaa-branding").upload(path, blob, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: true,
          });
          if (uploaded.error) {
            // Keeps existing projects functional until the scalability SQL has
            // created the Storage bucket. The next upload will use Storage.
            setting("logo_data_url", legacyDataUrl);
            return setNotice("Logo cargado. Ejecute el SQL de escalabilidad para almacenarlo de forma optimizada y presione Guardar.");
          }
          const publicUrl = supabase.storage.from("mrmaa-branding").getPublicUrl(path).data.publicUrl;
          setting("logo_data_url", `${publicUrl}?v=${Date.now()}`);
          setNotice("Logo cargado. Presione Guardar configuración.");
        }, "image/png");
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }
  async function removeReservationArea(area: Area) {
    if (areaBusy || !(await authorizeSettings())) return;
    const en = appLanguage(form.language) === "en";
    if (!window.confirm(en
      ? `Remove “${area.name}” from available areas? Existing reservations and quotes will keep their history.`
      : `¿Eliminar “${area.name}” de las áreas disponibles? Las reservas y cotizaciones anteriores conservarán su historial.`)) return;
    setAreaBusy(true);
    try {
      const result = await supabase.from("v2_reservation_areas")
        .update({ active: false }).eq("id", area.id).eq("restaurant_id", restaurantId);
      if (result.error) { setNotice(result.error.message); return; }
      if (reservationAreaEdit === area.id) {
        setReservationAreaEdit(""); setReservationAreaName("");
      }
      await load();
    } finally { setAreaBusy(false); }
  }
  async function saveReservationArea(event: React.FormEvent) {
    event.preventDefault();
    const name = reservationAreaName.trim();
    if (!name || areaBusy || !(await authorizeSettings())) return;
    setAreaBusy(true);
    try {
      const result = reservationAreaEdit
        ? await supabase.from("v2_reservation_areas").update({ name }).eq("id", reservationAreaEdit).eq("restaurant_id", restaurantId)
        : await supabase.from("v2_reservation_areas").insert({ restaurant_id: restaurantId, name });
      if (result.error) { setNotice(result.error.message); return; }
      setReservationAreaName(""); setReservationAreaEdit("");
      await load();
    } finally { setAreaBusy(false); }
  }
  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorizeSettings())) return;
    const r = await supabase
      .from("v2_areas")
      .insert({ restaurant_id: restaurantId, name: areaName });
    if (r.error) return setNotice(r.error.message);
    setAreaName("");
    load();
  }
  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorizeSettings())) return;
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
    if (!(await authorizeSettings())) return;
    const payload = {
      restaurant_id: restaurantId,
      ...employee,
      area_id: employee.area_id || null,
    };
    const r = employeeEditId
      ? await supabase.from("v2_employees").update(payload).eq("id", employeeEditId)
      : await supabase.from("v2_employees").insert(payload);
    if (r.error) return setNotice(r.error.message);
    setEmployee({ name: "", employee_code: "", phone: "", area_id: "" });
    setEmployeeEditId("");
    setNotice(employeeEditId ? "Empleado actualizado." : "Empleado agregado.");
    load();
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (productSavingRef.current) return;
    const name = product.name.trim();
    if (!name) return;
    productSavingRef.current = true;
    setProductBusy(true);
    setNotice("");
    try {
      if (!(await authorizeProducts())) return;
      const payload = { name, description: product.description, price: Number(product.price) };
      const current = await supabase.auth.getSession();
      const accessToken = current.data.session?.access_token;
      if (!accessToken) return setNotice("Su sesión no es válida. Inicie sesión nuevamente.");
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ restaurant_id: restaurantId, id: productEditId || undefined, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(result.error || "No fue posible guardar el menú o producto. Intente nuevamente.");
      setNotice(productEditId ? "Menú o producto actualizado." : "Menú o producto agregado.");
      setProduct({ name: "", description: "", price: 0 }); setProductEditId("");
      await load();
    } finally { productSavingRef.current = false; setProductBusy(false); }
  }
  async function del(table: string, id: string) {
    if (!(await authorizeSettings())) return;
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
  const tabs = productsOnly ? ["cotizaciones"] : [
    "general",
    "reservaciones",
    "cotizaciones",
    "horarios",
    "usuarios",
    "cuenta",
    "seguridad",
  ];
  return (
    <div className="settingsLayout">
      <aside>
        {tabs.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => {
              if (x === tab) return;
              if (!confirmDiscardChanges()) return;
              setTab(x);
            }}
            key={x}
          >
            {x}
          </button>
        ))}
      </aside>
      {tab === "usuarios" ? (
        <UsersModule defaultLanguage={emailLanguage(savedForm?.language)} />
      ) : tab === "cuenta" ? (
        <AccountSettings />
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
                  Idioma del restaurante
                  <select
                    value={form.language}
                    onChange={(e) => {
                      const language = appLanguage(e.target.value);
                      setForm({ ...form, language });
                      setPreferences(language, form.currency);
                    }}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                  <small>Este idioma se aplicará a toda la aplicación y será el idioma inicial de las nuevas invitaciones.</small>
                </label>
                <label>
                  Moneda
                  <select
                    value={form.currency}
                    onChange={(e) => {
                      const currency = appCurrency(e.target.value);
                      setForm({ ...form, currency });
                      setPreferences(form.language, currency);
                    }}
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
              <section className="moduleCard"><h3>Áreas para reservaciones</h3>
                <form className="inlineForm" onSubmit={saveReservationArea}>
                  <input required value={reservationAreaName} onChange={e=>setReservationAreaName(e.target.value)} placeholder="Nombre del área" />
                  <button className="primary" disabled={areaBusy}>{reservationAreaEdit ? "Guardar" : "Agregar"}</button>
                  {reservationAreaEdit && <button type="button" onClick={()=>{setReservationAreaEdit("");setReservationAreaName("");}}>Cancelar</button>}
                </form>
                <div className="compactList">{reservationAreas.map(a=><article key={a.id}><b>{a.name}</b><div className="rowActions"><button type="button" disabled={areaBusy} onClick={()=>{setReservationAreaEdit(a.id);setReservationAreaName(a.name);}}>Editar</button><button type="button" disabled={areaBusy} onClick={()=>removeReservationArea(a)}><Trash2 /> Eliminar</button></div></article>)}</div>
                {!reservationAreas.length && <p>No hay áreas de reservaciones. Agregue su primera área.</p>}
                <small>Estas áreas son independientes de Horarios.</small>
              </section>
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
                checked={form.settings.reservation_allow_deposits !== false}
                set={(v) => setting("reservation_allow_deposits", v)}
              />
            </div>
          )}
          {tab === "cotizaciones" && (
            <div className="formStack">
              {!productsOnly && <>
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
                        quote_number_start:
                          e.target.value === "" ? "" : Number(e.target.value),
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
                  Color del encabezado de productos
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_middle_color || "#18181b"}
                      onChange={(e) => setting("quote_middle_color", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_middle_color || "#18181b"} />
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
                  ].filter(([key]) => form.settings[key] !== false).map(([key, title]) => (
                    <article key={key} className="configFieldRow">
                      <b>{title}</b>
                      <button type="button" className="iconButton" title="Quitar campo" onClick={() => setting(key, false)}><Trash2 /></button>
                    </article>
                  ))}
                </div>
                {[
                  ["quote_show_client_name", "Nombre del cliente"],
                  ["quote_show_client_phone", "Teléfono del cliente"],
                  ["quote_show_client_email", "Correo del cliente"],
                  ["quote_show_event_date", "Fecha del evento"],
                  ["quote_show_event_time", "Hora del evento"],
                  ["quote_show_area", "Área del evento"],
                  ["quote_show_guests", "Número de invitados"],
                  ["quote_show_customer_note", "Nota para el cliente"],
                ].some(([key]) => form.settings[key] === false) && <div className="buttonRow">
                  <span>Restaurar:</span>
                  {[
                    ["quote_show_client_name", "Nombre"], ["quote_show_client_phone", "Teléfono"],
                    ["quote_show_client_email", "Correo"], ["quote_show_event_date", "Fecha"],
                    ["quote_show_event_time", "Hora"], ["quote_show_area", "Área"],
                    ["quote_show_guests", "Invitados"], ["quote_show_customer_note", "Nota"],
                  ].filter(([key]) => form.settings[key] === false).map(([key, title]) =>
                    <button key={key} type="button" className="secondary" onClick={() => setting(key, true)}>+ {title}</button>
                  )}
                </div>}
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
                    onChange={(e) => setCustomAdjustment({
                      ...customAdjustment,
                      default_value: e.target.value === "" ? "" : Number(e.target.value),
                    })}
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
              </>}
              <h3>Menús y productos</h3>
              <p>Puede escribir la descripción en varias líneas. Presione Enter para agregar otra línea.</p>
              <form className="productForm" onSubmit={addProduct}>
                <input
                  required
                  placeholder="Nombre"
                  value={product.name}
                  onChange={(e) =>
                    setProduct({ ...product, name: e.target.value })
                  }
                />
                <textarea
                  rows={5}
                  style={{ resize: "vertical" }}
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
                    setProduct({
                      ...product,
                      price: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
                <button className="primary" disabled={productBusy}>{productEditId ? "Guardar cambios" : "Agregar"}</button>
                {productEditId && <button type="button" disabled={productBusy} onClick={() => { if (confirmDiscardChanges()) { setProductEditId(""); setProduct({name:"",description:"",price:0}); } }}>Cancelar</button>}
              </form>
              <div className="compactList">
                {products.map((p) => (
                  <article key={p.id}>
                    <div>
                      <b>
                        {p.name} · {formatAppMoney(p.price)}
                      </b>
                      <small style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.description}</small>
                    </div>
                    <div className="rowActions">
                    <button type="button" disabled={productBusy} onClick={() => {
                      if (!confirmDiscardChanges()) return;
                      setProductEditId(p.id); setProduct({name:p.name,description:p.description || "",price:p.price});
                    }}><Pencil /> Editar</button>
                    {!productsOnly && <button type="button" disabled={productBusy} onClick={() => del("v2_quote_products", p.id)}>
                      <Trash2 />
                    </button>}
                    </div>
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
                    placeholder="ID del empleado (opcional)"
                    value={employee.employee_code}
                    onChange={(e) =>
                      setEmployee({ ...employee, employee_code: e.target.value })
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
                  <button className="primary">{employeeEditId ? "Guardar cambios" : "Agregar empleado"}</button>
                  {employeeEditId && <button type="button" className="secondary" onClick={() => { setEmployeeEditId(""); setEmployee({ name: "", employee_code: "", phone: "", area_id: "" }); }}><X /> Cancelar</button>}
                </form>
                <div className="compactList">
                  {employees.map((e) => (
                    <article key={e.id}>
                      <div>
                        <b>{e.name}{e.employee_code ? ` · ID ${e.employee_code}` : ""}</b>
                        <small>
                          {areas.find((a) => a.id === e.area_id)?.name ||
                            "Sin área"}{" "}
                          · {e.phone}
                        </small>
                      </div>
                      <div className="rowActions">
                        <button title="Editar empleado" onClick={() => { setEmployeeEditId(e.id); setEmployee({ name: e.name, employee_code: e.employee_code || "", phone: e.phone || "", area_id: e.area_id || "" }); }}><Pencil /></button>
                        <button title="Eliminar empleado" onClick={() => del("v2_employees", e.id)}><Trash2 /></button>
                      </div>
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
          {!productsOnly && <button className="primary settingsSave" onClick={save}>
            Guardar configuración
          </button>}
          {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
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
    borderPixels: number[] = [];
  for (let x = 0; x < width; x++) borderPixels.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) borderPixels.push(y * width, y * width + width - 1);
  const buckets = new Map<string, { count: number; rgb: [number, number, number] }>();
  borderPixels.forEach((pixel) => {
    const i = pixel * 4;
    if (data[i + 3] < 20) return;
    const key = `${Math.round(data[i] / 24)},${Math.round(data[i + 1] / 24)},${Math.round(data[i + 2] / 24)}`;
    const bucket = buckets.get(key) || { count: 0, rgb: [0, 0, 0] };
    bucket.count++;
    bucket.rgb[0] += data[i]; bucket.rgb[1] += data[i + 1]; bucket.rgb[2] += data[i + 2];
    buckets.set(key, bucket);
  });
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return;
  const background = dominant.rgb.map((value) => value / dominant.count),
    queue = borderPixels,
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
    if (delta > 78) continue;
    const i = pixel * 4;
    data[i + 3] = delta < 28 ? 0 : Math.round(((delta - 28) / 50) * 255);
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
