const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

// Execute the real gate, logout controller and MFA reader. Only hooks, the
// browser surface and Supabase I/O are simulated; no real account is accessed.
function harness({ allowed = true, anonymous = false, recovery = false, app = false } = {}) {
  const sourceRoot = process.env.UNOMESA_AUTH_TEST_ROOT || process.cwd();
  const listeners = new Map(), authListeners = new Set(), storage = new Map();
  const timers = new Map(), timerDelays = new Map(), diagnostics = []; let nextTimer = 0;
  const session = { user: { id: 'test-user' }, access_token: 'x.' + Buffer.from(JSON.stringify({ session_id: 'test-session' })).toString('base64url') + '.x' };
  const state = {
    session: anonymous ? null : session, allowed, alive: true, reads: 0, mfaCalls: 0, closes: 0, signOuts: 0,
    heldMfa: null, holdMfa: false, holdTouch: false, heldTouch: null, revoke: null, authEnd: null,
    remembered: 0, rememberAllowed: true, authError: null, sessionError: null, forcedLocation: null,
    touchError: null, touchStatus: 200, mfaError: null, mfaStatus: 200, rememberError: null, rememberStatus: 200,
  };
  const target = prefix => ({
    addEventListener(name, fn) { const key = prefix + name; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); },
    removeEventListener(name, fn) { listeners.get(prefix + name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of [...(listeners.get(prefix + event.type) || [])]) fn(event); },
  });
  const sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  const location = {
    href: 'https://unomesa.com/' + (recovery ? '?reset=1' : ''), pathname: '/',
    search: recovery ? '?reset=1' : '', hash: '',
    replace(value) { state.forcedLocation = value; },
  };
  const window = { ...target('window:'), location, sessionStorage,
    history: { replaceState(_a, _b, value) { const url = new URL(value, location.href); Object.assign(location, { href: url.href, pathname: url.pathname, search: url.search, hash: url.hash }); } },
  };
  const emitAuth = (event, next = state.session) => { for (const fn of [...authListeners]) fn(event, next); };
  const client = {
    auth: {
      getSession: async () => { state.reads++; return { data: { session: state.session }, error: state.sessionError }; },
      onAuthStateChange(fn) { authListeners.add(fn); return { data: { subscription: { unsubscribe: () => authListeners.delete(fn) } } }; },
      async signOut() {
        state.signOuts++; state.authEnd = deferred();
        await state.authEnd.promise;
        if (state.authError) return { error: state.authError };
        state.session = null; emitAuth('SIGNED_OUT', null);
        return { error: null };
      },
    },
    rpc(name) {
      const result = (async () => {
      if (name === 'v2_session_remember_device') { state.remembered++; return {data:state.rememberAllowed,error:state.rememberError,status:state.rememberStatus}; }
      if (name === 'v2_session_close') { state.closes++; state.revoke = deferred(); return state.revoke.promise; }
      if (name === 'v2_session_touch_active') {
        if (state.holdTouch) { state.holdTouch = false; state.heldTouch = deferred(); return state.heldTouch.promise; }
        return { data: state.alive, error: state.touchError, status: state.touchStatus };
      }
      if (name === 'v2_mfa_session_allowed') {
        state.mfaCalls++;
        if (state.holdMfa) { state.holdMfa = false; state.heldMfa = deferred(); return state.heldMfa.promise; }
        return { data: state.allowed, error: state.mfaError, status: state.mfaStatus };
      }
      throw Error('Unexpected RPC: ' + name);
      })();
      // Deliberately allow late I/O to finish: the real gate must ignore it.
      result.abortSignal = () => result;
      return result;
    },
  };
  const slots = [], effects = [], renders = [];
  let cursor = 0, scheduled = false, disposed = false, component, output;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  function schedule() {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; if (!disposed) render(); });
  }
  const react = {
    Fragment: 'fragment',
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) { slots[i].value = next; schedule(); } }];
    },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const jsx = (type, props) => ({ type, props });
  const appMode = { isAppMode:()=>app, accountEntryPath:()=>app?'/mobile?login=1':'/?login=1', APP_IDLE_LIMIT:2592000000, sessionActivityStorage:()=>sessionStorage };
  const modules = {
    './reservation-revalidation': { fetchFreshReservationRows: () => {throw Error('unexpected reservation read')} },
    './app-launch': { AccessLoading() {} },
    './session-connection-dialog': { SessionConnectionDialog() {} },
    './app-mode':appMode, '@/lib/app-mode':appMode,
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { ShieldCheck() {} },
    '@supabase/supabase-js': { createClient: () => client },
    '@/components/security-center': { SessionManager() {} },
    '@/components/app-preferences': { useAppPreferences: () => ({ language: 'es' }) },
  };
  const context = {
    window, document: { ...target('document:'), visibilityState: 'visible' }, sessionStorage,
    navigator: { userAgent: 'Test browser', maxTouchPoints: 0, onLine: true },
    AbortController, console: { warn: (...args) => diagnostics.push(args) },
    Event: class { constructor(type) { this.type = type; } },
    URL, URLSearchParams, Set, Date, Promise,
    process: { env: {} }, atob: value => Buffer.from(value, 'base64').toString(),
    setTimeout(fn, delay = 0) { const id = ++nextTimer; timers.set(id, fn); timerDelays.set(id, delay); if (delay === 0) queueMicrotask(() => { const run = timers.get(id); timers.delete(id); run?.(); }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => ++nextTimer, clearInterval: () => {},
    require: name => { if (!(name in modules)) throw Error('Unexpected import: ' + name); return modules[name]; },
  };
  for (const file of ['lib/launch-session.ts','lib/session-control.ts', 'lib/session-activity.ts', 'lib/supabase.ts', 'lib/mfa.ts', 'lib/session-verification.ts', 'components/mfa-settings.tsx']) {
    context.exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext('(function(exports, require){' + code + '})(exports, require)', context);
    modules['@/' + file.replace(/\.tsx?$/, '')] = context.exports;
  }
  component = modules['@/components/mfa-settings'].MfaSessionGate;
  function text(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (Array.isArray(node)) {
      const modal = node.find(child => child?.type?.name === 'SessionConnectionDialog');
      return modal ? text(modal.props.children) : node.map(text).filter(Boolean).join(' ');
    }
    if (typeof node.type === 'function') return node.type.name;
    return text(node.props?.children);
  }
  function render() {
    cursor = 0;
    output = component({ children: 'CONTENT' });
    renders.push(text(output));
    while (effects.length) effects.shift()();
  }
  render();
  return {
    state, renders, window, modules, diagnostics,
    delays: () => [...timers.keys()].map(id => timerDelays.get(id)),
    fireTimer(delay) { const id = [...timers.keys()].find(id => timerDelays.get(id) === delay); assert.ok(id, `Missing timer ${delay}`); const run = timers.get(id); timers.delete(id); run(); },
    connection(online) { context.navigator.onLine = online; window.dispatchEvent({ type: online ? "online" : "offline" }); },
    visibility(value) { context.document.visibilityState = value; context.document.dispatchEvent({ type: "visibilitychange" }); },
    label: () => text(output),
    focus: () => window.dispatchEvent({ type: 'focus' }), emitAuth,
    logout: () => modules['@/lib/supabase'].signOutCurrentSession(),
    async finishLogout() { state.revoke.resolve({ data: true }); await flush(); state.authEnd.resolve(); await flush(); },
    dispose() { disposed = true; for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('late MFA denial during logout cannot flash a challenge; repeated logout shares one request', async () => {
  const h = harness(); await flush();
  assert.equal(h.label(), 'CONTENT');
  h.state.holdMfa = true; h.focus(); await flush();
  assert.ok(h.state.heldMfa);
  const start = h.renders.length;
  const first = h.logout(); const second = h.logout();
  assert.equal(first, second);
  await flush();
  h.state.heldMfa.resolve({ data: false, error: null }); await flush();
  assert.equal(h.label().trim(), 'Cerrando sesión…');
  assert.equal(h.state.closes, 1);
  assert.ok(!h.renders.slice(start).includes('MfaChallenge'));
  const reads = h.state.reads;
  h.focus(); h.emitAuth('TOKEN_REFRESHED'); await flush();
  assert.equal(h.state.reads, reads);
  await h.finishLogout(); await first;
  assert.equal(h.label(), 'CONTENT');
  assert.equal(h.window.location.search, '?login=1');
  assert.equal(h.modules['@/lib/supabase'].isSigningOut(), false);
  h.dispose();
});

test('late security errors during logout do not replace the closing screen', async () => {
  const h = harness(); await flush();
  h.state.holdMfa = true; h.focus(); await flush();
  const closing = h.logout(); await flush();
  h.state.heldMfa.reject(Error('network')); await flush();
  assert.equal(h.label().trim(), 'Cerrando sesión…');
  await h.finishLogout(); await closing;
  h.dispose();
});

test('genuine MFA remains required and opens access only after successful verification', async () => {
  const h = harness({ allowed: false }); await flush();
  assert.equal(h.label(), 'MfaChallenge');
  assert.ok(!h.renders.includes('CONTENT'));
  h.state.allowed = true; h.focus(); await flush();
  assert.equal(h.label(), 'CONTENT');
  h.dispose();
});

test('new sign-in starts security checks; an old denial cannot overwrite a newer successful check', async () => {
  const h = harness(); await flush();
  h.state.holdMfa = true; h.focus(); await flush();
  h.focus(); await flush();
  h.state.heldMfa.resolve({ data: false }); await flush();
  assert.equal(h.label(), 'CONTENT');
  h.emitAuth('SIGNED_OUT', null); await flush();
  h.state.allowed = false; h.emitAuth('SIGNED_IN'); await flush();
  assert.equal(h.label(), 'MfaChallenge');
  h.dispose();
});

test('anonymous and password recovery routes preserve their existing behavior', async () => {
  const publicPage = harness({ anonymous: true }); await flush();
  assert.equal(publicPage.label(), 'CONTENT');
  assert.equal(publicPage.state.mfaCalls, 0);
  publicPage.dispose();
  const recovery = harness({ allowed: false, recovery: true }); await flush();
  assert.equal(recovery.label(), 'CONTENT');
  const closing = recovery.logout(); await flush();
  assert.equal(recovery.label().trim(), 'Cerrando sesión…');
  await recovery.finishLogout(); await closing;
  recovery.dispose();
});

test('logout from MFA and server-revoked sessions both reach sign-in without reopening the challenge', async () => {
  const challenge = harness({ allowed: false }); await flush();
  assert.equal(challenge.label(), 'MfaChallenge');
  const closing = challenge.logout(); await flush();
  assert.equal(challenge.label().trim(), 'Cerrando sesión…');
  await challenge.finishLogout(); await closing; challenge.dispose();
  const revoked = harness(); await flush();
  revoked.state.alive = false; revoked.focus(); await flush();
  assert.equal(revoked.label().trim(), 'Cerrando sesión…');
  await revoked.finishLogout();
  assert.equal(revoked.label(), 'CONTENT');
  assert.equal(revoked.window.location.search, '?login=1');
  revoked.dispose();
});

test('failed Auth logout retains the closing state until the local navigation fallback', async () => {
  const h = harness(); await flush();
  h.state.authError = Error('offline');
  const closing = h.logout(); await flush();
  await h.finishLogout(); await closing;
  assert.equal(h.state.forcedLocation, '/?login=1');
  assert.equal(h.label().trim(), 'Cerrando sesión…');
  assert.equal(h.modules['@/lib/supabase'].isSigningOut(), true);
  h.dispose();
});

test('session read failures remain fail-closed', async () => {
  const h = harness(); await flush();
  h.state.sessionError = Error('unavailable'); h.focus(); await flush();
  assert.match(h.label(), /No pudimos verificar su acceso/);
  assert.notEqual(h.label(), 'CONTENT');
  h.dispose();
});

test('app restores an allowed session and registers only that device for persistence', async()=>{
 const h=harness({app:true}); await flush(); await flush();
 assert.equal(h.label(),'CONTENT'); assert.ok(h.state.remembered>0); h.dispose();
});
test('app never remembers a session before MFA is completed', async()=>{
 const h=harness({app:true,allowed:false}); await flush(); await flush();
 assert.equal(h.state.remembered,0); assert.notEqual(h.label(),'CONTENT'); h.dispose();
});
test('app rejects a revoked session rather than remembering it', async()=>{
 const h=harness({app:true}); await flush(); await flush();
 const before=h.state.remembered; h.state.alive=false; h.focus(); await flush();
 assert.equal(h.state.remembered,before); assert.notEqual(h.label(),'CONTENT'); h.dispose();
});


test('offline keeps credentials and automatically checks all access rules on reconnection', async () => {
  const h = harness({ app:true }); await flush();
  const session = h.state.session, reads = h.state.reads;
  h.connection(false); await flush();
  assert.match(h.label(), /Sin conexión/);
  assert.equal(h.state.session, session);
  assert.equal(h.state.closes, 0);
  h.focus(); await flush();
  assert.equal(h.state.reads, reads);
  h.connection(true); await flush();
  assert.equal(h.label(), 'CONTENT');
  assert.ok(h.state.reads > reads);
  assert.ok(h.state.remembered >= 2);
  h.dispose();
});

test('temporary MFA transport failures retain HTTP status, retry with backoff and recover', async () => {
  const h = harness(); await flush();
  h.state.mfaError = { code:'', message:'Service unavailable; private response' };
  h.state.mfaStatus = 503;
  h.focus(); await flush();
  assert.match(h.label(), /Reconectando/);
  assert.notEqual(h.label(), 'MfaChallenge');
  assert.equal(h.state.closes, 0);
  h.fireTimer(1000); await flush();
  assert.ok(h.delays().includes(3000));
  assert.equal(h.diagnostics.length, 1, 'repeated failure logs are deduplicated');
  assert.ok(!JSON.stringify(h.diagnostics).includes('private response'));
  h.state.mfaError = null; h.state.mfaStatus = 200;
  h.fireTimer(3000); await flush();
  assert.equal(h.label(), 'CONTENT');
  assert.equal(h.delays().length, 0);
  h.dispose();
});

test('stalled checks time out, and late results cannot grant access after timeout', async () => {
  const h = harness(); await flush();
  h.state.holdTouch = true; h.focus(); await flush();
  h.fireTimer(12000); await flush();
  assert.match(h.label(), /Reconectando/);
  h.state.heldTouch.resolve({ data:true, error:null }); await flush();
  assert.match(h.label(), /Reconectando/);
  assert.equal(h.state.closes, 0);
  h.fireTimer(1000); await flush();
  assert.equal(h.label(), 'CONTENT');
  h.dispose();
});

test('background pauses retries and foreground recovers without a stale error', async () => {
  const h = harness(); await flush();
  h.state.touchError = { message:'TypeError: Failed to fetch' }; h.state.touchStatus = 0;
  h.focus(); await flush();
  assert.match(h.label(), /Reconectando/);
  h.visibility('hidden'); await flush();
  assert.equal(h.delays().length, 0);
  const reads = h.state.reads; h.focus(); h.connection(true); await flush();
  assert.equal(h.state.reads, reads);
  h.state.touchError = null; h.state.touchStatus = 200;
  h.visibility('visible'); await flush();
  assert.equal(h.label(), 'CONTENT');
  h.dispose();
});

test('reconnection cannot bypass MFA or server revocation', async () => {
  const h = harness(); await flush();
  h.connection(false); await flush();
  h.state.allowed = false; h.connection(true); await flush();
  assert.equal(h.label(), 'MfaChallenge');
  h.connection(false); await flush();
  h.state.alive = false; h.connection(true); await flush();
  assert.equal(h.label().trim(), 'Cerrando sesión…');
  await h.finishLogout();
  assert.equal(h.window.location.search, '?login=1');
  h.dispose();
});

test('permission and malformed responses fail closed without erasing the session or automatic retries', async () => {
  const h = harness(); await flush();
  h.state.touchError = { code:'42501', message:'permission denied' }; h.state.touchStatus = 403;
  h.focus(); await flush();
  assert.match(h.label(), /No pudimos verificar su acceso/);
  assert.equal(h.delays().length, 0);
  assert.equal(h.state.closes, 0);
  h.state.touchError = null; h.state.touchStatus = 200; h.state.alive = null;
  h.focus(); await flush();
  assert.match(h.label(), /No pudimos verificar su acceso/);
  assert.equal(h.state.closes, 0);
  h.dispose();
});

test('device registration retries temporary failures but still rejects explicit denial', async () => {
  const h = harness({ app:true }); await flush();
  h.state.rememberError = { message:'Load failed' }; h.state.rememberStatus = 0;
  h.focus(); await flush();
  assert.match(h.label(), /Reconectando/);
  assert.equal(h.state.closes, 0);
  h.state.rememberError = null; h.state.rememberStatus = 200; h.state.rememberAllowed = false;
  h.fireTimer(1000); await flush();
  assert.equal(h.label().trim(), 'Cerrando sesión…');
  await h.finishLogout();
  h.dispose();
});

test('logout and unmount cancel scheduled network retries', async () => {
  const h = harness(); await flush();
  h.state.sessionError = { name:'AuthRetryableFetchError', message:'fetch failed' };
  h.focus(); await flush();
  assert.ok(h.delays().includes(1000));
  const closing = h.logout(); await flush();
  assert.ok(!h.delays().includes(1000));
  assert.equal(h.label().trim(), 'Cerrando sesión…');
  await h.finishLogout(); await closing;
  h.dispose();
  assert.equal(h.delays().length, 0);
});


test('retry delays are capped and a successful recovery resets the backoff', async () => {
  const h = harness(); await flush();
  h.state.sessionError = { name:'AuthRetryableFetchError', status:0 };
  h.focus(); await flush();
  for (const delay of [1000, 3000, 10000, 30000, 30000]) {
    h.fireTimer(delay); await flush();
    assert.match(h.label(), /Reconectando/);
  }
  h.state.sessionError = null;
  h.fireTimer(30000); await flush();
  assert.equal(h.label(), 'CONTENT');
  h.state.sessionError = { status:429 }; h.focus(); await flush();
  assert.ok(h.delays().includes(1000));
  h.dispose();
});

test('known transport errors retry; authorization and unexpected errors do not', async () => {
  const h = harness(); await flush();
  const classify = h.modules['@/lib/session-verification'].classifyVerificationFailure;
  for (const error of [{ status:408 }, { status:429 }, { status:502 }, { code:'PGRST001' }, { name:'AuthRetryableFetchError' }, { message:'TypeError: Load failed' }]) {
    assert.equal(classify(error, true), 'retrying');
  }
  for (const error of [{ status:401 }, { status:403, message:'Failed to fetch' }, { code:'PGRST202' }, { code:'SESSION_RESPONSE_INVALID' }, { name:'TypeError', message:'Cannot read properties of null' }]) {
    assert.equal(classify(error, true), 'error');
  }
  assert.equal(classify({}, false), 'offline');
  h.dispose();
});

test('going offline invalidates an in-flight success until a fresh verification succeeds', async () => {
  const h = harness(); await flush();
  h.state.holdMfa = true; h.focus(); await flush();
  h.connection(false); await flush();
  h.state.heldMfa.resolve({ data:true, error:null }); await flush();
  assert.match(h.label(), /Sin conexión/);
  h.state.allowed = false; h.connection(true); await flush();
  assert.equal(h.label(), 'MfaChallenge');
  h.dispose();
});


test('malformed session tokens fail closed instead of granting or erasing a session', async () => {
  const h = harness(); await flush();
  h.state.session = { user:{ id:'test-user' }, access_token:'not-a-jwt' };
  h.focus(); await flush();
  assert.match(h.label(), /No pudimos verificar su acceso/);
  assert.equal(h.state.closes, 0);
  h.dispose();
});
