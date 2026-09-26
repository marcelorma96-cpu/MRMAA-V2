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
function harness({ allowed = true, anonymous = false, recovery = false } = {}) {
  const sourceRoot = process.env.UNOMESA_AUTH_TEST_ROOT || process.cwd();
  const listeners = new Map(), authListeners = new Set(), storage = new Map();
  const timers = new Map(); let nextTimer = 0;
  const session = { user: { id: 'test-user' }, access_token: 'x.' + Buffer.from(JSON.stringify({ session_id: 'test-session' })).toString('base64url') + '.x' };
  const state = {
    session: anonymous ? null : session, allowed, alive: true, reads: 0, mfaCalls: 0, closes: 0, signOuts: 0,
    heldMfa: null, holdMfa: false, holdTouch: false, heldTouch: null, revoke: null, authEnd: null,
    authError: null, sessionError: null, forcedLocation: null,
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
    async rpc(name) {
      if (name === 'v2_session_close') { state.closes++; state.revoke = deferred(); return state.revoke.promise; }
      if (name === 'v2_session_touch_active') {
        if (state.holdTouch) { state.holdTouch = false; state.heldTouch = deferred(); return state.heldTouch.promise; }
        return { data: state.alive, error: null };
      }
      if (name === 'v2_mfa_session_allowed') {
        state.mfaCalls++;
        if (state.holdMfa) { state.holdMfa = false; state.heldMfa = deferred(); return state.heldMfa.promise; }
        return { data: state.allowed, error: null };
      }
      throw Error('Unexpected RPC: ' + name);
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
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { ShieldCheck() {} },
    '@supabase/supabase-js': { createClient: () => client },
    '@/components/security-center': { SessionManager() {} },
    '@/components/app-preferences': { useAppPreferences: () => ({ language: 'es' }) },
  };
  const context = {
    window, document: { ...target('document:'), visibilityState: 'visible' }, sessionStorage,
    navigator: { userAgent: 'Test browser', maxTouchPoints: 0 },
    Event: class { constructor(type) { this.type = type; } },
    URL, URLSearchParams, Set, Date, Promise,
    process: { env: {} }, atob: value => Buffer.from(value, 'base64').toString(),
    setTimeout(fn, delay = 0) { const id = ++nextTimer; timers.set(id, fn); if (delay === 0) queueMicrotask(() => { const run = timers.get(id); timers.delete(id); run?.(); }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => ++nextTimer, clearInterval: () => {},
    require: name => { if (!(name in modules)) throw Error('Unexpected import: ' + name); return modules[name]; },
  };
  for (const file of ['lib/session-control.ts', 'lib/session-activity.ts', 'lib/supabase.ts', 'lib/mfa.ts', 'components/mfa-settings.tsx']) {
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
    if (Array.isArray(node)) return node.map(text).join(' ');
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
    state, renders, window, modules,
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
  assert.match(h.label(), /No se pudo comprobar la seguridad/);
  assert.notEqual(h.label(), 'CONTENT');
  h.dispose();
});
