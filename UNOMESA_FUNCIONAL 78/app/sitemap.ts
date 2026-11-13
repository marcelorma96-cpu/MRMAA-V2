import type { MetadataRoute } from "next";
import { publicSiteOrigin, searchIndexingEnabled, publicAlternates } from "@/lib/public-seo";
import { EVENT_PATHS } from "@/lib/event-page-seo";
import { LEGAL_PATHS, type LegalDocumentId } from "@/lib/legal-routes";
import { legalAlternates } from "@/lib/legal-seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  if (!origin || !searchIndexingEnabled()) return [];
  const events = Object.values(EVENT_PATHS).map(path => ({ url: origin + path, alternates: { languages: { es: origin + EVENT_PATHS.es, en: origin + EVENT_PATHS.en, "x-default": origin + EVENT_PATHS.en } } }));
  const legal = (Object.keys(LEGAL_PATHS) as LegalDocumentId[]).flatMap(document =>
    Object.values(LEGAL_PATHS[document]).map(path => ({ url: origin + path, alternates: { languages: legalAlternates(document) } })));
  return [...["/", "/es"].map(path => ({ url: `${origin}${path}`, alternates: { languages: publicAlternates() } })), ...legal, ...events];
}
