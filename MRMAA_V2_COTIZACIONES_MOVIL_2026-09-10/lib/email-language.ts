export const EMAIL_LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
] as const;

export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number]["value"];

export function isEmailLanguage(value: unknown): value is EmailLanguage {
  return value === "es" || value === "en" || value === "fr";
}

export function emailLanguage(value: unknown): EmailLanguage {
  return isEmailLanguage(value) ? value : "es";
}

// No roles or other account metadata are included in a preference update.
export function emailLanguageUpdate(value: unknown) {
  if (!isEmailLanguage(value)) throw new Error("Seleccione Español, English o Français.");
  return { data: { language: value } };
}
