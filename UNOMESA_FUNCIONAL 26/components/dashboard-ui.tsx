"use client";
import { X } from "lucide-react";
import { formatAppMoney, useAppPreferences } from "@/components/app-preferences";
import { eventTimeFormat, eventTimeParts, eventTimeFromParts } from "@/lib/local-date";

// Small, prop-only presentational pieces shared by the dashboard and its panel
// components (quotes-panel, clients-panel, quote-preview). Pulled out of
// dashboard.tsx verbatim — same markup, same behavior — purely so the panels
// can import them without importing the 1,700-line Dashboard component itself.

export const money = (n: number) => formatAppMoney(n);

export const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export function Nav({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function EventTimeInput({ value, onChange, format, disabled = false, label }: {
  value?: string | null; onChange: (value: string) => void; format?: unknown; disabled?: boolean; label?: string;
}) {
  const { language } = useAppPreferences();
  const en = language === "en";
  const mode = eventTimeFormat(format);
  const parts = eventTimeParts(value);
  const hour = parts ? String(mode === "12h" ? parts.hour % 12 || 12 : parts.hour).padStart(2, "0") : "";
  const minute = parts?.minute || "";
  const period = parts && parts.hour >= 12 ? "PM" : "AM";
  const update = (h: string, m: string, p: string) => onChange(eventTimeFromParts(h, m, p, mode));
  return <span className="eventTimeInput" role="group" aria-label={label || (en ? "Event time" : "Hora del evento")} translate="no">
    <select disabled={disabled} aria-label={en ? "Hour" : "Hora"} value={hour} onChange={e => e.target.value === "" ? onChange("") : update(e.target.value, minute || "00", period)}>
      <option value="">HH</option>
      {Array.from({ length: mode === "12h" ? 12 : 24 }, (_, i) => String(mode === "12h" ? i + 1 : i).padStart(2, "0")).map(h => <option value={h} key={h}>{h}</option>)}
    </select>
    <span aria-hidden="true">:</span>
    <select disabled={disabled} aria-label={en ? "Minutes" : "Minutos"} value={minute} onChange={e => e.target.value === "" ? onChange("") : update(hour || (mode === "12h" ? "12" : "00"), e.target.value, period)}>
      <option value="">MM</option>
      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(m => <option value={m} key={m}>{m}</option>)}
    </select>
    {mode === "12h" && <select aria-label={en ? "AM or PM" : "AM o PM"} value={period} disabled={disabled || !parts} onChange={e => update(hour, minute, e.target.value)}><option>AM</option><option>PM</option></select>}
    <button type="button" className="eventTimeClear" disabled={disabled || !parts} aria-label={en ? "Clear time" : "Borrar hora"} title={en ? "Clear time" : "Borrar hora"} onClick={() => onChange("")}><X size={16}/></button>
  </span>;
}

export function ShiftEndpointInput({ label, mode, time, text, format, disabled, onMode, onTime, onText, placeholder, calculate, calculationTime, onCalculate, onCalculationTime }: {
  label: string; mode: "time" | "text"; time: string; text: string; format: unknown; disabled?: boolean;
  onMode: (mode: "time" | "text") => void; onTime: (value: string) => void; onText: (value: string) => void; placeholder: string;
  calculate: boolean; calculationTime: string; onCalculate: (value: boolean) => void; onCalculationTime: (value: string) => void;
}) {
  const { language } = useAppPreferences();
  const en = language === "en";
  return <div className="shiftEndpoint" role="group" aria-label={label} translate="no">
    <div className="shiftEndpointHeader"><span>{label}</span>
      <select disabled={disabled} aria-label={`${label}: ${en ? "Time or text" : "Hora o texto"}`} value={mode} onChange={e => onMode(e.target.value === "text" ? "text" : "time")}>
        <option value="time">{en ? "Time" : "Hora"}</option><option value="text">{en ? "Text" : "Texto"}</option>
      </select>
    </div>
    {mode === "time" ? <EventTimeInput label={label} value={time} format={format} disabled={disabled} onChange={onTime}/>
      : <input aria-label={label} required maxLength={40} disabled={disabled} placeholder={placeholder} value={text} onChange={e => onText(e.target.value)}/>}
    {mode === "text" && <div className="shiftCalculation">
      <label><input type="checkbox" disabled={disabled} checked={calculate} onChange={e => onCalculate(e.target.checked)}/>{en ? "Add time for calculation" : "Agregar hora para cálculo"}</label>
      {calculate && <><EventTimeInput label={`${label}: ${en ? "calculation time" : "hora de cálculo"}`} value={calculationTime} format={format} disabled={disabled} onChange={onCalculationTime}/><small>{en ? "Used for totals only. Hidden in schedules and PDFs." : "Solo para contabilizar horas. No aparece en horarios ni PDF."}</small></>}
    </div>}
  </div>;
}

export function Actions({ busy = false }: { busy?: boolean }) {
  const { language } = useAppPreferences();
  return (
    <div className="actions">
      <button className="primary" type="submit" disabled={busy}>
        {busy ? (language === "en" ? "Saving…" : "Guardando…") : (language === "en" ? "Save" : "Guardar")}
      </button>
    </div>
  );
}

export function Total({
  label,
  value,
  big,
}: {
  label: string;
  value: number;
  big?: boolean;
}) {
  return (
    <div className={big ? "total big" : "total"}>
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

export function HelpSection({ title, text }: { title: string; text: string }) {
  const { t } = useAppPreferences();
  return <details className="helpSection"><summary>{t(title)}</summary><p>{t(text)}</p></details>;
}

export function Modal({
  title,
  close,
  wide,
  children,
}: {
  title: string;
  close: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section className={wide ? "modal wide" : "modal"}>
        <header>
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
