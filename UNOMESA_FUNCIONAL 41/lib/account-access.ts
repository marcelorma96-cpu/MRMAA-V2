import {rememberedBranch} from "./branches";
import { exportBudget } from "./export-limits";
import type { SupabaseClient } from "@supabase/supabase-js";
import { permissionsFor } from "@/lib/permissions";

export const LOAD_RETRY_MESSAGE = "No se pudo cargar la información. Revise su conexión y presione Reintentar.";
export class AccountAccessError extends Error {
  constructor(public readonly kind: "retry" | "invalid_session" | "revoked", message: string) { super(message); }
}
export const invalidSession = () => new AccountAccessError("invalid_session", "Su sesión ya no es válida. Inicie sesión nuevamente.");
export const revokedAccess = () => new AccountAccessError("revoked", "Esta cuenta no tiene acceso activo a UnoMesa. Consulte al administrador.");

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
  branchDeletedAt?: string | null;
  restaurantId: string; restaurantName: string; planCode: "basic" | "intermediate" | "advanced";
  trialEndsAt: string; subscriptionStatus: string; accessStatus: string;
  billingEnforcementEnabled: boolean; graceEndsAt: string | null; exportUntil: string | null;
  deletionScheduledAt: string | null; canWrite: boolean; trialExempt: boolean; isOwner: boolean; paidUntil: string | null; billingRootId?:string; branchEnabled?:boolean; branchCapacity?:number; canReadBranch?:boolean; cancelAtPeriodEnd?: boolean;
};

export async function readVerifiedAccount(client: SupabaseClient, expectedUserId: string, selectedBranch?:string): Promise<VerifiedAccount> {
  try {
    const verified = await client.auth.getUser();
    if (verified.error) {
      if (isInvalidSessionError(verified.error)) throw invalidSession();
      throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    }
    if (!expectedUserId || !verified.data.user || verified.data.user.id !== expectedUserId) throw invalidSession();
    const desired=selectedBranch||rememberedBranch(expectedUserId);
    let active:{restaurant_id:string,status:string}|undefined;
    if(desired){const chosen=await client.from('v2_members').select('restaurant_id,status').eq('user_id',expectedUserId).eq('restaurant_id',desired).maybeSingle();
      if(chosen.error)throw new AccountAccessError('retry',LOAD_RETRY_MESSAGE);
      if(chosen.data?.status==='activo')active=chosen.data;
      else if(selectedBranch)throw new AccountAccessError('retry','No tiene acceso a esa sucursal.');
    }
    if(!active){const first=await client.from('v2_members').select('restaurant_id,status').eq('user_id',expectedUserId).eq('status','activo').order('restaurant_id').limit(1);
      if(first.error)throw new AccountAccessError('retry',LOAD_RETRY_MESSAGE);active=first.data?.[0];}
    if(!active){const existing=await client.from('v2_members').select('restaurant_id').eq('user_id',expectedUserId).limit(1);
      if(existing.error)throw new AccountAccessError('retry',LOAD_RETRY_MESSAGE);if(existing.data?.length)throw revokedAccess();}
    let ensured = active ? {data:active.restaurant_id,error:null} : await client.rpc("v2_ensure_restaurant");
    if (ensured.error?.code === "P0001" && /^Acceso no autorizado\.?$/i.test(ensured.error.message.trim())) {
      ensured = await client.rpc("v2_finish_registration");
    }
    if (ensured.error) {
      // This exact application exception means there is no active membership.
      if (ensured.error.code === "P0001" && /^Acceso no autorizado\.?$/i.test(ensured.error.message.trim())) throw revokedAccess();
      throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    }
    if (typeof ensured.data !== "string" || !ensured.data) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    // Both reads use the verified session and tenant. Apply neither until both pass.
    const [membership, result] = await Promise.all([
      client.from("v2_members").select("role,status")
        .eq("restaurant_id", ensured.data).eq("user_id", expectedUserId).maybeSingle(),
      client.rpc("v2_account_billing", { p_restaurant: ensured.data }),
    ]);
    if (membership.error) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    if (!permissionsFor(membership.data?.role, membership.data?.status).canRead) throw revokedAccess();
    if (result.error || !result.data || result.data.id !== ensured.data) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    return {
      branchDeletedAt:result.data.branch_deleted_at||null,
      canReadBranch:result.data.branch_can_read!==false,billingRootId:result.data.billing_root_id||ensured.data,branchEnabled:result.data.branch_enabled!==false,branchCapacity:result.data.branch_capacity||1,
      restaurantId: result.data.id, restaurantName: result.data.name, planCode: result.data.plan_code,
      trialEndsAt: result.data.trial_ends_at, subscriptionStatus: result.data.subscription_status,
      accessStatus: result.data.access_status || result.data.subscription_status,
      billingEnforcementEnabled: Boolean(result.data.billing_enforcement_enabled),
      graceEndsAt: result.data.grace_ends_at, exportUntil: result.data.export_until,
      deletionScheduledAt: result.data.deletion_scheduled_at,
      canWrite: result.data.can_write === true, trialExempt: result.data.trial_exempt === true, isOwner: result.data.is_owner === true, paidUntil: result.data.billing_current_period_end, cancelAtPeriodEnd: result.data.billing_cancel_at_period_end === true,
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
      readCatalog(client, restaurantId, "v2_quote_products", "name", true),
      readCatalog(client, restaurantId, "v2_reservation_areas", "name", true),
      client.rpc("v2_effective_membership", { p_restaurant: restaurantId }),
    ]);
    if (!membership.error && !permissionsFor(membership.data?.role, membership.data?.status).canRead) throw revokedAccess();
    if (restaurant.error || products.error || areas.error || membership.error || !restaurant.data) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
    return { restaurant: restaurant.data, products: products.data || [], areas: areas.data || [], membership: membership.data! };
  } catch (error) {
    if (error instanceof AccountAccessError) throw error;
    throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
  }
}

/** Load complete, bounded catalogs; never silently accept PostgREST's first 1,000 rows. */
export async function readCatalog(client: SupabaseClient, restaurantId: string, table: string, order = "name", activeOnly = false) {
  const data: any[] = [], budget = exportBudget();
  for (let offset = 0; ; offset += 500) {
    let query = client.from(table).select("*").eq("restaurant_id", restaurantId);
    if (activeOnly) query = query.eq("active", true);
    const result = await query.order(order, { nullsFirst: false }).order("id").range(offset, offset + 499);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data || []; budget.add(rows); data.push(...rows);
    if (rows.length < 500) return { data, error: null };
  }
}
