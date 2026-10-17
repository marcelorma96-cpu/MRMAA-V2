const spanishCountries = new Set([
  "GT", "MX", "ES", "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC",
  "SV", "GQ", "HN", "NI", "PA", "PY", "PE", "PR", "UY", "VE",
]);

/** Public defaults only; never changes a restaurant's saved preferences. */
export function publicLocale(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  const country = /^[A-Z]{2}$/.test(normalized) ? normalized : null;
  return {
    country,
    language: country && spanishCountries.has(country) ? "es" as const : "en" as const,
    currency: country === "GT" ? "GTQ" as const : country === "MX" ? "MXN" as const : "USD" as const,
  };
}
