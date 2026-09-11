import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuote,
  calculateQuoteWithAdjustments,
  numberValue,
} from "../lib/calculations";

test("calcula subtotal, descuento, propina, anticipo y saldo", () => {
  const result = calculateQuote(
    [
      { name: "Menú", description: "", quantity: 10, unit_price: 25 },
      { name: "Salón", description: "", quantity: 1, unit_price: 100 },
    ],
    10,
    10,
    100,
  );

  assert.deepEqual(result, {
    subtotal: 350,
    discountPct: 10,
    discount: 35,
    afterDiscount: 315,
    tipPct: 10,
    tip: 31.5,
    total: 346.5,
    deposit: 100,
    balance: 246.5,
  });
});

test("no permite porcentajes de descuento mayores a 100 ni anticipo mayor al total", () => {
  const result = calculateQuote(
    [{ name: "Evento", description: "", quantity: 1, unit_price: 200 }],
    150,
    10,
    500,
  );

  assert.equal(result.total, 0);
  assert.equal(result.deposit, 0);
  assert.equal(result.balance, 0);
});

test("normaliza entradas vacías, negativas y decimales con coma", () => {
  assert.equal(numberValue("12,50"), 12.5);
  assert.equal(numberValue(""), 0);
  assert.equal(numberValue(-7), 0);
});

test("aplica cobros y descuentos personalizados antes del anticipo", () => {
  const result = calculateQuoteWithAdjustments(
    [{ name: "Evento", description: "", quantity: 1, unit_price: 1000 }],
    0,
    10,
    200,
    [
      { id: "servicio", label: "Servicio", kind: "charge", mode: "percent", value: 5 },
      { id: "anticipo", label: "Descuento de evento", kind: "discount", mode: "fixed", value: 100 },
    ],
  );
  assert.equal(result.subtotal, 1000);
  assert.equal(result.tip, 100);
  assert.equal(result.adjustmentTotal, -50);
  assert.equal(result.total, 1050);
  assert.equal(result.balance, 850);
});
