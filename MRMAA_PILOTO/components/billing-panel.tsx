"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type BillingInterval, type PlanCode, planFor } from "@/lib/plans";
import { useAppPreferences } from "./app-preferences";
import { PlanCards } from "./plan-cards";

export function BillingPanel({ restaurantId }: { restaurantId: string }) {
  const { language, t } = useAppPreferences(), en = language === "en";
  const [account, setAccount] = useState<any>(null), [interval, setInterval] = useState<BillingInterval>("month"),
    [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [verifying, setVerifying] = useState(false);
  const load = useCallback(async () => {
    const result = await supabase.rpc("v2_account_billing", { p_restaurant: restaurantId });
    if (result.error || !result.data) throw new Error("No se pudo cargar la suscripción. Intente nuevamente.");
    setAccount(result.data);
    return result.data;
  }, [restaurantId]);
  useEffect(() => {
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const returned = new URLSearchParams(window.location.search).get("billing") === "success";
    let attempts = 0;
    const refresh = async () => {
      try {
        const data = await load();
        if (cancelled) return;
        if (attempts === 0) setInterval(data.billing_cycle || "month");
        if (returned && data.subscription_status !== "active" && attempts++ < 15) {
          setVerifying(true); timer = setTimeout(refresh, 2000);
        } else {
          setVerifying(false);
          if (returned && data.subscription_status !== "active") setError("El pago todavía no está confirmado. Revise de nuevo en unos momentos.");
          window.dispatchEvent(new Event("mrmaa:billing-updated"));
        }
      } catch { if (!cancelled) { setVerifying(false); setError("No se pudo cargar la suscripción. Intente nuevamente."); } }
    };
    void refresh();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [load]);
  async function redirect(action: "checkout" | "portal" | "change", plan?: PlanCode) {
    if (busy) return;
    if (action === "change" && plan) {
      const lower = planFor(plan).monthly < planFor(account.plan_code).monthly;
      const cycleChanged = interval !== account.billing_cycle;
      const detail = cycleChanged
        ? (en ? "Changing the billing interval may reset your renewal date and generate an immediate charge. Lemon Squeezy calculates the adjustment for unused time. Any resulting credit is not an automatic refund to your card."
          : "Cambiar la periodicidad puede modificar la fecha de renovación y generar un cobro inmediato. Lemon Squeezy calcula el ajuste por el tiempo no utilizado. Un crédito resultante no es una devolución automática a su tarjeta.")
        : lower
          ? (en ? "Lemon Squeezy calculates a prorated credit for unused time, applied to billing. This is not an automatic refund to your card."
            : "Lemon Squeezy calcula un crédito proporcional por el tiempo no utilizado y lo aplica a la facturación. No es una devolución automática a su tarjeta.")
          : (en ? "Lemon Squeezy may charge the prorated difference immediately."
            : "Lemon Squeezy puede cobrar inmediatamente la diferencia proporcional.");
      if (!window.confirm(`${planFor(account.plan_code).name} → ${planFor(plan).name}. ${detail} ${en ? "The change takes effect immediately. Continue?" : "El cambio entra en vigor inmediatamente. ¿Desea continuar?"}`)) return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Inicie sesión nuevamente.");
      const response = await fetch(`/api/billing/${action}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, plan, interval, language }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "change" && !result.url && plan) {
        setVerifying(true);
        for (let attempt = 0; attempt < 15; attempt++) {
          const updated = await load();
          if (updated.plan_code === plan && updated.billing_cycle === interval) {
            setVerifying(false);
            setNotice(en ? "Your subscription was updated successfully." : "Su suscripción se actualizó correctamente.");
            window.dispatchEvent(new Event("mrmaa:billing-updated"));
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error("El cambio fue solicitado y todavía se está verificando. Revise nuevamente en unos momentos.");
      }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !/^(?:[a-z0-9-]+\.)?lemonsqueezy\.com$/.test(url.hostname) || !!url.username || !!url.password || !!url.port) throw new Error("No se pudo abrir el pago. Intente nuevamente.");
      window.location.assign(url.href);
    } catch (failure) { setVerifying(false); setError(failure instanceof Error ? failure.message : "No se pudo abrir el pago. Intente nuevamente."); }
    finally { setBusy(false); }
  }
  const status = account?.trial_exempt ? (en ? "Complimentary pilot access" : "Acceso gratuito del piloto")
    : account?.subscription_status === "active" ? (en ? "Active subscription" : "Suscripción activa")
    : account?.can_write ? (en ? "Trial or grace period active" : "Prueba o período de gracia vigente") : (en ? "Subscription required" : "Suscripción requerida");
  return <section className="moduleCard billingPanel" translate="no">
    <div className="moduleTitle"><div><h2>{en ? "Plan and subscription" : "Plan y suscripción"}</h2><p>{account?.trial_exempt
      ? (en ? "Your restaurant has complimentary access, with no expiration date." : "Su restaurante tiene acceso gratuito, sin fecha de vencimiento.")
      : (en ? "Manage your restaurant's plan and billing with Lemon Squeezy." : "Administre el plan y los pagos de su restaurante con Lemon Squeezy.")}</p></div>{account && !account.trial_exempt && <span className="billingTestBadge">{en ? "Test payments" : "Pagos de prueba"}</span>}</div>
    {error && <p className="error" role="alert">{en ? t(error) : error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
    {verifying && <p role="status">{en ? "Verifying payment…" : "Verificando el pago…"}</p>}
    {!account ? <button type="button" onClick={() => load().catch(() => setError("No se pudo cargar la suscripción. Intente nuevamente."))}>{en ? "Retry" : "Reintentar"}</button> : <>
      <p><strong>{planFor(account.plan_code).name}</strong> · {status}</p>
      {!account.trial_exempt && <p>{account.subscription_status === "active" ? (en ? "Paid through: " : "Período pagado hasta: ") : (en ? "Trial ends: " : "Su prueba termina: ")}{new Intl.DateTimeFormat(en ? "en-US" : "es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(account.subscription_status === "active" && account.billing_current_period_end ? account.billing_current_period_end : account.trial_ends_at))}</p>}
      {account.billing_cancel_at_period_end && <p>{en ? "Renewal canceled. Access continues through the paid period." : "Renovación cancelada. El acceso continúa hasta terminar el período pagado."}</p>}
      {account.trial_exempt ? <p>{en ? "This access includes current and future members invited to this restaurant. Each member keeps the permissions assigned by the administrator." : "Este acceso incluye a los miembros actuales y futuros invitados a este restaurante. Cada persona conserva los permisos asignados por el administrador."}</p>
        : !account.is_owner ? <p>{en ? "Only the main administrator can manage billing." : "Solo el administrador principal puede gestionar los pagos."}</p> : <>
          {(account.subscription_status === "active" || account.billing_current_period_end) && <button type="button" className="secondary" disabled={busy} onClick={() => redirect("portal")}>{en ? "Manage subscription" : "Gestionar suscripción"}</button>}
          {account.subscription_status !== "active" && <p>{en ? "Your trial lasts 5 days without a card. If you activate a paid plan now, the paid period starts immediately. Annual billing is one payment for 12 months. This environment uses test cards only." : "Su prueba dura 5 días sin tarjeta. Si activa un plan de pago ahora, el período pagado comienza de inmediato. El pago anual cubre 12 meses en un solo cobro. Este entorno utiliza únicamente tarjetas de prueba."}</p>}
          {account.subscription_status !== "active" && <p>{en ? "You can change your plan or billing interval without waiting. Close any previous checkout and complete payment only for your final choice. Previously opened links may remain valid until they expire." : "Puede cambiar de plan o periodicidad sin esperar. Cierre la pantalla de pago anterior y pague únicamente la opción que elija al final. Los enlaces abiertos anteriormente pueden seguir vigentes hasta vencer."}</p>}
          {account.subscription_status === "past_due" && account.billing_current_period_end ? <p>{en ? "Resolve the pending payment before changing plans." : "Resuelva el pago pendiente antes de cambiar de plan."}</p>
            : <PlanCards interval={interval} onInterval={setInterval} onChoose={plan => redirect(account.subscription_status === "active" ? "change" : "checkout", plan)} busy={busy || verifying} payNow={account.subscription_status !== "active"} current={account.plan_code} currentInterval={account.billing_cycle} />}
        </>}
    </>}
  </section>;
}
