import { NextRequest, NextResponse } from "next/server";
import { permissionsFor } from "@/lib/permissions";
import { createClient, type User } from "@supabase/supabase-js";
import { emailLanguage, isEmailLanguage } from "@/lib/email-language";
import { takeDistributedRateLimit } from "@/lib/server-scale";
import { createHash, randomUUID } from "node:crypto";

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
const invitationHash = (value: string) => createHash("sha256").update(value).digest("hex");
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
  const { data: member, error: membershipError } = await admin
    .from("v2_members")
    .select("restaurant_id,role,status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !member || !permissionsFor(member.role, member.status).isAdmin)
    throw new Error("Solo el administrador puede gestionar usuarios.");
  return { admin, member, user };
}
export async function GET(req: NextRequest) {
  try {
    enforceRequestSafety(req, 60);
    const { admin, member } = await context(req);
    await takeDistributedRateLimit(admin, req, "users:get", 60);
    const { data, error } = await admin
      .from("v2_members")
      .select("user_id,name,email,role,status,invited_at,last_invited_at")
      .eq("restaurant_id", member.restaurant_id)
      .order("name");
    if (error) throw error;
    const restaurant = await admin.from("v2_restaurants").select("owner_id")
      .eq("id", member.restaurant_id).single();
    // Fetch only this restaurant's members; language must not depend on the
    // first page of the project's global user list.
    const byId = new Map<string, User>();
    for (let offset = 0; offset < (data || []).length; offset += 20) {
      const results = await Promise.all((data || []).slice(offset, offset + 20).map(async (row) => {
        const result = await admin.auth.admin.getUserById(row.user_id);
        if (result.error) throw result.error;
        return result.data.user;
      }));
      for (const authUser of results) if (authUser) byId.set(authUser.id, authUser);
    }
    return NextResponse.json((data || []).map((row) => {
      const authUser = byId.get(row.user_id);
      return {
        ...row,
        name: row.name || String(authUser?.user_metadata?.full_name || "Usuario"),
        email: row.email || authUser?.email || "",
        is_owner: row.user_id === restaurant.data?.owner_id,
        language: emailLanguage(authUser?.user_metadata?.language),
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
      { email, name, role, language } = await req.json();
    await takeDistributedRateLimit(admin, req, "users:invite", 10);
    const safeName = cleanText(name, 120), safeRole = cleanText(role, 24).toLowerCase();
    if (!email || !safeName) throw new Error("Nombre y correo son obligatorios.");
    if (!["administrador", "gerente", "operacion", "lectura"].includes(safeRole)) throw new Error("Rol no permitido.");
    const siteUrl = canonicalSiteUrl;
    const normalizedEmail = cleanText(email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Correo electrónico inválido.");
    if (language !== undefined && !isEmailLanguage(language))
      throw new Error("El idioma seleccionado no es válido.");
    const restaurant = await admin.from("v2_restaurants").select("language,owner_id")
      .eq("id", member.restaurant_id).single();
    if (restaurant.error) throw restaurant.error;
    const selectedLanguage = language ?? emailLanguage(restaurant.data.language);
    const invitationToken = randomUUID();
    let { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${siteUrl}/?invite=1&invitation=${encodeURIComponent(invitationToken)}`,
      data: { full_name: safeName, restaurant_id: member.restaurant_id, role: safeRole, language: selectedLanguage },
    });
    let existingUser = false;
    if (error && /already been registered|already registered|already exists/i.test(error.message)) {
      // An existing account may only be updated or re-invited through its
      // membership in this restaurant, never by a global email lookup.
      const existing = await admin.from("v2_members").select("user_id,status")
        .eq("restaurant_id", member.restaurant_id).eq("email", normalizedEmail).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) throw new Error("No se pudo crear esta invitación. Revise el correo o contacte a soporte.");
      if (existing.data.user_id === restaurant.data.owner_id || existing.data.status !== "invitado")
        throw new Error("Este usuario ya tiene acceso. Use Editar para actualizar sus datos.");
      const foundResult = await admin.auth.admin.getUserById(existing.data.user_id);
      if (foundResult.error || !foundResult.data.user) throw new Error("No se encontró el usuario de la invitación.");
      const found = foundResult.data.user;
      data = { user: found } as typeof data;
      error = null;
      existingUser = true;
      const preference = await admin.auth.admin.updateUserById(found.id, {
        user_metadata: { full_name: safeName, restaurant_id: member.restaurant_id, role: safeRole, language: selectedLanguage },
      });
      if (preference.error) throw preference.error;
      const recovery = await admin.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${siteUrl}/?invite=1&invitation=${encodeURIComponent(invitationToken)}`,
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
        invite_token_hash: invitationHash(invitationToken),
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
      { user_id, action, name, role, language } = await req.json();
    await takeDistributedRateLimit(admin, req, "users:update", 20);
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
      if (language !== undefined && !isEmailLanguage(language))
        throw new Error("El idioma seleccionado no es válido.");
      const cleanName = String(name || "").trim();
      const cleanRole = String(role || "").trim().toLowerCase();
      if (!cleanName) throw new Error("El nombre es obligatorio.");
      if (!["administrador", "gerente", "operacion", "lectura"].includes(cleanRole))
        throw new Error("El rol seleccionado no es válido.");
      const restaurant = await admin.from("v2_restaurants").select("owner_id")
        .eq("id", member.restaurant_id).single();
      if (restaurant.error) throw restaurant.error;
      if (restaurant.data?.owner_id === user_id && !isAdminRole(cleanRole))
        throw new Error("El rol del administrador principal solo puede cambiarse mediante Transferir administración.");
      if (isAdminRole(invited.role) && !isAdminRole(cleanRole)) await ensureAnotherAdmin();
      const { error: updateError } = await admin.from("v2_members")
        .update({ name: cleanName, role: cleanRole })
        .eq("restaurant_id", member.restaurant_id).eq("user_id", user_id);
      if (updateError) throw updateError;
      const preference = await admin.auth.admin.updateUserById(user_id, {
        user_metadata: { full_name: cleanName, role: cleanRole, ...(language !== undefined && { language }) },
      });
      if (preference.error) throw new Error("Se guardaron los datos del usuario, pero no su preferencia de correo. Intente guardar nuevamente.");
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
    const authLookup = await admin.auth.admin.getUserById(invited.user_id);
    if (authLookup.error || !authLookup.data.user)
      throw new Error("No se encontró el usuario de la invitación.");
    const storedLanguage = authLookup.data.user.user_metadata?.language;
    const safeLanguage = emailLanguage(storedLanguage);
    if (storedLanguage !== safeLanguage) {
      const normalized = await admin.auth.admin.updateUserById(invited.user_id, {
        user_metadata: { ...authLookup.data.user.user_metadata, language: safeLanguage },
      });
      if (normalized.error) throw normalized.error;
    }
    const invitationToken = randomUUID();
    const { error } = await admin.auth.resetPasswordForEmail(invited.email, {
      redirectTo: `${siteUrl}/?invite=1&invitation=${encodeURIComponent(invitationToken)}`,
    });
    if (error) throw error;
    const now = new Date().toISOString();
    const { error: saveError } = await admin.from("v2_members").update({
      last_invited_at: now,
      invite_token_hash: invitationHash(invitationToken),
    })
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
