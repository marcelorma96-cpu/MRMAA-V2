export type PlanCode = "basic" | "intermediate" | "advanced";
export type BillingInterval = "month" | "year";
export const TRIAL_DAYS = 5;
export const PUBLIC_SIGNUP_ENABLED = process.env.NEXT_PUBLIC_MRMAA_PUBLIC_SIGNUP === "true";
export const PLANS = [
  { code: "basic", name: "Basic", monthly: 20, annual: 200, users: 1, schedules: false,
    es: ["Clientes, reservaciones y cotizaciones", "PDF, impresión e importación/exportación", "1 usuario administrador"],
    en: ["Customers, reservations and quotes", "PDF, printing and import/export", "1 administrator"] },
  { code: "intermediate", name: "Intermediate", monthly: 40, annual: 400, users: 5, schedules: true,
    es: ["Todo lo incluido en Basic", "Empleados, horarios y reportes", "Hasta 5 usuarios, incluido el administrador"],
    en: ["Everything in Basic", "Employees, schedules and reports", "Up to 5 users, including the administrator"] },
  { code: "advanced", name: "Advanced", monthly: 50, annual: 500, users: 15, schedules: true,
    es: ["Todo lo incluido en Intermediate", "Hasta 15 usuarios, incluido el administrador", "Roles y colaboración para equipos más grandes"],
    en: ["Everything in Intermediate", "Up to 15 users, including the administrator", "Roles and collaboration for larger teams"] },
] as const;
export function isPlan(value: unknown): value is PlanCode { return PLANS.some(p => p.code === value); }
export function isBillingInterval(value: unknown): value is BillingInterval { return value === "month" || value === "year"; }
export function planFor(value: unknown) { return PLANS.find(p => p.code === value) || PLANS[0]; }
export function planAmount(code: PlanCode, interval: BillingInterval) {
  const plan = planFor(code);
  return (interval === "year" ? plan.annual : plan.monthly) * 100;
}
