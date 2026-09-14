import { NextRequest, NextResponse } from "next/server";
import { BillingError, billingContext, requestBody, strictRateLimit } from "@/lib/billing-server";
import { lemonRequest, lemonStoreId, lemonURL, requireTest } from "@/lib/lemon-squeezy";
export async function POST(req: NextRequest) {
  try {
    const body = await requestBody(req);
    const { restaurant, user } = await billingContext(req, body.restaurant_id);
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
