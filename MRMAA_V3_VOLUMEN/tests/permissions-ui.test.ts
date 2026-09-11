import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Clients, Quotes, QuotePreview } from "../components/dashboard";
import { ReservationsEnhanced } from "../components/reservations-enhanced";
import { MonthlySchedules } from "../components/advanced-modules";
import { permissionsFor, requirePermission } from "../lib/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

// tsx's standalone renderer uses classic JSX; Next's production build uses automatic JSX.
(globalThis as any).React = React;
const noop = () => {};
const client = { id: "client-a", name: "Cliente de prueba", phone: "", email: "", notes: "" };
const quote = { id: "quote-a", quote_number: 2010, client_name: "Cliente de prueba", event_date: "2026-09-10", event_time: "12:00", status: "pendiente", items: [], total: 500, deposit: 0, discount_pct: 0, tip_pct: 0 };
const reservation = { id: "reservation-a", client_name: "Cliente de prueba", event_date: new Date().toISOString().slice(0, 10), event_time: "12:00", quote_id: quote.id };

for (const [role, edit, schedule, admin] of [
  ["lectura", false, false, false], ["operacion", true, false, false],
  ["gerente", true, true, false], ["administrador", true, true, true],
] as const) {
  test(`${role}: interfaz conserva consultas y solo muestra las acciones autorizadas`, () => {
    const permissions = permissionsFor(role, "activo");
    const props = { canEdit: permissions.canOperate, canDelete: permissions.isAdmin, edit: noop, remove: noop, removeMany: async () => {} };
    const clients = renderToStaticMarkup(React.createElement(Clients, { ...props, rows: [client] as any }));
    assert.equal(clients.includes('title="Editar cliente"'), edit);
    assert.equal(clients.includes('title="Enviar a la papelera"'), admin);
    assert.equal(clients.includes("Eliminar seleccionados"), false);
    assert.equal(clients.includes('aria-label="Seleccionar Cliente de prueba"'), admin);
    assert.ok(clients.includes("Descargar Excel") && clients.includes("Imprimir"));
    const quotes = renderToStaticMarkup(React.createElement(Quotes, { ...props, rows: [quote] as any, preview: noop, convert: noop }));
    assert.equal(quotes.includes('title="Editar cotización"'), edit);
    assert.equal(quotes.includes('title="Convertir en reservación"'), edit);
    assert.equal(quotes.includes('title="Enviar a la papelera"'), admin);
    assert.ok(quotes.includes('title="Ver cotización"'));
    const preview = renderToStaticMarkup(React.createElement(QuotePreview, { quote: quote as any, settings: {}, restaurant: "Prueba", close: noop, edit: noop, canEdit: permissions.canOperate }));
    assert.equal(/>\s*Editar\s*</.test(preview), edit);
    assert.ok(preview.includes("Descargar PDF A4"));
    const reservations = renderToStaticMarkup(React.createElement(ReservationsEnhanced, { ...props, rows: [reservation] as any, quotes: [quote] as any, restaurantId: "restaurant-a", restaurantName: "Prueba", openQuote: noop, reload: async () => {} }));
    assert.equal(reservations.includes('title="Editar reservación"'), edit);
    assert.equal(/>\s*Importar\s*</.test(reservations), edit);
    assert.equal(reservations.includes('type="file"'), edit);
    assert.equal(reservations.includes('title="Enviar a la papelera"'), admin);
    assert.ok(reservations.includes("Imprimir") && reservations.includes("Excel") && reservations.includes('title="Ver cotización"'));
    const schedules = renderToStaticMarkup(React.createElement(MonthlySchedules, { restaurantId: "restaurant-a", canEdit: permissions.canManageSchedules }));
    assert.equal(schedules.includes("scheduleEditor"), schedule);
    assert.equal(schedules.includes("Copiar mes anterior"), schedule);
    assert.equal(schedules.includes("Generar automáticamente"), schedule);
    assert.equal(schedules.includes("Minimizar"), schedule);
    assert.equal(schedules.includes('aria-expanded="true"'), schedule);
    assert.ok(schedules.includes("Imprimir horarios") && schedules.includes("Buscar empleado"));
  });
}

test("roles desconocidos y estados no activos no conceden acceso", () => {
  for (const role of ["administrador", "gerente", "operacion", "lectura", undefined, "otro"]) {
    for (const status of [undefined, "invitado", "inactivo"]) {
      assert.ok(Object.values(permissionsFor(role, status)).every((value) => !value));
    }
  }
  assert.ok(Object.values(permissionsFor("otro", "activo")).every((value) => !value));
});

test("guardar vuelve a comprobar membresía y no acepta un rol falso en metadatos", async () => {
  let membership: any = { role: "operacion", status: "activo" };
  let lookupError: any = null;
  let lookups = 0;
  const filters: [string, string][] = [];
  const query = { eq(key: string, value: string) { filters.push([key, value]); return query; }, async maybeSingle() { lookups++; return { data: membership, error: lookupError }; } };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-a", user_metadata: { role: "administrador" } } }, error: null }) },
    from: (name: string) => { assert.equal(name, "v2_members"); return { select: () => query }; },
  } as unknown as SupabaseClient;
  await requirePermission(client, "restaurant-a", "canOperate");
  membership = { role: "lectura", status: "activo" };
  await assert.rejects(requirePermission(client, "restaurant-a", "canOperate"), /no permite/);
  await assert.rejects(requirePermission(client, "restaurant-a", "isAdmin"), /no permite/);
  membership = { role: "administrador", status: "inactivo" };
  await assert.rejects(requirePermission(client, "restaurant-a", "isAdmin"), /no permite/);
  lookupError = { message: "database unavailable" };
  await assert.rejects(requirePermission(client, "restaurant-a", "canOperate"), /verificar/);
  assert.equal(lookups, 5);
  assert.ok(filters.some(([key, value]) => key === "user_id" && value === "user-a"));
  assert.ok(filters.some(([key, value]) => key === "restaurant_id" && value === "restaurant-a"));
});
