import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import countriesEs from 'react-phone-number-input/locale/es.json';
import countriesEn from 'react-phone-number-input/locale/en.json';
import { BillingError, requestBody, serverClients } from '@/lib/billing-server';
import { GOOGLE_AUTH_ENABLED, hasGoogleIdentity, hasOAuthMethod } from '@/lib/google-auth';
import { PUBLIC_SIGNUP_ENABLED } from '@/lib/plans';
import { requireVerifiedMfa } from '@/lib/mfa';
import { GOOGLE_LEGAL_VERSION } from '@/lib/google-registration-intent';

type Country = keyof typeof countriesEn;
const validCountry = (value: string) => /^[A-Z]{2}$/.test(value) && value !== 'ZZ' && Object.hasOwn(countriesEn, value);
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function context(req: NextRequest) {
  if (!GOOGLE_AUTH_ENABLED) throw new BillingError('GOOGLE_DISABLED', 503);
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new BillingError('GOOGLE_SESSION', 401);
  const { admin, client } = serverClients(token);
  // A browser-supplied user id, email, restaurant id or provider is never trusted.
  const verified = await client.auth.getUser(token);
  const user = verified.data.user;
  if (verified.error || !user || !hasGoogleIdentity(user) || !hasOAuthMethod(token)) throw new BillingError('GOOGLE_SESSION', 401);
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  if (claims.sub !== user.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id || '')) throw new BillingError('GOOGLE_SESSION', 401);
  try { await requireVerifiedMfa(user, token); } catch { throw new BillingError('GOOGLE_SECURITY', 403); }
  return { admin, user, sessionId: claims.session_id as string };
}
function failure(error: unknown) {
  return reply({ code: error instanceof BillingError ? error.message : 'GOOGLE_UNAVAILABLE' }, error instanceof BillingError ? error.status : 503);
}
export async function GET(req: NextRequest) {
  try {
    const { admin, user, sessionId } = await context(req);
    const result = await admin.rpc('v2_google_registration_state', { p_user: user.id, p_session: sessionId });
    if (result.error || !['ready', 'needs_profile', 'blocked'].includes(result.data)) throw new Error('STATE');
    if (result.data === 'needs_profile' && !PUBLIC_SIGNUP_ENABLED) return reply({ state: 'closed' });
    return reply({ state: result.data });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await requestBody(req);
    const { admin, user, sessionId } = await context(req);
    if (!PUBLIC_SIGNUP_ENABLED) throw new BillingError('GOOGLE_CLOSED', 403);
    const country = typeof body.country === 'string' ? body.country as Country : null;
    if (body.accepted !== true || body.legal_version !== GOOGLE_LEGAL_VERSION
      || (body.country != null && (!country || !validCountry(country)))
      || !['es', 'en'].includes(body.language) || !['GTQ', 'USD', 'MXN'].includes(body.currency)) throw new BillingError('GOOGLE_INPUT');
    const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
    const fullName = typeof metadataName === 'string' && metadataName.trim().length >= 2
      ? metadataName.trim().slice(0, 120) : (body.language === 'en' ? 'Administrator' : 'Administrador');
    const rate = await admin.rpc('v2_take_rate_limit', { p_bucket: 'google-register', p_subject_hash: createHash('sha256').update(user.id).digest('hex'), p_limit: 5, p_window_seconds: 60 });
    if (rate.error) throw new Error('RATE');
    if (rate.data !== true) throw new BillingError('GOOGLE_RATE', 429);
    const result = await admin.rpc('v2_google_start_trial', { p_user: user.id, p_session: sessionId, p_data: {
      full_name: fullName, legal_version: GOOGLE_LEGAL_VERSION,
      country: country ? (body.language === 'en' ? countriesEn : countriesEs)[country] : '',
      language: body.language, currency: body.currency, accepted: true,
    }});
    if (result.error) {
      if (result.error.message === 'GOOGLE_ACCESS') throw new BillingError('GOOGLE_ACCESS', 403);
      throw new Error('REGISTRATION');
    }
    if (!result.data?.restaurant_id) throw new Error('REGISTRATION');
    return reply({ ok: true, created: result.data.created === true });
  } catch (error) { return failure(error); }
}
