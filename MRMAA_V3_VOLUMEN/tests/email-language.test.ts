import assert from "node:assert/strict";
import test from "node:test";
import { emailLanguage, emailLanguageUpdate } from "../lib/email-language";

test("la preferencia personal solo modifica el idioma, sin campos de permisos", () => {
  for (const language of ["es", "en"] as const) {
    assert.equal(emailLanguage(language), language);
    assert.deepEqual(emailLanguageUpdate(language), { data: { language } });
  }
});

test("perfiles antiguos usan español y no se guardan idiomas inválidos", () => {
  for (const value of [undefined, null, "", "de", "fr", "fr-CA", 123, {}, ["en"], { role: "administrador" }]) {
    assert.equal(emailLanguage(value), "es");
    assert.throws(() => emailLanguageUpdate(value));
  }
});
