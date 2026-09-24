"use client";
import { useAppPreferences } from "./app-preferences";

export function MobileComingSoon() {
  const { language } = useAppPreferences();
  const en = language === "en";
  return <section className="mobileComingSoon" translate="no" aria-label={en ? "Mobile apps coming soon" : "Aplicaciones móviles próximamente"}>
    <h2>{en ? "MRMAA, wherever you are" : "MRMAA, donde usted esté"}</h2>
    <p>{en ? "Mobile apps in our plans. Release date to be announced." : "Aplicaciones móviles en nuestros planes. Fecha de lanzamiento por anunciar."}</p>
    <div className="mobileComingSoonBadges">
      <div className="mobileComingSoonBadge">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c.03 3.23 2.83 4.3 2.86 4.32-.02.08-.45 1.53-1.48 3.03-.89 1.3-1.81 2.6-3.27 2.63-1.44.03-1.9-.85-3.55-.85-1.64 0-2.16.82-3.52.88-1.41.05-2.49-1.41-3.39-2.71-1.84-2.66-3.25-7.52-1.36-10.8a5.25 5.25 0 0 1 4.46-2.7c1.39-.03 2.71.94 3.55.94.85 0 2.43-1.16 4.09-.99.7.03 2.66.28 3.92 2.13-.1.06-2.34 1.36-2.31 4.12ZM14.35 4.53c.75-.9 1.26-2.15 1.12-3.4-1.08.05-2.38.72-3.15 1.62-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.42-.61 3.17-1.54Z"/></svg>
        <span><small>{en ? "Coming soon" : "Próximamente"}</small><strong>iOS</strong></span>
      </div>
      <div className="mobileComingSoonBadge">
        <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="m8 8-3-5m19 5 3-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M2 25C2 14 8 7 16 7s14 7 14 18Z" fill="currentColor"/><circle cx="9" cy="17" r="1.5" fill="#18181b"/><circle cx="23" cy="17" r="1.5" fill="#18181b"/></svg>
        <span><small>{en ? "Coming soon" : "Próximamente"}</small><strong>Android</strong></span>
      </div>
    </div>
    <p>{en ? "You can already use MRMAA in your phone's browser." : "Ya puede utilizar MRMAA desde el navegador de su teléfono."}</p>
  </section>;
}
