import { performance } from "node:perf_hooks";

const target = process.env.MRMAA_LOAD_URL;
const concurrency = Number(process.env.MRMAA_LOAD_CONCURRENCY || 100);
const requests = Number(process.env.MRMAA_LOAD_REQUESTS || 5000);
if (!target || (!/^https:\/\//.test(target) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)))
  throw new Error("Defina MRMAA_LOAD_URL con staging HTTPS o localhost para pruebas aisladas.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5000) throw new Error("Concurrencia inválida.");

let cursor = 0, succeeded = 0, failed = 0;
const durations = [];
async function worker() {
  while (cursor++ < requests) {
    const start = performance.now();
    try {
      const response = await fetch(target, { redirect: "manual", headers: { "user-agent": "MRMAA-Staging-Load-Test/1.0" } });
      durations.push(performance.now() - start);
      if (response.status >= 200 && response.status < 400) succeeded++; else failed++;
      await response.arrayBuffer();
    } catch { failed++; durations.push(performance.now() - start); }
  }
}
const started = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
durations.sort((a, b) => a - b);
const percentile = (p) => Number((durations[Math.min(durations.length - 1, Math.floor(durations.length * p))] || 0).toFixed(1));
console.log(JSON.stringify({ target, concurrency, requests, succeeded, failed,
  duration_seconds: Number(((performance.now() - started) / 1000).toFixed(2)),
  latency_ms: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) } }, null, 2));
if (failed / requests > .01) process.exitCode = 1;
