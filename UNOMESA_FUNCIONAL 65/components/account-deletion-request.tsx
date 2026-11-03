import type { AppLanguage } from "@/lib/translations";
import styles from "./account-deletion-request.module.css";

/** Public email request only: opening this page or link never deletes data. */
export function AccountDeletionRequest({ language }: { language: AppLanguage }) {
  const en = language === "en";
  const subject = en ? "UnoMesa account and data deletion request" : "Solicitud de eliminación de cuenta y datos de UnoMesa";
  const body = en
    ? "Hello UnoMesa Support,\n\nI request deletion of my UnoMesa account and its associated personal data.\n\nAccount email:\nRestaurant / company:\nLocations, if applicable:\nScope: personal account / entire business (owner only)\n\nPlease confirm the verification steps, deletion timeframe, and any data that must be retained, including the reason and retention period.\n\nThank you."
    : "Hola, soporte de UnoMesa:\n\nSolicito eliminar mi cuenta de UnoMesa y los datos personales asociados.\n\nCorreo de la cuenta:\nRestaurante / empresa:\nSucursales, si corresponde:\nAlcance: cuenta personal / negocio completo (solo propietario)\n\nPor favor, confirmen los pasos de verificación, el plazo de eliminación y cualquier dato que deba conservarse, con el motivo y plazo de conservación.\n\nGracias.";
  const href = `mailto:support@unomesa.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return <section className={styles.card} aria-labelledby="request-deletion">
    <span className={styles.eyebrow}>{en ? "ACCOUNT & PRIVACY" : "CUENTA Y PRIVACIDAD"}</span>
    <h2 id="request-deletion">{en ? "Request account deletion" : "Solicitar eliminación de cuenta"}</h2>
    <p>{en ? "You can send a request without signing in or reinstalling UnoMesa." : "Puede enviar su solicitud sin iniciar sesión ni reinstalar UnoMesa."}</p>
    <a className={styles.action} href={href}>{en ? "Prepare request email" : "Preparar correo de solicitud"}<span aria-hidden="true">↗</span></a>
    <p className={styles.hint}>{en ? "This button opens your email app with a draft. Review it and press Send there. Opening it does not submit a request or delete anything." : "Este botón abre su aplicación de correo con un borrador. Revíselo y pulse Enviar allí. Abrirlo no envía la solicitud ni elimina información."}</p>
    <p>{en ? "If the button does not open your email app, write directly to " : "Si el botón no abre su aplicación de correo, escriba directamente a "}<a className={styles.email} href={href}>support@unomesa.com</a>.</p>
    <p className={styles.hint}>{en ? "Subject: " : "Asunto: "}<strong>{subject}</strong></p>
  </section>;
}
