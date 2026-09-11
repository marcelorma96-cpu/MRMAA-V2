import { NextRequest, NextResponse } from "next/server";
import { permissionsFor } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const attempts = new Map<string, number[]>();

function protectRequest(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && ![new URL(req.url).origin, "https://mrmaa.com"].includes(origin)) throw new Error("Origen no permitido.");
  if (Number(req.headers.get("content-length") || 0) > 8_000) throw new Error("Solicitud demasiado grande.");
  const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((value) => value > now - 60_000);
  if (recent.length >= 8) throw new Error("Demasiadas solicitudes. Espere un minuto.");
  attempts.set(key, [...recent, now]);
}

async function getContext(req: NextRequest) {
  if (!url || !anon || !service) throw new Error("Falta la clave privada de Supabase en Vercel.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sesión inválida.");
  const publicClient = createClient(url, anon);
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await publicClient.auth.getUser(token);
  if (!data.user) throw new Error("Sesión inválida.");
  const membership = await admin.from("v2_members")
    .select("restaurant_id,role,status")
    .eq("user_id", data.user.id).maybeSingle();
  if (membership.error || !membership.data || !permissionsFor(membership.data.role, membership.data.status).isAdmin)
    throw new Error("Solo un administrador activo puede realizar esta acción.");
  return { admin, user: data.user, member: membership.data };
}

export async function POST(req: NextRequest) {
  try {
    protectRequest(req);
    const { admin, user, member } = await getContext(req);
    const body = await req.json();
    if (body.action === "transfer") {
      const targetId = String(body.target_user_id || "");
      if (!targetId || targetId === user.id) throw new Error("Seleccione otro usuario activo.");
      const target = await admin.from("v2_members").select("user_id,status")
        .eq("restaurant_id", member.restaurant_id).eq("user_id", targetId).single();
      if (!target.data || target.data.status !== "activo") throw new Error("El nuevo administrador debe tener acceso activo.");
      const promoted = await admin.from("v2_members").update({ role: "administrador" })
        .eq("restaurant_id", member.restaurant_id).eq("user_id", targetId);
      if (promoted.error) throw promoted.error;
      const ownership = await admin.from("v2_restaurants").update({ owner_id: targetId })
        .eq("id", member.restaurant_id).eq("owner_id", user.id);
      if (ownership.error) throw ownership.error;
      const demoted = await admin.from("v2_members").update({ role: "gerente" })
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user.id);
      if (demoted.error) throw demoted.error;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete_account") {
      if (body.confirmation !== "ELIMINAR MRMAA") throw new Error("La confirmación escrita no coincide.");
      const others = await admin.from("v2_members").select("user_id", { count: "exact", head: true })
        .eq("restaurant_id", member.restaurant_id).eq("status", "activo")
        .in("role", ["administrador", "admin"]).neq("user_id", user.id);
      if (!others.count) throw new Error("Primero transfiera la administración a otro usuario activo.");
      const removed = await admin.from("v2_members").delete()
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user.id);
      if (removed.error) throw removed.error;
      const remaining = await admin.from("v2_members").select("user_id", { count: "exact", head: true }).eq("user_id", user.id);
      if (!remaining.count) {
        const deletion = await admin.auth.admin.deleteUser(user.id);
        if (deletion.error) throw deletion.error;
      }
      return NextResponse.json({ ok: true });
    }
    throw new Error("Acción no permitida.");
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
