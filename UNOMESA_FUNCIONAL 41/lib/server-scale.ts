import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function requestSubject(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex");
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
  if (result.error) throw new RequestSafetyError("El servicio no está disponible. Intente nuevamente más tarde.", 503);
  if (result.data !== true) throw new RequestSafetyError("Demasiadas solicitudes. Espere un minuto e intente nuevamente.", 429);
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

export class RequestSafetyError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
/** Enforces the actual byte count even when Content-Length is absent or untrusted. */
export async function readBoundedText(req: Request, maxBytes: number) {
  if (Number(req.headers.get("content-length") || 0) > maxBytes)
    throw new RequestSafetyError("Solicitud demasiado grande.", 413);
  if (!req.body) return "";
  const reader = req.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new RequestSafetyError("Solicitud demasiado grande.", 413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
export async function readBoundedJson(req: Request, maxBytes: number): Promise<Record<string, any>> {
  const raw = await readBoundedText(req, maxBytes);
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch { throw new RequestSafetyError("Revise la información ingresada."); }
}
