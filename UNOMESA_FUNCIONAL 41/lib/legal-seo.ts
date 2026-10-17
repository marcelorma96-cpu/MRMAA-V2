import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "./legal-content";
import { LEGAL_PATHS, legalHref, type LegalDocumentId } from "./legal-routes";
import { publicSiteOrigin, searchIndexingEnabled } from "./public-seo";
import type { AppLanguage } from "./translations";

export function legalAlternates(document: LegalDocumentId) {
  const origin = publicSiteOrigin();
  return origin ? {
    es: origin + LEGAL_PATHS[document].es,
    en: origin + LEGAL_PATHS[document].en,
    "x-default": origin + LEGAL_PATHS[document].en,
  } : undefined;
}

export function legalMetadata(document: LegalDocumentId, language: AppLanguage): Metadata {
  const { title, intro: description } = LEGAL_DOCUMENTS[document][language];
  const origin = publicSiteOrigin(), url = origin ? origin + legalHref(document, language) : undefined;
  const localizedTitle = `${title} | UnoMesa`;
  return {
    title: localizedTitle, description,
    robots: { index: searchIndexingEnabled(), follow: searchIndexingEnabled() },
    ...(url ? { alternates: { canonical: url, languages: legalAlternates(document) } } : {}),
    openGraph: { title: localizedTitle, description, url, siteName: "UnoMesa", type: "website",
      locale: language === "en" ? "en_US" : "es_ES", alternateLocale: [language === "en" ? "es_ES" : "en_US"] },
    twitter: { card: "summary", title: localizedTitle, description },
  };
}
