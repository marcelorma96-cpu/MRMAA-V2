const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(name, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/', name + '.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, URL, Set, Symbol, require: key => imports[key] };
  vm.runInNewContext(code, context);
  return context.exports;
}
const pixel = load('meta-pixel');
const { filterLandingAnalytics: filter } = load('vercel-analytics', { './meta-pixel': pixel });
const root = 'https://www.mrmaa.com/';
const page = url => ({ type: 'pageview', url });
test('counts public landing and strips marketing query/hash from transmitted URL', () => {
  const url = root + '?fbclid=ad-click&utm_source=facebook#planes';
  assert.equal(filter(page(url), url, url, true).url, root);
});
test('measures Spanish and event landing paths without admitting account or restaurant pages', () => {
  for (const path of ['/es', '/es/software-eventos-restaurantes', '/restaurant-event-management']) {
    const clean = 'https://www.unomesa.com' + path, url = clean + '?utm_source=google&gclid=abc';
    assert.equal(filter(page(url), url, url, true).url, clean);
    for (const privatePart of ['?code=secret', '?email=private@example.com', '#access_token=token']) {
      assert.equal(filter(page(clean + privatePart), clean + privatePart, clean, true), null);
    }
    assert.equal(filter(page(url), url, url, false), null);
  }
  for (const path of ['/es/dashboard', '/r/example', '/restaurant-event-management/private']) {
    const url = 'https://www.unomesa.com' + path;
    assert.equal(filter(page(url), url, url, true), null);
  }
});
test('blocks private SPA views even though their URL is still the landing URL', () => {
  assert.equal(filter(page(root), root, root, false), null);
});
test('blocks auth callback even after app removes the original token', () => {
  assert.equal(filter(page(root), root + '?code=private-token', root, true), null);
  assert.equal(filter(page(root), root + '#access_token=private-token', root, true), null);
});
test('blocks unknown queries, nonproduction hosts and private paths', () => {
  for (const url of [root + '?email=private@example.com', root + 'api/account', 'http://localhost:3000/', 'https://preview.vercel.app/']) {
    assert.equal(filter(page(url), url, url, true), null);
  }
});
test('blocks custom events and late events after navigation', () => {
  assert.equal(filter({ type: 'event', url: root }, root, root, true), null);
  assert.equal(filter(page(root), root, root + '?code=token', true), null);
});
