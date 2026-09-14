import { NextRequest, NextResponse } from "next/server";
import { BillingError, acquireBilling, billingContext, releaseBilling, requestBody, strictRateLimit } from "@/lib/billing-server";
import { checkoutSelection, lemonPatch, lemonRequest, lemonStoreId, lemonURL, planFromVariant, requireTest, validateVariant } from "@/lib/lemon-squeezy";
import { planFor } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let locked: { admin: any; id: string; token: string } | undefined;
  let binding: any;
  let targetVariant = "";
  let providerChanged = false;
  try {
    const body = await requestBody(req), selected = checkoutSelection(body);
    const { admin, client, restaurant } = await billingContext(req, body.restaurant_id);
    await strictRateLimit(req, "billing:change", 6);
    const exemption = await client.rpc("v2_billing_exempt", { p_restaurant: restaurant.id });
    if (exemption.error) throw exemption.error;
    if (exemption.data) throw new BillingError("Esta cuenta está exenta de pago.");
    if (restaurant.subscription_status !== "active" || !restaurant.lemon_subscription_id)
      throw new BillingError("Todavía no tiene una suscripción de pago.");
    if (selected.plan === restaurant.plan_code && selected.interval === restaurant.billing_cycle)
      throw new BillingError("Este ya es su plan actual.");

    const lease = await acquireBilling(admin, restaurant.id);
    locked = { admin, id: restaurant.id, token: lease.lease_token };
    const [members, found] = await Promise.all([
      admin.from("v2_members").select("user_id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).in("status", ["activo", "invitado"]),
      admin.from("v2_lemon_checkouts").select("*").eq("restaurant_id", restaurant.id).eq("subscription_id", restaurant.lemon_subscription_id).single(),
    ]);
    if (members.error || found.error || !found.data) throw new Error("Billing state unavailable");
    if ((members.count ?? 0) > planFor(selected.plan).users)
      throw new BillingError("Este plan admite menos usuarios de los que tiene activos o invitados. Revise su equipo antes de continuar.");
    binding = found.data;
    const currentResponse = await lemonRequest(`/subscriptions/${restaurant.lemon_subscription_id}`);
    const current = requireTest(currentResponse.data, "subscriptions");
    const currentOffer = planFromVariant(current.variant_id);
    if (String(current.store_id) !== lemonStoreId() || String(current.customer_id) !== restaurant.lemon_customer_id
      || String(current.variant_id) !== binding.variant_id || currentOffer.plan !== restaurant.plan_code
      || currentOffer.interval !== restaurant.billing_cycle)
      throw new Error("Subscription mismatch");

    targetVariant = await validateVariant(selected.plan, selected.interval);
    const prepared = await admin.from("v2_lemon_checkouts").update({
      variant_id: targetVariant, plan_code: selected.plan, billing_cycle: selected.interval,
    }).eq("id", binding.id).eq("variant_id", binding.variant_id);
    if (prepared.error) throw prepared.error;

    const response = await lemonPatch(`/subscriptions/${restaurant.lemon_subscription_id}`, {
      data: { type: "subscriptions", id: String(restaurant.lemon_subscription_id), attributes: {
        variant_id: Number(targetVariant), invoice_immediately: true,
      } },
    });
    const changed = requireTest(response.data, "subscriptions");
    if (String(changed.store_id) !== lemonStoreId() || String(changed.customer_id) !== restaurant.lemon_customer_id)
      throw new Error("Subscription mismatch");
    providerChanged = String(changed.variant_id) === targetVariant;
    if (!providerChanged) {
      const portal = changed.urls?.customer_portal_update_subscription;
      if (!portal) throw new Error("Plan change not confirmed");
      await admin.from("v2_lemon_checkouts").update({ variant_id: binding.variant_id, plan_code: binding.plan_code, billing_cycle: binding.billing_cycle }).eq("id", binding.id).eq("variant_id", targetVariant);
      return NextResponse.json({ url: lemonURL(portal) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // If Lemon rejected the change, restore the verified binding. When the
    // provider accepted it but the response was interrupted, keep the target
    // so the signed webhook can finish synchronizing the account.
    if (locked && binding && targetVariant && !providerChanged) {
      try {
        const latest = await lemonRequest(`/subscriptions/${binding.subscription_id}`);
        providerChanged = String(requireTest(latest.data, "subscriptions").variant_id) === targetVariant;
      } catch {}
      if (!providerChanged) await locked.admin.from("v2_lemon_checkouts").update({
        variant_id: binding.variant_id, plan_code: binding.plan_code, billing_cycle: binding.billing_cycle,
      }).eq("id", binding.id).eq("variant_id", targetVariant);
    }
    return NextResponse.json({ error: error instanceof BillingError ? error.message : "No se pudo cambiar el plan. Intente nuevamente." }, { status: error instanceof BillingError ? error.status : 503 });
  } finally { if (locked) await releaseBilling(locked.admin, locked.id, locked.token); }
}
