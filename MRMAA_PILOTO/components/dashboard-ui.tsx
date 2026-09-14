"use client";
import { X } from "lucide-react";
import { formatAppMoney, useAppPreferences } from "@/components/app-preferences";

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

export function Actions() {
  return (
    <div className="actions">
      <button className="primary" type="submit">
        Guardar
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
