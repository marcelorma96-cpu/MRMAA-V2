import test from "node:test";
import assert from "node:assert/strict";
import { loadTurnstile } from "../lib/turnstile";

test("Turnstile comparte la carga, permite reintentar errores y espera ready antes de renderizar", async () => {
  // Minimal DOM to exercise script loading without calling Cloudflare or Auth.
  let connected: Script | undefined;
  let created = 0;
  const timers = new Map<number, () => void>();
  let timerId = 0;
  class Script extends EventTarget {
    src = "";
    async = false;
    defer = false;
    dataset: Record<string, string> = {};
    isConnected = false;
    remove() { this.isConnected = false; if (connected === this) connected = undefined; }
  }
  const fakeWindow: any = {
    setTimeout(callback: () => void) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id: number) { timers.delete(id); },
  };
  const fakeDocument: any = {
    querySelector: () => connected,
    createElement: () => { created++; return new Script(); },
    head: { appendChild(script: Script) { script.isConnected = true; connected = script; } },
  };
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  try {
    const first = loadTurnstile();
    assert.equal(first, loadTurnstile(), "concurrent mounts share the same request");
    assert.equal(created, 1);
    connected!.dispatchEvent(new Event("error"));
    await assert.rejects(first, /No se pudo cargar/);
    assert.equal(connected, undefined);
    assert.equal(timers.size, 0);

    const timedOut = loadTurnstile();
    assert.equal(created, 2);
    timers.values().next().value!();
    await assert.rejects(timedOut, /No se pudo cargar/);
    assert.equal(connected, undefined, "a stalled request is removable and retryable");

    let ready: (() => void) | undefined;
    fakeWindow.turnstile = { ready(callback: () => void) { ready = callback; } };
    let resolved = false;
    const successful = loadTurnstile().then((api) => { resolved = true; return api; });
    await Promise.resolve();
    assert.equal(resolved, false, "script availability alone does not mean API readiness");
    ready!();
    assert.equal(await successful, fakeWindow.turnstile);
    assert.equal(await loadTurnstile(), fakeWindow.turnstile, "navigation reuses the loaded API");
    assert.equal(timers.size, 0);
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (priorDocument) Object.defineProperty(globalThis, "document", priorDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
