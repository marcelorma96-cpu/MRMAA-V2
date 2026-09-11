import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const port = Number(process.env.MRMAA_LOCAL_PORT || 3010);
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["start", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://local-test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-load-test-key",
  },
});
let logs = "";
server.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
server.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`El servidor terminó antes de la prueba.\n${logs}`);
    try { const response = await fetch(url); if (response.status < 500) { ready = true; break; } } catch {}
    await wait(100);
  }
  if (!ready) throw new Error(`El servidor local no quedó listo.\n${logs}`);
  const test = spawn(process.execPath, ["scripts/staging-load-test.mjs"], {
    stdio: "inherit",
    env: { ...process.env, MRMAA_LOAD_URL: url },
  });
  const exitCode = await new Promise((resolve) => test.on("exit", resolve));
  if (exitCode) process.exitCode = Number(exitCode);
} finally {
  server.kill("SIGTERM");
}
