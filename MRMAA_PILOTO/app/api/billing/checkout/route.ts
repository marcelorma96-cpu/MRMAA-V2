import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { BillingError, acquireBilling, billingContext, releaseBilling, requestBody, strictRateLimit } from "@/lib/billing-server";
import { CHECKOUT_MINUTES, checkoutSelection, lemonRequest, lemonStoreId, lemonURL, requireTest, validateVariant } from "@/lib/lemon-squeezy";
import { siteOrigin } from "@/lib/site-origin";
import { planAmount, planFor } from "@/lib/plans";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let locked: { admin: any; id: string; token: string } | undefined;
  try {
    const body = await requestBody(req), selected = checkoutSelection(body);
    const { admin, client, user, restaurant } = await billingContext(req, body.restaurant_id);
    await strictRateLimit(req, "billing:checkout", 8);
    const exemption = await client.rpc("v2_billing_exempt", { p_restaurant: restaurant.id });
    if (exemption.error) throw exemption.error;
    if (exemption.data) throw new BillingError("Esta cuenta está exenta de pago.");
    if (["suspended", "deleted"].includes(restaurant.access_status)) throw new BillingError("Contacte a soporte para revisar su cuenta.", 403);
    const lease = await acquireBilling(admin, restaurant.id);
    locked = { admin, id: restaurant.id, token: lease.lease_token };
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
      preview: true, test_mode: true, expires_at: expires,
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
