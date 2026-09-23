import { NextRequest } from "next/server";
import { dispatchBillingWebhook } from "@/lib/billing-provider";
export const runtime = "nodejs";
export async function POST(req: NextRequest) { return dispatchBillingWebhook(req); }
