import test from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.mjs";

test("permite el script y el iframe de Turnstile sin abrir otros dominios", async () => {
  const rules = await config.headers();
  const policy = rules.find((r) => r.source === "/(.*)").headers
    .find((h) => h.key === "Content-Security-Policy").value;
  const directives = new Map(policy.split(";").map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
  // An omitted frame-src falls back to default-src 'self' and blocks Turnstile.
  for (const name of ["script-src", "frame-src"]) {
    const allowed = directives.get(name);
    assert.ok(allowed?.includes("https://challenges.cloudflare.com"), `${name} debe permitir Turnstile`);
    assert.ok(!allowed.includes("*") && !allowed.includes("https:") && !allowed.includes("*.cloudflare.com"));
  }
  assert.deepEqual(directives.get("default-src"), ["'self'"]);
  assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(directives.get("object-src"), ["'none'"]);
});
