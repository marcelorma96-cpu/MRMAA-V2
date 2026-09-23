// Server-only boundary. Each adapter verifies provider signatures, prices, owner
// bindings, environment and paid invoices before updating entitlements in Supabase.
import { NextRequest, NextResponse } from "next/server";
import { BillingError, billingContext, requestBody, serverClients } from "./billing-server";
import * as lemon from "./billing-lemon-provider";
import { lemonURL } from "./lemon-squeezy";

export type BillingInput = { body: Record<string, any>; context: Awaited<ReturnType<typeof billingContext>> };
type Action = "checkout" | "change" | "portal";
type PaymentAccount = { provider: string; mode: string; external_subscription_id: string | null; external_customer_id: string | null };
export type BillingProvider = {
  checkout: (req: NextRequest, input: BillingInput) => Promise<NextResponse>;
  change: (req: NextRequest, input: BillingInput) => Promise<NextResponse>;
  portal: (req: NextRequest, input: BillingInput) => Promise<NextResponse>;
  webhook: (req: NextRequest) => Promise<NextResponse>;
  validateRedirect: (value: unknown) => string;
  canDelete: (account: PaymentAccount) => Promise<boolean>;
};
const providers: Readonly<Record<string, BillingProvider>> = {
  lemon_squeezy: { ...lemon, validateRedirect: lemonURL },
};
export function paymentProvider(name: string): BillingProvider {
  if (!Object.hasOwn(providers,name)) throw new BillingError("Este proveedor de pago todavía no está disponible. Contacte a soporte.",503);
  return providers[name];
}
export function selectBillingProvider(bound: string | null | undefined, fallback = process.env.BILLING_PROVIDER || "lemon_squeezy") {
  const name = bound || fallback;
  paymentProvider(name); // Never silently reroute an existing account or an unknown configuration.
  return name;
}
async function paymentAccount(admin: ReturnType<typeof serverClients>["admin"], restaurantId: string) {
  const result = await admin.from("v2_payment_accounts").select("provider,mode,external_subscription_id,external_customer_id").eq("restaurant_id",restaurantId).maybeSingle();
  if (result.error) throw new BillingError("No se pudo cargar la suscripción. Intente nuevamente.",503);
  return result.data as PaymentAccount | null;
}
export async function dispatchBilling(action: Action, req: NextRequest) {
  try {
    const body = await requestBody(req);
    const context = await billingContext(req,body.restaurant_id);
    const account = await paymentAccount(context.admin,context.restaurant.id);
    // SQL 25 backfills all legacy Lemon bindings; this fallback also protects a
    // legacy Stripe account until it is explicitly migrated by its operator.
    const bound = account?.provider || (context.restaurant.lemon_subscription_id ? "lemon_squeezy" : context.restaurant.stripe_subscription_id ? "stripe_legacy" : null);
    const adapter = paymentProvider(selectBillingProvider(bound));
    const response = await adapter[action](req,{ body,context });
    response.headers.set("Cache-Control","no-store");
    if (response.ok) {
      const payload = await response.clone().json();
      if (payload.url) adapter.validateRedirect(payload.url);
    }
    return response;
  } catch (error) {
    return NextResponse.json({error: error instanceof BillingError ? error.message : "No se pudo completar la operación de pago. Intente nuevamente."}, { status: error instanceof BillingError ? error.status : 503, headers: {"Cache-Control":"no-store"} });
  }
}
export async function dispatchBillingWebhook(req: NextRequest) {
  try {
    // Keep the existing Lemon endpoint stable, even if the default for new
    // accounts changes. Future adapters receive their own explicit query value.
    const name = new URL(req.url).searchParams.get("provider") || "lemon_squeezy";
    const response = await paymentProvider(name).webhook(req);
    response.headers.set("Cache-Control","no-store");
    return response;
  } catch { return NextResponse.json({error:"Proveedor no disponible."},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
export async function canDeleteBillingData(admin: ReturnType<typeof serverClients>["admin"], restaurantId: string) {
  const account = await paymentAccount(admin,restaurantId);
  if (!account) return true; // Trial with no provider binding.
  if (!account.external_subscription_id) return false; // Pending or ambiguous payment: retain.
  return paymentProvider(account.provider).canDelete(account);
}
