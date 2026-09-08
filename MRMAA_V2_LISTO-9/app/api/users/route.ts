import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function context(req: NextRequest) {
  if (!url || !anon || !service)
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.");
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
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/?invite=1`,
      data: { full_name: name, restaurant_id: member.restaurant_id, role },
    });
    if (error) throw error;
    await admin
      .from("v2_members")
      .upsert(
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
    return NextResponse.json({ ok: true });
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
