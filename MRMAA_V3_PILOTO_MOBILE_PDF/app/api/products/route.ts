import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { permissionsFor } from "@/lib/permissions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const canonicalSiteUrl = "https://mrmaa.com";

function requestSafety(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 10_000)
    throw new Error("Solicitud inválida.");
  const origin = req.headers.get("origin");
  const ownOrigin = new URL(req.url).origin;
  if (origin && origin !== ownOrigin && origin !== canonicalSiteUrl)
    throw new Error("Solicitud inválida.");
}

async function context(req: NextRequest, restaurantId: string) {
  if (!url || !anon || !service) throw new Error("No fue posible guardar el producto.");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || !restaurantId) throw new Error("Su sesión no es válida.");
  const publicClient = createClient(url, anon, { auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const authResult = await publicClient.auth.getUser(token);
  if (authResult.error || !authResult.data.user) throw new Error("Su sesión no es válida.");
  const membership = await admin.from("v2_members").select("role,status")
    .eq("restaurant_id", restaurantId).eq("user_id", authResult.data.user.id).maybeSingle();
  if (membership.error || !permissionsFor(membership.data?.role, membership.data?.status).canManageQuoteProducts)
    throw new Error("Su acceso no permite administrar menús y productos.");
  return admin;
}

export async function POST(req: NextRequest) {
  try {
    requestSafety(req);
    const payload = await req.json();
    const restaurantId = String(payload.restaurant_id || "").trim();
    const productId = String(payload.id || "").trim();
    const name = String(payload.name || "").trim().slice(0, 160);
    const description = String(payload.description || "").trim().slice(0, 10_000);
    const price = Number(payload.price);
    if (!name) throw new Error("Ingrese el nombre del menú o producto.");
    if (!Number.isFinite(price) || price < 0 || price > 999_999_999)
      throw new Error("Ingrese un precio válido.");
    const admin = await context(req, restaurantId);
    const result = productId
      ? await admin.from("v2_quote_products").update({ name, description, price })
          .eq("id", productId).eq("restaurant_id", restaurantId).select("*").maybeSingle()
      : await admin.from("v2_quote_products").insert({ restaurant_id: restaurantId, name, description, price })
          .select("*").single();
    if (result.error) {
      if (result.error.code === "23505")
        throw new Error("Ya existe un menú o producto con ese nombre. Use Editar para modificarlo.");
      throw new Error("No fue posible guardar el menú o producto. Intente nuevamente.");
    }
    if (!result.data) throw new Error("No se encontró el menú o producto que desea editar.");
    return NextResponse.json({ product: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible guardar el menú o producto." },
      { status: 400 },
    );
  }
}
