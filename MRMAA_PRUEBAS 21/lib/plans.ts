export type PlanCode = "basic" | "intermediate" | "advanced";
export type BillingInterval = "month" | "year";
export const TRIAL_DAYS = 10;
export const PUBLIC_SIGNUP_ENABLED = process.env.NEXT_PUBLIC_MRMAA_PUBLIC_SIGNUP !== "false";
export const PLANS = [
  { code: "basic", name: "Basic", monthly: 25, annual: 250, users: 1, reports: false, schedules: false,
    es: ["Clientes, reservaciones y cotizaciones", "PDF, impresión e importación/exportación", "1 usuario administrador", "Asistente de ayuda IA: 50 consultas al mes por restaurante"],
    en: ["Customers, reservations and quotes", "PDF, printing and import/export", "1 administrator", "AI help assistant: 50 questions per month per restaurant"] },
  { code: "intermediate", name: "Intermediate", monthly: 45, annual: 450, users: 5, reports: false, schedules: true,
    es: ["Todo lo incluido en Basic", "Empleados y horarios", "Hasta 5 usuarios, incluido el administrador"],
    en: ["Everything in Basic", "Employees and schedules", "Up to 5 users, including the administrator"] },
  { code: "advanced", name: "Advanced", monthly: 55, annual: 550, users: 15, reports: true, schedules: true,
    es: ["Todo lo incluido en Intermediate", "Hasta 15 usuarios, incluido el administrador", "Reportes completos de eventos, anticipos, clientes y horas programadas"],
    en: ["Everything in Intermediate", "Up to 15 users, including the administrator", "Full reports on events, deposits, customers and scheduled hours"] },
] as const;
export function isPlan(value: unknown): value is PlanCode { return PLANS.some(p => p.code === value); }
export function isBillingInterval(value: unknown): value is BillingInterval { return value === "month" || value === "year"; }
export function planFor(value: unknown) { return PLANS.find(p => p.code === value) || PLANS[0]; }
export function planAmount(code: PlanCode, interval: BillingInterval) {
  const plan = planFor(code);
  return (interval === "year" ? plan.annual : plan.monthly) * 100;
}
