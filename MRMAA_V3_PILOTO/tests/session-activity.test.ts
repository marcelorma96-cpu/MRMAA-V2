import test from "node:test";
import assert from "node:assert/strict";
import { remainingIdleTime, IDLE_LIMIT } from "../lib/session-activity";

test("sesión nueva no hereda vencimiento de sesión anterior", () => {
  const now = 10_000_000;
  assert.equal(remainingIdleTime(String(now - IDLE_LIMIT), now), 0);
  assert.equal(remainingIdleTime(String(now), now), IDLE_LIMIT);
  assert.equal(remainingIdleTime(null, now), IDLE_LIMIT);
});
test("volver después de una hora no renueva una sesión vencida", () => {
  const now = 10_000_000;
  assert.equal(remainingIdleTime(String(now - IDLE_LIMIT - 5000), now), 0);
  assert.equal(remainingIdleTime(String(now - 5000), now), IDLE_LIMIT - 5000);
  assert.equal(remainingIdleTime("invalid", now), IDLE_LIMIT);
});
