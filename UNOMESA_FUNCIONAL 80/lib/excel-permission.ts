import type { SupabaseClient } from "@supabase/supabase-js";

export type ExcelAccess = { allowed: boolean; canManage: boolean; teamEnabled: boolean };
export const EXCEL_DENIED = "Las descargas de Excel están deshabilitadas por el administrador.";
export const EXCEL_CHECK_FAILED = "No se pudo verificar el permiso de descarga. Intente nuevamente.";
const denied: ExcelAccess = { allowed: false, canManage: false, teamEnabled: false };

// Membership and tenant preference come from PostgreSQL, never from local storage or metadata.
export async function readExcelAccess(client: SupabaseClient, restaurantId?: string): Promise<ExcelAccess> {
  if (!restaurantId) return { ...denied };
  const { data, error } = await client.rpc("v2_excel_export_access", { p_restaurant_id: restaurantId });
  if (error) throw new Error(EXCEL_CHECK_FAILED);
  const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
  if (!row) return { ...denied };
  return { allowed: row.allowed === true, canManage: row.can_manage === true, teamEnabled: row.team_enabled === true };
}

export async function saveTeamExcelAccess(client: SupabaseClient, restaurantId: string, enabled: boolean) {
  const { data, error } = await client.rpc("v2_set_team_excel_exports", { p_restaurant_id: restaurantId, p_enabled: enabled });
  if (error || data !== enabled) throw new Error("No se pudo guardar el permiso. Verifique su acceso e intente nuevamente.");
  return enabled;
}
