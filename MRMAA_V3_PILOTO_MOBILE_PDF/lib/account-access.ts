import type { SupabaseClient } from "@supabase/supabase-js";
import { permissionsFor } from "@/lib/permissions";

export const LOAD_RETRY_MESSAGE = "No se pudo cargar la información. Revise su conexión y presione Reintentar.";
export class AccountAccessError extends Error {
  constructor(public readonly kind: "retry" | "invalid_session" | "revoked", message: string) { super(message); }
}
export const invalidSession = () => new AccountAccessError("invalid_session", "Su sesión ya no es válida. Inicie sesión nuevamente.");
export const revokedAccess = () => new AccountAccessError("revoked", "Esta cuenta no tiene acceso activo a MRMAA. Consulte al administrador.");

// Only explicit Auth rejections invalidate credentials. A network error, timeout,
// rate limit, database permission error or unavailable service cannot prove revocation.
export function isInvalidSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, name } = error as { code?: string; name?: string };
  return name === "AuthSessionMissingError" || [
    "session_not_found", "session_expired", "user_not_found", "user_banned", "bad_jwt",
    "refresh_token_not_found", "refresh_token_already_used",
  ].includes(code || "");
}

export type VerifiedAccount = {
  restaurantId: string; restaurantName: string; planCode: "basic" | "intermediate" | "advanced";
  trialEndsAt: string; subscriptionStatus: string; accessStatus: string;
  billingEnforcementEnabled: boolean; graceEndsAt: string | null; exportUntil: string | null;
};

export async function readVerifiedAccount(client: SupabaseClient, expectedUserId: string): Promise<VerifiedAccount> {
  try {
    const verified = await client.auth.getUser();
    if (verified.error) {
      if (isInvalidSessionError(verified.error)) throw invalidSession();
      throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    }
    if (!expectedUserId || !verified.data.user || verified.data.user.id !== expectedUserId) throw invalidSession();
    const ensured = await client.rpc("v2_ensure_restaurant");
    if (ensured.error) {
      // This exact application exception means there is no active membership.
      if (ensured.error.code === "P0001" && /^Acceso no autorizado\.?$/i.test(ensured.error.message.trim())) throw revokedAccess();
      throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    }
    if (typeof ensured.data !== "string" || !ensured.data) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    const membership = await client.from("v2_members").select("role,status")
      .eq("restaurant_id", ensured.data).eq("user_id", expectedUserId).maybeSingle();
    if (membership.error) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    if (!permissionsFor(membership.data?.role, membership.data?.status).canRead) throw revokedAccess();
    const result = await client.from("v2_restaurants")
      .select("id,name,plan_code,trial_ends_at,subscription_status,access_status,billing_enforcement_enabled,grace_ends_at,export_until")
      .eq("id", ensured.data).single();
    if (result.error || !result.data || result.data.id !== ensured.data) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    return {
      restaurantId: result.data.id, restaurantName: result.data.name, planCode: result.data.plan_code,
      trialEndsAt: result.data.trial_ends_at, subscriptionStatus: result.data.subscription_status,
      accessStatus: result.data.access_status || result.data.subscription_status,
      billingEnforcementEnabled: Boolean(result.data.billing_enforcement_enabled),
      graceEndsAt: result.data.grace_ends_at, exportUntil: result.data.export_until,
    };
  } catch (error) {
    if (error instanceof AccountAccessError) throw error;
    if (isInvalidSessionError(error)) throw invalidSession();
    throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
  }
}

// Read-only, bounded catalog refresh. The caller applies it only when complete,
// so a failed background refresh cannot erase drafts, permissions or catalogs.
export async function readDashboardData(client: SupabaseClient, restaurantId: string, userId: string) {
  try {
    const [restaurant, products, areas, membership] = await Promise.all([
      client.from("v2_restaurants").select("name,language,currency,quote_number_start,settings").eq("id", restaurantId).single(),
      client.from("v2_quote_products").select("*").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
      client.from("v2_reservation_areas").select("id,name").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
      client.from("v2_members").select("role,status").eq("restaurant_id", restaurantId).eq("user_id", userId).maybeSingle(),
    ]);
    if (!membership.error && !permissionsFor(membership.data?.role, membership.data?.status).canRead) throw revokedAccess();
    if (restaurant.error || products.error || areas.error || membership.error || !restaurant.data) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    return { restaurant: restaurant.data, products: products.data || [], areas: areas.data || [], membership: membership.data! };
  } catch (error) {
    if (error instanceof AccountAccessError) throw error;
    throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
  }
}
