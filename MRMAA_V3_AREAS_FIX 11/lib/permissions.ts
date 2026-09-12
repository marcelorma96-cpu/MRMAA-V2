import type { SupabaseClient } from "@supabase/supabase-js";

// The restaurant membership is authoritative. Never authorize from user_metadata.
export function permissionsFor(role: unknown, status: unknown) {
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
  const active = status === "activo";
  const isAdmin = active && ["administrador", "admin"].includes(normalized);
  return {
    canRead: active && ["administrador", "admin", "gerente", "operacion", "lectura"].includes(normalized),
    isAdmin,
    canOperate: isAdmin || (active && ["gerente", "operacion"].includes(normalized)),
    canManageSchedules: isAdmin || (active && normalized === "gerente"),
    canManageQuoteProducts: isAdmin || (active && ["gerente", "operacion"].includes(normalized)),
  };
}

export type Permission = keyof ReturnType<typeof permissionsFor>;
export const ACCESS_DENIED = "Su acceso no permite realizar esta acción. Consulte al administrador.";

// Recheck immediately before a mutation: an already open page may have stale permissions.
// This improves the UI; PostgreSQL RLS remains the enforcement for direct requests.
export async function requirePermission(client: SupabaseClient, restaurantId: string, permission: Permission) {
  if (!restaurantId) throw new Error(ACCESS_DENIED);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Su sesión no es válida. Inicie sesión nuevamente.");
  const membership = await client.from("v2_members").select("role,status")
    .eq("restaurant_id", restaurantId).eq("user_id", data.user.id).maybeSingle();
  if (membership.error) throw new Error("No se pudieron verificar sus permisos. Intente nuevamente.");
  const permissions = permissionsFor(membership.data?.role, membership.data?.status);
  if (!permissions[permission]) throw new Error(ACCESS_DENIED);
  return permissions;
}
