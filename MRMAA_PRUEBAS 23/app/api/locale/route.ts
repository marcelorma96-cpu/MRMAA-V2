import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const spanish = new Set(["GT","MX","ES","AR","BO","CL","CO","CR","CU","DO","EC","SV","GQ","HN","NI","PA","PY","PE","PR","UY","VE"]);
  const language = country && /^[A-Z]{2}$/.test(country) ? (spanish.has(country) ? "es" : "en") : null;
  return NextResponse.json({ language }, { headers: { "Cache-Control": "private, no-store" } });
}
