import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET || "";
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [usage, cleanup] = await Promise.all([
    // Un restaurante grande puede tener millones de filas. El lote es pequeño
    // incluso antes de aplicar la migración de mantenimiento acotado.
    admin.rpc("v2_refresh_usage_batch", { p_limit: 1 }),
    admin.rpc("v2_platform_maintenance"),
  ]);
  if (usage.error || cleanup.error)
    return NextResponse.json({ error: usage.error?.message || cleanup.error?.message }, { status: 500 });
  return NextResponse.json({ ok: true, tenants_refreshed: usage.data, cleanup: cleanup.data });
}
