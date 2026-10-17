"use client";

import { useAppPreferences } from "./app-preferences";
import { legalHref, type LegalDocumentId } from "@/lib/legal-routes";
import type { AppLanguage } from "@/lib/translations";

export function LegalLanguageSelector({ document, language }: { document: LegalDocumentId; language: AppLanguage }) {
  const { currency, setPreferences } = useAppPreferences();
  return <nav className="legalLanguages" aria-label={language === "en" ? "Document language" : "Idioma del documento"}>
    {(["es", "en"] as const).map(locale => <a key={locale} href={legalHref(document, locale)}
      hrefLang={locale} lang={locale} aria-current={language === locale ? "page" : undefined}
      onClick={event => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setPreferences(locale, currency);
      }}>{locale === "es" ? "Español" : "English"}</a>)}
  </nav>;
}
