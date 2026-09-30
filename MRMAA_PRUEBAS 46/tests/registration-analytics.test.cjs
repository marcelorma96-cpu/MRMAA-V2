const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = 'https://www.mrmaa.com/';
function setup(href = root, env = {}, fail = false) {
  const sent = []; let filter;
  const context = { exports: {}, URL, Set, Symbol, window: { location: { href } }, process: { env: { NODE_ENV: 'production', ...env } } };
  const compile = name => ts.transpileModule(fs.readFileSync(`lib/${name}.ts`, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext('(function(){'+compile('meta-pixel')+'})()', context);
  const pixel = context.exports; context.exports = {};
  context.require = key => key === './meta-pixel' ? pixel : {
    inject: opts => { if (fail) throw Error('blocked'); filter = opts.beforeSend; },
    track: (name, data) => { const event = filter({ type: 'event', name, data, url: context.window.location.href }); if (event) sent.push({...event,name,data}); }
  };
  vm.runInNewContext(compile('registration-analytics'), context);
  return { api: context.exports, sent, context };
}
test('records funnel events and strips URL parameters and arbitrary properties', () => {
  const { api, sent } = setup(root + '?utm_source=facebook');
  api.startRegistrationAnalytics();
  for (const name of ['Registro_abierto','Registro_intento','Registro_exitoso']) api.trackRegistration(name);
  assert.equal(sent.length, 3); assert.equal(sent[0].url, root);
  api.trackRegistration('Registro_error', 'server');
  assert.deepEqual(JSON.parse(JSON.stringify(sent[3].data)), {reason:'server'});
  api.trackRegistration('Registro_error', 'private@example.com');
  assert.equal(sent[4].data, undefined);

});
test('no transmission after leaving signup or on callback/private URLs', () => {
  const { api, sent, context } = setup(); const stop = api.startRegistrationAnalytics();
  stop(); api.trackRegistration('Registro_intento'); assert.equal(sent.length, 0);
  api.startRegistrationAnalytics(); context.window.location.href = root+'?code=secret';
  api.trackRegistration('Registro_error','server'); assert.equal(sent.length,0);
  for(const url of [root+'?code=secret',root+'#access_token=secret',root+'?email=x',root+'api/account','http://localhost:3000/']) {
    const item = setup(url); item.api.startRegistrationAnalytics(); item.api.trackRegistration('Registro_abierto'); assert.equal(item.sent.length,0);
  }
});
test('rejects automatic pageviews and unknown event names', () => {
  const {api,sent} = setup(); api.startRegistrationAnalytics();
  assert.equal(api.filterRegistrationEvent({type:'pageview',url:root},root,root,true),null);
  api.trackRegistration('CustomerEmail'); assert.equal(sent.length,0);
});
test('allows public login link but blocks other login values and mixed auth parameters', () => {
  const {api} = setup();
  assert.equal(api.isRegistrationUrl(root+'?login=1'),true);
  for(const query of ['?login=2','?login=1&login=1','?login=1&code=secret']) assert.equal(api.isRegistrationUrl(root+query),false);
});
test('disabled analytics, development and injection failures do not affect registration', () => {
  for(const [env,fail] of [[{NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED:'false'},false],[{NODE_ENV:'development'},false],[{},true]]) {
    const {api,sent}=setup(root,env,fail);
    assert.doesNotThrow(()=>{api.startRegistrationAnalytics();api.trackRegistration('Registro_intento');});
    assert.equal(sent.length,0);
  }
});
