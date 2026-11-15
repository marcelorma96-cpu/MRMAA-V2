import { supabase } from "@/lib/supabase";

export type AuditActivity = "excel_exportado" | "impresion";

export async function recordAuditActivity(
  restaurantId: string | undefined,
  activity: AuditActivity,
  section: string,
  details: Record<string, unknown> = {},
) {
  if (!restaurantId) return;
  try {
    await supabase.rpc("v2_record_activity", {
      target_restaurant: restaurantId,
      activity,
      section,
      details,
    });
  } catch {
    // La auditoría nunca debe impedir la operación solicitada por el usuario.
  }
}
