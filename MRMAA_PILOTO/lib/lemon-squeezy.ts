import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { BillingError } from "./billing-server";
import { PLANS, isBillingInterval, isPlan, planAmount, type PlanCode, type BillingInterval } from "./plans";

// This build is for the isolated test project. No browser-supplied mode/price.
export const LEMON_TEST_MODE = true;
export const CHECKOUT_MINUTES = 15;
export function lemonStoreId() {
  const id = process.env.LEMON_SQUEEZY_STORE_ID || "";
  if (!/^[1-9]\d*$/.test(id)) throw new BillingError("Los pagos de prueba todavía no están configurados.", 503);
  return id;
}
export function lemonURL(value: unknown) {
  const url = new URL(String(value));
  if (url.protocol !== "https:" || url.username || url.password || url.port
    || !/^(?:[a-z0-9-]+\.)?lemonsqueezy\.com$/.test(url.hostname)) throw new Error("Invalid payment URL");
  return url.href;
}
export async function lemonRequest(path: string, data?: any, query?: Record<string, string>): Promise<any> {
  const key = process.env.LEMON_SQUEEZY_API_KEY || "";
  if (!key) throw new BillingError("Los pagos de prueba todavía no están configurados.", 503);
  if (!/^\/[a-z-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) throw new Error("Invalid Lemon resource");
  const response = await fetch(`https://api.lemonsqueezy.com/v1${path}${query ? `?${new URLSearchParams(query)}` : ""}`, {
    method: data ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data) throw new BillingError("No se pudo completar la operación de pago. Intente nuevamente.", 503);
  return result;
}
export async function lemonPatch(path: string, data: any): Promise<any> {
  const key = process.env.LEMON_SQUEEZY_API_KEY || "";
  if (!key) throw new BillingError("Los pagos de prueba todavía no están configurados.", 503);
  if (!/^\/[a-z-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) throw new Error("Invalid Lemon resource");
  const response = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method: "PATCH", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data) throw new BillingError("No se pudo cambiar el plan. Intente nuevamente.", 503);
  return result;
}
export function requireTest(resource: any, type: string) {
  if (resource?.type !== type || resource.attributes?.test_mode !== LEMON_TEST_MODE) throw new Error("Unexpected payment environment");
  return resource.attributes;
}
export function variantId(plan: PlanCode, interval: BillingInterval) {
  const id = process.env[`LEMON_SQUEEZY_VARIANT_${plan.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}`] || "";
  if (!/^[1-9]\d*$/.test(id)) throw new BillingError("Este plan todavía no tiene los pagos configurados.", 503);
  return id;
}
export function planFromVariant(id: unknown): { plan: PlanCode; interval: BillingInterval } {
  const matches = PLANS.flatMap(plan => (["month", "year"] as const).flatMap(interval => {
    const configured = process.env[`LEMON_SQUEEZY_VARIANT_${plan.code.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}`];
    return configured && configured === String(id) ? [{ plan: plan.code, interval }] : [];
  }));
  if (matches.length !== 1) throw new Error("Unknown or ambiguous subscription variant");
  return matches[0];
}
export function validatePrice(resource: any, plan: PlanCode, interval: BillingInterval) {
  const price = resource?.attributes;
  if (resource?.type !== "prices" || String(price?.variant_id) !== variantId(plan, interval)
    || price.category !== "subscription" || price.scheme !== "standard" || price.unit_price !== planAmount(plan, interval)
    || price.renewal_interval_unit !== interval || price.renewal_interval_quantity !== 1 || price.setup_fee_enabled
    || price.usage_aggregation || (price.package_size != null && price.package_size !== 1))
    throw new BillingError("La configuración del precio requiere revisión. Contacte a soporte.", 503);
}
export async function validateVariant(plan: PlanCode, interval: BillingInterval) {
  const id = variantId(plan, interval);
  planFromVariant(id); // Reject accidentally reusing the same ID for two offers.
  const [variant, prices] = await Promise.all([
    lemonRequest(`/variants/${id}`), lemonRequest("/prices", undefined, { "filter[variant_id]": id, "page[size]": "1" }),
  ]);
  const attr = requireTest(variant.data, "variants");
  const product = await lemonRequest(`/products/${attr.product_id}`);
  const productAttr = requireTest(product.data, "products");
  if (String(productAttr.store_id) !== lemonStoreId() || !["published", "pending"].includes(attr.status)) throw new Error("Unexpected variant/store");
  validatePrice(prices.data[0], plan, interval);
  return id;
}
export function verifyLemonEvent(raw: string, signature: string | null, secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "") {
  if (!secret || !signature || !/^[0-9a-f]{64}$/i.test(signature)) throw new BillingError("Firma inválida.", 400);
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new BillingError("Firma inválida.", 400);
  let event: any;
  try { event = JSON.parse(raw); } catch { throw new BillingError("Evento no permitido.", 400); }
  if (!event?.meta?.event_name || event.data?.attributes?.test_mode !== LEMON_TEST_MODE) throw new BillingError("Evento no permitido.", 400);
  return { ...event, receiptId: `lemon_test_${createHash("sha256").update(raw).digest("hex")}` };
}
export function checkoutSelection(body: any) {
  if (!isPlan(body.plan) || !isBillingInterval(body.interval)) throw new BillingError("Seleccione un plan y una periodicidad válidos.");
  return { plan: body.plan, interval: body.interval };
}
