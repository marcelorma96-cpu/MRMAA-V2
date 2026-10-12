import { readBoundedJson, RequestSafetyError } from "./server-scale";
import { requireVerifiedMfa } from "@/lib/mfa";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { siteOrigin } from "./site-origin";

export class BillingError extends Error {
  constructor(message: string, public status = 400, public code = "BILLING_ERROR") { super(message); }
}
export function serverClients(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new BillingError("El servicio no está disponible. Intente nuevamente más tarde.", 503);
  const auth = { persistSession: false, autoRefreshToken: false };
  return {
    admin: createClient(url, service, { auth }),
    client: createClient(url, anon, { auth, global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined }),
  };
}
export async function requestBody(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== siteOrigin(new URL(req.url).origin) && origin !== new URL(req.url).origin)
    throw new BillingError("Solicitud no permitida.", 403);
  try { return await readBoundedJson(req, 10000); }
  catch (error) { if (error instanceof RequestSafetyError) throw new BillingError(error.message, error.status); throw error; }

}
export async function strictRateLimit(req: NextRequest, bucket: string, limit: number) {
  const { createHash } = await import("node:crypto");
  const { admin } = serverClients();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const result = await admin.rpc("v2_take_rate_limit", { p_bucket: bucket, p_subject_hash: createHash("sha256").update(ip).digest("hex"), p_limit: limit, p_window_seconds: 60 });
  if (result.error) throw new BillingError("El servicio no está disponible. Intente nuevamente más tarde.", 503);
  if (!result.data) throw new BillingError("Demasiados intentos. Espere un minuto.", 429);
}
export async function billingContext(req: NextRequest, restaurantId: unknown) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || typeof restaurantId !== "string" || !/^[0-9a-f-]{36}$/i.test(restaurantId)) throw new BillingError("Inicie sesión nuevamente.", 401);
  const { admin, client } = serverClients(token);
  const verified = await client.auth.getUser(token);
  if (verified.error || !verified.data.user?.email_confirmed_at) throw new BillingError("Inicie sesión nuevamente.", 401);
  try { await requireVerifiedMfa(verified.data.user, token); }
  catch { throw new BillingError("Complete la verificación en dos pasos para continuar.", 403); }
  const [membership, restaurant] = await Promise.all([
    admin.from("v2_members").select("role,status").eq("restaurant_id", restaurantId).eq("user_id", verified.data.user.id).maybeSingle(),
    admin.from("v2_restaurants").select("*").eq("id", restaurantId).maybeSingle(),
  ]);
  if (membership.error || restaurant.error) throw new BillingError("No se pudo cargar la suscripción. Intente nuevamente.", 503);
  if (membership.data?.status !== "activo" || !["administrador", "admin"].includes(membership.data.role) || restaurant.data?.owner_id !== verified.data.user.id)
    throw new BillingError("Solo el administrador principal puede gestionar la suscripción.", 403);
  return { admin, client, user: verified.data.user, restaurant: restaurant.data };
}
export async function acquireBilling(admin: ReturnType<typeof serverClients>["admin"], restaurantId: string) {
  const result = await admin.rpc("v2_billing_acquire", { p_restaurant: restaurantId });
  if (result.error) throw new BillingError("No se pudo iniciar la operación. Intente nuevamente.", 503);
  if (!result.data) throw new BillingError("Hay una operación en curso. Espere unos segundos.", 409);
  return result.data as { lease_token: string; checkout_id: string | null; checkout_key: string; checkout_plan: string | null; checkout_cycle: string | null; plan_change_next_at?: string | null; pending_plan_change?: any };
}
export async function releaseBilling(admin: ReturnType<typeof serverClients>["admin"], restaurantId: string, token: string) {
  await admin.from("v2_billing_state").update({ lease_until: null, lease_token: null }).eq("restaurant_id", restaurantId).eq("lease_token", token);
}
