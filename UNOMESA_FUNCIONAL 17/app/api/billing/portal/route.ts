import { NextRequest } from "next/server";
import { dispatchBilling } from "@/lib/billing-provider";
export const runtime = "nodejs";
export async function POST(req: NextRequest) { return dispatchBilling("portal", req); }
