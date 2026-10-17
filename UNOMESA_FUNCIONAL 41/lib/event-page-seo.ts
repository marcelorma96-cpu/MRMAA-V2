import type { Metadata } from "next";
import { publicSiteOrigin, searchIndexingEnabled, type PublicLanguage } from "./public-seo";

export const EVENT_PATHS = { es: "/es/software-eventos-restaurantes", en: "/restaurant-event-management" } as const;
const copy = {
  es: { title: "Software para eventos y grupos en restaurantes | UnoMesa", description: "Gestione cotizaciones, reservas de grupos, salones y anticipos con UnoMesa. Reciba solicitudes de eventos y pruebe Advanced gratis durante 10 días." },
  en: { title: "Restaurant Event Management & Group Bookings | UnoMesa", description: "Manage event quotes, group reservations, private dining rooms and recorded deposits with UnoMesa. Try Advanced free for 10 days, with no card required." },
};
export function eventPageMetadata(language: PublicLanguage): Metadata {
  const origin = publicSiteOrigin(), url = origin ? origin + EVENT_PATHS[language] : undefined;
  return { ...copy[language], robots: { index: searchIndexingEnabled(), follow: searchIndexingEnabled() },
    ...(origin ? { alternates: { canonical: url, languages: { es: origin + EVENT_PATHS.es, en: origin + EVENT_PATHS.en, "x-default": origin + EVENT_PATHS.en } } } : {}),
    openGraph: { ...copy[language], type: "website", siteName: "UnoMesa", url, locale: language === "es" ? "es_ES" : "en_US",
      ...(origin ? { images: [{ url: origin + "/brand/unomesa-social.png", width: 1200, height: 630, alt: "UnoMesa" }] } : {}) },
    twitter: { ...copy[language], card: "summary_large_image", ...(origin ? { images: [origin + "/brand/unomesa-social.png"] } : {}) },
  };
}
export function eventPageStructuredData(language: PublicLanguage) {
  const origin = publicSiteOrigin(); if (!origin) return null;
  const home = origin + (language === "es" ? "/es" : "/"), url = origin + EVENT_PATHS[language];
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": url + "#webpage", url, name: copy[language].title, description: copy[language].description, inLanguage: language, isPartOf: { "@id": origin + "/#website" }, about: { "@id": origin + "/#software" } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "UnoMesa", item: home },
      { "@type": "ListItem", position: 2, name: language === "es" ? "Gestión de eventos" : "Event management", item: url },
    ] },
  ] };
}
