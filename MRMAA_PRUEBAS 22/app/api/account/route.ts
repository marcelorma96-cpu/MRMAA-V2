import { userMessage } from "@/lib/user-message";
import { requireVerifiedMfa } from "@/lib/mfa";
import { siteOrigin } from "@/lib/site-origin";
import { NextRequest, NextResponse } from "next/server";
import { permissionsFor } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import { takeDistributedRateLimit, readBoundedJson, RequestSafetyError } from "@/lib/server-scale";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;


function protectRequest(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && ![new URL(req.url).origin, siteOrigin(new URL(req.url).origin)].includes(origin)) throw new Error("Origen no permitido.");
  if (Number(req.headers.get("content-length") || 0) > 8_000) throw new Error("Solicitud demasiado grande.");

}

async function getContext(req: NextRequest) {
  if (!url || !anon || !service) throw new Error("El servicio no está disponible. Intente nuevamente más tarde.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sesión inválida.");
  const publicClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await publicClient.auth.getUser(token);
  if (!data.user) throw new Error("Sesión inválida.");
  await requireVerifiedMfa(data.user, token);
  const membership = await admin.from("v2_members")
    .select("restaurant_id,role,status")
    .eq("user_id", data.user.id).maybeSingle();
  if (membership.error || !membership.data || !permissionsFor(membership.data.role, membership.data.status).isAdmin)
    throw new Error("Solo un administrador activo puede realizar esta acción.");
  return { admin, client: publicClient, user: data.user, member: membership.data };
}

export async function POST(req: NextRequest) {
  try {
    protectRequest(req);
    const { admin, client, user, member } = await getContext(req);
    await takeDistributedRateLimit(admin, req, "account:write", 8);
    const body = await readBoundedJson(req, 8_000);
    if (body.action === "transfer") {
      const targetId = String(body.target_user_id || "");
      if (!targetId || targetId === user.id) throw new Error("Seleccione otro usuario activo.");
      const result = await client.rpc("v2_transfer_owner", { p_restaurant: member.restaurant_id, p_target: targetId });
      if (result.error) throw new Error("No se pudo transferir la administración. Revise que el destinatario esté activo e intente nuevamente.");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete_account") {
      if (body.confirmation !== "ELIMINAR MRMAA") throw new Error("La confirmación escrita no coincide.");
      const owned = await admin.from("v2_restaurants").select("id").eq("owner_id", user.id).limit(1);
      if (owned.error) throw new Error("No se pudo comprobar la cuenta. Intente nuevamente.");
      if (owned.data?.length) throw new Error("Primero transfiera la administración a otro usuario activo.");
      const removed = await admin.from("v2_members").delete()
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user.id);
      if (removed.error) throw removed.error;
      const remaining = await admin.from("v2_members").select("user_id", { count: "exact", head: true }).eq("user_id", user.id);
      if (remaining.error) throw new Error("No se pudo comprobar la cuenta. Intente nuevamente.");
      if (!remaining.count) {
        const deletion = await admin.auth.admin.deleteUser(user.id);
        if (deletion.error) throw deletion.error;
      }
      return NextResponse.json({ ok: true });
    }
    throw new Error("Acción no permitida.");
  } catch (error: any) {
    return NextResponse.json({ error: userMessage(error) }, { status: error instanceof RequestSafetyError ? error.status : 400 });
  }
}
