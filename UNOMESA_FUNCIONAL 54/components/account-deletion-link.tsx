import { legalHref } from "@/lib/legal-routes";
import type { AppLanguage } from "@/lib/translations";

export function AccountDeletionLink({ language }: { language: AppLanguage }) {
  const en = language === "en";
  return <section className="moduleCard settingsPanel" translate="no">
    <h2>{en ? "Delete account and personal data" : "Eliminar cuenta y datos personales"}</h2>
    <p>{en ? "Request deletion through UnoMesa Support. You can also use this public page if you cannot sign in." : "Solicite la eliminación a soporte de UnoMesa. También puede usar esta página pública si no puede iniciar sesión."}</p>
    <a href={legalHref("accountDeletion", language)} target="_blank" rel="noopener noreferrer">{en ? "Request account deletion" : "Solicitar eliminación de cuenta"} ↗</a>
  </section>;
}
