import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canDeleteBillingData } from "@/lib/billing-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const expected = Buffer.from(process.env.CRON_SECRET || "");
  const received = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "");
  return expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  const deadline = Date.now() + 45_000;
  const timeLeft = () => deadline - Date.now();
  const worker = randomUUID();
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([
      AbortSignal.timeout(Math.max(1, Math.min(8000, timeLeft()))), ...(init?.signal ? [init.signal] : []),
    ]) }) },
  });
  let cleanupBatches = 0, moreCleanup = false, deleted = 0, skipped = 0, failed = 0, jobsCompleted = 0;
  try {
    // Recounts of all business rows are diagnostics, not a prerequisite for housekeeping.
    // Resource/seat limits are checked transactionally on writes.
    for (; cleanupBatches < 20 && timeLeft() > 15_000; cleanupBatches++) {
      const cleanup = await admin.rpc("v2_platform_maintenance");
      if (cleanup.error) throw new Error("HOUSEKEEPING_FAILED");
      moreCleanup = cleanup.data?.more_possible === true;
      if (!moreCleanup) { cleanupBatches++; break; }
    }
    if (process.env.MRMAA_RETENTION_DELETE_ENABLED !== "true") {
      return NextResponse.json({ ok: true, cleanup_batches: cleanupBatches, more_cleanup: moreCleanup,
        retention: { enabled: false }, deletion: { deleted: 0, skipped: 0, failed: 0, cleanup_completed: 0 } });
    }
    const retention = await admin.rpc("v2_retention_maintenance");
    if (retention.error) throw new Error("RETENTION_CHECK_FAILED");
    const due = await admin.rpc("v2_retention_due", { p_limit: 5 });
    if (due.error) throw new Error("RETENTION_LIST_FAILED");
    for (const row of due.data || []) {
      if (timeLeft() < 20_000) break;
      try {
        const deferred = await admin.rpc("v2_retention_defer", { p_restaurant: row.restaurant_id });
        if (deferred.error) { failed++; continue; }
        // Keep data if the payment provider is unavailable, a paid period remains,
        // or the SQL recheck finds a payment/checkout currently in progress.
        if (!(await canDeleteBillingData(admin,row.restaurant_id))) { skipped++; continue; }
        const removed = await admin.rpc("v2_retention_delete", { p_restaurant: row.restaurant_id });
        if (removed.error) { failed++; continue; }
        if (removed.data?.deleted === true) deleted++; else skipped++;
      } catch { failed++; }
    }
    // The database deletion and cleanup-job creation are one transaction. A crash
    // here leaves a recoverable job instead of losing its Storage/Auth references.
    for (let jobs = 0; jobs < 5 && timeLeft() > 10_000; jobs++) {
      const claimed = await admin.rpc("v2_claim_retention_cleanup", { p_worker: worker });
      if (claimed.error) throw new Error("CLEANUP_CLAIM_FAILED");
      const job = claimed.data?.[0];
      if (!job) break;
      let error: string | null = null;
      try {
        const rid = String(job.payload?.restaurant_id || "");
        if (!/^[0-9a-f-]{36}$/i.test(rid)) throw new Error("CLEANUP_PAYLOAD");
        const prefixes = [rid];
        let operations = 0;
        while (prefixes.length) {
          if (timeLeft() < 3000 || ++operations > 50) throw new Error("CLEANUP_RETRY");
          const prefix = prefixes[prefixes.length - 1];
          const listed = await admin.storage.from("mrmaa-branding").list(prefix, { limit: 100 });
          if (listed.error) throw new Error("STORAGE_LIST_FAILED");
          if (!listed.data?.length) { prefixes.pop(); continue; }
          const files = listed.data.filter(file => file.id).map(file => `${prefix}/${file.name}`);
          if (files.length) {
            const removed = await admin.storage.from("mrmaa-branding").remove(files);
            if (removed.error) throw new Error("STORAGE_DELETE_FAILED");
          } else {
            const folder = listed.data[0].name;
            if (!folder || folder.includes("/") || folder === "." || folder === ".." || prefixes.length > 20)
              throw new Error("STORAGE_PATH_INVALID");
            prefixes.push(`${prefix}/${folder}`);
          }
        }
        for (const userId of new Set<string>(job.payload?.users || [])) {
          if (timeLeft() < 3000) throw new Error("CLEANUP_RETRY");
          const [memberships, ownerships] = await Promise.all([
            admin.from("v2_members").select("user_id").eq("user_id", userId).limit(1),
            admin.from("v2_restaurants").select("id").eq("owner_id", userId).limit(1),
          ]);
          if (memberships.error || ownerships.error) throw new Error("USER_CHECK_FAILED");
          if (!memberships.data?.length && !ownerships.data?.length) {
            const result = await admin.auth.admin.deleteUser(userId);
            if (result.error && result.error.status !== 404) throw new Error("USER_DELETE_FAILED");
          }
        }
      } catch { error = "Reintentar limpieza de archivos o usuarios."; failed++; }
      const finished = await admin.rpc("v2_finish_retention_cleanup", { p_id: job.id, p_worker: worker, p_error: error });
      if (finished.error || finished.data !== true) failed++;
      else if (!error) jobsCompleted++;
    }
    return NextResponse.json({ ok: failed === 0, cleanup_batches: cleanupBatches, more_cleanup: moreCleanup,
      retention: retention.data, deletion: { deleted, skipped, failed, cleanup_completed: jobsCompleted },
      budget_exhausted: timeLeft() < 10_000 }, { status: failed ? 503 : 200 });
  } catch {
    // No provider payloads, personal data or secrets in the response/log.
    console.error("MRMAA maintenance failed", { cleanupBatches, deleted, jobsCompleted });
    return NextResponse.json({ ok: false, error: "No se pudo completar el mantenimiento. Revise los registros y vuelva a intentarlo." }, { status: 503 });
  }
}
