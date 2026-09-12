import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function requestSubject(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const agent = req.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}|${agent}`).digest("hex");
}

export async function takeDistributedRateLimit(
  admin: SupabaseClient,
  req: NextRequest,
  bucket: string,
  limit: number,
  windowSeconds = 60,
) {
  const result = await admin.rpc("v2_take_rate_limit", {
    p_bucket: bucket,
    p_subject_hash: requestSubject(req),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  // Compatibilidad durante el despliegue gradual de la migración nueva.
  if (result.error && /v2_take_rate_limit|schema cache|function/i.test(result.error.message)) return;
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Demasiadas solicitudes. Espere un minuto e intente nuevamente.");
}

export async function recordServerMetric(
  admin: SupabaseClient,
  metric: string,
  startedAt: number,
  failed = false,
) {
  const result = await admin.rpc("v2_record_metric", {
    p_metric: metric,
    p_dimension: process.env.VERCEL_REGION || "local",
    p_duration_ms: Math.max(0, Date.now() - startedAt),
    p_error: failed,
  });
  if (result.error && !/v2_record_metric|schema cache|function/i.test(result.error.message))
    console.error("MRMAA metric error", result.error.message);
}
