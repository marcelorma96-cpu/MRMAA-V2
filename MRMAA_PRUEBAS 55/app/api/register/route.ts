import { NextRequest, NextResponse } from "next/server";
import { BillingError, requestBody, serverClients, strictRateLimit } from "@/lib/billing-server";
import { isPlan, isBillingInterval, PUBLIC_SIGNUP_ENABLED } from "@/lib/plans";
import { siteOrigin } from "@/lib/site-origin";

export async function POST(req: NextRequest) {
  try {
    if (!PUBLIC_SIGNUP_ENABLED) throw new BillingError("El registro está temporalmente cerrado.", 403);
    const body = await requestBody(req);
    if (!isPlan(body.plan_code) || !isBillingInterval(body.billing_cycle) || !["es", "en"].includes(body.language) || !["GTQ", "USD", "MXN"].includes(body.currency))
      throw new BillingError("Revise el plan, idioma y moneda seleccionados.");
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128
      || !/[a-z]/.test(body.password) || !/[A-Z]/.test(body.password) || !/\d/.test(body.password) || !/[^A-Za-z0-9]/.test(body.password))
      throw new BillingError("Use 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.");
    if (body.accepted !== true) throw new BillingError("Debe aceptar los Términos y la Política de privacidad.");
    await strictRateLimit(req, "register", 5);
    const { admin, client } = serverClients();
    const { password, captchaToken, ...details } = body;
    // New public registrations always start the Advanced trial. Existing accounts and billing are untouched.
    const intent = await admin.rpc("v2_begin_registration", { p_data: { ...details, plan_code: "advanced", billing_cycle: "month" } });
    if (intent.error) {
      if (intent.error.code === "P0001" && /^El registro .* en curso\./.test(intent.error.message))
        throw new BillingError("Hay un intento de registro pendiente. Revise su correo. Si no recibe el enlace, espere dos minutos antes de reintentar.", 409, "REGISTRATION_IN_PROGRESS");
      throw new BillingError(intent.error.code === "P0001" ? intent.error.message : "No se pudo crear la cuenta. Revise sus datos e intente nuevamente.");
    }
    const result = await client.auth.signUp({
      email: String(body.email).trim().toLowerCase(), password,
      options: { emailRedirectTo: siteOrigin(new URL(req.url).origin), captchaToken: typeof captchaToken === "string" ? captchaToken : undefined,
        data: { registration_token: intent.data, full_name: String(body.full_name).trim(), language: body.language } },
    });
    if (result.error || !result.data.user) {
      // Keep the durable intent for a confirmation email already queued by Auth.
      throw new BillingError("No se pudo completar el registro. Revise su correo antes de volver a intentarlo.");
    }
    // Registration returns to sign-in. Do not install or expose an automatic session.
    return NextResponse.json({ ok: true, requiresEmailConfirmation: !result.data.session }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof BillingError ? error.message : "No se pudo crear la cuenta. Intente nuevamente.", code: error instanceof BillingError ? error.code : "REGISTRATION_FAILED" }, { status: error instanceof BillingError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
