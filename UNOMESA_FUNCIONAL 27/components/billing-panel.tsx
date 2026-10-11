"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { type BillingInterval, type PlanCode, planFor } from "@/lib/plans";
import { useAppPreferences } from "./app-preferences";
import { billingPresentation } from "@/lib/billing-presentation";
import { PlanCards } from "./plan-cards";
import { BILLING_RETURN_CHANNEL, BILLING_RETURN_EVENT, openBilling, reserveBillingWindow } from "@/lib/billing-navigation";

export function BillingPanel({ restaurantId }: { restaurantId: string }) {
  const { language, t } = useAppPreferences(), en = language === "en";
  const [account, setAccount] = useState<any>(null), [interval, setInterval] = useState<BillingInterval>("month"),
    [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [verifying, setVerifying] = useState(false);
  const [changeStatus, setChangeStatus] = useState<{ next_at: string | null; pending: boolean; mode: string | null } | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false), [clock, setClock] = useState(Date.now());
  const [confirmation, setConfirmation] = useState<{ plan: PlanCode; interval: BillingInterval; previousPlan: PlanCode; previousInterval: BillingInterval } | null>(null);
  const [refreshError, setRefreshError] = useState(""), [refreshVersion, setRefreshVersion] = useState(0);
  const [resumeConfirmation, setResumeConfirmation] = useState(false);
  const resumeDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (resumeConfirmation) resumeDialog.current?.showModal(); return () => resumeDialog.current?.close(); }, [resumeConfirmation]);
  const [paymentPending, setPaymentPending] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [providerState, setProviderState] = useState<{ provider_status: string; refunded: boolean; can_checkout: boolean; ends_at: string | null } | null>(null);
  const [external, setExternal] = useState<'native'|'tab'|'legacy'|null>(null);
  const [blockedURL, setBlockedURL] = useState<string|null>(null); // Memory only; never storage/logs.
  const awaitingCheckout = useRef(false);
  useEffect(() => {
    let mounted = true;
    const returned = async () => {
      setExternal(null); setBlockedURL(null);
      // A very fast close can coincide with the read started when opening.
      // Refresh after that read finishes rather than reusing its earlier result.
      await accountRead.current?.promise.catch(() => {});
      if(mounted) setRefreshVersion(value => value + 1);
    };
    window.addEventListener(BILLING_RETURN_EVENT, returned);
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel(BILLING_RETURN_CHANNEL); channel.onmessage = event => { if(event.data === 'refresh') returned(); }; } catch {}
    return () => { mounted = false; window.removeEventListener(BILLING_RETURN_EVENT, returned); channel?.close(); };
  }, []);
  const accountVersion = useRef(""), loadedCycle = useRef("");
  const accountRead = useRef<{ restaurant: string; promise: Promise<any> } | null>(null);
  const lifecycle = useRef(0);
  useEffect(() => {
    lifecycle.current++;
    accountRead.current = null;
    accountVersion.current = ""; loadedCycle.current = "";
    setAccount(null); setProviderState(null); setExternal(null); setBlockedURL(null); awaitingCheckout.current = false;
    return () => { lifecycle.current++; accountRead.current = null; };
  }, [restaurantId]);
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
    if (accountRead.current?.restaurant === restaurantId) return accountRead.current.promise;
    const generation = lifecycle.current;
    const promise = (async () => {
      const result = await supabase.rpc("v2_account_billing", { p_restaurant: restaurantId });
      if (result.error || !result.data || result.data.id !== restaurantId) throw new Error("No se pudo cargar la suscripción. Intente nuevamente.");
      if (generation !== lifecycle.current) return result.data;
      setAccount(result.data); setRefreshError("");
      const cycle = result.data.billing_cycle || "month";
      if (loadedCycle.current !== cycle) { loadedCycle.current = cycle; setInterval(cycle); }
      const version = JSON.stringify([result.data.plan_code, cycle, result.data.subscription_status,
        result.data.billing_current_period_end, result.data.billing_cancel_at_period_end, result.data.can_write, result.data.trial_exempt]);
      if (accountVersion.current !== version) {
        accountVersion.current = version; setProviderState(null);
        window.dispatchEvent(new Event("mrmaa:billing-updated"));
      }
      if (result.data.is_owner && !result.data.trial_exempt && result.data.subscription_status === "active") {
        const state = await supabase.rpc("v2_plan_change_status", { p_restaurant: restaurantId });
        if (generation !== lifecycle.current) return result.data;
        setStatusUnavailable(Boolean(state.error || !state.data));
        setChangeStatus(state.error ? null : state.data);
        setClock(Date.now());
      } else { setChangeStatus(null); setStatusUnavailable(false); }
      return result.data;
    })();
    accountRead.current = { restaurant: restaurantId, promise };
    try { return await promise; }
    finally { if (accountRead.current?.promise === promise) accountRead.current = null; }
  }, [restaurantId]);
  async function refreshProvider() {
    if (inFlight.current) return;
    // Other team members may refresh their local view, but only the owner can
    // reconcile billing with the provider through the authenticated endpoint.
    if (!account?.is_owner) {
      setError(""); setNotice("");
      try { await accountRead.current?.promise.catch(() => {}); await load(); setNotice(en ? "Account status refreshed. Only the owner can verify billing with Lemon Squeezy." : "Estado de la cuenta actualizado. Solo el propietario puede verificar los pagos con Lemon Squeezy."); }
      catch { setError(en ? "Could not refresh the account." : "No se pudo actualizar la cuenta."); }
      return;
    }
    inFlight.current = true; setBusy(true); setCheckingProvider(true); setError(""); setNotice(""); setProviderState(null);
    const generation = lifecycle.current;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error(en ? "Sign in again." : "Inicie sesión nuevamente.");
      const response = await fetch("/api/billing/refresh", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ restaurant_id: restaurantId, language }) });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error || (en ? "Could not verify billing." : "No se pudieron verificar los pagos.")}${result.reference ? ` (${en ? "Reference" : "Referencia"}: ${result.reference})` : ""}`);
      await accountRead.current?.promise.catch(() => {});
      const updated = await load();
      if (generation !== lifecycle.current) return;
      if (result.verified === true) {
        setProviderState(result);
        setNotice(en ? "Status updated and verified with Lemon Squeezy." : "Estado actualizado y verificado con Lemon Squeezy.");
        if (updated.subscription_status === "active") { awaitingCheckout.current = false; setPaymentPending(false); setVerifying(false); }
      } else if (result.reason === "exempt") {
        setNotice(en ? "Account updated. This restaurant is exempt from payment; no Lemon Squeezy verification is needed." : "Cuenta actualizada. Este restaurante está exento de pago; no necesita verificación con Lemon Squeezy.");
      } else {
        setNotice(en ? "There is no paid subscription linked yet. If you just paid, confirmation is still pending; do not pay again." : "Todavía no hay una suscripción de pago vinculada. Si acaba de pagar, falta recibir la confirmación; no vuelva a pagar.");
      }
    } catch (failure) { if (generation === lifecycle.current) setError(failure instanceof Error ? failure.message : (en ? "Could not verify the status." : "No se pudo verificar el estado.")); }
    finally { if (generation === lifecycle.current) { setCheckingProvider(false); setBusy(false); } inFlight.current = false; }
  }
  useEffect(() => {
    let cancelled = false, refreshing = false, timer: ReturnType<typeof setTimeout> | undefined;
    // A return link is only a request to refresh. It never proves payment.
    const returned = awaitingCheckout.current || ["success", "return"].includes(new URLSearchParams(window.location.search).get("billing") || "");
    let started = Date.now(), confirmed = false;
    setPaymentPending(returned); setVerifying(returned); setRefreshError("");
    const refresh = async () => {
      if (cancelled || refreshing || document.visibilityState === "hidden") return;
      if (timer) clearTimeout(timer);
      refreshing = true;
      try {
        const data = await load();
        if (cancelled) return;
        const pending = returned && !data.trial_exempt && data.subscription_status !== "active";
        setPaymentPending(pending);
        setVerifying(pending && Date.now() - started < 60000);
        if (returned && data.subscription_status === "active" && !confirmed) {
          confirmed = true; awaitingCheckout.current = false;
          setNotice(en ? "Your payment is confirmed and your subscription is active." : "Su pago está confirmado y su suscripción está activa.");
          // Select the verified paid cycle, even if the trial had the same cycle.
          setInterval(data.billing_cycle || "month");
        }
        if (Date.now() - started < 120000) {
          timer = setTimeout(refresh, pending && Date.now() - started < 60000 ? 3000 : 15000);
        }
      } catch { if (!cancelled) { setVerifying(false); setRefreshError("No se pudo cargar la suscripción. Intente nuevamente."); } }
      finally { refreshing = false; }
    };
    const onReturn = () => { if (document.visibilityState !== "hidden") { started = Date.now(); void refresh(); } };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    void refresh();
    return () => {
      cancelled = true; if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [load, en, refreshVersion]);
  async function redirect(action: "checkout" | "portal" | "change" | "resume", plan?: PlanCode, confirmed = confirmation) {
    if (inFlight.current) return;
    if (action === "change" && (!confirmed || !plan)) return;
    inFlight.current = true;
    // Reserve before the first await so Safari does not block the new tab.
    const paymentTab = action === 'resume' ? null : reserveBillingWindow(en);
    let opened = false;
    setBlockedURL(null);
    const targetInterval = action === "change" ? confirmed!.interval : interval;
    setConfirmation(null); setResumeConfirmation(false);
    setBusy(true); setError(""); setNotice("");
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Inicie sesión nuevamente.");
      const response = await fetch(`/api/billing/${action}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, plan, interval: targetInterval, language,
          ...(action === "resume" ? { confirmed: true } : {}),
          ...(action === "change" ? { confirmed: true, expected_plan: confirmed!.previousPlan, expected_interval: confirmed!.previousInterval } : {}) }) });
      const result = await response.json();
      if (!response.ok) {
        if (action === "change") await load().catch(() => {});
        throw new Error(`${result.error || (en ? "Payment request failed." : "Falló la solicitud de pago.")}${result.reference ? ` (${en ? "Reference" : "Referencia"}: ${result.reference})` : ""}`);
      }
      if (action === "resume") {
        setVerifying(true);
        for (let attempt = 0; attempt < 15; attempt++) {
          const updated = await load();
          if (updated.subscription_status === "active" && updated.billing_cancel_at_period_end === false) {
            setVerifying(false);
            setNotice(en ? "Automatic renewal reactivated for your current plan." : "Renovación automática reactivada para su plan actual.");
            window.dispatchEvent(new Event("mrmaa:billing-updated"));
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        setVerifying(false);
        setNotice(en ? "Reactivation requested. Confirmation is pending; refresh the status shortly." : "Reactivación solicitada. Falta recibir la confirmación; actualice el estado en unos momentos.");
        return;
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
      const destination = await openBilling(result.url, paymentTab);
      opened = destination !== 'blocked';
      if(destination === 'blocked') { setBlockedURL(result.url); return; }
      setExternal(destination);
      awaitingCheckout.current = action === 'checkout';
      setRefreshVersion(value => value + 1);
    } catch (failure) { setVerifying(false); setError(failure instanceof Error ? failure.message : "No se pudo abrir el pago. Intente nuevamente."); }
    finally { if(!opened) paymentTab?.close(); setBusy(false); inFlight.current = false; }
  }
  const presentation = billingPresentation(account || {});
  const providerBlocksCheckout = account?.subscription_status !== "active" && providerState?.can_checkout === false;
  const subscriptionEnded = providerState?.can_checkout === true;
  const status = account?.trial_exempt ? (en ? "No charge" : "Sin pagos")
    : account?.subscription_status === "active" ? (en ? "Active subscription" : "Suscripción activa")
    : subscriptionEnded ? (en ? "Subscription ended" : "Suscripción finalizada")
    : account?.can_write ? (en ? "Trial or grace period active" : "Prueba o período de gracia vigente") : (en ? "Subscription required" : "Suscripción requerida");
  const testPayments = changeStatus?.mode ? changeStatus.mode === "test" : process.env.NEXT_PUBLIC_LEMON_SQUEEZY_MODE !== "live";
  const coolingDown = Boolean(changeStatus?.next_at && Date.parse(changeStatus.next_at) > clock);
  const changeDisabled = account?.subscription_status === "active" && (statusUnavailable || !changeStatus || changeStatus.pending || coolingDown);
  const dateText = (date: string) => new Intl.DateTimeFormat(en ? "en-US" : "es-GT", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(date));
  const offerText = (plan: PlanCode, cycle: BillingInterval) => `${planFor(plan).name} · US$${cycle === "year" ? planFor(plan).annual : planFor(plan).monthly} ${cycle === "year" ? (en ? "/ year" : "/ año") : (en ? "/ month" : "/ mes")}`;
  return <section className="moduleCard billingPanel" translate="no">
    <div className="moduleTitle"><div><h2>{en ? "Plan and subscription" : "Plan y suscripción"}</h2><p>{en ? "Manage your restaurant's plan and billing with Lemon Squeezy." : "Administre el plan y los pagos de su restaurante con Lemon Squeezy."}</p></div>{testPayments && <span className="billingTestBadge">{en ? "Test payments" : "Pagos de prueba"}</span>}</div>
    {error && <p className="error" role="alert">{en ? t(error) : error}</p>}
    {refreshError && <p className="error" role="alert">{en ? t(refreshError) : refreshError}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
    {external && <p className="billingPending" role="status">{external === 'native'
      ? (en ? 'Tap Done in the payment window to return here. Your subscription will refresh automatically.' : 'Pulse Listo en la ventana de pagos para regresar aquí. Su suscripción se actualizará automáticamente.')
      : external === 'legacy' ? (en ? 'Return to UnoMesa after finishing in your browser. Update the iOS app to get an in-app Done button.' : 'Vuelva a UnoMesa al terminar en el navegador. Actualice la app iOS para tener el botón Listo dentro de la app.')
      : (en ? 'Billing opened in another tab. Close it when finished to return here; your subscription will refresh.' : 'Los pagos se abrieron en otra pestaña. Ciérrela al terminar para regresar aquí; su suscripción se actualizará.')}</p>}
    {blockedURL && <p className="billingPending" role="status">{en ? 'Your browser blocked the payment window. ' : 'El navegador bloqueó la ventana de pagos. '}<a href={blockedURL} target="_blank" rel="noopener noreferrer" onClick={() => {setExternal('tab');awaitingCheckout.current = account?.subscription_status !== 'active';setRefreshVersion(v=>v+1)}}>{en ? 'Open secure billing' : 'Abrir pagos seguros'}</a></p>}
    {verifying && <p role="status">{en ? "Verifying payment…" : "Verificando el pago…"}</p>}
    {paymentPending && !verifying && <p className="billingPending" role="status">{en ? "We are still awaiting payment confirmation. If you were already charged, do not pay again. Refresh the status or contact support@unomesa.com with your receipt." : "Todavía esperamos la confirmación del pago. Si ya le cobraron, no vuelva a pagar. Actualice el estado o contacte a support@unomesa.com con su comprobante."}</p>}
    <button type="button" className="secondary" disabled={busy || !account} onClick={() => void refreshProvider()}>{checkingProvider ? (en ? "Checking Lemon Squeezy…" : "Consultando Lemon Squeezy…") : (en ? "Refresh status" : "Actualizar estado")}</button>
    {providerState?.refunded && <p className="billingPending">{en ? "The payment was refunded. A refund does not necessarily end the provider subscription; its verified status determines whether a new plan can be purchased." : "El pago fue reembolsado. El reembolso no necesariamente finaliza la suscripción del proveedor; su estado verificado determina si ya puede contratar otro plan."}</p>}
    {providerBlocksCheckout && <p className="billingPending">{en ? "Lemon Squeezy still has a subscription that must be managed before creating another. Open Manage subscription to review its renewal or pending payment." : "Lemon Squeezy todavía tiene una suscripción que debe gestionarse antes de crear otra. Abra Gestionar suscripción para revisar la renovación o el pago pendiente."}{providerState?.ends_at && <> {en ? "Provider end date: " : "Fecha final en el proveedor: "}{dateText(providerState.ends_at)}</>}</p>}
    {account && <>
      <p><strong>{account.subscription_status === "active" ? (en ? "Current plan: " : "Plan actual: ") : (en ? "Selected plan: " : "Plan seleccionado: ")}{planFor(account.plan_code).name}</strong> · {status}</p>
      {presentation.end !== null && <p>{presentation.paid
        ? (presentation.ended ? (en ? "Paid period ended: " : "El período pagado terminó: ") : (en ? "Paid through: " : "Período pagado hasta: "))
        : (presentation.ended ? (en ? "Trial ended: " : "Su prueba terminó: ") : (en ? "Trial ends: " : "Su prueba termina: "))}{new Intl.DateTimeFormat(en ? "en-US" : "es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(presentation.end))}</p>}
      {presentation.renewal && <p>{presentation.renewal === 'through-period'
        ? (en ? "Renewal canceled. Access continues through the paid period." : "Renovación cancelada. El acceso continúa hasta terminar el período pagado.")
        : (en ? "Automatic renewal is canceled. Choose a plan to subscribe again once the previous subscription has ended." : "La renovación automática está cancelada. Elija un plan para contratarlo nuevamente cuando termine la suscripción anterior.")}</p>}
      {!account.is_owner ? <p>{en ? "Only the main administrator can manage billing." : "Solo el administrador principal puede gestionar los pagos."}</p>
        : account.trial_exempt ? <p>{en ? "This restaurant and its invited users have Advanced at no charge, with their assigned roles." : "Este restaurante y sus usuarios invitados tienen Advanced sin pagos, con sus permisos asignados."}</p> : <>
          {presentation.renewal === 'through-period' && <button type="button" className="primary" disabled={busy || verifying} onClick={() => setResumeConfirmation(true)}>{en ? "Reactivate current plan" : "Reactivar plan actual"}</button>}
          {(subscriptionEnded || (account.subscription_status === "cancelled" && presentation.paid && presentation.ended)) && !providerBlocksCheckout && <div className="billingRestart">
            <p><strong>{offerText(account.plan_code, interval)}</strong></p>
            <button type="button" className="primary" disabled={busy || verifying || paymentPending} onClick={() => void redirect("checkout", account.plan_code)}>{en ? "Pay now" : "Pagar ahora"}</button>
            <p>{en ? "Keep this plan, or choose another below. Your restaurant data stays in the same account." : "Conserve este plan o elija otro abajo. Los datos de su restaurante permanecen en la misma cuenta."}</p>
          </div>}
          <p className="billingReturnHelp">{en ? "Web: close the payment tab to return. iOS: tap Done. Refresh status checks changes with Lemon Squeezy." : "Web: cierre la pestaña de pagos para volver. iOS: pulse Listo. Actualizar estado verifica los cambios con Lemon Squeezy."}</p>
          {(account.subscription_status === "active" || account.billing_current_period_end || providerState) && <button type="button" className="secondary" disabled={busy} onClick={() => redirect("portal")}>{subscriptionEnded ? (en ? "View past payments" : "Ver pagos anteriores") : (en ? "Manage subscription" : "Gestionar suscripción")}</button>}
          {account.subscription_status !== "active" && <p>{en ? `${presentation.paid || providerState ? "Choose a plan and select Pay now to subscribe again after your previous subscription ends." : presentation.trialEnded ? "Your free trial has ended." : "Your trial lasts 10 days without a card."} If you activate a paid plan now, the paid period starts immediately. Annual billing is one payment for 12 months.${testPayments ? " This environment uses test cards only." : ""}` : `${presentation.paid || providerState ? "Elija un plan y pulse Pagar ahora para contratarlo nuevamente cuando finalice su suscripción anterior." : presentation.trialEnded ? "Su prueba gratuita ya terminó." : "Su prueba dura 10 días sin tarjeta."} Si activa un plan de pago ahora, el período pagado comienza de inmediato. El pago anual cubre 12 meses en un solo cobro.${testPayments ? " Este entorno utiliza únicamente tarjetas de prueba." : ""}`}</p>}
          {account.subscription_status !== "active" && <details className="billingHelp"><summary>{en ? "Help choosing a plan" : "Ayuda para elegir un plan"}</summary><p>{en ? "You can change your plan or billing interval without waiting. Close any previous checkout and complete payment only for your final choice. Previously opened links may remain valid until they expire." : "Puede cambiar de plan o periodicidad sin esperar. Cierre la pantalla de pago anterior y pague únicamente la opción que elija al final. Los enlaces abiertos anteriormente pueden seguir vigentes hasta vencer."}</p></details>}
          {account.subscription_status === "active" && <div className="billingChangeStatus" role="status">
            <p><strong>{en ? "After a successful change, you cannot change your plan or billing cycle again in UnoMesa for " : "Cuando se complete el cambio, no podrá volver a cambiar de plan ni de periodicidad en UnoMesa durante "}{testPayments ? (en ? "1 minute (test mode)." : "1 minuto (modo de prueba).") : (en ? "24 hours." : "24 horas.")}</strong></p>
            {coolingDown && <p><strong>{en ? "Next change available: " : "Próximo cambio disponible: "}</strong>{dateText(changeStatus!.next_at!)}</p>}
            {changeStatus?.pending && <p>{en ? "A change is awaiting verification. Refresh the status. Do not repeat the payment; contact support if this persists." : "Hay un cambio pendiente de verificación. Actualice el estado. No repita el pago; si persiste, contacte a soporte."}</p>}
            {statusUnavailable && <p className="error">{en ? "Plan-change protection could not be loaded. Check that SQL 32 was applied." : "No se pudo cargar la protección de cambios de plan. Compruebe que aplicó el SQL 32."}</p>}
          </div>}
          {providerBlocksCheckout ? null : account.subscription_status === "past_due" && account.billing_current_period_end ? <p>{en ? "Resolve the pending payment before changing plans." : "Resuelva el pago pendiente antes de cambiar de plan."}</p>
            : <PlanCards interval={interval} onInterval={setInterval} onChoose={plan => {
              if (account.subscription_status !== "active") void redirect("checkout", plan);
              else if (!changeDisabled) setConfirmation({ plan, interval, previousPlan: account.plan_code, previousInterval: account.billing_cycle });
            }} busy={busy || verifying} selectionDisabled={changeDisabled || paymentPending} payNow={account.subscription_status !== "active"} current={account.plan_code} currentInterval={account.billing_cycle} />}
        </>}
    </>}
    {resumeConfirmation && <dialog ref={resumeDialog} className="billingConfirm" aria-labelledby="resume-title" onCancel={() => setResumeConfirmation(false)}>
      <h2 id="resume-title">{en ? "Reactivate current plan" : "Reactivar plan actual"}</h2>
      <p>{en ? "This restores automatic renewal for your existing subscription, keeping its plan and billing frequency. Future recurring charges will resume according to the provider’s current terms. Review your billed amount under Manage subscription." : "Se restablecerá la renovación automática de su suscripción existente, conservando el plan y la periodicidad. Los próximos cobros recurrentes seguirán las condiciones vigentes del proveedor. Consulte su importe actual en Gestionar suscripción."}</p>
      <div className="billingConfirmActions"><button type="button" className="secondary" autoFocus onClick={() => setResumeConfirmation(false)}>{en ? "Go back" : "Volver"}</button><button type="button" className="primary" disabled={busy || verifying} onClick={() => void redirect("resume")}>{en ? "Confirm automatic renewal" : "Confirmar renovación automática"}</button></div>
    </dialog>}
    {confirmation && <dialog ref={dialog} className="billingConfirm" aria-labelledby="billing-confirm-title" aria-describedby="billing-confirm-description" onCancel={() => setConfirmation(null)}>
      <h2 id="billing-confirm-title">{en ? "Confirm subscription change" : "Confirmar cambio de suscripción"}</h2>
      <dl><div><dt>{en ? "Current plan · catalog price" : "Plan actual · precio de catálogo"}</dt><dd>{offerText(confirmation.previousPlan, confirmation.previousInterval)}</dd></div>
        <div><dt>{en ? "New" : "Nuevo"}</dt><dd>{offerText(confirmation.plan, confirmation.interval)}</dd></div></dl>
      <p id="billing-confirm-description">{en ? "The provider may charge a prorated adjustment immediately. Changing between annual and monthly billing may reset the renewal date. A credit for unused time is not an automatic card refund." : "El proveedor puede cobrar un ajuste proporcional de inmediato. Cambiar entre anual y mensual puede modificar la fecha de renovación. Un crédito por tiempo no utilizado no es una devolución automática a su tarjeta."}</p>
      <p>{en ? "These are recurring prices before applicable taxes, not an exact quote of today's adjustment. The change applies when confirmed by the provider." : "Estos son precios recurrentes antes de impuestos aplicables, no el importe exacto del ajuste de hoy. El cambio se aplica cuando lo confirma el proveedor."}</p>
      <p>{en ? "An existing subscription may retain an earlier price. Check your current billed amount under Manage subscription." : "Una suscripción existente puede conservar una tarifa anterior. Consulte el importe que paga actualmente en Gestionar suscripción."}</p>
      <p className="billingChangeStatus"><strong>{en ? `After a successful change, you cannot change your plan or billing cycle again in UnoMesa for ${testPayments ? "1 minute (test mode)" : "24 hours"}.` : `Cuando se complete el cambio, no podrá volver a cambiar de plan ni de periodicidad en UnoMesa durante ${testPayments ? "1 minuto (modo de prueba)" : "24 horas"}.`}</strong></p>
      <div className="billingConfirmActions"><button type="button" className="secondary" autoFocus onClick={() => setConfirmation(null)}>{en ? "Cancel" : "Cancelar"}</button>
        <button type="button" className="primary" disabled={busy} onClick={() => void redirect("change", confirmation.plan, confirmation)}>{en ? "Confirm change" : "Confirmar cambio"}</button></div>
    </dialog>}
  </section>;
}
