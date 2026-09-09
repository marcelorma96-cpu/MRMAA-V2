import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    const { admin, member } = await context(req);
    const { data, error } = await admin
      .from("v2_members")
      .select("user_id,name,email,role,status")
      .eq("restaurant_id", member.restaurant_id)
      .order("name");
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const { admin, member } = await context(req),
      { email, name, role, origin } = await req.json();
    if (!email || !name) throw new Error("Nombre y correo son obligatorios.");
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin || "").replace(/\/$/, "");
    if (!siteUrl) throw new Error("Falta NEXT_PUBLIC_SITE_URL en Vercel.");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      redirectTo: `${siteUrl}/?invite=1`,
      data: { full_name: name, restaurant_id: member.restaurant_id, role },
    });
    if (error) {
      if (/rate|email|smtp/i.test(error.message))
        throw new Error(`Supabase no pudo enviar el correo: ${error.message}. Configure SMTP en Authentication > Email.`);
      throw error;
    }
    const memberResult = await admin.from("v2_members").upsert(
      {
        restaurant_id: member.restaurant_id,
        user_id: data.user.id,
        name,
        email,
        role,
        status: "invitado",
      },
      { onConflict: "restaurant_id,user_id" },
    );
    if (memberResult.error) throw memberResult.error;
    return NextResponse.json({ ok: true, email: data.user.email });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const { admin, member, user } = await context(req),
      { user_id } = await req.json();
    if (user_id === user.id)
      throw new Error("No puede eliminar su propio acceso.");
    const { error } = await admin
      .from("v2_members")
      .delete()
      .eq("restaurant_id", member.restaurant_id)
      .eq("user_id", user_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
