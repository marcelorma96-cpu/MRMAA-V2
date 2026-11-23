const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/public-locale.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { publicLocale } = context.exports;

test('public regional defaults match Guatemala, Mexico and the United States', () => {
  for (const [input, country, language, currency] of [
    ['GT', 'GT', 'es', 'GTQ'], [' mx ', 'MX', 'es', 'MXN'], ['US', 'US', 'en', 'USD'],
  ]) {
    assert.equal(JSON.stringify(publicLocale(input)), JSON.stringify({ country, language, currency }));
  }
});

test('other countries and unavailable geolocation have explicit supported defaults', () => {
  for (const country of ['ES', 'AR', 'SV', 'GQ', 'PR']) {
    assert.equal(publicLocale(country).language, 'es');
    assert.equal(publicLocale(country).currency, 'USD');
  }
  for (const country of ['BR', 'FR', 'CA', 'GB', 'JP']) assert.equal(publicLocale(country).language, 'en');
  for (const invalid of [null, undefined, '', 'Guatemala', 'US,MX', 502, {}]) {
    assert.equal(publicLocale(invalid).country, null);
    assert.equal(publicLocale(invalid).language, 'en');
    assert.equal(publicLocale(invalid).currency, 'USD');
  }
});
