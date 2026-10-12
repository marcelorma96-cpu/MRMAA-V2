import type { MetadataRoute } from "next";
import { publicSiteOrigin, searchIndexingEnabled, publicAlternates } from "@/lib/public-seo";
import { EVENT_PATHS } from "@/lib/event-page-seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  if (!origin || !searchIndexingEnabled()) return [];
  const events = Object.values(EVENT_PATHS).map(path => ({ url: origin + path, alternates: { languages: { es: origin + EVENT_PATHS.es, en: origin + EVENT_PATHS.en, "x-default": origin + EVENT_PATHS.en } } }));
  return [...["/", "/es", "/privacidad", "/terminos", "/suscripciones", "/tratamiento-datos"].map(path => ({ url: `${origin}${path}`, ...(["/","/es"].includes(path)?{alternates:{languages:publicAlternates()}}:{}) })), ...events];
}
