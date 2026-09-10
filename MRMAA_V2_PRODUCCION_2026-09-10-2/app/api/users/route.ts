import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const canonicalSiteUrl = "https://mrmaa.com";
const requestLog = new Map<string, number[]>();
function enforceRequestSafety(req: NextRequest, limit = 30) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 32_000) throw new Error("Solicitud demasiado grande.");
  const origin = req.headers.get("origin");
  const ownOrigin = new URL(req.url).origin;
  if (origin && origin !== ownOrigin && origin !== canonicalSiteUrl)
    throw new Error("Origen de solicitud no permitido.");
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || "unknown";
  const now = Date.now(), cutoff = now - 60_000;
  const recent = (requestLog.get(key) || []).filter((time) => time > cutoff);
  if (recent.length >= limit) throw new Error("Demasiadas solicitudes. Espere un minuto e intente nuevamente.");
  recent.push(now);
  requestLog.set(key, recent);
}
const cleanText = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
async function context(req: NextRequest) {
  if (!url || !anon || !service)
    throw new Error(
      "Falta SUPABASE_SECRET_KEY en Vercel. Agréguela y vuelva a desplegar.",
    );
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sesión inválida.");
  const publicClient = createClient(url, anon),
    admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  const {
    data: { user },
  } = await publicClient.auth.getUser(token);
  if (!user) throw new Error("Sesión inválida.");
  const { data: member } = await admin
    .from("v2_members")
    .select("restaurant_id,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !["administrador", "admin"].includes(member.role))
    throw new Error("Solo el administrador puede gestionar usuarios.");
  return { admin, member, user };
}
export async function GET(req: NextRequest) {
  try {
    enforceRequestSafety(req, 60);
    const { admin, member } = await context(req);
    const { data, error } = await admin
      .from("v2_members")
      .select("user_id,name,email,role,status,invited_at,last_invited_at")
      .eq("restaurant_id", member.restaurant_id)
      .order("name");
    if (error) throw error;
    const authUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byId = new Map((authUsers.data?.users || []).map((u) => [u.id, u]));
    const activatedIds = (data || []).filter((row) => {
      const authUser = byId.get(row.user_id);
      return row.status === "invitado" && Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at || authUser?.last_sign_in_at);
    }).map((row) => row.user_id);
    if (activatedIds.length)
      await admin.from("v2_members").update({ status: "activo" })
        .eq("restaurant_id", member.restaurant_id).in("user_id", activatedIds);
    return NextResponse.json((data || []).map((row) => {
      const authUser = byId.get(row.user_id);
      const confirmed = Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at || authUser?.last_sign_in_at);
      return {
        ...row,
        status: row.status === "invitado" && confirmed ? "activo" : row.status,
        name: row.name || String(authUser?.user_metadata?.full_name || "Usuario"),
        email: row.email || authUser?.email || "",
      };
    }));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}
export async function POST(req: NextRequest) {
  try {
    enforceRequestSafety(req, 10);
    const { admin, member } = await context(req),
      { email, name, role } = await req.json();
    const safeName = cleanText(name, 120), safeRole = cleanText(role, 24).toLowerCase();
    if (!email || !safeName) throw new Error("Nombre y correo son obligatorios.");
    if (!["administrador", "gerente", "operacion", "lectura"].includes(safeRole)) throw new Error("Rol no permitido.");
    const siteUrl = canonicalSiteUrl;
    const normalizedEmail = cleanText(email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Correo electrónico inválido.");
    let { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${siteUrl}/?invite=1`,
      data: { full_name: safeName, restaurant_id: member.restaurant_id, role: safeRole },
    });
    let existingUser = false;
    if (error && /already been registered|already registered|already exists/i.test(error.message)) {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = listed.data?.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (!found) throw error;
      data = { user: found } as typeof data;
      error = null;
      existingUser = true;
      await admin.auth.admin.updateUserById(found.id, {
        user_metadata: { ...found.user_metadata, full_name: safeName, restaurant_id: member.restaurant_id, role: safeRole },
      });
      const recovery = await admin.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${siteUrl}/?invite=1`,
      });
      if (recovery.error) throw recovery.error;
    }
    if (error) {
      if (/rate|email|smtp/i.test(error.message))
        throw new Error(`Supabase no pudo enviar el correo: ${error.message}. Configure SMTP en Authentication > Email.`);
      throw error;
    }
    if (!data.user) throw new Error("Supabase no devolvió el usuario de la invitación.");
    const invitedUser = data.user;
    const memberResult = await admin.from("v2_members").upsert(
      {
        restaurant_id: member.restaurant_id,
        user_id: invitedUser.id,
        name: safeName,
        email: normalizedEmail,
        role: safeRole,
        status: "invitado",
        invited_at: new Date().toISOString(),
        last_invited_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,user_id" },
    );
    if (memberResult.error) throw memberResult.error;
    return NextResponse.json({ ok: true, email: invitedUser.email, existingUser });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
export async function PATCH(req: NextRequest) {
  try {
    enforceRequestSafety(req, 20);
    const { admin, member, user } = await context(req),
      { user_id, action, name, role } = await req.json();
    const { data: invited, error: lookupError } = await admin
      .from("v2_members")
      .select("user_id,name,email,role,status,last_invited_at")
      .eq("restaurant_id", member.restaurant_id)
      .eq("user_id", user_id)
      .single();
    if (lookupError || !invited) throw new Error("No se encontró la invitación.");
    const isAdminRole = (value: string) => ["administrador", "admin"].includes(value);
    const ensureAnotherAdmin = async () => {
      if (!isAdminRole(invited.role)) return;
      const { count, error } = await admin.from("v2_members")
        .select("user_id", { count: "exact", head: true })
        .eq("restaurant_id", member.restaurant_id)
        .eq("status", "activo")
        .in("role", ["administrador", "admin"])
        .neq("user_id", user_id);
      if (error) throw error;
      if (!count) throw new Error("Debe existir por lo menos otro administrador activo antes de quitar este acceso o cambiar su rol.");
    };
    if (action === "update_member") {
      const cleanName = String(name || "").trim();
      const cleanRole = String(role || "").trim().toLowerCase();
      if (!cleanName) throw new Error("El nombre es obligatorio.");
      if (!["administrador", "gerente", "operacion", "lectura"].includes(cleanRole))
        throw new Error("El rol seleccionado no es válido.");
      if (isAdminRole(invited.role) && !isAdminRole(cleanRole)) await ensureAnotherAdmin();
      const { error: updateError } = await admin.from("v2_members")
        .update({ name: cleanName, role: cleanRole })
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user_id);
      if (updateError) throw updateError;
      const authUser = await admin.auth.admin.getUserById(user_id);
      if (authUser.data.user)
        await admin.auth.admin.updateUserById(user_id, {
          user_metadata: { ...authUser.data.user.user_metadata, full_name: cleanName, role: cleanRole },
        });
      return NextResponse.json({ ok: true });
    }
    if (action === "toggle_status") {
      if (user_id === user.id) throw new Error("No puede desactivar su propio acceso.");
      if (invited.status !== "inactivo") await ensureAnotherAdmin();
      const nextStatus = invited.status === "inactivo" ? "activo" : "inactivo";
      const { error: statusError } = await admin.from("v2_members").update({ status: nextStatus })
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user_id);
      if (statusError) throw statusError;
      return NextResponse.json({ ok: true, status: nextStatus });
    }
    if (invited.status !== "invitado") throw new Error("Este usuario ya está activo.");
    if (invited.last_invited_at && Date.now() - new Date(invited.last_invited_at).getTime() < 60000)
      throw new Error("Espere 60 segundos antes de reenviar la invitación.");
    const siteUrl = canonicalSiteUrl;
    const { error } = await admin.auth.resetPasswordForEmail(invited.email, {
      redirectTo: `${siteUrl}/?invite=1`,
    });
    if (error) throw error;
    const now = new Date().toISOString();
    const { error: saveError } = await admin.from("v2_members").update({ last_invited_at: now })
      .eq("restaurant_id", member.restaurant_id).eq("user_id", invited.user_id);
    if (saveError) throw saveError;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
export async function DELETE(req: NextRequest) {
  try {
    enforceRequestSafety(req, 10);
    const { admin, member, user } = await context(req),
      { user_id } = await req.json();
    if (user_id === user.id)
      throw new Error("No puede eliminar su propio acceso.");
    const { data: target } = await admin.from("v2_members").select("role,status")
      .eq("restaurant_id", member.restaurant_id).eq("user_id", user_id).single();
    if (target && ["administrador", "admin"].includes(target.role) && target.status === "activo") {
      const { count } = await admin.from("v2_members")
        .select("user_id", { count: "exact", head: true })
        .eq("restaurant_id", member.restaurant_id).eq("status", "activo")
        .in("role", ["administrador", "admin"]).neq("user_id", user_id);
      if (!count) throw new Error("No puede eliminar al único administrador activo del negocio.");
    }
    const { error } = await admin
      .from("v2_members")
      .delete()
      .eq("restaurant_id", member.restaurant_id)
      .eq("user_id", user_id);
    if (error) throw error;
    const { count } = await admin.from("v2_members").select("user_id", { count: "exact", head: true }).eq("user_id", user_id);
    if (!count) {
      const deletion = await admin.auth.admin.deleteUser(user_id);
      if (deletion.error && !/not found/i.test(deletion.error.message)) throw deletion.error;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
