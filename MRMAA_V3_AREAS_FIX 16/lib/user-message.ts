const TECHNICAL_ERROR =
  /(?:supabase|postgrest|postgres|auth\/v\d|rest\/v\d|row.level security|permission denied|duplicate key|foreign key|unique constraint|violates|relation ["']|table ["']|column ["']|schema ["']|invalid input syntax|jwt|pgrst\d|sqlstate|failed to fetch|networkerror|fetch failed|load fail(?:ed)?|failed to load|network request failed|aborterror|\b(?:22|23|42)[0-9a-z]{3}\b)/i;

const KNOWN_USER_MESSAGES = [
  "Primero elimine la reserva vinculada",
  "Esta cotización ya tiene una reservación vinculada",
  "Ya existe el cliente",
  "Ya existe un menú o producto",
  "Seleccione ",
  "Indique ",
  "Agregue ",
  "Necesito dos semanas",
  "No hay días vacíos",
];

/** Keeps product messages but hides provider, database and API internals. */
export function userMessage(value: unknown, fallback?: string) {
  const message = value instanceof Error ? value.message
    : value && typeof value === "object" && "message" in value ? String(value.message || "").trim()
    : String(value || "").trim();
  const generic = fallback ||
    (typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
      ? "An error occurred. Refresh the page and try again."
      : "Ocurrió un error. Actualice la página e intente nuevamente.");
  if (!message) return generic;
  if (/invalid login credentials/i.test(message))
    return typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
      ? "Incorrect email or password."
      : "Correo o contraseña incorrectos.";
  if (/email rate limit exceeded|too many requests/i.test(message))
    return typeof document !== "undefined" && document.documentElement.lang.startsWith("en")
      ? "Too many attempts. Wait a few minutes and try again."
      : "Demasiados intentos. Espere unos minutos e intente nuevamente.";
  if (KNOWN_USER_MESSAGES.some((known) => message.startsWith(known))) return message;
  return TECHNICAL_ERROR.test(message) ? generic : message;
}
