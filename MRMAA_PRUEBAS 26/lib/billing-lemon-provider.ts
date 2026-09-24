import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { BillingError, acquireBilling, releaseBilling, serverClients, strictRateLimit } from "@/lib/billing-server";
import { CHECKOUT_MINUTES, LEMON_TEST_MODE, LemonAPIError, checkoutSelection, lemonPatch, lemonRequest, lemonStoreId, lemonURL, planFromVariant, requireTest, validatePrice, validateVariant, verifyLemonEvent } from "@/lib/lemon-squeezy";
import { siteOrigin } from "@/lib/site-origin";
import { planAmount, planFor } from "@/lib/plans";
import { RequestSafetyError, readBoundedText } from "@/lib/server-scale";
import type { BillingInput } from "./billing-provider";

export async function checkout(req: NextRequest, input: BillingInput) {
  let locked: { admin: any; id: string; token: string } | undefined;
  try {
    const body = input.body, selected = checkoutSelection(body);
    const { admin, client, user, restaurant } = input.context;
    await strictRateLimit(req, "billing:checkout", 8);
    const exemption = await client.rpc("v2_billing_exempt", { p_restaurant: restaurant.id });
    if (exemption.error) throw exemption.error;
    if (exemption.data) throw new BillingError("Esta cuenta está exenta de pago.");
    if (["suspended", "deleted"].includes(restaurant.access_status)) throw new BillingError("Contacte a soporte para revisar su cuenta.", 403);
    const lease = await acquireBilling(admin, restaurant.id);
    locked = { admin, id: restaurant.id, token: lease.lease_token };
    const pinned = await admin.rpc("v2_pin_billing_provider", { p_restaurant: restaurant.id, p_provider: "lemon_squeezy", p_mode: LEMON_TEST_MODE ? "test" : "live", p_lease: lease.lease_token });
    if (pinned.error) throw pinned.error;
    const [members, current, pending] = await Promise.all([
      admin.from("v2_members").select("user_id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).in("status", ["activo", "invitado"]),
      admin.from("v2_restaurants").select("lemon_subscription_id,lemon_customer_id,subscription_status,stripe_subscription_id").eq("id", restaurant.id).single(),
      admin.from("v2_lemon_checkouts").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (members.error || current.error || pending.error) throw new Error("Billing state unavailable");
    if ((members.count ?? 0) > planFor(selected.plan).users) throw new BillingError("Este plan admite menos usuarios de los que tiene activos o invitados. Revise su equipo antes de continuar.");
    if (current.data.stripe_subscription_id) throw new BillingError("Contacte a soporte para revisar su suscripción anterior.");
    if (current.data.lemon_subscription_id) {
      const subscription = await lemonRequest(`/subscriptions/${current.data.lemon_subscription_id}`);
      const attr = requireTest(subscription.data, "subscriptions");
      if (String(attr.store_id) !== lemonStoreId() || String(attr.customer_id) !== current.data.lemon_customer_id) throw new Error("Subscription mismatch");
      if (attr.status !== "expired" || current.data.subscription_status !== "cancelled") throw new BillingError("Ya tiene una suscripción. Utilice Gestionar suscripción.");
    }
    let previous = pending.data;
    if (previous && new Date(previous.expires_at).getTime() > Date.now()) {
      if (previous.owner_id !== user.id) throw new BillingError("Contacte a soporte para revisar su cuenta.", 403);
      if (previous.subscription_id) throw new BillingError("Estamos verificando el pago anterior. Espere unos segundos.", 409);
      if (!previous.checkout_url) throw new BillingError("No pudimos confirmar la creación del enlace. Espere 15 minutos antes de reintentar.", 409);
      // A different selection may open immediately. Reuse its own existing
      // checkout when switching A -> B -> A, without rewriting any binding.
      if (previous.plan_code !== selected.plan || previous.billing_cycle !== selected.interval) {
        const matching = await admin.from("v2_lemon_checkouts").select("*")
          .eq("restaurant_id", restaurant.id).eq("owner_id", user.id)
          .eq("plan_code", selected.plan).eq("billing_cycle", selected.interval)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (matching.error) throw matching.error;
        previous = matching.data;
      }
      if (previous) {
        if (previous.subscription_id) throw new BillingError("Estamos verificando el pago anterior. Espere unos segundos.", 409);
        if (!previous.checkout_url) throw new BillingError("No pudimos confirmar la creación del enlace. Espere 15 minutos antes de reintentar.", 409);
        return NextResponse.json({ url: lemonURL(previous.checkout_url) }, { headers: { "Cache-Control": "no-store" } });
      }
    }
    const variant = await validateVariant(selected.plan, selected.interval);
    const id = randomUUID(), expires = new Date(Date.now() + CHECKOUT_MINUTES * 60000).toISOString();
    // Persist the binding before calling the provider: a lost HTTP response must
    // not silently create another checkout on the next click. No undocumented
    // provider idempotency header is assumed.
    const prepared = await admin.from("v2_lemon_checkouts").insert({ id, restaurant_id: restaurant.id, owner_id: user.id, owner_email: user.email!.toLowerCase(),
      store_id: lemonStoreId(), variant_id: variant, plan_code: selected.plan, billing_cycle: selected.interval, expires_at: expires });
    if (prepared.error) throw prepared.error;
    const origin = siteOrigin(new URL(req.url).origin);
    const response = await lemonRequest("/checkouts", { data: { type: "checkouts", attributes: {
      product_options: { enabled_variants: [Number(variant)], redirect_url: `${origin}/?billing=success`, receipt_link_url: `${origin}/?billing=return`, receipt_button_text: "MRMAA" },
      checkout_options: { embed: false, discount: false, skip_trial: true, subscription_preview: true, locale: body.language === "en" ? "en" : "es" },
      checkout_data: { email: user.email, name: restaurant.name, custom: { mrmaa_checkout: id, restaurant_id: restaurant.id }, variant_quantities: [{ variant_id: Number(variant), quantity: 1 }] },
      preview: true, test_mode: LEMON_TEST_MODE, expires_at: expires,
    }, relationships: { store: { data: { type: "stores", id: lemonStoreId() } }, variant: { data: { type: "variants", id: variant } } } } });
    const attr = requireTest(response.data, "checkouts");
    if (String(attr.store_id) !== lemonStoreId() || String(attr.variant_id) !== variant || attr.preview?.currency !== "USD"
      || attr.preview.subtotal !== planAmount(selected.plan, selected.interval) || attr.preview.discount_total !== 0) throw new Error("Checkout price mismatch");
    const url = lemonURL(attr.url);
    const saved = await admin.from("v2_lemon_checkouts").update({ checkout_id: response.data.id, checkout_url: url }).eq("id", id);
    if (saved.error) throw saved.error;
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof BillingError ? error.message : "No se pudo abrir el pago. Intente nuevamente." }, { status: error instanceof BillingError ? error.status : 503 });
  } finally { if (locked) await releaseBilling(locked.admin, locked.id, locked.token); }
}



// Writes are serialized by the existing restaurant billing lease. Pending intent
// survives timeouts/process death so a retry never repeats an uncertain charge.
async function changeState(admin: any, restaurantId: string) {
  const result = await admin.from("v2_billing_state").select("plan_change_next_at,pending_plan_change").eq("restaurant_id", restaurantId).single();
  if (result.error || !result.data) throw new BillingError("Falta actualizar la protección de cambios de plan. Aplique el SQL 32 antes de cambiar planes.", 503, "PLAN_CHANGE_SQL_REQUIRED");
  return result.data;
}
async function saveChangeState(locked: { admin: any; id: string; token: string }, values: any) {
  const result = await locked.admin.from("v2_billing_state").update(values).eq("restaurant_id", locked.id).eq("lease_token", locked.token).select("restaurant_id").single();
  if (result.error || !result.data) throw new BillingError("No se pudo guardar el estado del cambio. Contacte a soporte.", 503, "PLAN_CHANGE_STATE_FAILED");
}
async function acceptChange(locked: { admin: any; id: string; token: string }, intent: any) {
  const next = new Date(Date.now() + (intent.mode === "test" ? 60000 : 86400000)).toISOString();
  await saveChangeState(locked, { pending_plan_change: null, plan_change_next_at: next });
  return next;
}
async function bindChange(admin: any, id: string, offer: { variant_id: string; plan_code: string; billing_cycle: string }) {
  const result = await admin.from("v2_lemon_checkouts").update(offer).eq("id", id).select("id").single();
  if (result.error || !result.data) throw new BillingError("No se pudo guardar el estado del cambio. Contacte a soporte.", 503, "PLAN_CHANGE_STATE_FAILED");
}
const pendingMessage = "Hay un cambio pendiente de verificación. Actualice el estado; no repita el pago. Si persiste, contacte a soporte.";

export async function change(req: NextRequest, input: BillingInput) {
  let locked: { admin: any; id: string; token: string } | undefined;
  let binding: any, intent: any, targetVariant = "", submitted = false, providerChanged = false;
  let stage = "validation";
  const en = input.body.language === "en";
  try {
    const body = input.body, selected = checkoutSelection(body);
    const { admin, client } = input.context;
    if (body.confirmed !== true) throw new BillingError("No se recibió la confirmación. Recargue la página, vuelva a elegir el plan y pulse Confirmar cambio.", 400, "CONFIRMATION_REQUIRED");
    await strictRateLimit(req, "billing:change", 6);
    const exemption = await client.rpc("v2_billing_exempt", { p_restaurant: input.context.restaurant.id });
    if (exemption.error) throw exemption.error;
    if (exemption.data) throw new BillingError("Esta cuenta está exenta de pago.", 400, "BILLING_EXEMPT");
    const lease = await acquireBilling(admin, input.context.restaurant.id);
    locked = { admin, id: input.context.restaurant.id, token: lease.lease_token };
    // Reload AFTER acquiring the lease: a second request may have started before
    // the preceding request/webhook finished.
    stage = "state";
    const state = await changeState(admin, locked.id);
    if (state.pending_plan_change) throw new BillingError(pendingMessage, 409, "PLAN_CHANGE_PENDING");
    if (state.plan_change_next_at && Date.parse(state.plan_change_next_at) > Date.now()) {
      return NextResponse.json({ error: en ? "Wait until the displayed date before changing plans again." : "Espere hasta la fecha indicada antes de volver a cambiar de plan.", code: "PLAN_CHANGE_COOLDOWN", next_at: state.plan_change_next_at }, { status: 429 });
    }
    const fresh = await admin.from("v2_restaurants").select("*").eq("id", locked.id).single();
    if (fresh.error || !fresh.data) throw new BillingError("No se pudo cargar la suscripción. Intente nuevamente.", 503);
    const restaurant = fresh.data;
    if (restaurant.owner_id !== input.context.user.id) throw new BillingError("Solo el administrador principal puede gestionar la suscripción.", 403);
    if (restaurant.subscription_status !== "active" || !restaurant.lemon_subscription_id)
      throw new BillingError("Todavía no tiene una suscripción de pago.", 400, "NO_ACTIVE_SUBSCRIPTION");
    if (body.expected_plan !== restaurant.plan_code || body.expected_interval !== restaurant.billing_cycle)
      throw new BillingError("Su suscripción cambió desde que abrió la ventana. Actualice y confirme nuevamente.", 409, "PLAN_CHANGED");
    if (selected.plan === restaurant.plan_code && selected.interval === restaurant.billing_cycle)
      throw new BillingError("Este ya es su plan actual.", 400, "SAME_PLAN");
    const [members, found] = await Promise.all([
      admin.from("v2_members").select("user_id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).in("status", ["activo", "invitado"]),
      admin.from("v2_lemon_checkouts").select("*").eq("restaurant_id", restaurant.id).eq("subscription_id", restaurant.lemon_subscription_id).single(),
    ]);
    if (members.error || found.error || !found.data) throw new BillingError("No se pudo verificar el vínculo de la suscripción. Contacte a soporte.", 503, "SUBSCRIPTION_BINDING_MISSING");
    if ((members.count ?? 0) > planFor(selected.plan).users)
      throw new BillingError("Este plan admite menos usuarios de los que tiene activos o invitados. Revise su equipo antes de continuar.", 400, "PLAN_USER_LIMIT");
    binding = found.data;
    stage = "current_subscription";
    const current = requireTest((await lemonRequest(`/subscriptions/${restaurant.lemon_subscription_id}`)).data, "subscriptions");
    const currentOffer = planFromVariant(current.variant_id);
    if (String(current.store_id) !== lemonStoreId() || String(current.customer_id) !== restaurant.lemon_customer_id)
      throw new BillingError("La tienda o el cliente de pago no coincide. Contacte a soporte.", 503, "SUBSCRIPTION_BINDING_MISMATCH");
    if (String(current.variant_id) !== binding.variant_id || currentOffer.plan !== restaurant.plan_code || currentOffer.interval !== restaurant.billing_cycle)
      throw new BillingError("El proveedor y MRMAA todavía no muestran el mismo plan. Espere la sincronización y actualice; si persiste, contacte a soporte.", 409, "SUBSCRIPTION_NOT_SYNCED");
    stage = "target_configuration";
    targetVariant = await validateVariant(selected.plan, selected.interval);
    intent = { id: randomUUID(), mode: LEMON_TEST_MODE ? "test" : "live", binding_id: binding.id,
      subscription_id: binding.subscription_id, customer_id: restaurant.lemon_customer_id, store_id: lemonStoreId(),
      variant_id: targetVariant, plan_code: selected.plan, billing_cycle: selected.interval, created_at: new Date().toISOString() };
    stage = "prepare";
    await saveChangeState(locked, { pending_plan_change: intent });
    await bindChange(admin, binding.id, { variant_id: targetVariant, plan_code: selected.plan, billing_cycle: selected.interval });
    stage = "provider_update";
    submitted = true;
    const changed = requireTest((await lemonPatch(`/subscriptions/${restaurant.lemon_subscription_id}`, {
      data: { type: "subscriptions", id: String(restaurant.lemon_subscription_id), attributes: { variant_id: Number(targetVariant), invoice_immediately: true } },
    })).data, "subscriptions");
    if (String(changed.store_id) !== lemonStoreId() || String(changed.customer_id) !== restaurant.lemon_customer_id)
      throw new BillingError("La tienda o el cliente de pago no coincide. Contacte a soporte.", 503, "SUBSCRIPTION_BINDING_MISMATCH");
    providerChanged = String(changed.variant_id) === targetVariant;
    if (!providerChanged) {
      const portal = changed.urls?.customer_portal_update_subscription;
      if (!portal) throw new BillingError(pendingMessage, 409, "PLAN_CHANGE_PENDING");
      // PayPal needs customer approval. Keep the durable intent, but retain the
      // old binding until a signed webhook confirms the requested variant.
      await bindChange(admin, binding.id, { variant_id: binding.variant_id, plan_code: binding.plan_code, billing_cycle: binding.billing_cycle });
      return NextResponse.json({ url: lemonURL(portal), pending: true });
    }
    stage = "record_success";
    const next = await acceptChange(locked, intent);
    return NextResponse.json({ ok: true, next_at: next });
  } catch (error) {
    // Only a definite rejection restores the old binding. Unknown network/server
    // results stay pending and are completed by a verified signed webhook.
    if (locked && binding && intent) {
      try {
        if (!submitted || (error instanceof LemonAPIError && error.providerStatus >= 400 && error.providerStatus < 500 && error.providerStatus !== 408)) {
          await bindChange(locked.admin, binding.id, { variant_id: binding.variant_id, plan_code: binding.plan_code, billing_cycle: binding.billing_cycle });
          await saveChangeState(locked, { pending_plan_change: null });
        } else if (submitted && !providerChanged) {
          const latest = requireTest((await lemonRequest(`/subscriptions/${binding.subscription_id}`)).data, "subscriptions");
          if (String(latest.variant_id) === targetVariant && String(latest.customer_id) === intent.customer_id && String(latest.store_id) === intent.store_id) {
            const next = await acceptChange(locked, intent);
            return NextResponse.json({ ok: true, next_at: next });
          }
        }
      } catch { /* Preserve pending intent; never repeat an uncertain charge. */ }
    }
    const uncertain = submitted && !(error instanceof LemonAPIError && error.providerStatus >= 400 && error.providerStatus < 500 && error.providerStatus !== 408);
    const code = uncertain ? "PLAN_CHANGE_PENDING" : error instanceof BillingError ? error.code : "PLAN_CHANGE_FAILED";
    const reference = randomUUID().slice(0, 8);
    // No emails, tokens, signed URLs, provider bodies or credentials in logs.
    console.error("mrmaa.billing.change", { reference, code, stage, plan: ["basic", "intermediate", "advanced"].includes(input.body.plan) ? input.body.plan : "invalid", cycle: ["month", "year"].includes(input.body.interval) ? input.body.interval : "invalid", mode: LEMON_TEST_MODE ? "test" : "live", provider_status: error instanceof LemonAPIError ? error.providerStatus : undefined });
    const translations: Record<string, string> = {
      CONFIRMATION_REQUIRED: "Confirmation was not received. Reload the page, choose the plan again and select Confirm change.", PLAN_CHANGE_SQL_REQUIRED: "The plan-change protection needs an update. Apply SQL 32 before changing plans.",
      PLAN_CHANGE_STATE_FAILED: "The change status could not be saved. Contact support.", PLAN_CHANGE_PENDING: "A change is awaiting verification. Refresh the status; do not repeat the payment. Contact support if it persists.",
      PLAN_CHANGED: "Your subscription changed after opening this window. Refresh and confirm again.", SAME_PLAN: "This is already your current plan.",
      BILLING_EXEMPT: "This account is exempt from payment.", NO_ACTIVE_SUBSCRIPTION: "You do not have an active paid subscription yet.",
      PLAN_USER_LIMIT: "This plan allows fewer users than your active users and pending invitations. Review your team first.",
      SUBSCRIPTION_BINDING_MISSING: "The subscription link could not be verified. Contact support.", SUBSCRIPTION_BINDING_MISMATCH: "The payment store or customer does not match. Contact support.",
      SUBSCRIPTION_NOT_SYNCED: "The provider and MRMAA do not show the same plan yet. Wait for synchronization and refresh. Contact support if it persists.",
      PAYMENT_MODE_MISMATCH: "The payment environment does not match this subscription. Contact support.",
      VARIANT_NOT_CONFIGURED: `Check the ${input.body.interval === "year" ? "yearly" : "monthly"} variant ID for this plan in Vercel.`,
      VARIANT_MAPPING_INVALID: "The variant IDs do not identify a unique plan and billing cycle. Review the six plan variables in Vercel.",
      PRICE_CONFIG_INVALID: "The price configuration requires review. Contact support.", VARIANT_STORE_INVALID: "The variant must belong to the configured store and be available.",
      LEMON_REQUEST_FAILED: "Lemon Squeezy could not process the request. Contact support with the error reference.",
    };
    const message = en ? translations[code] || "The plan could not be changed. Refresh the status or contact support." : uncertain ? pendingMessage : error instanceof BillingError ? error.message : "No se pudo cambiar el plan. Actualice el estado o contacte a soporte.";
    return NextResponse.json({ error: message, code, reference }, { status: uncertain ? 409 : error instanceof BillingError ? error.status : 503 });
  } finally { if (locked) await releaseBilling(locked.admin, locked.id, locked.token); }
}

export async function resume(req: NextRequest, input: BillingInput) {
  let locked: { admin: any; id: string; token: string } | undefined;
  const en = input.body.language === "en";
  const fail = (es: string, english: string, status = 409) => new BillingError(en ? english : es, status);
  try {
    const { admin, client, restaurant, user } = input.context;
    if (input.body.confirmed !== true) throw fail("Confirme la reactivación de la renovación automática.", "Confirm automatic renewal reactivation.", 400);
    await strictRateLimit(req, "billing:resume", 6);
    const exemption = await client.rpc("v2_billing_exempt", { p_restaurant: restaurant.id });
    if (exemption.error) throw exemption.error;
    if (exemption.data || ["suspended", "deleted"].includes(restaurant.access_status)) throw fail("Esta cuenta no permite reactivar cobros.", "Billing cannot be resumed for this account.", 403);
    const lease = await acquireBilling(admin, restaurant.id);
    locked = { admin, id: restaurant.id, token: lease.lease_token };
    if (lease.pending_plan_change) throw fail("Hay un cambio de plan pendiente. Actualice el estado antes de reactivar.", "A plan change is pending. Refresh the status before resuming.");
    const bound = await admin.from("v2_payment_accounts").select("provider,mode,external_subscription_id,external_customer_id,owner_id").eq("restaurant_id", restaurant.id).single();
    const a = bound.data;
    if (bound.error || !a || a.provider !== "lemon_squeezy" || a.mode !== (LEMON_TEST_MODE ? "test" : "live") || a.owner_id !== user.id || !a.external_subscription_id || !a.external_customer_id)
      throw fail("No se pudo verificar la suscripción de esta cuenta.", "The subscription binding could not be verified.");
    const id = String(a.external_subscription_id);
    const response = await lemonRequest(`/subscriptions/${id}`);
    const check = (resource: any) => {
      const attr = requireTest(resource, "subscriptions");
      if (String(resource.id) !== id || String(attr.store_id) !== lemonStoreId() || String(attr.customer_id) !== String(a.external_customer_id) || String(attr.user_email).toLowerCase() !== user.email?.toLowerCase())
        throw fail("La suscripción no corresponde a esta cuenta.", "The subscription does not belong to this account.", 403);
      return attr;
    };
    const sub = check(response.data);
    if (sub.status === "active" && sub.cancelled === false) return NextResponse.json({ requested: true });
    if (sub.status !== "cancelled" || sub.cancelled !== true || !Number.isFinite(Date.parse(sub.ends_at)) || Date.parse(sub.ends_at) <= Date.now())
      throw fail("La suscripción ya no se puede reactivar. Actualice el estado y elija un plan para contratarlo nuevamente.", "This subscription can no longer be resumed. Refresh the status and select a plan to subscribe again.");
    // Only restore renewal. Never change the variant, price, quantity or billing date.
    const updated = await lemonPatch(`/subscriptions/${id}`, { data: { type: "subscriptions", id, attributes: { cancelled: false } } });
    const after = check(updated.data);
    if (after.cancelled !== false || after.status !== "active") throw fail("El proveedor no confirmó la reactivación. Revise Gestionar suscripción; algunos métodos de pago requieren gestionarla allí.", "The provider did not confirm reactivation. Check Manage subscription; some payment methods must be managed there.");
    // Signed webhooks remain the only path that updates paid access in MRMAA.
    return NextResponse.json({ requested: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof BillingError ? error.message : (en ? "Could not confirm reactivation. Refresh the status before retrying." : "No se pudo confirmar la reactivación. Actualice el estado antes de reintentar.") }, { status: error instanceof BillingError ? error.status : 503 });
  } finally { if (locked) await releaseBilling(locked.admin, locked.id, locked.token); }
}

export async function portal(req: NextRequest, input: BillingInput) {
  try {
    const body = input.body;
    const { restaurant, user } = input.context;
    await strictRateLimit(req, "billing:portal", 12);
    if (!restaurant.lemon_subscription_id) throw new BillingError("Todavía no tiene una suscripción de pago.");
    const response = await lemonRequest(`/subscriptions/${restaurant.lemon_subscription_id}`);
    const attr = requireTest(response.data, "subscriptions");
    if (String(attr.store_id) !== lemonStoreId() || String(attr.customer_id) !== restaurant.lemon_customer_id || String(attr.user_email).toLowerCase() !== user.email?.toLowerCase()) throw new Error("Subscription mismatch");
    // Do not store this short-lived, authenticated URL in the browser or logs.
    return NextResponse.json({ url: lemonURL(attr.urls?.customer_portal) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof BillingError ? error.message : "No se pudo abrir la suscripción. Intente nuevamente." }, { status: error instanceof BillingError ? error.status : 503 });
  }
}

const relevant = new Set(["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_resumed", "subscription_expired", "subscription_paused", "subscription_unpaused", "subscription_payment_success", "subscription_payment_failed", "subscription_payment_recovered", "subscription_payment_refunded", "order_refunded"]);
export async function webhook(req: NextRequest) {
  let locked: { admin: any; id: string; token: string } | undefined;
  let stage = "request";
  const reference = randomUUID().slice(0, 8);
  try {
    if (Number(req.headers.get("content-length") || 0) > 262144) return new NextResponse(null, { status: 413 });
    const raw = await readBoundedText(req, 262144);
    if (Buffer.byteLength(raw) > 262144) return new NextResponse(null, { status: 413 });
    stage = "signature";
    const event = verifyLemonEvent(raw, req.headers.get("x-signature"));
    if (!relevant.has(event.meta.event_name)) return NextResponse.json({ received: true });
    stage = "store";
    if (String(event.data.attributes.store_id) !== lemonStoreId()) throw new BillingError("Evento no permitido.", 400);
    stage = "database";
    const { admin } = serverClients();
    const already = await admin.from("v2_billing_events").select("event_id,restaurant_id").eq("event_id", event.receiptId).maybeSingle();
    if (already.error) throw already.error;
    if (already.data) {
      const state = await admin.from("v2_billing_state").select("pending_plan_change").eq("restaurant_id", already.data.restaurant_id || event.meta.custom_data?.restaurant_id).maybeSingle();
      if (state.error) throw state.error;
      if (!state.data?.pending_plan_change) return NextResponse.json({ received: true });
    }
    stage = "checkout_binding";
    let subscriptionId = event.data.type === "subscriptions" ? String(event.data.id)
      : event.data.type === "subscription-invoices" ? String(event.data.attributes.subscription_id) : null;
    const bySubscription = subscriptionId
      ? await admin.from("v2_lemon_checkouts").select("*").eq("subscription_id", subscriptionId).maybeSingle()
      : await admin.from("v2_lemon_checkouts").select("*").eq("order_id", String(event.data.id)).maybeSingle();
    if (bySubscription.error) throw bySubscription.error;
    let attempt = bySubscription.data;
    const proof = event.meta.custom_data?.mrmaa_checkout;
    if (!attempt && proof) {
      if (typeof proof !== "string" || !/^[0-9a-f-]{36}$/i.test(proof)) throw new BillingError("Evento no permitido.", 400);
      const lookup = await admin.from("v2_lemon_checkouts").select("*").eq("id", proof).maybeSingle();
      if (lookup.error) throw lookup.error;
      attempt = lookup.data;
    }
    // Ignore unrelated store orders; initial MRMAA subscription events must have
    // the checkout proof. Retry missing bindings on invoices that arrived first.
    if (!attempt) {
      if (subscriptionId && event.data.type === "subscription-invoices") throw new Error("Awaiting subscription binding");
      if (proof) throw new Error("Unknown checkout binding");
      console.warn("mrmaa.billing.webhook", { reference, code: "UNBOUND_EVENT", stage, mode: LEMON_TEST_MODE ? "test" : "live" });
      return NextResponse.json({ received: true, ignored: true, code: "UNBOUND_EVENT", reference });
    }
    subscriptionId ||= attempt.subscription_id;
    if (!subscriptionId || !/^\d+$/.test(subscriptionId)) throw new Error("Missing subscription ID");
    if (proof && proof !== attempt.id) throw new Error("Checkout mismatch");
    if (event.meta.custom_data?.restaurant_id && event.meta.custom_data.restaurant_id !== attempt.restaurant_id) throw new Error("Tenant mismatch");
    stage = "billing_lock";
    const lease = await acquireBilling(admin, attempt.restaurant_id);
    locked = { admin, id: attempt.restaurant_id, token: lease.lease_token };
    const freshAttempt = await admin.from("v2_lemon_checkouts").select("*").eq("id", attempt.id).single();
    if (freshAttempt.error || !freshAttempt.data) throw new Error("Missing checkout binding");
    attempt = freshAttempt.data;
    stage = "subscription";
    const response = await lemonRequest(`/subscriptions/${subscriptionId}`);
    const sub = requireTest(response.data, "subscriptions");
    const intent = lease.pending_plan_change;
    const confirmsChange = intent && intent.mode === (LEMON_TEST_MODE ? "test" : "live")
      && intent.binding_id === attempt.id && intent.subscription_id === subscriptionId
      && intent.store_id === String(sub.store_id) && intent.customer_id === String(sub.customer_id)
      && intent.variant_id === String(sub.variant_id);
    if (confirmsChange && String(sub.variant_id) !== attempt.variant_id) {
      // A requested PayPal change becomes effective only after customer approval.
      // All normal customer, email, price and invoice checks still follow.
      if (String(sub.store_id) !== attempt.store_id || String(sub.customer_id) !== attempt.customer_id
        || String(sub.user_email).toLowerCase() !== attempt.owner_email.toLowerCase()
        || String(event.data.attributes.customer_id) !== String(sub.customer_id)) throw new Error("Subscription binding mismatch");
      const requested = planFromVariant(sub.variant_id);
      if (requested.plan !== intent.plan_code || requested.interval !== intent.billing_cycle) throw new Error("Plan mismatch");
      await bindChange(admin, attempt.id, { variant_id: intent.variant_id, plan_code: intent.plan_code, billing_cycle: intent.billing_cycle });
      attempt = { ...attempt, variant_id: intent.variant_id, plan_code: intent.plan_code, billing_cycle: intent.billing_cycle };
    }
    stage = "subscription_binding";
    if (String(sub.store_id) !== attempt.store_id || attempt.store_id !== lemonStoreId() || String(sub.variant_id) !== attempt.variant_id
      || (attempt.customer_id && String(sub.customer_id) !== attempt.customer_id)
      || (attempt.subscription_id && attempt.subscription_id !== subscriptionId)
      || String(sub.user_email).toLowerCase() !== attempt.owner_email.toLowerCase()
      || String(event.data.attributes.customer_id) !== String(sub.customer_id)) throw new Error("Subscription binding mismatch");
    if (!attempt.subscription_id && (new Date(sub.created_at).getTime() < new Date(attempt.created_at).getTime() - 5000
      || new Date(sub.created_at).getTime() > new Date(attempt.expires_at).getTime() + 300000)) throw new Error("Expired checkout binding");
    const choice = planFromVariant(sub.variant_id);
    if (choice.plan !== attempt.plan_code || choice.interval !== attempt.billing_cycle) throw new Error("Plan mismatch");
    if (!sub.first_subscription_item || sub.first_subscription_item.quantity !== 1) throw new Error("Unexpected subscription items");
    stage = "payment_resources";
    const [price, invoices, current] = await Promise.all([
      lemonRequest(`/prices/${sub.first_subscription_item.price_id}`),
      lemonRequest("/subscription-invoices", undefined, { "filter[subscription_id]": subscriptionId, "filter[store_id]": lemonStoreId(), "page[size]": "1" }),
      admin.from("v2_restaurants").select("billing_current_period_end").eq("id", attempt.restaurant_id).single(),
    ]);
    // Keep existing paid subscriptions syncing after a catalog price increase.
    // Unbound checkouts and pending plan changes still require the current price.
    stage = "price";
    validatePrice(price.data, choice.plan, choice.interval, attempt.subscription_id === subscriptionId && !intent);
    if (current.error) throw current.error;
    stage = "invoice";
    const invoice = invoices.data[0];
    if (!invoice) throw new Error("Awaiting invoice");
    const bill = requireTest(invoice, "subscription-invoices");
    if (String(bill.subscription_id) !== subscriptionId || String(bill.customer_id) !== String(sub.customer_id)
      || String(bill.store_id) !== lemonStoreId() || bill.currency !== "USD") throw new Error("Invoice mismatch");
    let paid = ["paid", "partial_refund"].includes(bill.status) && bill.refunded !== true;
    let fullyRefunded = bill.status === "refunded" || bill.refunded === true;
    if (bill.billing_reason === "initial") {
      stage = "order";
      const order = await lemonRequest(`/orders/${sub.order_id}`);
      const orderAttr = requireTest(order.data, "orders");
      if (String(orderAttr.store_id) !== lemonStoreId() || String(orderAttr.customer_id) !== String(sub.customer_id)) throw new Error("Order mismatch");
      fullyRefunded ||= orderAttr.status === "refunded";
      paid &&= ["paid", "partial_refund"].includes(orderAttr.status);
    }
    stage = "payment_status";
    const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
    let until: string | null = null;
    if (paid && ["active", "cancelled"].includes(sub.status)) until = iso(sub.cancelled || sub.status === "cancelled" ? sub.ends_at : sub.renews_at);
    // A collection pause or retry date is not a newly paid billing period.
    if (sub.status === "paused" && !fullyRefunded) until = iso(current.data.billing_current_period_end);
    const status = !fullyRefunded && until && Date.parse(until) > Date.now() ? "active"
      : fullyRefunded || ["expired", "paused"].includes(sub.status) || (sub.status === "cancelled" && !!sub.ends_at && Date.parse(sub.ends_at) <= Date.now()) ? "cancelled" : "past_due";
    const updated = new Date(Math.max(Date.parse(sub.updated_at), Date.parse(bill.updated_at))).toISOString();
    stage = "apply_subscription";
    const applied = await admin.rpc("v2_lemon_apply", {
      p_event: event.receiptId, p_updated: updated, p_attempt: attempt.id, p_lease: lease.lease_token,
      p_store: String(sub.store_id), p_variant: String(sub.variant_id), p_customer: String(sub.customer_id), p_subscription: subscriptionId, p_order: String(sub.order_id),
      p_status: status, p_paid_until: status === "active" ? until : null,
      p_cancel_at_end: Boolean(sub.cancelled), p_ended_at: fullyRefunded ? iso(bill.refunded_at) || new Date().toISOString() : iso(sub.ends_at),
    });
    if (applied.error) throw applied.error;
    stage = "complete_plan_change";
    if (confirmsChange) await acceptChange(locked, intent);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Lemon retries non-2xx responses. Never expose provider payloads/secrets.
    const code = error instanceof BillingError ? error.code : "WEBHOOK_PROCESSING_FAILED";
    const dbCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    console.error("mrmaa.billing.webhook", { reference, code, stage, mode: LEMON_TEST_MODE ? "test" : "live",
      provider_status: error instanceof LemonAPIError ? error.providerStatus : undefined,
      database_code: /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(dbCode) ? dbCode : undefined });
    return NextResponse.json({ error: "No se pudo procesar el evento.", code, reference }, { status: error instanceof RequestSafetyError ? error.status : error instanceof BillingError && error.status === 400 ? 400 : 503 });
  } finally { if (locked) await releaseBilling(locked.admin, locked.id, locked.token); }
}
/** Retention fails closed: unknown states, missing IDs or provider errors keep data. */
export async function canDelete(account: { external_subscription_id: string | null; external_customer_id: string | null; mode: string }) {
  if (account.mode !== (LEMON_TEST_MODE ? "test" : "live")) return false;
  if (!account.external_subscription_id) return false;
  const sub = requireTest((await lemonRequest(`/subscriptions/${account.external_subscription_id}`)).data, "subscriptions");
  if (String(sub.store_id) !== lemonStoreId() || String(sub.customer_id) !== account.external_customer_id) throw new Error("Subscription mismatch");
  if (sub.status === "expired") return true;
  return sub.status === "cancelled" && typeof sub.ends_at === "string" && Number.isFinite(Date.parse(sub.ends_at)) && Date.parse(sub.ends_at) <= Date.now();
}
