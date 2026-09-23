"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type BillingInterval, type PlanCode, planFor } from "@/lib/plans";
import { useAppPreferences } from "./app-preferences";
import { PlanCards } from "./plan-cards";

export function BillingPanel({ restaurantId }: { restaurantId: string }) {
  const { language, t } = useAppPreferences(), en = language === "en";
  const [account, setAccount] = useState<any>(null), [interval, setInterval] = useState<BillingInterval>("month"),
    [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [verifying, setVerifying] = useState(false);
  const [changeStatus, setChangeStatus] = useState<{ next_at: string | null; pending: boolean; mode: string | null } | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false), [clock, setClock] = useState(Date.now());
  const [confirmation, setConfirmation] = useState<{ plan: PlanCode; interval: BillingInterval; previousPlan: PlanCode; previousInterval: BillingInterval } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), inFlight = useRef(false);
  useEffect(() => {
    if (!confirmation) return;
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, [confirmation]);
  useEffect(() => {
    if (!changeStatus?.next_at) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [changeStatus?.next_at]);
  const load = useCallback(async () => {
    const result = await supabase.rpc("v2_account_billing", { p_restaurant: restaurantId });
    if (result.error || !result.data) throw new Error("No se pudo cargar la suscripción. Intente nuevamente.");
    setAccount(result.data);
    if (result.data.is_owner && !result.data.trial_exempt && result.data.subscription_status === "active") {
      const state = await supabase.rpc("v2_plan_change_status", { p_restaurant: restaurantId });
      setStatusUnavailable(Boolean(state.error || !state.data));
      setChangeStatus(state.error ? null : state.data);
      setClock(Date.now());
    }
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
  async function redirect(action: "checkout" | "portal" | "change", plan?: PlanCode, confirmed = confirmation) {
    if (inFlight.current) return;
    if (action === "change" && (!confirmed || !plan)) return;
    inFlight.current = true;
    const targetInterval = action === "change" ? confirmed!.interval : interval;
    setConfirmation(null);
    setBusy(true); setError(""); setNotice("");
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Inicie sesión nuevamente.");
      const response = await fetch(`/api/billing/${action}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, plan, interval: targetInterval, language,
          ...(action === "change" ? { confirmed: true, expected_plan: confirmed!.previousPlan, expected_interval: confirmed!.previousInterval } : {}) }) });
      const result = await response.json();
      if (!response.ok) {
        if (action === "change") await load().catch(() => {});
        throw new Error(`${result.error || (en ? "Payment request failed." : "Falló la solicitud de pago.")}${result.reference ? ` (${en ? "Reference" : "Referencia"}: ${result.reference})` : ""}`);
      }
      if (result.next_at) setChangeStatus(previous => ({ next_at: result.next_at, pending: false, mode: previous?.mode || null }));
      if (action === "change" && !result.url && plan) {
        setVerifying(true);
        for (let attempt = 0; attempt < 15; attempt++) {
          const updated = await load();
          if (updated.plan_code === plan && updated.billing_cycle === targetInterval) {
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
      if (url.protocol !== "https:" || !!url.username || !!url.password || !!url.port) throw new Error("No se pudo abrir el pago. Intente nuevamente.");
      window.location.assign(url.href);
    } catch (failure) { setVerifying(false); setError(failure instanceof Error ? failure.message : "No se pudo abrir el pago. Intente nuevamente."); }
    finally { setBusy(false); inFlight.current = false; }
  }
  const status = account?.trial_exempt ? (en ? "No charge" : "Sin pagos")
    : account?.subscription_status === "active" ? (en ? "Active subscription" : "Suscripción activa")
    : account?.can_write ? (en ? "Trial or grace period active" : "Prueba o período de gracia vigente") : (en ? "Subscription required" : "Suscripción requerida");
  const testPayments = changeStatus?.mode ? changeStatus.mode === "test" : process.env.NEXT_PUBLIC_LEMON_SQUEEZY_MODE !== "live";
  const coolingDown = Boolean(changeStatus?.next_at && Date.parse(changeStatus.next_at) > clock);
  const changeDisabled = account?.subscription_status === "active" && (statusUnavailable || !changeStatus || changeStatus.pending || coolingDown);
  const dateText = (date: string) => new Intl.DateTimeFormat(en ? "en-US" : "es-GT", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(date));
  const offerText = (plan: PlanCode, cycle: BillingInterval) => `${planFor(plan).name} · US$${cycle === "year" ? planFor(plan).annual : planFor(plan).monthly} ${cycle === "year" ? (en ? "/ year" : "/ año") : (en ? "/ month" : "/ mes")}`;
  return <section className="moduleCard billingPanel" translate="no">
    <div className="moduleTitle"><div><h2>{en ? "Plan and subscription" : "Plan y suscripción"}</h2><p>{en ? "Manage your restaurant's plan and billing with Lemon Squeezy." : "Administre el plan y los pagos de su restaurante con Lemon Squeezy."}</p></div>{testPayments && <span className="billingTestBadge">{en ? "Test payments" : "Pagos de prueba"}</span>}</div>
    {error && <p className="error" role="alert">{en ? t(error) : error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
    {verifying && <p role="status">{en ? "Verifying payment…" : "Verificando el pago…"}</p>}
    {!account ? <button type="button" onClick={() => load().catch(() => setError("No se pudo cargar la suscripción. Intente nuevamente."))}>{en ? "Retry" : "Reintentar"}</button> : <>
      <p><strong>{planFor(account.plan_code).name}</strong> · {status}</p>
      {!account.trial_exempt && <p>{account.subscription_status === "active" ? (en ? "Paid through: " : "Período pagado hasta: ") : (en ? "Trial ends: " : "Su prueba termina: ")}{new Intl.DateTimeFormat(en ? "en-US" : "es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(account.subscription_status === "active" && account.billing_current_period_end ? account.billing_current_period_end : account.trial_ends_at))}</p>}
      {account.billing_cancel_at_period_end && <p>{en ? "Renewal canceled. Access continues through the paid period." : "Renovación cancelada. El acceso continúa hasta terminar el período pagado."}</p>}
      {!account.is_owner ? <p>{en ? "Only the main administrator can manage billing." : "Solo el administrador principal puede gestionar los pagos."}</p>
        : account.trial_exempt ? <p>{en ? "This restaurant and its invited users have Advanced at no charge, with their assigned roles." : "Este restaurante y sus usuarios invitados tienen Advanced sin pagos, con sus permisos asignados."}</p> : <>
          {(account.subscription_status === "active" || account.billing_current_period_end) && <button type="button" className="secondary" disabled={busy} onClick={() => redirect("portal")}>{en ? "Manage subscription" : "Gestionar suscripción"}</button>}
          {account.subscription_status !== "active" && <p>{en ? `Your trial lasts 10 days without a card. If you activate a paid plan now, the paid period starts immediately. Annual billing is one payment for 12 months.${testPayments ? " This environment uses test cards only." : ""}` : `Su prueba dura 10 días sin tarjeta. Si activa un plan de pago ahora, el período pagado comienza de inmediato. El pago anual cubre 12 meses en un solo cobro.${testPayments ? " Este entorno utiliza únicamente tarjetas de prueba." : ""}`}</p>}
          {account.subscription_status !== "active" && <p>{en ? "You can change your plan or billing interval without waiting. Close any previous checkout and complete payment only for your final choice. Previously opened links may remain valid until they expire." : "Puede cambiar de plan o periodicidad sin esperar. Cierre la pantalla de pago anterior y pague únicamente la opción que elija al final. Los enlaces abiertos anteriormente pueden seguir vigentes hasta vencer."}</p>}
          {account.subscription_status === "active" && <div className="billingChangeStatus" role="status">
            <p><strong>{en ? "After a successful change, you cannot change your plan or billing cycle again in MRMAA for " : "Cuando se complete el cambio, no podrá volver a cambiar de plan ni de periodicidad en MRMAA durante "}{testPayments ? (en ? "1 minute (test mode)." : "1 minuto (modo de prueba).") : (en ? "24 hours." : "24 horas.")}</strong></p>
            {coolingDown && <p><strong>{en ? "Next change available: " : "Próximo cambio disponible: "}</strong>{dateText(changeStatus!.next_at!)}</p>}
            {changeStatus?.pending && <p>{en ? "A change is awaiting verification. Refresh the status. Do not repeat the payment; contact support if this persists." : "Hay un cambio pendiente de verificación. Actualice el estado. No repita el pago; si persiste, contacte a soporte."}</p>}
            {statusUnavailable && <p className="error">{en ? "Plan-change protection could not be loaded. Check that SQL 32 was applied." : "No se pudo cargar la protección de cambios de plan. Compruebe que aplicó el SQL 32."}</p>}
            <button type="button" className="secondary" disabled={busy} onClick={() => load().catch(() => setError("No se pudo cargar la suscripción. Intente nuevamente."))}>{en ? "Refresh status" : "Actualizar estado"}</button>
          </div>}
          {account.subscription_status === "past_due" && account.billing_current_period_end ? <p>{en ? "Resolve the pending payment before changing plans." : "Resuelva el pago pendiente antes de cambiar de plan."}</p>
            : <PlanCards interval={interval} onInterval={setInterval} onChoose={plan => {
              if (account.subscription_status !== "active") void redirect("checkout", plan);
              else if (!changeDisabled) setConfirmation({ plan, interval, previousPlan: account.plan_code, previousInterval: account.billing_cycle });
            }} busy={busy || verifying} selectionDisabled={changeDisabled} payNow={account.subscription_status !== "active"} current={account.plan_code} currentInterval={account.billing_cycle} />}
        </>}
    </>}
    {confirmation && <dialog ref={dialog} className="billingConfirm" aria-labelledby="billing-confirm-title" aria-describedby="billing-confirm-description" onCancel={() => setConfirmation(null)}>
      <h2 id="billing-confirm-title">{en ? "Confirm subscription change" : "Confirmar cambio de suscripción"}</h2>
      <dl><div><dt>{en ? "Current plan · catalog price" : "Plan actual · precio de catálogo"}</dt><dd>{offerText(confirmation.previousPlan, confirmation.previousInterval)}</dd></div>
        <div><dt>{en ? "New" : "Nuevo"}</dt><dd>{offerText(confirmation.plan, confirmation.interval)}</dd></div></dl>
      <p id="billing-confirm-description">{en ? "The provider may charge a prorated adjustment immediately. Changing between annual and monthly billing may reset the renewal date. A credit for unused time is not an automatic card refund." : "El proveedor puede cobrar un ajuste proporcional de inmediato. Cambiar entre anual y mensual puede modificar la fecha de renovación. Un crédito por tiempo no utilizado no es una devolución automática a su tarjeta."}</p>
      <p>{en ? "These are recurring prices before applicable taxes, not an exact quote of today's adjustment. The change applies when confirmed by the provider." : "Estos son precios recurrentes antes de impuestos aplicables, no el importe exacto del ajuste de hoy. El cambio se aplica cuando lo confirma el proveedor."}</p>
      <p>{en ? "An existing subscription may retain an earlier price. Check your current billed amount under Manage subscription." : "Una suscripción existente puede conservar una tarifa anterior. Consulte el importe que paga actualmente en Gestionar suscripción."}</p>
      <p className="billingChangeStatus"><strong>{en ? `After a successful change, you cannot change your plan or billing cycle again in MRMAA for ${testPayments ? "1 minute (test mode)" : "24 hours"}.` : `Cuando se complete el cambio, no podrá volver a cambiar de plan ni de periodicidad en MRMAA durante ${testPayments ? "1 minuto (modo de prueba)" : "24 horas"}.`}</strong></p>
      <div className="billingConfirmActions"><button type="button" className="secondary" autoFocus onClick={() => setConfirmation(null)}>{en ? "Cancel" : "Cancelar"}</button>
        <button type="button" className="primary" disabled={busy} onClick={() => void redirect("change", confirmation.plan, confirmation)}>{en ? "Confirm change" : "Confirmar cambio"}</button></div>
    </dialog>}
  </section>;
}
