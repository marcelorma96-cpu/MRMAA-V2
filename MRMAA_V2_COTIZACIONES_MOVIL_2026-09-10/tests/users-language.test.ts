import assert from "node:assert/strict";
import test, { before } from "node:test";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://email-tests.example.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
process.env.SUPABASE_SECRET_KEY = "test-server-key";

// Exercise the real handlers and Supabase SDK against a strictly local mock.
let handlers: typeof import("../app/api/users/route");
before(async () => { handlers = await import("../app/api/users/route"); });
let requestNumber = 0;

function environment(options: { existing?: boolean; foreign?: boolean; owner?: boolean; role?: string; status?: string; preferenceFailure?: boolean } = {}) {
  const calls: { path: string; method: string; body: any }[] = [];
  const userId = options.owner ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222";
  const target = {
    user_id: userId, restaurant_id: "restaurant-a", name: "Equipo", email: "team@example.test",
    role: options.owner ? "administrador" : "operacion", status: "invitado", last_invited_at: null,
  };
  const authUser = {
    id: userId, email: target.email, aud: "authenticated", role: "authenticated",
    user_metadata: { language: "fr", full_name: "Equipo", preserved: "keep-me" } as Record<string, any>,
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://email-tests.example.test", "ninguna solicitud sale del mock");
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path: url.pathname, method, body });
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (url.pathname === "/auth/v1/user") return response({ id: "11111111-1111-4111-8111-111111111111", email: "admin@example.test" });
    if (url.pathname === "/rest/v1/v2_restaurants") return response({ owner_id: "11111111-1111-4111-8111-111111111111", language: "en" });
    if (url.pathname === "/rest/v1/v2_members") {
      if (method !== "GET" && method !== "HEAD") return response([]);
      if (url.searchParams.get("select") === "restaurant_id,role,status") return response({ restaurant_id: "restaurant-a", role: options.role || "administrador", status: options.status || "activo" });
      assert.equal(url.searchParams.get("restaurant_id"), "eq.restaurant-a", "siempre limita los miembros al restaurante");
      if (url.searchParams.has("email")) return response(options.foreign ? null : { user_id: userId, status: "invitado" });
      if (url.searchParams.has("user_id")) return response(target);
      return response([target]);
    }
    if (url.pathname === "/auth/v1/invite") {
      if (options.existing) return response({ msg: "User already registered", code: "email_exists" }, 422);
      return response({ ...authUser, user_metadata: body.data });
    }
    if (url.pathname === `/auth/v1/admin/users/${userId}`) {
      if (method === "PUT") {
        if (options.preferenceFailure) return response({ msg: "metadata write failed" }, 400);
        authUser.user_metadata = { ...authUser.user_metadata, ...body.user_metadata };
      }
      return response({ user: authUser });
    }
    if (url.pathname === "/auth/v1/recover") return response({});
    throw new Error(`Solicitud inesperada: ${method} ${url.pathname}`);
  };
  return { calls, authUser, restore: () => { globalThis.fetch = original; } };
}

function request(method: string, body?: any, authorized = true) {
  return new NextRequest("https://mrmaa.com/api/users", {
    method,
    headers: {
      "Content-Type": "application/json", Origin: "https://mrmaa.com",
      "x-forwarded-for": `192.0.2.${++requestNumber}`,
      ...(authorized ? { Authorization: "Bearer test-session" } : {}),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}
const invitation = { email: "team@example.test", name: "Equipo", role: "operacion" };

test("las invitaciones guardan el idioma elegido antes del envío", async () => {
  for (const language of ["es", "en", "fr"]) {
    const env = environment();
    try {
      const result = await handlers.POST(request("POST", { ...invitation, language }));
      assert.equal(result.status, 200, JSON.stringify(await result.json()));
      const invite = env.calls.find((call) => call.path === "/auth/v1/invite");
      assert.equal(invite?.body.data.language, language);
      assert.equal(invite?.body.data.restaurant_id, "restaurant-a");
    } finally { env.restore(); }
  }
});

test("una invitación sin idioma usa el idioma del restaurante", async () => {
  const env = environment();
  try {
    const result = await handlers.POST(request("POST", invitation));
    assert.equal(result.status, 200);
    assert.equal(env.calls.find((call) => call.path === "/auth/v1/invite")?.body.data.language, "en");
  } finally { env.restore(); }
});

test("se rechazan idiomas inválidos antes de enviar", async () => {
  const env = environment();
  try {
    const result = await handlers.POST(request("POST", { ...invitation, language: { role: "administrador" } }));
    assert.equal(result.status, 400);
    assert.ok(!env.calls.some((call) => call.path === "/auth/v1/invite"));
  } finally { env.restore(); }
});

test("reenviar una invitación conserva la preferencia del destinatario", async () => {
  const env = environment();
  try {
    const result = await handlers.PATCH(request("PATCH", { user_id: "22222222-2222-4222-8222-222222222222" }));
    assert.equal(result.status, 200, JSON.stringify(await result.json()));
    assert.equal(env.authUser.user_metadata.language, "fr");
    assert.ok(env.calls.some((call) => call.path === "/auth/v1/recover"));
    assert.ok(!env.calls.some((call) => call.path.startsWith("/auth/v1/admin/") && call.method === "PUT"));
  } finally { env.restore(); }
});

test("al actualizar un invitado existente se guarda el idioma antes del enlace", async () => {
  const env = environment({ existing: true });
  try {
    const result = await handlers.POST(request("POST", { ...invitation, language: "en" }));
    assert.equal(result.status, 200, JSON.stringify(await result.json()));
    const update = env.calls.findIndex((call) => call.method === "PUT");
    const recovery = env.calls.findIndex((call) => call.path === "/auth/v1/recover");
    assert.ok(update >= 0 && recovery > update);
    assert.equal(env.authUser.user_metadata.language, "en");
    assert.equal(env.authUser.user_metadata.preserved, "keep-me");
  } finally { env.restore(); }
});

test("un fallo al guardar idioma detiene el reenvío", async () => {
  const env = environment({ existing: true, preferenceFailure: true });
  try {
    const result = await handlers.POST(request("POST", { ...invitation, language: "en" }));
    assert.equal(result.status, 400);
    assert.ok(!env.calls.some((call) => call.path === "/auth/v1/recover"));
  } finally { env.restore(); }
});

test("no se modifica una cuenta existente ajena al restaurante", async () => {
  const env = environment({ existing: true, foreign: true });
  try {
    const result = await handlers.POST(request("POST", { ...invitation, language: "en" }));
    assert.equal(result.status, 400);
    assert.ok(!env.calls.some((call) => call.path.startsWith("/auth/v1/admin/") || call.path === "/auth/v1/recover"));
  } finally { env.restore(); }
});

test("guardar idioma de un miembro conserva sus otros metadatos", async () => {
  const env = environment();
  try {
    const result = await handlers.PATCH(request("PATCH", { action: "update_member", user_id: "22222222-2222-4222-8222-222222222222", name: "Equipo", role: "operacion", language: "en" }));
    assert.equal(result.status, 200);
    assert.equal(env.authUser.user_metadata.language, "en");
    assert.equal(env.authUser.user_metadata.preserved, "keep-me");
  } finally { env.restore(); }
});

test("el rol del administrador principal sigue protegido", async () => {
  const env = environment({ owner: true });
  try {
    const result = await handlers.PATCH(request("PATCH", { action: "update_member", user_id: "11111111-1111-4111-8111-111111111111", name: "Admin", role: "operacion", language: "en" }));
    assert.equal(result.status, 400);
    assert.ok(!env.calls.some((call) => call.method === "PATCH" || call.method === "PUT"));
  } finally { env.restore(); }
});

test("solo un administrador activo puede gestionar preferencias de otros", async () => {
  for (const options of [{ role: "operacion" }, { status: "inactivo" }]) {
    const env = environment(options);
    try {
      const result = await handlers.POST(request("POST", { ...invitation, language: "en" }));
      assert.equal(result.status, 400);
      assert.ok(!env.calls.some((call) => call.path === "/auth/v1/invite"));
    } finally { env.restore(); }
  }
  const env = environment();
  try {
    const result = await handlers.GET(request("GET", undefined, false));
    assert.equal(result.status, 403);
    assert.equal(env.calls.length, 0);
  } finally { env.restore(); }
});

test("la lista de miembros lee el idioma sin consultar usuarios de otros negocios", async () => {
  const env = environment();
  try {
    const result = await handlers.GET(request("GET"));
    assert.equal(result.status, 200);
    const rows = await result.json();
    assert.equal(rows[0].language, "fr");
    assert.ok(!env.calls.some((call) => call.path === "/auth/v1/admin/users"));
  } finally { env.restore(); }
});
