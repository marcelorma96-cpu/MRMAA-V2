import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  const spanish = new Set(["GT","MX","ES","AR","BO","CL","CO","CR","CU","DO","EC","SV","GQ","HN","NI","PA","PY","PE","PR","UY","VE"]);
  // English is the fallback when the country is absent or unavailable.
  const language = country && /^[A-Z]{2}$/.test(country) ? (spanish.has(country) ? "es" : "en") : "en";
  return NextResponse.json({ language }, { headers: { "Cache-Control": "private, no-store" } });
}
