/** Each environment sends authentication links to its own site. */
export function siteOrigin(fallbackOrigin?: string): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || fallbackOrigin
    || (typeof window !== "undefined" ? window.location.origin : "");
  if (!raw) throw new Error("Falta configurar la dirección de este sitio.");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("La dirección del sitio debe usar HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Configure únicamente el dominio del sitio, sin rutas ni parámetros.");
  }
  return url.origin;
}
