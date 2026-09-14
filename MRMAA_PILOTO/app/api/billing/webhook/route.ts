import { NextRequest, NextResponse } from "next/server";
import { BillingError, acquireBilling, releaseBilling, serverClients } from "@/lib/billing-server";
import { lemonRequest, lemonStoreId, planFromVariant, requireTest, validatePrice, verifyLemonEvent } from "@/lib/lemon-squeezy";
export const runtime = "nodejs";
const relevant = new Set(["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_resumed", "subscription_expired", "subscription_paused", "subscription_unpaused", "subscription_payment_success", "subscription_payment_failed", "subscription_payment_recovered", "subscription_payment_refunded", "order_refunded"]);
export async function POST(req: NextRequest) {
  let locked: { admin: any; id: string; token: string } | undefined;
  try {
    if (Number(req.headers.get("content-length") || 0) > 262144) return new NextResponse(null, { status: 413 });
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 262144) return new NextResponse(null, { status: 413 });
    const event = verifyLemonEvent(raw, req.headers.get("x-signature"));
    if (!relevant.has(event.meta.event_name)) return NextResponse.json({ received: true });
    if (String(event.data.attributes.store_id) !== lemonStoreId()) throw new BillingError("Evento no permitido.", 400);
    const { admin } = serverClients();
    const already = await admin.from("v2_billing_events").select("event_id").eq("event_id", event.receiptId).maybeSingle();
    if (already.error) throw already.error;
    if (already.data) return NextResponse.json({ received: true });
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
      return NextResponse.json({ received: true });
    }
    subscriptionId ||= attempt.subscription_id;
    if (!subscriptionId || !/^\d+$/.test(subscriptionId)) throw new Error("Missing subscription ID");
    if (proof && proof !== attempt.id) throw new Error("Checkout mismatch");
    if (event.meta.custom_data?.restaurant_id && event.meta.custom_data.restaurant_id !== attempt.restaurant_id) throw new Error("Tenant mismatch");
    const lease = await acquireBilling(admin, attempt.restaurant_id);
    locked = { admin, id: attempt.restaurant_id, token: lease.lease_token };
    const response = await lemonRequest(`/subscriptions/${subscriptionId}`);
    const sub = requireTest(response.data, "subscriptions");
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
    const [price, invoices, current] = await Promise.all([
      lemonRequest(`/prices/${sub.first_subscription_item.price_id}`),
      lemonRequest("/subscription-invoices", undefined, { "filter[subscription_id]": subscriptionId, "filter[store_id]": lemonStoreId(), "page[size]": "1" }),
      admin.from("v2_restaurants").select("billing_current_period_end").eq("id", attempt.restaurant_id).single(),
    ]);
    validatePrice(price.data, choice.plan, choice.interval);
    if (current.error) throw current.error;
    const invoice = invoices.data[0];
    if (!invoice) throw new Error("Awaiting invoice");
    const bill = requireTest(invoice, "subscription-invoices");
    if (String(bill.subscription_id) !== subscriptionId || String(bill.customer_id) !== String(sub.customer_id)
      || String(bill.store_id) !== lemonStoreId() || bill.currency !== "USD") throw new Error("Invoice mismatch");
    let paid = ["paid", "partial_refund"].includes(bill.status) && bill.refunded !== true;
    let fullyRefunded = bill.status === "refunded" || bill.refunded === true;
    if (bill.billing_reason === "initial") {
      const order = await lemonRequest(`/orders/${sub.order_id}`);
      const orderAttr = requireTest(order.data, "orders");
      if (String(orderAttr.store_id) !== lemonStoreId() || String(orderAttr.customer_id) !== String(sub.customer_id)) throw new Error("Order mismatch");
      fullyRefunded ||= orderAttr.status === "refunded";
      paid &&= ["paid", "partial_refund"].includes(orderAttr.status);
    }
    const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
    let until: string | null = null;
    if (paid && ["active", "cancelled"].includes(sub.status)) until = iso(sub.cancelled || sub.status === "cancelled" ? sub.ends_at : sub.renews_at);
    // A collection pause or retry date is not a newly paid billing period.
    if (sub.status === "paused" && !fullyRefunded) until = iso(current.data.billing_current_period_end);
    const status = !fullyRefunded && until && Date.parse(until) > Date.now() ? "active"
      : fullyRefunded || ["expired", "paused"].includes(sub.status) || (sub.status === "cancelled" && !!sub.ends_at && Date.parse(sub.ends_at) <= Date.now()) ? "cancelled" : "past_due";
    const updated = new Date(Math.max(Date.parse(sub.updated_at), Date.parse(bill.updated_at))).toISOString();
    const applied = await admin.rpc("v2_lemon_apply", {
      p_event: event.receiptId, p_updated: updated, p_attempt: attempt.id, p_lease: lease.lease_token,
      p_store: String(sub.store_id), p_variant: String(sub.variant_id), p_customer: String(sub.customer_id), p_subscription: subscriptionId, p_order: String(sub.order_id),
      p_status: status, p_paid_until: status === "active" ? until : null,
      p_cancel_at_end: Boolean(sub.cancelled), p_ended_at: fullyRefunded ? iso(bill.refunded_at) || new Date().toISOString() : iso(sub.ends_at),
    });
    if (applied.error) throw applied.error;
    return NextResponse.json({ received: true });
  } catch (error) {
    // Lemon retries non-2xx responses. Never expose provider payloads/secrets.
    return NextResponse.json({ error: "No se pudo procesar el evento." }, { status: error instanceof BillingError && error.status === 400 ? 400 : 503 });
  } finally { if (locked) await releaseBilling(locked.admin, locked.id, locked.token); }
}
