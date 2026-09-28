const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = 'https://www.unomesa.com/';
const destination = 'AW-10836285487/Sf2SCLLI5oYdEK-wkq8o';
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function browser(href = root, env = {}, appendFails = false) {
  const scripts = [];
  const context = {
    exports: {}, URL, Set, Symbol, Date,
    process: { env: { NODE_ENV: 'production', ...env } },
    window: { location: { href, pathname: '/' } },
    document: {
      getElementById: id => scripts.find(script => script.id === id),
      createElement: () => ({}),
      head: { appendChild: script => { if (appendFails) throw Error('blocked'); scripts.push(script); } },
    },
  };
  const modules = {};
  context.require = name => modules[name];
  for (const name of ['meta-pixel', 'google-ads']) {
    context.exports = {};
    vm.runInNewContext('(function(){' + compile(fs.readFileSync(`lib/${name}.ts`, 'utf8')) + '})()', context);
    modules['./' + name] = context.exports;
  }
  return {
    api: context.exports, context, scripts,
    calls: () => (context.window.dataLayer || []).map(args => Array.from(args)),
    conversions() { return this.calls().filter(args => args[0] === 'event' && args[1] === 'conversion'); },
  };
}

test('public Google ad links work; authentication URLs and unknown parameters are blocked', () => {
  const { api } = browser();
  for (const host of ['unomesa.com', 'www.unomesa.com', 'mrmaa.com', 'www.mrmaa.com']) {
    assert.equal(api.isGoogleAdsPublicUrl(`https://${host}/?gclid=click-1&gbraid=abc&wbraid=xyz&gad_source=1&gad_campaignid=123&utm_source=google#planes`), true);
  }
  assert.equal(api.isGoogleAdsPublicUrl(root + '?gtm_debug=123'), true);
  assert.equal(api.isGoogleAdsPublicUrl(root + '?login=1', true), true);
  assert.equal(api.isGoogleAdsPublicUrl(root + '?login=1'), false);
  for (const suffix of ['?code=secret', '?gclid=abc&email=private', '?login=1&code=secret', '?login=2', '#access_token=secret', 'api/register', '?gtm_debug=bad']) {
    assert.equal(api.isGoogleAdsPublicUrl(root + suffix, true), false, suffix);
  }
});

test('landing loads one async base tag, but never counts a signup or automatic pageview', () => {
  const state = browser(root + '?gclid=abc&utm_campaign=campaign');
  const stop = state.api.startLandingGoogleAds();
  stop(); state.api.startLandingGoogleAds();
  state.api.trackGoogleAdsRegistration();
  assert.equal(state.scripts.length, 1);
  assert.equal(state.scripts[0].async, true);
  assert.equal(state.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=AW-10836285487');
  const configs = state.calls().filter(args => args[0] === 'config');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][2].send_page_view, false);
  assert.equal(configs[0][2].allow_enhanced_conversions, false);
  assert.equal(configs[0][2].allow_ad_personalization_signals, false);
  assert.equal(configs[0][2].page_location, root + '?gclid=abc');
  assert.equal(state.conversions().length, 0);
});

test('success is queued once even before Google loads and survives immediate return to sign-in', () => {
  const state = browser(root + '?gclid=abc');
  const stop = state.api.startRegistrationGoogleAds();
  assert.equal(state.conversions().length, 0);
  state.api.trackGoogleAdsRegistration();
  state.api.trackGoogleAdsRegistration();
  stop();
  state.context.window.location.href = root + '?login=1';
  state.api.trackGoogleAdsRegistration();
  state.api.startRegistrationGoogleAds();
  state.api.trackGoogleAdsRegistration();
  assert.equal(state.conversions().length, 1);
  const event = state.conversions()[0][2];
  assert.equal(event.send_to, destination);
  assert.deepEqual(Object.keys(event).sort(), ['page_location', 'page_referrer', 'page_title', 'send_to']);
  assert.equal(event.page_location, root + '?gclid=abc');
});

test('closed signup, unsafe current URLs, auth callbacks and private entry never emit conversions', () => {
  const state = browser();
  const stop = state.api.startRegistrationGoogleAds();
  stop(); state.api.trackGoogleAdsRegistration();
  assert.equal(state.conversions().length, 0);
  state.api.startRegistrationGoogleAds();
  state.context.window.location.href = root + '?code=private-token';
  state.api.trackGoogleAdsRegistration();
  assert.equal(state.conversions().length, 0);
  for (const entry of [root + '?code=secret', root + '#access_token=secret', root + 'api/account']) {
    const blocked = browser(entry);
    blocked.context.window.location.href = root;
    blocked.api.startRegistrationGoogleAds();
    blocked.api.trackGoogleAdsRegistration();
    assert.equal(blocked.scripts.length, 0);
    assert.equal(blocked.conversions().length, 0);
  }
});

test('development, preview and disabled tag do not load; script and gtag failures never throw', () => {
  for (const [url, env] of [[root, { NODE_ENV: 'development' }], [root, { NEXT_PUBLIC_GOOGLE_ADS_ENABLED: 'false' }], ['https://preview.vercel.app/', {}]]) {
    const state = browser(url, env);
    state.api.startRegistrationGoogleAds(); state.api.trackGoogleAdsRegistration();
    assert.equal(state.scripts.length, 0);
    assert.equal(state.conversions().length, 0);
  }
  const blocked = browser(root, {}, true);
  assert.doesNotThrow(() => { blocked.api.startRegistrationGoogleAds(); blocked.api.trackGoogleAdsRegistration(); });
  const throwing = browser();
  throwing.api.startRegistrationGoogleAds();
  throwing.context.window.gtag = () => { throw Error('blocked'); };
  assert.doesNotThrow(() => throwing.api.trackGoogleAdsRegistration());
});

// Run the application's actual submit handler with simulated server replies.
// This verifies the success boundary without creating accounts or touching Supabase.
function submitHarness(response, failure, mode = 'signup') {
  const state = browser();
  state.api.startRegistrationGoogleAds();
  const source = fs.readFileSync('app/page.tsx', 'utf8');
  const wrapper = source.slice(source.indexOf('function trackRegistration('), source.indexOf('\nfunction PasswordInput'));
  const submit = source.slice(source.indexOf('  async function submit('), source.indexOf('  async function resetPassword('));
  let modeAfter = mode;
  Object.assign(state.context, {
    currentMode: mode, submitting: { current: false }, configured: true, PUBLIC_SIGNUP_ENABLED: true,
    form: { password: 'ValidPassword1!', confirmPassword: 'ValidPassword1!', email: 'test@example.invalid', name: 'Test', restaurant: 'Test', phone: '', country: 'Guatemala', language: 'es', currency: 'GTQ' },
    accepted: true, TURNSTILE_SITE_KEY: '', captchaToken: '', signupPlan: 'advanced', signupInterval: 'month',
    passwordIsStrong: () => true, emailLanguage: value => value,
    trackVercelRegistration: () => {}, trackMetaRegistration: () => {},
    trackGoogleAdsRegistration: state.api.trackGoogleAdsRegistration,
    setFeedback: () => {}, setFeedbackKind: () => {}, setBusy: () => {},
    setCurrentMode: value => { modeAfter = value; }, setShowRecovery: () => {}, setAccepted: () => {}, setForm: () => {},
    renewCaptcha: () => {}, history: { replaceState: () => {} },
    fetch: async () => { if (failure) throw Error('network'); return { ok: response.httpOk, status: response.status || 200, json: async () => response.body }; },
    sessionStorage: { setItem: () => {} }, ACTIVITY_KEY: 'activity',
    supabase: { auth: { signInWithPassword: async () => ({ data: { session: {} } }) } }, signedIn: () => {},
  });
  vm.runInNewContext(compile(wrapper + '\n' + submit + '\nexports.submit = submit;'), state.context);
  return { state, run: () => state.context.exports.submit({ preventDefault() {} }), modeAfter: () => modeAfter };
}

test('real submit handler counts only successful account creation, preserving its sign-in transition', async () => {
  for (const response of [
    { httpOk: false, status: 409, body: { code: 'REGISTRATION_IN_PROGRESS' } },
    { httpOk: false, status: 500, body: { error: 'server' } },
    { httpOk: true, body: { ok: false } },
  ]) {
    const item = submitHarness(response);
    await item.run();
    assert.equal(item.state.conversions().length, 0);
  }
  const network = submitHarness({}, true); await network.run();
  assert.equal(network.state.conversions().length, 0);
  const login = submitHarness({}, false, 'login'); await login.run();
  assert.equal(login.state.conversions().length, 0);
  const success = submitHarness({ httpOk: true, body: { ok: true, requiresEmailConfirmation: true } });
  await success.run();
  assert.equal(success.state.conversions().length, 1);
  assert.equal(success.modeAfter(), 'login');
  assert.equal(success.state.context.submitting.current, false);
});

test('CSP permits Google Ads while preserving the existing security boundaries', async () => {
  const { default: config } = await import('../next.config.mjs');
  const headers = (await config.headers())[0].headers;
  const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
  for (const item of ["frame-ancestors 'none'", "object-src 'none'", 'https://challenges.cloudflare.com', 'https://connect.facebook.net', 'https://www.googletagmanager.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net', 'https://www.google.com.gt', 'https://www.google.com.mx']) {
    assert.ok(csp.includes(item), item);
  }
  assert.equal(csp.includes("'unsafe-eval'"), false);
});
