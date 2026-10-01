export const PUBLIC_SEO_COPY = {
  en: {
    title: "UnoMesa | Restaurant Reservations, Quotes & Staff Schedules",
    description: "Manage restaurant reservations, event quotes, customers and staff schedules with UnoMesa. Try Advanced free for 10 days, no card required. Available in English and Spanish.",
  },
  es: {
    title: "UnoMesa | Reservaciones, cotizaciones y horarios para restaurantes",
    description: "Organice reservaciones, cotizaciones de eventos, clientes y horarios con UnoMesa. Pruebe Advanced gratis por 10 días, sin tarjeta. Disponible en español e inglés.",
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
    return url.origin;
  } catch { return null; }
}
