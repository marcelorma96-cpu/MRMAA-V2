import type { Metadata } from "next";
import { PLANS } from "./plans";

export const PUBLIC_SEO_COPY = {
  en: {
    title: "Restaurant Reservation Software & Event Quotes | UnoMesa",
    description: "Restaurant reservation software with floor plans, event quotes and customer management. Organize tables and groups with UnoMesa. Try free for 10 days.",
  },
  es: {
    title: "Software de reservaciones para restaurantes | UnoMesa",
    description: "Software de reservaciones para restaurantes con plano de mesas, cotizaciones de eventos y clientes. Organice salones y grupos con UnoMesa. Pruebe gratis 10 días.",
  },
} as const;

// The trial project changes only this default; it stays out of search results.
const TEST_PROJECT = false;
export function searchIndexingEnabled() {
  return !TEST_PROJECT && process.env.VERCEL_ENV !== "preview" && process.env.NEXT_PUBLIC_SEARCH_INDEXING !== "false";
}
/** Use the configured public domain, never an invented domain or localhost. */
export function publicSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
      || url.pathname !== "/" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
    // Production redirects the apex host to www. Keep all search signals on
    // the final URL while respecting other configured environments/domains.
    if (url.hostname === "unomesa.com") url.hostname = "www.unomesa.com";
    return url.origin;
  } catch { return null; }
}

export type PublicLanguage = "en" | "es";
export function publicAlternates() {
  const origin = publicSiteOrigin();
  return origin ? { en: `${origin}/`, es: `${origin}/es`, "x-default": `${origin}/` } : undefined;
}
export function publicMetadata(language: PublicLanguage, accountEntry = false): Metadata {
  if (accountEntry) return {
    title: language === "es" ? "Acceso a UnoMesa" : "Sign in to UnoMesa",
    robots: { index: false, follow: false }, alternates: {}, openGraph: null, twitter: null,
  };
  const copy = PUBLIC_SEO_COPY[language], origin = publicSiteOrigin();
  const url = origin ? `${origin}${language === "es" ? "/es" : "/"}` : undefined;
  const images = origin ? [{url:`${origin}/brand/unomesa-social.png`,width:1200,height:630,alt:"UnoMesa · Reservations, events & floor plans"}] : undefined;
  return {...copy, robots: {index:searchIndexingEnabled(),follow:searchIndexingEnabled()},
    ...(url ? {alternates:{canonical:url,languages:publicAlternates()}} : {}),
    openGraph:{type:"website",siteName:"UnoMesa",...copy,url,locale:language==="es"?"es_ES":"en_US",alternateLocale:[language==="es"?"en_US":"es_ES"],images},
    twitter:{card:"summary_large_image",...copy,images:images?.map(image=>image.url)},
  };
}
export function publicStructuredData(language: PublicLanguage) {
  const origin=publicSiteOrigin(); if(!origin)return null;
  const page=`${origin}${language==="es"?"/es":"/"}`,copy=PUBLIC_SEO_COPY[language];
  return {"@context":"https://schema.org","@graph":[
    {"@type":"Organization","@id":`${origin}/#organization`,name:"UnoMesa",legalName:"UnoMesa LLC",url:origin,logo:`${origin}/icon.png`},
    {"@type":"WebSite","@id":`${origin}/#website`,name:"UnoMesa",url:origin,inLanguage:["en","es"],publisher:{"@id":`${origin}/#organization`}},
    {"@type":"WebPage","@id":`${page}#webpage`,url:page,name:copy.title,description:copy.description,inLanguage:language,isPartOf:{"@id":`${origin}/#website`},about:{"@id":`${origin}/#software`}},
    {"@type":"SoftwareApplication","@id":`${origin}/#software`,name:"UnoMesa",applicationCategory:"BusinessApplication",operatingSystem:"Web browser",url:page,description:copy.description,inLanguage:["en","es"],publisher:{"@id":`${origin}/#organization`},
      featureList:language==="es"?["Reservaciones de restaurantes","Plano de mesas, salones y niveles","Cotizaciones de eventos","Gestión de clientes","Horarios del personal según plan"]:["Restaurant reservations","Floor plans, rooms and levels","Event quotes","Customer management","Staff schedules by plan"],
      offers:PLANS.flatMap(plan=>[{"@type":"Offer",name:`${plan.name} · ${language==="es"?"mensual":"monthly"}`,url:`${page}#planes`,priceCurrency:"USD",price:plan.monthly,priceSpecification:{"@type":"UnitPriceSpecification",priceCurrency:"USD",price:plan.monthly,billingDuration:"P1M"}},{"@type":"Offer",name:`${plan.name} · ${language==="es"?"anual":"annual"}`,url:`${page}#planes`,priceCurrency:"USD",price:plan.annual,priceSpecification:{"@type":"UnitPriceSpecification",priceCurrency:"USD",price:plan.annual,billingDuration:"P1Y"}}])},
  ]};
}
