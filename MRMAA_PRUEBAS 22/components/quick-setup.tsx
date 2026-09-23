"use client";
import { useRef, useState } from "react";
import { Modal, EventTimeInput } from "./dashboard-ui";
import { supabase } from "@/lib/supabase";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges } from "@/lib/unsaved-changes";
import { useAppPreferences } from "./app-preferences";

export function QuickSetup({ restaurantId, schedules, completed, format, onSaved, onStart, close }: {
  restaurantId: string; schedules: boolean; completed: boolean; format: unknown;
  onSaved: () => Promise<void>; onStart: (target: "quotes" | "reservations" | "schedules") => void; close: () => void;
}) {
  const { language, currency } = useAppPreferences(), en = language === "en";
  const [step, setStep] = useState(schedules ? 0 : 1), [saved, setSaved] = useState(completed);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const initial = { team_area: "", employee_name: "", shift_name: en ? "First shift" : "Turno inicial", shift_start: "09:00", shift_end: "17:00", event_area: "", product_name: "", product_description: "", product_price: "" };
  const [form, setForm] = useState(initial), [dirty, setDirty] = useState(false);
  const clearDraft = useUnsavedChanges(dirty && !saved, close);
  function field(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })); setDirty(true); }
  function dismiss() { if (!busy && confirmDiscardChanges()) close(); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    if (step === 0) {
      if (!form.shift_start || !form.shift_end) { setError(en ? "Complete both shift times." : "Complete ambas horas del turno."); return; }
      setError(""); setStep(1); return;
    }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await supabase.rpc("v2_quick_setup", { p_restaurant: restaurantId, p_payload: form });
      if (result.error) throw result.error;
      clearDraft(); setDirty(false); setSaved(true); await onSaved();
    } catch (error) { setError(userMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal title={en ? "Quick setup" : "Inicio rápido"} close={dismiss}>
    <div className="quickSetup" translate="no">
      {!saved ? <>
        <p className="quickSetupIntro">{en ? "Your first event in about 5 minutes. Start with the essentials; complete the rest later." : "Su primer evento en unos 5 minutos. Empiece con lo básico y complete lo demás después."}</p>
        <div className="quickSetupProgress" aria-label={en ? "Setup progress" : "Progreso del inicio rápido"}>{schedules && <span aria-current={step === 0 ? "step" : undefined}>{en ? "1. Team" : "1. Equipo"}</span>}<span aria-current={step === 1 ? "step" : undefined}>{schedules ? "2. " : "1. "}{en ? "Events and menu" : "Eventos y menú"}</span></div>
        <form onSubmit={submit} className="formStack">
          <fieldset disabled={busy}>
            {step === 0 ? <>
              <label>{en ? "Employee area" : "Área de empleados"}<input required maxLength={120} value={form.team_area} onChange={e => field("team_area", e.target.value)} placeholder={en ? "e.g. Kitchen" : "Ej. Cocina"}/></label>
              <label>{en ? "First employee" : "Primer empleado"}<input required maxLength={120} value={form.employee_name} onChange={e => field("employee_name", e.target.value)} placeholder={en ? "Full name" : "Nombre completo"}/></label>
              <small>{en ? "This creates an employee record, not a login or a user invitation." : "Crea una ficha de empleado, no una cuenta de acceso ni una invitación."}</small>
              <label>{en ? "First shift" : "Turno inicial"}<input required maxLength={120} value={form.shift_name} onChange={e => field("shift_name", e.target.value)}/></label>
              <div className="shiftEndpoints"><label>{en ? "Start" : "Entrada"}<EventTimeInput value={form.shift_start} format={format} onChange={value => field("shift_start",value)}/></label><label>{en ? "End" : "Salida"}<EventTimeInput value={form.shift_end} format={format} onChange={value => field("shift_end",value)}/></label></div>
            </> : <>
              <label>{en ? "Area for quotes and reservations" : "Área para cotizaciones y reservaciones"}<input required maxLength={120} value={form.event_area} onChange={e => field("event_area",e.target.value)} placeholder={en ? "e.g. Main dining room" : "Ej. Salón principal"}/></label>
              <label>{en ? "Menu item or service" : "Producto del menú o servicio"}<input required maxLength={120} value={form.product_name} onChange={e => field("product_name",e.target.value)} placeholder={en ? "e.g. Celebration menu" : "Ej. Menú de celebración"}/></label>
              <label>{en ? "Description (optional)" : "Descripción (opcional)"}<textarea maxLength={2000} rows={2} value={form.product_description} onChange={e => field("product_description",e.target.value)}/></label>
              <label>{en ? "Unit price" : "Precio unitario"} ({currency})<input required type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" value={form.product_price} onChange={e => field("product_price",e.target.value)}/></label>
              <small>{en ? "Existing active records with the same name are reused; their data and prices stay unchanged." : "Se reutilizan registros activos con el mismo nombre; sus datos y precios se conservan."}</small>
              {!schedules && <small>{en ? "Basic includes quotes and reservations. Employees and schedules are available with Intermediate or Advanced." : "Basic incluye cotizaciones y reservas. Empleados y horarios están disponibles con Intermediate o Advanced."}</small>}
            </>}
          </fieldset>
          {error && <p role="alert" className="alert">{error}</p>}
          <div className="quickSetupActions">{step === 1 && schedules && <button type="button" className="secondary" disabled={busy} onClick={() => { setStep(0); setError(""); }}>{en ? "Back" : "Atrás"}</button>}<button className="primary" disabled={busy}>{busy ? (en ? "Saving…" : "Guardando…") : step === 0 ? (en ? "Next" : "Continuar") : (en ? "Save and start" : "Guardar y empezar")}</button><button type="button" className="link" disabled={busy} onClick={dismiss}>{en ? "Later" : "Después"}</button></div>
        </form>
      </> : <>
        <h3>{en ? "Ready for your first event" : "Listo para su primer evento"}</h3>
        <p>{en ? "Choose where to start. Your setup is saved; you can add more records in Settings." : "Elija dónde empezar. Su configuración está guardada; puede agregar más registros en Configuración."}</p>
        {error && <p role="alert" className="alert">{error}</p>}
        <div className="quickSetupActions">{(["quotes","reservations",...(schedules ? ["schedules"] : [])] as const).map(target => <button type="button" className="primary" disabled={busy} key={target} onClick={() => onStart(target as "quotes"|"reservations"|"schedules")}>{target === "quotes" ? (en ? "Create quote" : "Crear cotización") : target === "reservations" ? (en ? "Create reservation" : "Crear reservación") : (en ? "Assign a schedule" : "Asignar horario")}</button>)}</div>
        <p>{en ? "Guide, tutorial and the MRMAA Assistant are available whenever you need them under Help." : "El instructivo, tutorial y Asistente MRMAA están disponibles cuando los necesite en Ayuda."}</p>
      </>}
    </div>
  </Modal>;
}
