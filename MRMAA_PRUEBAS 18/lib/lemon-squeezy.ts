import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { BillingError } from "./billing-server";
import { PLANS, isBillingInterval, isPlan, planAmount, type PlanCode, type BillingInterval } from "./plans";

// Safe by default: real charges are enabled only by an explicit server setting.
// The browser never supplies the environment or the price.
export const LEMON_TEST_MODE = process.env.LEMON_SQUEEZY_MODE !== "live";
export const CHECKOUT_MINUTES = 15;
export class LemonAPIError extends BillingError {
  constructor(public providerStatus: number) {
    super("Lemon Squeezy no pudo procesar la solicitud. Contacte a soporte con la referencia del error.", 503, "LEMON_REQUEST_FAILED");
  }
}
export function lemonStoreId() {
  const id = process.env.LEMON_SQUEEZY_STORE_ID || "";
  if (!/^[1-9]\d*$/.test(id)) throw new BillingError("Los pagos todavía no están configurados.", 503);
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
  if (!key) throw new BillingError("Los pagos todavía no están configurados.", 503);
  if (!/^\/[a-z-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) throw new Error("Invalid Lemon resource");
  const response = await fetch(`https://api.lemonsqueezy.com/v1${path}${query ? `?${new URLSearchParams(query)}` : ""}`, {
    method: data ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data) throw new LemonAPIError(response.status);
  return result;
}
export async function lemonPatch(path: string, data: any): Promise<any> {
  const key = process.env.LEMON_SQUEEZY_API_KEY || "";
  if (!key) throw new BillingError("Los pagos todavía no están configurados.", 503);
  if (!/^\/[a-z-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) throw new Error("Invalid Lemon resource");
  const response = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method: "PATCH", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data) throw new LemonAPIError(response.status);
  return result;
}
export function requireTest(resource: any, type: string) {
  if (resource?.type !== type || resource.attributes?.test_mode !== LEMON_TEST_MODE) throw new BillingError("El modo de pagos no coincide con la suscripción. Contacte a soporte.", 503, "PAYMENT_MODE_MISMATCH");
  return resource.attributes;
}
export function variantId(plan: PlanCode, interval: BillingInterval) {
  const key = `LEMON_SQUEEZY_VARIANT_${plan.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}`;
  const id = (process.env[key] || "").trim();
  if (!/^[1-9]\d*$/.test(id)) throw new BillingError(`Revise ${key} en Vercel: falta un ID de variante válido.`, 503, "VARIANT_NOT_CONFIGURED");
  return id;
}
export function planFromVariant(id: unknown): { plan: PlanCode; interval: BillingInterval } {
  const matches = PLANS.flatMap(plan => (["month", "year"] as const).flatMap(interval => {
    const configured = process.env[`LEMON_SQUEEZY_VARIANT_${plan.code.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}`];
    return configured && configured.trim() === String(id) ? [{ plan: plan.code, interval }] : [];
  }));
  if (matches.length !== 1) throw new BillingError("Los IDs de variantes no identifican un único plan y período. Revise las seis variables de planes en Vercel.", 503, "VARIANT_MAPPING_INVALID");
  return matches[0];
}
// Previous catalog amounts are valid only for an already bound subscription's
// server-fetched price. New checkouts and target variants always use today's catalog.
const PREVIOUS_AMOUNTS = { basic: { month: 2000, year: 20000 }, intermediate: { month: 4000, year: 40000 }, advanced: { month: 5000, year: 50000 } } as const;
export function validatePrice(resource: any, plan: PlanCode, interval: BillingInterval, allowPreviousPrice = false) {
  const price = resource?.attributes;
  const amountMatches = price?.unit_price === planAmount(plan, interval)
    || (allowPreviousPrice && price?.unit_price === PREVIOUS_AMOUNTS[plan][interval]);
  if (resource?.type !== "prices" || String(price?.variant_id) !== variantId(plan, interval)
    || price.category !== "subscription" || price.scheme !== "standard" || !amountMatches
    || price.renewal_interval_unit !== interval || price.renewal_interval_quantity !== 1 || price.setup_fee_enabled
    || price.usage_aggregation || (price.package_size != null && price.package_size !== 1))
    throw new BillingError("La configuración del precio requiere revisión. Contacte a soporte.", 503, "PRICE_CONFIG_INVALID");
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
  if (String(productAttr.store_id) !== lemonStoreId() || !["published", "pending"].includes(attr.status)) throw new BillingError("La variante debe pertenecer a la tienda configurada y estar disponible.", 503, "VARIANT_STORE_INVALID");
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
  return { ...event, receiptId: `lemon_${LEMON_TEST_MODE ? "test" : "live"}_${createHash("sha256").update(raw).digest("hex")}` };
}
export function checkoutSelection(body: any) {
  if (!isPlan(body.plan) || !isBillingInterval(body.interval)) throw new BillingError("Seleccione un plan y una periodicidad válidos.");
  return { plan: body.plan, interval: body.interval };
}
