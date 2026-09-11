import assert from "node:assert/strict";
import test from "node:test";
import {
  appCurrency,
  appLanguage,
  formatAppMoney,
} from "../components/app-preferences";
import { translate, translateRecord } from "../lib/translations";

test("la aplicación admite solo español e inglés", () => {
  assert.equal(appLanguage("es"), "es");
  assert.equal(appLanguage("en"), "en");
  assert.equal(appLanguage("fr"), "es");
  assert.equal(translate("Cotizaciones", "en"), "Quotes");
  assert.equal(translate("Quotes", "es"), "Cotizaciones");
});

test("las monedas válidas son GTQ, USD y MXN sin convertir el valor", () => {
  assert.equal(appCurrency("GTQ"), "GTQ");
  assert.equal(appCurrency("USD"), "USD");
  assert.equal(appCurrency("MXN"), "MXN");
  assert.equal(appCurrency("EUR"), "GTQ");
  const currencyMarkers = { GTQ: "GTQ", USD: "$", MXN: "MX$" } as const;
  for (const currency of ["GTQ", "USD", "MXN"] as const) {
    const formatted = formatAppMoney(1234.5, currency, "en");
    assert.match(formatted, /1,234\.50/);
    assert.ok(formatted.includes(currencyMarkers[currency]));
  }
});

test("los encabezados exportados cambian de idioma sin tocar los datos", () => {
  assert.deepEqual(
    translateRecord({ Cliente: "Mesa Norte", Telefono: "+502 5555" }, "en"),
    { Customer: "Mesa Norte", Phone: "+502 5555" },
  );
});
