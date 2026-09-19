"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileDown, FileSpreadsheet, Info, Maximize2, Minimize2, Move, Printer, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requirePermission, ACCESS_DENIED } from "@/lib/permissions";
import { printScheduleHtml, reserveQuotePrintWindow } from "@/lib/print";
import { useExcelExportAccess } from "@/components/excel-permission";
import { confirmApp, appLocale, currentAppLanguage, useAppPreferences } from "@/components/app-preferences";
import { userMessage } from "@/lib/user-message";
import { useUnsavedChanges, useDraftBaseline } from "@/lib/unsaved-changes";
import { useDataRefresh, useOnDataRefresh } from "@/components/restaurant-sync";
import { recordAuditActivity } from "@/lib/audit-activity";
import { localDateISO } from "@/lib/local-date";
import { readScheduleRange, readScheduleReferences } from "@/lib/schedule-range";
import { translate } from "@/lib/translations";

// Extracted verbatim from components/advanced-modules.tsx — no behavior
// change, only moved to its own file so MonthlySchedules is a separate bundle
// chunk from EnhancedSettings (previously both lived in the same file, so
// dynamic-importing either one likely pulled in the other's code too).

export type Area = { id: string; name: string; color: string; active: boolean };
export type Employee = {
  id: string;
  name: string;
  employee_code: string;
  phone: string;
  area_id: string | null;
  active: boolean;
};
export type Shift = {
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
  const remoteVersion = useDataRefresh(restaurantId, 'v2_schedules,v2_employees,v2_shifts,v2_areas');
  const loadGeneration = useRef(0);
  const excelAccess = useExcelExportAccess(restaurantId);
  const { language } = useAppPreferences();
  const [printLayout,setPrintLayout]=useState<'continuous'|'area'>('continuous');
  const [printScale,setPrintScale]=useState(100);
  const [month, setMonth] = useState(monthStart()),
    [areas, setAreas] = useState<Area[]>([]),
    [excludedPrintAreas, setExcludedPrintAreas] = useState<string[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [shifts, setShifts] = useState<Shift[]>([]),
    [rows, setRows] = useState<Schedule[]>([]),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [dragged, setDragged] = useState<Schedule | null>(null),
    [dragTarget, setDragTarget] = useState(""),
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
  const clearScheduleUnsavedWarning = useUnsavedChanges(canEdit && scheduleDraft.dirty, scheduleDraft.markSaved);

  const [assignmentPanelCollapsed, setAssignmentPanelCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const areaById = useMemo(() => new Map(areas.map(area => [area.id, area])), [areas]);
  const shiftById = useMemo(() => new Map(shifts.map(shift => [shift.id, shift])), [shifts]);
  const selectableEmployees = useMemo(() => {
    const query = employeeSelectionSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => {
      const areaName = areaById.get(employee.area_id || "")?.name || "Sin área";
      return [employee.name, employee.employee_code, areaName].some((value) =>
        String(value || "").toLowerCase().includes(query),
      );
    });
  }, [employees, areaById, employeeSelectionSearch]);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
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
    if (generation !== loadGeneration.current) return;
    const error = a.error || e.error || s.error;
    if (error) throw error;
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    setRows(w);
    } catch (error) {
      if (generation === loadGeneration.current) setNotice(userMessage(error));
    }
  }, [restaurantId, month]);
  useEffect(() => () => { loadGeneration.current++; }, [load]);
  useOnDataRefresh(remoteVersion, () => { void load(); });
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
      setNotice(error instanceof Error ? userMessage(error) : ACCESS_DENIED);
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
    if (r.error) return setNotice(userMessage(r.error));
    scheduleDraft.markSaved();
    clearScheduleUnsavedWarning();
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
      !confirmApp("¿Eliminar la asignación de este día?")
    )
      return;
    const targetIds = selectedEmployeeIds.length ? selectedEmployeeIds : [form.employee_id];
    const r = await supabase
      .from("v2_schedules")
      .delete()
      .eq("restaurant_id", restaurantId)
      .in("employee_id", targetIds)
      .eq("work_date", form.work_date);
    if (r.error) return setNotice(userMessage(r.error));
    setNotice("Asignación eliminada.");
    load();
  }
  async function deletePeriod() {
    if (!(await authorizeSchedule())) return;
    const targetIds = selectedEmployeeIds.length ? selectedEmployeeIds : [form.employee_id].filter(Boolean);
    if (!targetIds.length || !form.work_date || !form.work_date_to)
      return setNotice("Seleccione empleado y rango de fechas.");
    if (!confirmApp(`¿Borrar los horarios de ${targetIds.length} empleado(s) entre ${form.work_date} y ${form.work_date_to}?`)) return;
    const r = await supabase.from("v2_schedules").delete()
      .eq("restaurant_id", restaurantId).in("employee_id", targetIds)
      .gte("work_date", form.work_date).lte("work_date", form.work_date_to);
    if (r.error) return setNotice(userMessage(r.error));
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
    if (r.error) return setNotice(userMessage(r.error));
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
    if (r.error) return setNotice(userMessage(r.error));
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
    if (saved.error) return setNotice(userMessage(saved.error));
    setNotice("Horario del mes anterior copiado.");
    load();
  }
  async function print(download = false) {
    const viewer = download ? null : reserveQuotePrintWindow("Horarios A4", language === "en" ? "Preparing A4 PDF…" : "Preparando PDF A4…");
    try {
    const { selected, exportEmployees, exportAreas, exportShifts } = await schedulesForSelectedRange(),
      dates: string[] = [];
    for (
      const d = new Date(`${printFrom}T12:00:00`),
        end = new Date(`${printTo}T12:00:00`);
      d <= end;
      d.setDate(d.getDate() + 1)
    )
      dates.push(iso(d));
    const selectedByCell = new Map<string, Schedule>();
    const scheduledEmployees = new Set<string>();
    for (const row of selected) {
      const key = `${row.employee_id}|${row.work_date}`;
      if (!selectedByCell.has(key)) selectedByCell.set(key, row);
      scheduledEmployees.add(row.employee_id);
    }
    const exportShiftById = new Map(exportShifts.map(shift => [shift.id, shift]));
    const printGroups = [
      ...exportAreas,
      { id: "unassigned", name: "Sin área", color: "#71717a", active: true },
    ]
      .filter((area) => !excludedPrintAreas.includes(area.id))
      .map((area) => ({
        area,
        people: exportEmployees.filter((e) =>
          area.id === "unassigned" ? !e.area_id : e.area_id === area.id,
        ),
      }))
      .filter((g) =>
        g.people.some((e) => scheduledEmployees.has(e.id)),
      );
    if (!printGroups.length) {
      viewer?.close();
      setNotice(language === "en" ? "No schedules in the selected areas and dates." : "No hay horarios en las áreas y fechas seleccionadas.");
      return;
    }
    const printedEmployees = new Set(printGroups.flatMap(g => g.people.map(e => e.id)));
    const cell = (employeeId: string, date: string) => {
      const x = selectedByCell.get(`${employeeId}|${date}`);
      if (!x) return "—";
      if (x.entry_type === "rest") return "DESCANSO";
      if (x.entry_type === "permission")
        return `PERMISO${x.notes ? `<small>${esc(x.notes)}</small>` : ""}`;
      const s = exportShiftById.get(x.shift_id || "");
      return `<b>${esc(s?.name || "Turno")}</b><span>${esc(s?.start_time?.slice(0, 5))}–${esc(s?.end_time?.slice(0, 5))}</span>${x.break_start && x.break_end ? `<small>Comida ${esc(x.break_start.slice(0, 5))}–${esc(x.break_end.slice(0, 5))}</small>` : ""}${x.notes ? `<small>${esc(x.notes)}</small>` : ""}`;
    };
    // A whole month in one table is wider than a Windows/Letter printable
    // area. Fixed two-week blocks keep the same geometry on Mac and Windows
    // without depending on a browser-specific "fit to page" option.
    const dateBlocks = Array.from({ length: Math.ceil(dates.length / 14) }, (_, index) =>
      dates.slice(index * 14, index * 14 + 14),
    );
    const pages = dateBlocks.flatMap((block) => printGroups.map((g) => ({ block, group: g })));
    await printScheduleHtml(
      `<html><head><title>Horarios</title><style>
      @page{size:A4 landscape;margin:7mm}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      html,body{margin:0;padding:0;color:#18181b;background:#fff;font-family:Arial,sans-serif}
      .print-page{break-after:page;page-break-after:always;width:100%}
      .print-page:last-child{break-after:auto;page-break-after:auto}
      h1{font-family:Georgia,serif;margin:0 0 3px;font-size:20px}
      p{margin:0 0 10px;color:#52525b;font-size:10px}
      h2{margin:0 0 6px;font-size:14px}
      table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7.5px}
      thead{display:table-header-group}
      tr{break-inside:avoid;page-break-inside:avoid}
      th,td{border:1px solid #8b8b92;padding:4px 2px;text-align:center;vertical-align:top;overflow-wrap:anywhere}
      th{background:#18181b!important;color:#fff!important;border-color:#18181b!important}
      .employee{width:34mm;text-align:left;font-weight:bold}
      td b,td span,td small{display:block}
      td small{font-size:6.5px;margin-top:2px}.date{font-size:6.5px}
      </style></head><body data-from="${esc(printFrom)}" data-to="${esc(printTo)}">${pages.map(({ block, group }) => `<section class="print-page"><h1>Horario de empleados</h1><p>Periodo: ${esc(printFrom)} a ${esc(printTo)} · ${esc(group.area.name)} · ${block[0]?.slice(8, 10)}/${block[0]?.slice(5, 7)}–${block[block.length - 1]?.slice(8, 10)}/${block[block.length - 1]?.slice(5, 7)}</p><h2>${esc(group.area.name)}</h2><table><thead><tr><th class="employee">Empleado</th>${block.map((d) => `<th><span>${new Date(`${d}T12:00:00`).toLocaleDateString(appLocale(), { weekday: "short" })}</span><span class="date">${d.slice(8, 10)}/${d.slice(5, 7)}</span></th>`).join("")}</tr></thead><tbody>${group.people.map((e) => `<tr><td class="employee">${esc(e.name)}</td>${block.map((d) => `<td>${cell(e.id, d)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`).join("")}</body></html>`,
      viewer,
      download,
      {layout:printLayout,scale:printScale},
    );
    await recordAuditActivity(restaurantId, "impresion", "horarios", { label: "Horario de empleados", from: printFrom, to: printTo, areas: printGroups.map(g => g.area.name), rows: selected.filter(row => printedEmployees.has(row.employee_id)).length });
    } catch (error) { viewer?.close(); throw error; }
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
    await excelAccess.ensureAllowed();
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
    await excelAccess.ensureAllowed();
    XLSX.writeFile(workbook, `${language === "en" ? "schedules" : "horarios"}-${printFrom}-${printTo}.xlsx`);
    await recordAuditActivity(restaurantId, "excel_exportado", "horarios", { label: "Horario de empleados", from: printFrom, to: printTo, rows: selected.length });
  }
  const grouped = useMemo(() => {
      const query = search.trim().toLocaleLowerCase(appLocale());
      return [
        ...areas,
        { id: "unassigned", name: "Sin área", color: "#71717a", active: true },
      ]
        .map((a) => ({
          area: a,
          people: employees.filter((e) => {
            if (!(a.id === "unassigned" ? !e.area_id : e.area_id === a.id)) return false;
            if (!query) return true;
            const areaName = (a.id === "unassigned" && language === "en" ? "No area" : a.name)
              .toLocaleLowerCase(appLocale());
            return areaName.includes(query)
              || e.name.toLocaleLowerCase(appLocale()).includes(query)
              || e.employee_code.toLocaleLowerCase(appLocale()).includes(query);
          }),
        }))
        .filter((g) => g.people.length);
    }, [areas, employees, search, language]);
  const scheduleByEmployeeAndDate = useMemo(
    () => new Map(rows.map((row) => [`${row.employee_id}|${row.work_date}`, row])),
    [rows],
  );
  const patternEligible = useMemo(() => {
    if (!employees.length) return false;
    return employees.every((employee) =>
      Array.from({ length: 14 }, (_, index) => index + 1).every((day) =>
        scheduleByEmployeeAndDate.has(`${employee.id}|${month}-${String(day).padStart(2, "0")}`),
      ),
    );
  }, [scheduleByEmployeeAndDate, employees, month]);
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
            placeholder={language === "en" ? "Search employee or area…" : "Buscar empleado o área…"}
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
        {canEdit && (
          <p className="scheduleDragGuide" role="note">
            <Move aria-hidden="true" />
            {language === "en"
              ? "Drag any assigned schedule to another day or employee to copy it."
              : "Arrastre cualquier horario asignado hacia otro día o empleado para copiarlo."}
          </p>
        )}
        {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      </section>
      {canEdit && (
      <section className={`moduleCard scheduleAssignmentCard${assignmentPanelCollapsed ? " collapsed" : ""}`}>
        <div className="scheduleAssignmentHeader">
          <p className="scheduleHelp">
            <b>Asignar empleados y turnos</b>
            {!assignmentPanelCollapsed && (
              <span>Asigne un día o periodo.</span>
            )}
          </p>
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
        <>
        <div className="scheduleAssignmentBody">
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
                      <small>{areaById.get(employee.area_id || "")?.name || "Sin área"}</small>
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
        </div>
        <small className="scheduleResizeHint"><Info aria-hidden="true" /> Arrastre la esquina inferior derecha para cambiar la altura.<span aria-hidden="true">↘</span></small>
        </>
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
        <div className="rowActions" style={{flexBasis:'100%',flexWrap:'wrap',gap:16}} translate="no">
          <label>{language==='en'?'Page layout':'Distribución'}<select disabled={exporting} value={printLayout} onChange={e=>setPrintLayout(e.target.value as 'continuous'|'area')}><option value="continuous">{language==='en'?'Continuous':'Corrido'}</option><option value="area">{language==='en'?'Page per area':'Página por área'}</option></select></label>
          <label>{language==='en'?'Print scale':'Escala de impresión'}<select disabled={exporting} value={printScale} onChange={e=>setPrintScale(Number(e.target.value))}>{[70,80,90,100,110,120].map(value=><option key={value} value={value}>{value}%</option>)}</select></label>
          <small style={{flexBasis:'100%'}}>{language==='en'?'Continuous joins areas with a small gap. Lower scale repaginates content before generating the PDF. Viewer zoom does not rearrange pages. Large areas may continue on another page.':'Corrido une las áreas con una separación pequeña. Menor escala reorganiza el contenido antes de generar el PDF. El zoom del visor no cambia las páginas. Un área grande puede continuar en otra hoja.'}</small>
        </div>
        <details style={{ flexBasis: "100%" }} translate="no">
          <summary>{language === "en" ? "Areas to print" : "Áreas a imprimir"}</summary>
          <fieldset disabled={exporting} style={{ border: 0, padding: "12px 0", display: "flex", flexWrap: "wrap", gap: 16 }}>
            <legend>{language === "en" ? "Select one or more areas (printing only)" : "Seleccione una o varias áreas (solo impresión)"}</legend>
            <button type="button" onClick={() => setExcludedPrintAreas([])}>{language === "en" ? "All" : "Todas"}</button>
            <button type="button" onClick={() => setExcludedPrintAreas([...areas.map(a => a.id), "unassigned"])}>{language === "en" ? "None" : "Ninguna"}</button>
            {[...areas, { id: "unassigned", name: language === "en" ? "No area" : "Sin área" }].map(area =>
              <label key={area.id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={!excludedPrintAreas.includes(area.id)} onChange={e => setExcludedPrintAreas(previous => e.target.checked ? previous.filter(id => id !== area.id) : [...previous, area.id])} />
                {area.name}
              </label>)}
          </fieldset>
        </details>
        <button className="primary" disabled={exporting} onClick={() => performScheduleExport(print)}>
          <Printer />
          Imprimir
        </button>
        <button className="secondary" disabled={exporting} onClick={() => performScheduleExport(() => print(true))}>
          <FileDown />
          {language === "en" ? "Download PDF" : "Descargar PDF"}
        </button>
        <button className="secondary" disabled={exporting || !excelAccess.allowed} title={excelAccess.allowed ? undefined : excelAccess.hint} onClick={() => performScheduleExport(exportScheduleExcel)}>
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
                    const cellKey = `${e.id}|${date}`;
                    return (
                      <button
                        key={date}
                        type="button"
                        data-assigned={Boolean(x)}
                        draggable={canEdit && Boolean(x)}
                        aria-disabled={!canEdit}
                        onDragStart={(event) => {
                          if (!canEdit || !x) return;
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData("text/plain", x.id);
                          setDragged(x);
                        }}
                        onDragOver={(event) => {
                          if (!canEdit || !dragged) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                          setDragTarget(cellKey);
                        }}
                        onDragLeave={() => setDragTarget((current) => current === cellKey ? "" : current)}
                        onDragEnd={() => { setDragged(null); setDragTarget(""); }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragTarget("");
                          if (canEdit) void copyByDrag(e, date);
                        }}
                        className={`${x?.entry_type || "empty"}${dragged?.id === x?.id ? " dragging" : ""}${dragTarget === cellKey ? " dropTarget" : ""}`}
                        title={
                          x
                            ? `${translate(x.entry_type === "rest" ? "Descanso" : x.entry_type === "permission" ? "Permiso" : "Trabajo", language)} ${x.break_start || ""} ${x.notes || ""}`
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
                          <b>{language === "en" ? "OFF" : "D"}</b>
                        ) : x?.entry_type === "permission" ? (
                          <b>{language === "en" ? "LV" : "P"}</b>
                        ) : (
                          <>
                            <b>
                              {(() => {
                                const shift = shiftById.get(x?.shift_id || "");
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
