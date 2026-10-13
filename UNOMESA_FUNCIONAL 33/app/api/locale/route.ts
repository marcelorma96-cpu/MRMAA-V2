import { NextRequest, NextResponse } from "next/server";
import { publicLocale } from "@/lib/public-locale";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const locale = publicLocale(request.headers.get("x-vercel-ip-country"));
  return NextResponse.json(locale, { headers: { "Cache-Control": "private, no-store" } });
}
