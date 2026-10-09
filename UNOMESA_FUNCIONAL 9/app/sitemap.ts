import type { MetadataRoute } from "next";
import { publicSiteOrigin, searchIndexingEnabled, publicAlternates } from "@/lib/public-seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  if (!origin || !searchIndexingEnabled()) return [];
  return ["/", "/es", "/privacidad", "/terminos", "/suscripciones", "/tratamiento-datos"].map(path => ({ url: `${origin}${path}`, ...(["/","/es"].includes(path)?{alternates:{languages:publicAlternates()}}:{}) }));
}
