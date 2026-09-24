"use client";
import { Check } from "lucide-react";
import { useAppPreferences } from "./app-preferences";
import { PLANS, type BillingInterval, type PlanCode } from "@/lib/plans";

export function PlanCards({ interval, onInterval, onChoose, busy = false, current, currentInterval, signup = false, trialAdvanced = false, payNow = false, minimumUsers = 0, selectionDisabled = false }: {
  interval: BillingInterval; onInterval: (value: BillingInterval) => void;
  onChoose: (plan: PlanCode) => void; busy?: boolean; current?: string; currentInterval?: BillingInterval; signup?: boolean; trialAdvanced?: boolean; payNow?: boolean; minimumUsers?: number; selectionDisabled?: boolean;
}) {
  const { language } = useAppPreferences();
  const en = language === "en";
  return <div translate="no" className="billingPlans">
    <div className="billingInterval" role="group" aria-label={en ? "Billing frequency" : "Periodicidad de pago"}>
      <button type="button" aria-pressed={interval === "month"} onClick={() => onInterval("month")} disabled={busy}>{en ? "Monthly" : "Mensual"}</button>
      <button type="button" aria-pressed={interval === "year"} onClick={() => onInterval("year")} disabled={busy}>{en ? "Annual · 2 months free" : "Anual · 2 meses gratis"}</button>
    </div>
    <div className="planGrid">{PLANS.map(plan => {
      const isCurrent = !payNow && current === plan.code && currentInterval === interval;
      const isUpgrade = !!current && PLANS.findIndex(p => p.code === plan.code) > PLANS.findIndex(p => p.code === current);
      return <article key={plan.code}>
      <h3>{plan.name}</h3>
      <div className="price"><strong>US${interval === "year" ? plan.annual : plan.monthly}</strong><span>{interval === "year" ? (en ? "/ year" : "/ año") : (en ? "/ month" : "/ mes")}</span></div>
      <p className="billingPriceDetail">{interval === "year" ? (en ? `One annual payment. Save US$${plan.monthly * 12 - plan.annual} per year.` : `Un pago anual. Ahorre US$${plan.monthly * 12 - plan.annual} al año.`) : (en ? "Billed monthly." : "Cobro mensual.")}</p>
      <ul>{plan[en ? "en" : "es"].map(text => <li key={text}><Check size={18} />{text}</li>)}</ul>
      <button type="button" className="primary" onClick={() => onChoose(plan.code)} disabled={busy || selectionDisabled || plan.users < minimumUsers || isCurrent}>
        {isCurrent ? (en ? "Current plan" : "Plan actual") : plan.users < minimumUsers ? (en ? "Contact support to change" : "Contacte a soporte para cambiar") : busy ? (en ? "Processing…" : "Procesando…") : payNow ? (en ? "Pay now" : "Pagar ahora") : trialAdvanced ? (en ? "Try Advanced free" : "Probar Advanced gratis") : signup ? (en ? `Try ${plan.name}` : `Probar ${plan.name}`) : isUpgrade ? (en ? `Upgrade to ${plan.name}` : `Mejorar a ${plan.name}`) : current === plan.code ? (en ? `Switch to ${interval === "year" ? "annual" : "monthly"}` : `Cambiar a pago ${interval === "year" ? "anual" : "mensual"}`) : (en ? `Choose ${plan.name}` : `Elegir ${plan.name}`)}
      </button>
      {isCurrent && <small>{en ? "Current plan" : "Plan actual"}</small>}
    </article>})}</div>
    <p className="billingFootnote">{en ? "Prices in USD, per restaurant. Pending invitations count toward the user limit. Card details are entered on the payment provider's page." : "Precios en USD, por restaurante. Las invitaciones pendientes cuentan para el límite de usuarios. Los datos de tarjeta se ingresan en la página del proveedor de pagos."}</p>
  </div>;
}
