const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const uid = '11111111-1111-4111-8111-111111111111', sid = '22222222-2222-4222-8222-222222222222';
const baseClaims = { sub: uid, session_id: sid, amr: [{ method: 'oauth' }] };
const tokenFor = claims => 'x.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.x';
const strong = 'New-Test-Password-26!';
function harness() {
  const state = { allowed: true, alive: true, rate: true, support: false, accepted: true, fetches: [], rates: [],
    providerError: null, password: null, requireCurrent: false, requireCode: false,
    user: { id: uid, email: 'owner@example.test', email_confirmed_at: '2026-09-30', identities: [{ provider: 'google' }], app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Existing Name' } } };
  const client = { auth: { getUser: async () => ({ data: { user: state.accepted ? state.user : null }, error: state.accepted ? null : Error('invalid') }) },
    rpc: async name => {
      assert.ok(['v2_session_alive', 'v2_mfa_session_allowed', 'v2_is_support_agent'].includes(name));
      return { data: name === 'v2_session_alive' ? state.alive : name === 'v2_is_support_agent' ? state.support : state.allowed, error: null };
    } };
  const admin = { rpc: async (name, args) => { assert.equal(name, 'v2_take_rate_limit'); state.rates.push(args); return { data: state.rate, error: null }; } };
  const mockedFetch = async (url, options) => {
    const claims = JSON.parse(Buffer.from(options.headers.Authorization.slice(7).split('.')[1], 'base64url'));
    assert.equal(claims.sub, uid); assert.equal(options.headers.apikey, 'public-test');
    assert.equal(options.cache, 'no-store');
    state.fetches.push({ url, options });
    if (state.providerError) return Response.json({ error_code: state.providerError, message: 'PRIVATE PROVIDER DETAILS' }, { status: 400 });
    if (url.endsWith('/reauthenticate')) { assert.equal(options.method, 'GET'); return Response.json({}); }
    assert.equal(url, 'https://auth.example.test/auth/v1/user'); assert.equal(options.method, 'PUT');
    const data = JSON.parse(options.body);
    assert.ok(Object.keys(data).every(key => ['password', 'data', 'nonce', 'current_password'].includes(key)));
    if (state.requireCurrent && state.password && data.current_password !== state.password)
      return Response.json({ error_code: data.current_password ? 'current_password_mismatch' : 'current_password_required' }, { status: 400 });
    if (state.requireCode && data.nonce !== '123456') return Response.json({ error_code: 'reauthentication_needed' }, { status: 400 });
    state.password = data.password;
    state.user.user_metadata = { ...state.user.user_metadata, ...data.data };
    return Response.json(state.user);
  };
  const overrides = {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/billing-server': { serverClients: () => ({ client, admin }) },
    '@supabase/supabase-js': { createClient: () => client },
    '@/lib/site-origin': { siteOrigin: () => 'https://unomesa.test' },
  };
  const root = process.cwd(), cache = {};
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache[file]) return cache[file].exports;
    const m = { exports: {} }; cache[file] = m;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const req = name => name in overrides ? overrides[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name);
    vm.runInNewContext(source, { module: m, exports: m.exports, require: req, Buffer, URL, atob, TextEncoder, TextDecoder, AbortSignal, fetch: mockedFetch,
      process: { env: { NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test' } } });
    return m.exports;
  }
  const api = load('app/api/security/password/route.ts');
  function request(body, { claims = baseClaims, origin = 'https://unomesa.test', anonymous = false } = {}) {
    return new Request('https://unomesa.test/api/security/password', { method: body ? 'POST' : 'GET',
      headers: { origin, ...(anonymous ? {} : { authorization: 'Bearer ' + tokenFor(claims) }), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const update = (extra = {}, options) => api.POST(request({ action: 'update', password: strong, confirmation: strong, ...extra }, options));
  return { state, api, request, update };
}

test('Google can create a password for the same account; metadata and identity are retained, label survives reload', async () => {
  const { state, api, request, update } = harness();
  assert.equal((await (await api.GET(request())).json()).mode, 'create');
  const reply = await update(); assert.equal(reply.status, 200); assert.equal(reply.headers.get('cache-control'), 'private, no-store');
  assert.equal(state.password, strong); assert.equal(state.user.id, uid); assert.equal(state.user.user_metadata.full_name, 'Existing Name');
  assert.equal(state.user.identities[0].provider, 'google');
  assert.equal((await (await api.GET(request())).json()).mode, 'change');
  assert.equal(state.fetches.length, 1); assert.equal(state.rates[0].p_limit, 6);
});
test('matching passwords and strength are checked on the server; target user and unrelated fields are rejected', async () => {
  const { state, update } = harness();
  for (const [extra, code] of [
    [{ confirmation: 'different' }, 'PASSWORD_MISMATCH'], [{ password: 'short', confirmation: 'short' }, 'PASSWORD_WEAK'],
    [{ password: 'A'.repeat(129), confirmation: 'A'.repeat(129) }, 'PASSWORD_WEAK'],
    [{ user_id: 'someone-else' }, 'PASSWORD_INPUT'], [{ email: 'someone@example.test' }, 'PASSWORD_INPUT'],
    [{ app_metadata: { role: 'admin' } }, 'PASSWORD_INPUT'],
  ]) { const response = await update(extra); assert.equal(response.status, 400); assert.equal((await response.json()).error, code); }
  assert.equal(state.fetches.length, 0); assert.equal(state.password, null);
});
test('anonymous, invalid, revoked, unverified MFA, recovery and support OAuth cannot update credentials', async () => {
  for (const configure of [
    h => { h.state.accepted = false; }, h => { h.state.alive = false; }, h => { h.state.allowed = false; },
    h => { h.state.support = true; }, h => { h.state.user.email_confirmed_at = null; },
  ]) { const h = harness(); configure(h); assert.ok((await h.update()).status >= 400); assert.equal(h.state.fetches.length, 0); }
  const { state, update } = harness();
  for (const options of [{ anonymous: true }, { origin: 'https://attacker.test' }, { claims: { ...baseClaims, sub: 'other-user' } }, { claims: { ...baseClaims, amr: [{ method: 'recovery' }] } }])
    assert.ok((await update({}, options)).status >= 400);
  assert.equal(state.fetches.length, 0);
});
test('provider current-password and reauthentication checks are honored, never bypassed with an admin update', async () => {
  const { state, api, request, update } = harness();
  state.password = 'Existing-Test-Password-26!'; state.requireCurrent = true; state.requireCode = true;
  const old = state.password;
  assert.equal((await (await update()).json()).error, 'PASSWORD_CURRENT'); assert.equal(state.password, old);
  assert.equal((await (await update({ current_password: 'wrong' })).json()).error, 'PASSWORD_CURRENT_INVALID'); assert.equal(state.password, old);
  assert.equal((await (await update({ current_password: old })).json()).error, 'PASSWORD_REAUTH');
  assert.equal((await api.POST(request({ action: 'reauthenticate' }))).status, 200);
  assert.equal((await update({ current_password: old, nonce: '123456' })).status, 200);
  assert.equal(state.password, strong);
});
test('rate limits and provider failures never report success or disclose provider details', async () => {
  const { state, update } = harness(); state.rate = false;
  assert.equal((await update()).status, 429); assert.equal(state.fetches.length, 0);
  state.rate = true; state.providerError = 'unknown';
  const response = await update(); assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'PASSWORD_UNAVAILABLE' }); assert.equal(state.password, null);
});
test('existing email accounts and Google accounts with an email identity use change-password mode', async () => {
  const { state, api, request } = harness();
  state.user.identities.push({ provider: 'email' });
  assert.equal((await (await api.GET(request())).json()).mode, 'change');
  state.user.identities = [{ provider: 'email' }];
  const claims = { ...baseClaims, amr: [{ method: 'password' }] };
  assert.equal((await (await api.GET(request(undefined, { claims }))).json()).mode, 'change');
});
