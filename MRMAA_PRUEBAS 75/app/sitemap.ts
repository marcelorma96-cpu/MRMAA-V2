import type { MetadataRoute } from "next";
import { publicSiteOrigin, searchIndexingEnabled } from "@/lib/public-seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  if (!origin || !searchIndexingEnabled()) return [];
  return ["/", "/privacidad", "/terminos", "/suscripciones", "/tratamiento-datos"].map(path => ({ url: `${origin}${path}` }));
}
