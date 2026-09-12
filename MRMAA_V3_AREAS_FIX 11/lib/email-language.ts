export const EMAIL_LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
] as const;

export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number]["value"];

export function isEmailLanguage(value: unknown): value is EmailLanguage {
  return value === "es" || value === "en";
}

export function emailLanguage(value: unknown): EmailLanguage {
  return isEmailLanguage(value) ? value : "es";
}

// No roles or other account metadata are included in a preference update.
export function emailLanguageUpdate(value: unknown) {
  if (!isEmailLanguage(value)) throw new Error("Seleccione Español o English.");
  return { data: { language: value } };
}
