import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const canonicalSiteUrl = "https://mrmaa.com";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function sameHash(left: string, right: string) {
  const a = Buffer.from(left, "hex"), b = Buffer.from(right, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

async function invitationContext(req: NextRequest, invitation: unknown) {
  if (!url || !anon || !service) throw new Error("No fue posible validar el enlace.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const cleanInvitation = String(invitation || "").trim();
  if (!token || !cleanInvitation || cleanInvitation.length > 200)
    throw new Error("El enlace ya venció o fue utilizado.");
  const publicClient = createClient(url, anon, { auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const authResult = await publicClient.auth.getUser(token);
  if (authResult.error || !authResult.data.user)
    throw new Error("El enlace ya venció o fue utilizado.");
  const membership = await admin.from("v2_members")
    .select("restaurant_id,user_id,status,invite_token_hash")
    .eq("user_id", authResult.data.user.id)
    .eq("status", "invitado");
  if (membership.error) throw new Error("No fue posible validar el enlace.");
  const expected = hash(cleanInvitation);
  const member = (membership.data || []).find(row =>
    typeof row.invite_token_hash === "string" && sameHash(row.invite_token_hash, expected),
  );
  if (!member) throw new Error("El enlace ya venció o fue utilizado.");
  return { admin, user: authResult.data.user, member, expected };
}

async function body(req: NextRequest) {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 4000) throw new Error("Solicitud inválida.");
  const origin = req.headers.get("origin");
  const ownOrigin = new URL(req.url).origin;
  if (origin && origin !== ownOrigin && origin !== canonicalSiteUrl)
    throw new Error("Solicitud inválida.");
  return req.json();
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await body(req);
    await invitationContext(req, payload.invitation);
    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "El enlace ya venció o fue utilizado." }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await body(req);
    const password = String(payload.password || "");
    if (!(password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)))
      throw new Error("La contraseña no cumple los requisitos de seguridad.");
    const { admin, user, member, expected } = await invitationContext(req, payload.invitation);
    const activated = await admin.from("v2_members")
      .update({ status: "activo", invite_token_hash: null })
      .eq("restaurant_id", member.restaurant_id)
      .eq("user_id", user.id)
      .eq("status", "invitado")
      .eq("invite_token_hash", expected)
      .select("user_id")
      .maybeSingle();
    if (activated.error || !activated.data)
      throw new Error("El enlace ya venció o fue utilizado.");
    const changed = await admin.auth.admin.updateUserById(user.id, { password });
    if (changed.error) {
      await admin.from("v2_members").update({ status: "invitado", invite_token_hash: expected })
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user.id);
      throw new Error("No se pudo guardar la contraseña. Solicite una invitación nueva.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "El enlace ya venció o fue utilizado." }, { status: 403 });
  }
}
