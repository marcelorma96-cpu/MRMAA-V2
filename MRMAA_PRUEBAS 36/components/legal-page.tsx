import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

export const LEGAL_VERSION = "2026-09-10";

export function LegalPage({ title, intro, children, updatedOn }: { title: string; intro: string; children: React.ReactNode; updatedOn?: string }) {
  return (
    <main className="legalPage">
      <article>
        <Link className="legalBack" href="/">← Volver a UnoMesa</Link>
        <BrandLogo className="brandLogoLegal" />
        <span className="heroTag">MYM S.A. · UnoMesa</span>
        <h1>{title}</h1>
        <p className="legalLead">{intro}</p>
        <p className="legalDate">Versión vigente: {LEGAL_VERSION}</p>
        {updatedOn && <p className="legalDate">Última actualización: <time dateTime={updatedOn}>{updatedOn}</time></p>}
        {children}
        <hr />
        <p><strong>Contacto:</strong> support@unomesa.com · Ciudad de Guatemala, Guatemala.</p>
        <p className="legalNotice">Este documento constituye una base contractual para una plataforma B2B. Debe ser revisado por asesoría legal habilitada antes del lanzamiento comercial general en cada jurisdicción.</p>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}
