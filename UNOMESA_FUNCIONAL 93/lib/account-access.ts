import {abortableRead,isTransientReadError} from "./initial-read";
import {rememberedBranch} from "./branches";
import { exportBudget } from "./export-limits";
import type { SupabaseClient } from "@supabase/supabase-js";
import { permissionsFor } from "@/lib/permissions";

const withSignal=<T extends {abortSignal(signal:AbortSignal):T}>(request:T,signal?:AbortSignal):T=>signal?request.abortSignal(signal):request;

export const LOAD_RETRY_MESSAGE = "No se pudo cargar la información. Revise su conexión y presione Reintentar.";
export class AccountAccessError extends Error {
  constructor(public readonly kind: "retry" | "invalid_session" | "revoked" | "failed", message: string) { super(message); }
}
function readFailure(error:unknown,status?:number){
  return new AccountAccessError((isTransientReadError(error)||isTransientReadError({status}))?'retry':'failed',LOAD_RETRY_MESSAGE);
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

export async function readVerifiedAccount(client: SupabaseClient, expectedUserId: string, selectedBranch?:string, signal?:AbortSignal): Promise<VerifiedAccount> {
  try {
    signal?.throwIfAborted();
    const verified = await abortableRead(client.auth.getUser(), signal);
    if (verified.error) {
      if (isInvalidSessionError(verified.error)) throw invalidSession();
      throw readFailure(verified.error);
    }
    if (!expectedUserId || !verified.data.user || verified.data.user.id !== expectedUserId) throw invalidSession();
    const desired=selectedBranch||rememberedBranch(expectedUserId);
    let active:{restaurant_id:string,status:string}|undefined;
    if(desired){const chosen=await withSignal(client.from('v2_members').select('restaurant_id,status').eq('user_id',expectedUserId).eq('restaurant_id',desired),signal).maybeSingle();
      if(chosen.error)throw readFailure(chosen.error,chosen.status);
      if(chosen.data?.status==='activo')active=chosen.data;
      else if(selectedBranch)throw new AccountAccessError('failed','No tiene acceso a esa sucursal.');
    }
    if(!active){const first=await withSignal(client.from('v2_members').select('restaurant_id,status').eq('user_id',expectedUserId).eq('status','activo').order('restaurant_id').limit(1),signal);
      if(first.error)throw readFailure(first.error,first.status);active=first.data?.[0];}
    if(!active){const existing=await withSignal(client.from('v2_members').select('restaurant_id').eq('user_id',expectedUserId).limit(1),signal);
      if(existing.error)throw readFailure(existing.error,existing.status);if(existing.data?.length)throw revokedAccess();}
    let ensured = active ? {data:active.restaurant_id,error:null,status:200} : await withSignal(client.rpc("v2_ensure_restaurant"),signal);
    if (ensured.error?.code === "P0001" && /^Acceso no autorizado\.?$/i.test(ensured.error.message.trim())) {
      ensured = await withSignal(client.rpc("v2_finish_registration"),signal);
    }
    if (ensured.error) {
      // This exact application exception means there is no active membership.
      if (ensured.error.code === "P0001" && /^Acceso no autorizado\.?$/i.test(ensured.error.message.trim())) throw revokedAccess();
      throw readFailure(ensured.error,ensured.status);
    }
    if (typeof ensured.data !== "string" || !ensured.data) throw new AccountAccessError("failed", LOAD_RETRY_MESSAGE);
    // Both reads use the verified session and tenant. Apply neither until both pass.
    const [membership, result] = await Promise.all([
      withSignal(client.from("v2_members").select("role,status")
        .eq("restaurant_id", ensured.data).eq("user_id", expectedUserId),signal).maybeSingle(),
      withSignal(client.rpc("v2_account_billing", { p_restaurant: ensured.data }),signal),
    ]);
    if (membership.error) throw readFailure(membership.error,membership.status);
    if (!permissionsFor(membership.data?.role, membership.data?.status).canRead) throw revokedAccess();
    if (result.error) throw readFailure(result.error,result.status);
    if (!result.data || result.data.id !== ensured.data) throw new AccountAccessError("failed", LOAD_RETRY_MESSAGE);
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
    signal?.throwIfAborted();
    if (error instanceof AccountAccessError) throw error;
    if (isInvalidSessionError(error)) throw invalidSession();
    throw readFailure(error);
  }
}

// Read-only, bounded catalog refresh. The caller applies it only when complete,
// so a failed background refresh cannot erase drafts, permissions or catalogs.
export async function readDashboardData(client: SupabaseClient, restaurantId: string, userId: string, signal?:AbortSignal) {
  try {
    const [restaurant, products, areas, membership] = await Promise.all([
      withSignal(client.from("v2_restaurants").select("name,country,language,currency,quote_number_start,settings").eq("id", restaurantId),signal).single(),
      readCatalog(client, restaurantId, "v2_quote_products", "name", true, signal),
      readCatalog(client, restaurantId, "v2_reservation_areas", "name", true, signal),
      withSignal(client.rpc("v2_effective_membership", { p_restaurant: restaurantId }),signal),
    ]);
    if (!membership.error && !permissionsFor(membership.data?.role, membership.data?.status).canRead) throw revokedAccess();
    const failure=[restaurant,products,areas,membership].find(result=>result.error);
    if(failure)throw readFailure(failure.error,failure.status);
    if(!restaurant.data)throw new AccountAccessError("failed", LOAD_RETRY_MESSAGE);
    return { restaurant: restaurant.data, products: products.data || [], areas: areas.data || [], membership: membership.data! };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof AccountAccessError) throw error;
    throw readFailure(error);
  }
}

/** Load complete, bounded catalogs; never silently accept PostgREST's first 1,000 rows. */
export async function readCatalog(client: SupabaseClient, restaurantId: string, table: string, order = "name", activeOnly = false, signal?:AbortSignal) {
  const data: any[] = [], budget = exportBudget();
  signal?.throwIfAborted();
  for (let offset = 0; ; offset += 500) {
    let query = client.from(table).select("*").eq("restaurant_id", restaurantId);
    if (activeOnly) query = query.eq("active", true);
    const result = await withSignal(query.order(order, { nullsFirst: false }).order("id").range(offset, offset + 499),signal);
    if (result.error) return { data: null, error: result.error, status: result.status };
    const rows = result.data || []; budget.add(rows); data.push(...rows);
    if (rows.length < 500) return { data, error: null, status: result.status };
  }
}
