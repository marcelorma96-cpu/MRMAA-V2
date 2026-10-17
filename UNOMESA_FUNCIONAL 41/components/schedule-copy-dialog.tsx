"use client";
import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/dashboard-ui";
import { useAppPreferences } from "@/components/app-preferences";
import { supabase } from "@/lib/supabase";
import { requirePermission } from "@/lib/permissions";
import { readScheduleRange } from "@/lib/schedule-range";
import { prepareScheduleCopy, scheduleCopyDates } from "@/lib/schedule-copy";
import { userMessage } from "@/lib/user-message";
import { translate } from "@/lib/translations";
import type { Area, Employee } from "@/components/schedules-module";

export function ScheduleCopyDialog({ restaurantId, month, employees, areas, close, onSaved }: {
  restaurantId: string; month: string; employees: Employee[]; areas: Area[]; close: () => void; onSaved: () => void;
}) {
  const { language } = useAppPreferences(), en = language === "en";
  const [from, setFrom] = useState(`${month}-01`), [to, setTo] = useState(`${month}-07`);
  const [destination, setDestination] = useState(`${month}-08`);
  const [area, setArea] = useState(""), [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<ReturnType<typeof prepareScheduleCopy> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<number | null>(null);
  const locked = useRef(false);
  const areaNames = useMemo(() => new Map(areas.map(a => [a.id, a.name])), [areas]);
  const eligible = employees.filter(e => e.active && (area === "" || (area === "none" ? !e.area_id : e.area_id === area)));
  const visible = eligible.filter(e => `${e.name} ${e.employee_code} ${areaNames.get(e.area_id || "") || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const ids = selected.filter(id => eligible.some(e => e.id === id));
  const reset = () => { setPreview(null); setDone(null); setError(""); };
  let end = "";
  try { end = scheduleCopyDates(from, to, destination).end; } catch { /* validated before reading */ }
  const dismiss = () => { if (!locked.current) close(); };
  async function review() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setDone(null); setPreview(null);
    try {
      const range = scheduleCopyDates(from, to, destination);
      prepareScheduleCopy([], [], ids, from, to, destination);
      await requirePermission(supabase, restaurantId, "canManageSchedules");
      const [source, existing] = await Promise.all([
        readScheduleRange(supabase, restaurantId, from, to),
        readScheduleRange(supabase, restaurantId, destination, range.end),
      ]);
      setPreview(prepareScheduleCopy(source, existing, ids, from, to, destination));
    } catch (error) { setError(translate(userMessage(error), language)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function copy() {
    if (locked.current || !preview?.payload.length) return;
    locked.current = true; setBusy(true); setError("");
    try {
      await requirePermission(supabase, restaurantId, "canManageSchedules");
      if (preview.payload.some(row => !employees.some(employee => employee.active && employee.id === row.employee_id))) {
        setPreview(null);
        throw new Error(en ? "An employee is no longer active. Review the selection before copying." : "Un empleado ya no está activo. Revise la selección antes de copiar.");
      }
      // Ignore a conflicting date even when someone saves it after the preview.
      const result = await supabase.from("v2_schedules").upsert(
        preview.payload.map(row => ({ ...row, restaurant_id: restaurantId })),
        { onConflict: "restaurant_id,employee_id,work_date", ignoreDuplicates: true },
      ).select("id");
      if (result.error) throw result.error;
      setDone(result.data?.length || 0); setPreview(null); onSaved();
    } catch (error) { setError(translate(userMessage(error), language)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <Modal title={en ? "Copy schedules by date" : "Copiar horarios por fechas"} close={dismiss}>
    <div className="scheduleCopyDialog" translate="no" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); dismiss(); } }}>
      <p>{en ? "Copy each selected employee’s schedule to a new period of the same length. Existing assignments are kept; vacations are not repeated." : "Copie el horario de cada empleado seleccionado a otro período de la misma duración. Se conservan las asignaciones existentes y no se repiten vacaciones."}</p>
      <fieldset disabled={busy}>
        <legend>{en ? "Dates" : "Fechas"}</legend>
        <div className="scheduleCopyDates">
          <label>{en ? "Copy from" : "Origen desde"}<input autoFocus type="date" required value={from} onChange={e => { setFrom(e.target.value); reset(); }}/></label>
          <label>{en ? "Copy through" : "Origen hasta"}<input type="date" required min={from} value={to} onChange={e => { setTo(e.target.value); reset(); }}/></label>
          <label>{en ? "Paste starting" : "Destino desde"}<input type="date" required value={destination} onChange={e => { setDestination(e.target.value); reset(); }}/></label>
          <label>{en ? "Destination ends" : "Destino hasta"}<input type="date" readOnly value={end} tabIndex={-1}/></label>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>{en ? "Employees" : "Empleados"}</legend>
        <label>{en ? "Filter by area" : "Filtrar por área"}<select value={area} onChange={e => { setArea(e.target.value); setSelected([]); reset(); }}>
          <option value="">{en ? "All areas" : "Todas las áreas"}</option>
          <option value="none">{en ? "No area" : "Sin área"}</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        <input type="search" aria-label={en ? "Search employees" : "Buscar empleados"} placeholder={en ? "Name or employee ID…" : "Nombre o ID de empleado…"} value={search} onChange={e => setSearch(e.target.value)}/>
        <div className="scheduleCopySelection">
          <span role="status">{ids.length} {en ? "selected" : "seleccionados"}</span>
          <button type="button" onClick={() => { setSelected([...new Set([...ids, ...visible.map(e => e.id)])]); reset(); }}>{en ? "Select visible" : "Seleccionar visibles"}</button>
          <button type="button" onClick={() => { setSelected([]); reset(); }}>{en ? "Clear" : "Limpiar"}</button>
        </div>
        <div className="scheduleCopyEmployees" role="group" aria-label={en ? "Employees to copy" : "Empleados a copiar"}>
          {visible.map(e => <label key={e.id}><input type="checkbox" checked={ids.includes(e.id)} onChange={event => { setSelected(event.target.checked ? [...ids, e.id] : ids.filter(id => id !== e.id)); reset(); }}/><span>{e.name}{e.employee_code ? ` · ${e.employee_code}` : ""}<small>{areaNames.get(e.area_id || "") || (en ? "No area" : "Sin área")}</small></span></label>)}
          {!visible.length && <p>{en ? "No employees match this filter." : "No hay empleados que coincidan con este filtro."}</p>}
        </div>
      </fieldset>
      {error && <p className="moduleNotice moduleError" role="alert">{error}</p>}
      {preview && <div className="scheduleCopySummary" role="status">
        <strong>{preview.payload.length} {en ? "assignments ready to copy" : "asignaciones listas para copiar"}</strong>
        <span>{preview.skipped} {en ? "existing assignments kept" : "asignaciones existentes conservadas"} · {preview.vacations} {en ? "vacation days excluded" : "días de vacaciones excluidos"}</span>
      </div>}
      {done !== null && <p className="moduleNotice" role="status">{en ? `${done} assignments copied. All previously saved dates were kept.` : `${done} asignaciones copiadas. Se conservaron todas las fechas guardadas previamente.`}</p>}
      <div className="scheduleCopyActions">
        <button type="button" disabled={busy} onClick={dismiss}>{en ? "Close" : "Cerrar"}</button>
        {preview ? <button type="button" className="primary" disabled={busy || !preview.payload.length} onClick={() => void copy()}>{busy ? (en ? "Copying…" : "Copiando…") : (en ? "Confirm copy" : "Confirmar copia")}</button>
          : <button type="button" className="primary" disabled={busy || !ids.length} onClick={() => void review()}>{busy ? (en ? "Checking…" : "Revisando…") : (en ? "Review copy" : "Revisar copia")}</button>}
      </div>
    </div>
  </Modal>;
}
