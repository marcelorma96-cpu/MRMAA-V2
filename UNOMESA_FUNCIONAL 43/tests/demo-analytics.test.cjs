const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup(url = 'https://unomesa.com/?utm_source=google', env = {}, fails = false) {
  const sent = [], modules = {};
  const context = { exports: {}, URL, Set, Symbol, window: { location: { href: url } }, process: { env: { NODE_ENV: 'production', ...env } } };
  context.require = name => name === '@vercel/analytics' ? { track: (name, data) => { if (fails) throw Error('blocked'); sent.push({ name, data }); } } : modules[name];
  for (const name of ['meta-pixel', 'vercel-analytics', 'demo-analytics']) {
    context.exports = {};
    const code = ts.transpileModule(fs.readFileSync(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext('(function(){' + code + '})()', context);
    modules['./' + name] = context.exports;
  }
  return { sent, api: modules['./demo-analytics'], filter: modules['./vercel-analytics'].filterLandingAnalytics, context };
}

test('demo sends only fixed Vercel events with flow; never signup or purchase conversions', () => {
  const { api, sent } = setup();
  for (const name of ['Demo_abierta', 'Demo_cotizacion_vista', 'Demo_reserva_creada', 'Demo_registro_click']) api.trackDemoEvent(name, 'quote');
  assert.equal(sent.length, 4);
  assert.ok(sent.every(event => JSON.stringify(event.data) === '{"flow":"quote"}'));
  for (const name of ['Registro_exitoso', 'CompleteRegistration', 'Purchase', 'conversion', 'customer@example.com']) api.trackDemoEvent(name, 'quote');
  api.trackDemoEvent('Demo_abierta', 'private data');
  assert.equal(sent.length, 4);
});

test('demo measurements cannot pass the landing filter after exit or in private/auth views', () => {
  const { filter } = setup();
  const root = 'https://unomesa.com/';
  const event = { type: 'event', url: root + '?gclid=example#planes' };
  assert.equal(filter(event, root, root, true, true).url, root);
  assert.equal(filter(event, root, root, true, false), null);
  assert.equal(filter(event, root, root, false, true), null);
  assert.equal(filter(event, root + '?code=secret', root, true, true), null);
  assert.equal(filter(event, root, root + '?login=1', true, true), null);
});

test('disabled, development, unknown URLs and telemetry failures never affect the demo', () => {
  for (const url of ['http://localhost:3000/', 'https://preview.vercel.app/', 'https://unomesa.com/?code=secret', 'https://unomesa.com/?email=private@example.com', 'https://unomesa.com/api/account']) {
    const { api, sent } = setup(url); api.trackDemoEvent('Demo_reserva_creada', 'direct'); assert.equal(sent.length, 0);
  }
  for (const [env, fails] of [[{ NODE_ENV: 'development' }, false], [{ NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: 'false' }, false], [{}, true]]) {
    const { api, sent } = setup(undefined, env, fails);
    assert.doesNotThrow(() => api.trackDemoEvent('Demo_registro_click', 'direct'));
    assert.equal(sent.length, 0);
  }
});
