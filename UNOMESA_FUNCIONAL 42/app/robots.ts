import type { MetadataRoute } from "next";
import { publicSiteOrigin, searchIndexingEnabled } from "@/lib/public-seo";
export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  if (!searchIndexingEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}) };
}
