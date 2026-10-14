import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serverClients } from "@/lib/billing-server";
import { GOOGLE_AUTH_ENABLED, hasGoogleIdentity, hasOAuthMethod } from "@/lib/google-auth";
import { requireVerifiedMfa } from "@/lib/mfa";
import { passwordAction, passwordIsStrong, PASSWORD_MAX_LENGTH } from "@/lib/password-settings";
import { readBoundedJson, RequestSafetyError } from "@/lib/server-scale";
import { siteOrigin } from "@/lib/site-origin";

export const runtime = "nodejs";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
class PasswordError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
async function context(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new PasswordError("PASSWORD_AUTH", 401);
  const { admin, client } = serverClients(token);
  const verified = await client.auth.getUser(token);
  const user = verified.data.user;
  if (verified.error || !user?.email || !user.email_confirmed_at || user.is_anonymous)
    throw new PasswordError("PASSWORD_AUTH", 401);
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  if (claims.sub !== user.id || !claims.session_id) throw new PasswordError("PASSWORD_AUTH", 401);
  const alive = await client.rpc("v2_session_alive");
  if (alive.error || alive.data !== true) throw new PasswordError("PASSWORD_AUTH", 401);
  try { await requireVerifiedMfa(user, token); }
  catch { throw new PasswordError("PASSWORD_MFA", 403); }
  const passwordLogin = Array.isArray(claims.amr) && claims.amr.some((x: { method?: string }) => x.method === "password");
  if (!passwordLogin) {
    if (!GOOGLE_AUTH_ENABLED || !hasGoogleIdentity(user) || !hasOAuthMethod(token))
      throw new PasswordError("PASSWORD_AUTH", 401);
    const support = await client.rpc("v2_is_support_agent");
    if (support.error || support.data !== false) throw new PasswordError("PASSWORD_AUTH", 401);
  }
  return { admin, user, token, passwordLogin };
}
function failed(error: unknown) {
  if (error instanceof PasswordError) return reply({ error: error.code }, error.status);
  if (error instanceof RequestSafetyError) return reply({ error: "PASSWORD_INPUT" }, error.status);
  // Do not expose or log submitted credentials, Auth responses or provider details.
  return reply({ error: "PASSWORD_UNAVAILABLE" }, 503);
}
export async function GET(req: NextRequest) {
  try {
    const { user, passwordLogin } = await context(req);
    return reply({ email: user.email, mode: passwordAction(user, passwordLogin), google: hasGoogleIdentity(user) });
  } catch (error) { return failed(error); }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && ![new URL(req.url).origin, siteOrigin(new URL(req.url).origin)].includes(origin))
      throw new PasswordError("PASSWORD_AUTH", 403);
    const body = await readBoundedJson(req, 4096);
    const { admin, user, token } = await context(req);
    if (!Object.keys(body).every(key => ["action", "password", "confirmation", "current_password", "nonce"].includes(key)))
      throw new PasswordError("PASSWORD_INPUT");
    if (!["update", "reauthenticate"].includes(body.action)) throw new PasswordError("PASSWORD_INPUT");
    if (body.action === "update") {
      if (typeof body.password !== "string" || !passwordIsStrong(body.password)) throw new PasswordError("PASSWORD_WEAK");
      if (body.password !== body.confirmation) throw new PasswordError("PASSWORD_MISMATCH");
      if (body.current_password !== undefined && (typeof body.current_password !== "string" || body.current_password.length > PASSWORD_MAX_LENGTH))
        throw new PasswordError("PASSWORD_INPUT");
      if (body.nonce !== undefined && (typeof body.nonce !== "string" || !/^[a-zA-Z0-9]{1,128}$/.test(body.nonce)))
        throw new PasswordError("PASSWORD_INPUT");
    }
    const rate = await admin.rpc("v2_take_rate_limit", { p_bucket: "account-password", p_subject_hash: createHash("sha256").update(user.id).digest("hex"), p_limit: 6, p_window_seconds: 60 });
    if (rate.error) throw new PasswordError("PASSWORD_UNAVAILABLE", 503);
    if (rate.data !== true) throw new PasswordError("PASSWORD_RATE", 429);
    const updating = body.action === "update";
    // Use the user's Auth endpoint, never an admin password reset. This preserves
    // Supabase's current-password, reauthentication, MFA and password policies.
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/${updating ? "user" : "reauthenticate"}`, {
      method: updating ? "PUT" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(updating ? { body: JSON.stringify({ password: body.password, data: { unomesa_password_set: true },
        ...(body.current_password ? { current_password: body.current_password } : {}), ...(body.nonce ? { nonce: body.nonce } : {}) }) } : {}),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const codes: Record<string, string> = {
        current_password_required: "PASSWORD_CURRENT", current_password_mismatch: "PASSWORD_CURRENT_INVALID",
        reauthentication_needed: "PASSWORD_REAUTH", reauthentication_not_valid: "PASSWORD_CODE_INVALID",
        same_password: "PASSWORD_SAME", weak_password: "PASSWORD_WEAK", insufficient_aal: "PASSWORD_MFA",
        session_not_found: "PASSWORD_AUTH", bad_jwt: "PASSWORD_AUTH", user_banned: "PASSWORD_AUTH",
        over_request_rate_limit: "PASSWORD_RATE", over_email_send_rate_limit: "PASSWORD_RATE",
      };
      throw new PasswordError(codes[result.error_code || result.code] || (response.status === 429 ? "PASSWORD_RATE" : "PASSWORD_UNAVAILABLE"), response.status);
    }
    return reply(updating ? { ok: true, mode: "change" } : { sent: true });
  } catch (error) { return failed(error); }
}
