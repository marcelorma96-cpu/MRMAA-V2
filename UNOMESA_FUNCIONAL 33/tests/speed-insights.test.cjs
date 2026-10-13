const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const context = { exports: {}, URL, Set };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/speed-insights.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { filterSpeedInsights: filter, speedInsightsPath: route } = context.exports;
const origin = 'https://www.unomesa.com';
const root = origin + '/';
const vital = url => ({ type: 'vital', url });

test('measures public and app entries while stripping all query values and fragments', () => {
  for (const pathname of ['/', '/es', '/mobile', '/login', '/restaurant-event-management', '/es/software-eventos-restaurantes']) {
    const url = origin + pathname + '?utm_source=example&fbclid=click#planes';
    const event = filter(vital(url), url, url, origin);
    assert.equal(event.url, origin + pathname);
    assert.equal(event.route, pathname);
  }
});
test('groups restaurant pages and discards arbitrary event metadata without mutation', () => {
  const url = origin + '/r/example-restaurant#restaurant-menu';
  const event = { ...vital(url), route: '/r/private-name', email: 'private@example.test', customerId: 'private-id' };
  const filtered = filter(event, url, url, origin);
  assert.equal(JSON.stringify(filtered), JSON.stringify({ type: 'vital', url: origin + '/r/[slug]', route: '/r/[slug]' }));
  assert.equal(event.email, 'private@example.test');
});
test('excludes OAuth, invitations and recovery even after original URL has been cleaned', () => {
  for (const suffix of ['?code=secret', '?support=private-id', '?invite=token', '?reset=1', '?email=a@example.test', '#access_token=secret', '#code%3Dsecret']) {
    assert.equal(filter(vital(root), root + suffix, root, origin), null);
    assert.equal(filter(vital(root), root, root + suffix, origin), null);
    assert.equal(filter(vital(root + suffix), root, root, origin), null);
  }
});
test('excludes API, billing callbacks, files, unknown and encoded paths', () => {
  for (const pathname of ['/auth/google', '/billing/return', '/api/account', '/menus/rest/file/customer.pdf', '/r/name/logo', '/r/name/private', '/r/private%40name', '/private/customer-id']) {
    assert.equal(route(origin + pathname, origin), null);
    assert.equal(filter(vital(origin + pathname), root, root, origin), null);
  }
});
test('rejects malformed, insecure, preview and credential-bearing URLs', () => {
  for (const url of ['bad-url', '/mobile', 'http://www.unomesa.com/', 'https://preview.vercel.app/', 'https://www.unomesa.com.evil.test/', 'https://user:password@www.unomesa.com/', 'http://localhost:3000/']) {
    assert.equal(route(url, origin), null);
  }
  assert.equal(filter({ type: 'event', url: root }, root, root, origin), null);
});
