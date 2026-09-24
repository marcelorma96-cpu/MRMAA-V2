const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const code = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../lib/meta-pixel.ts"), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;

function browser(href = "https://mrmaa.com/", enabled) {
  const scripts = [], events = [], window = { location: { href } };
  const context = {
    exports: {}, window, URL, Set, Symbol,
    process: { env: { NEXT_PUBLIC_META_PIXEL_ENABLED: enabled } },
    document: {
      createElement: () => ({}),
      head: { appendChild: script => scripts.push(script) },
    },
  };
  vm.runInNewContext(code, context);
  return {
    api: context.exports, window, scripts, events,
    load() {
      window.fbq.callMethod = (...args) => events.push(args);
      scripts[0].onload();
    },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const pageViews = state => state.events.filter(event => event[0] === "trackSingle");

test("accepts production landing and marketing parameters only", () => {
  const { isPublicLandingUrl } = browser().api;
  for (const url of ["https://mrmaa.com/", "https://www.mrmaa.com/?fbclid=abc&utm_campaign=guatemala#planes"])
    assert.equal(isPublicLandingUrl(url), true, url);
  for (const url of [
    "http://mrmaa.com/", "https://mrmaa.com:8080/", "https://preview.vercel.app/",
    "http://localhost:3000/", "https://mrmaa.com.evil.example/", "https://mrmaa.com/privacidad",
    "https://mrmaa.com/?login=1", "https://mrmaa.com/?code=secret", "https://mrmaa.com/?reset=1",
    "https://mrmaa.com/?invite=1", "https://mrmaa.com/?invitation=secret", "https://mrmaa.com/?support=secret",
    "https://mrmaa.com/?billing=success", "https://mrmaa.com/?email=private@example.com",
    "https://mrmaa.com/#access_token=secret", "https://mrmaa.com/#type=recovery", "invalid",
  ]) assert.equal(isPublicLandingUrl(url), false, url);
});

test("loads asynchronously and emits only one PageView without personal parameters", async () => {
  const state = browser();
  const stop = state.api.startLandingPixel();
  assert.equal(state.scripts.length, 1);
  assert.equal(state.scripts[0].async, true);
  assert.equal(state.scripts[0].src, "https://connect.facebook.net/en_US/fbevents.js");
  assert.equal(state.events.length, 0);
  state.load(); await flush();
  assert.deepEqual(state.events, [
    ["set", "autoConfig", false, "1105508185670938"],
    ["init", "1105508185670938"],
    ["consent", "grant"],
    ["trackSingle", "1105508185670938", "PageView"],
  ]);
  stop();
  assert.deepEqual(state.events.at(-1), ["consent", "revoke"]);
});

test("does not initialize or transmit if the visitor leaves before the script loads", async () => {
  const state = browser();
  const stop = state.api.startLandingPixel();
  stop(); state.load(); await flush();
  assert.deepEqual(state.events, []);
});

test("checks the URL again after a delayed load", async () => {
  const state = browser();
  state.api.startLandingPixel();
  state.window.location.href = "https://mrmaa.com/?support=secret";
  state.load(); await flush();
  assert.deepEqual(state.events, []);
});

test("remounts and Strict Mode do not duplicate the script, init or PageView", async () => {
  const state = browser();
  const first = state.api.startLandingPixel();
  first();
  const second = state.api.startLandingPixel();
  state.load(); await flush(); second();
  const third = state.api.startLandingPixel();
  await flush(); third();
  assert.equal(state.scripts.length, 1);
  assert.equal(state.events.filter(event => event[0] === "init").length, 1);
  assert.equal(pageViews(state).length, 1);
  assert.deepEqual(state.events.at(-1), ["consent", "revoke"]);
});

test("does not load on auth callbacks, even after auth removes URL credentials", () => {
  for (const entry of ["https://mrmaa.com/?code=secret", "https://mrmaa.com/#access_token=secret", "https://mrmaa.com/?invitation=secret"]) {
    const state = browser(entry);
    state.window.location.href = "https://mrmaa.com/";
    state.api.startLandingPixel()();
    assert.equal(state.scripts.length, 0);
  }
});

test("does not load outside production or when explicitly disabled", () => {
  for (const [href, enabled] of [["https://preview.vercel.app/"], ["http://localhost:3000/"], ["https://mrmaa.com/", "false"]]) {
    const state = browser(href, enabled);
    state.api.startLandingPixel()();
    assert.equal(state.scripts.length, 0);
  }
});

test("ad blocker or network failure does not throw or emit events", async () => {
  const state = browser();
  const stop = state.api.startLandingPixel();
  state.scripts[0].onerror(); await flush();
  assert.deepEqual(state.events, []);
  assert.doesNotThrow(stop);
  assert.doesNotThrow(() => state.api.startLandingPixel()());
});

test("pixel runtime errors do not propagate to application navigation", async () => {
  const state = browser();
  const stop = state.api.startLandingPixel();
  state.window.fbq.callMethod = () => { throw new Error("External script failure"); };
  state.scripts[0].onload(); await flush();
  assert.doesNotThrow(stop);
});

test("server rendering does not access browser globals or make requests", () => {
  const context = { exports: {}, process: { env: {} }, URL, Set, Symbol };
  vm.runInNewContext(code, context);
  assert.doesNotThrow(() => context.exports.startLandingPixel()());
});
