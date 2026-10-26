import type { AppLanguage } from "./translations";

/** Explicit public URLs keep the chosen language across tabs, devices and server rendering. */
export const LEGAL_PATHS = {
  terms: { es: "/terminos", en: "/en/terms" },
  privacy: { es: "/privacidad", en: "/en/privacy" },
  subscriptions: { es: "/suscripciones", en: "/en/subscriptions" },
  dataProcessing: { es: "/tratamiento-datos", en: "/en/data-processing" },
  accountDeletion: { es: "/eliminar-cuenta", en: "/en/delete-account" },
} as const;

export type LegalDocumentId = keyof typeof LEGAL_PATHS;
export function legalHref(document: LegalDocumentId, language: AppLanguage) {
  return LEGAL_PATHS[document][language];
}
