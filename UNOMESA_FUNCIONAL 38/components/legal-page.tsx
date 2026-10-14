import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { LegalLanguageSelector } from "./legal-language-selector";
import { legalHref, type LegalDocumentId } from "@/lib/legal-routes";
import type { AppLanguage } from "@/lib/translations";

// Existing consent protocol is pinned by deployed SQL. An identity correction must not rewrite historical receipts.
export const LEGAL_VERSION = "2026-09-10";
export const LEGAL_UPDATED_ON = "2026-10-08";

export function LegalPage({ document, language, title, intro, children, updatedOn = LEGAL_UPDATED_ON }: { document: LegalDocumentId; language: AppLanguage; title: string; intro: string; children: React.ReactNode; updatedOn?: string }) {
  const en = language === "en";
  const links: Array<[LegalDocumentId, string]> = [
    ["terms", en ? "Terms" : "Términos"], ["privacy", en ? "Privacy" : "Privacidad"],
    ["subscriptions", en ? "Subscriptions and refunds" : "Suscripciones y reembolsos"],
    ["dataProcessing", en ? "Data processing" : "Tratamiento de datos"],
  ];
  return (
    <main className="legalPage" lang={language} translate="no">
      <article>
        <div className="legalHeader">
          <Link className="legalBack" href={en ? "/" : "/es"}>← {en ? "Back to UnoMesa" : "Volver a UnoMesa"}</Link>
          <LegalLanguageSelector document={document} language={language} />
        </div>
        <BrandLogo className="brandLogoLegal" />
        <span className="heroTag">UnoMesa LLC · UnoMesa</span>
        <h1>{title}</h1>
        <p className="legalLead">{intro}</p>
        {updatedOn && <p className="legalDate">{en ? "Last updated:" : "Última actualización:"} <time dateTime={updatedOn}>{updatedOn}</time></p>}
        {children}
        <hr />
        <nav className="legalDocumentLinks" aria-label={en ? "Legal documents" : "Documentos legales"}>
          {links.map(([id, label]) => <Link key={id} href={legalHref(id, language)} aria-current={id === document ? "page" : undefined}>{label}</Link>)}
        </nav>
        <p><strong>{en ? "Contact:" : "Contacto:"}</strong> UnoMesa LLC · support@unomesa.com.</p>
        <p className="legalNotice">{en
          ? "This document is a contractual foundation for a B2B platform. It must be reviewed by qualified legal counsel before general commercial launch in each jurisdiction."
          : "Este documento constituye una base contractual para una plataforma B2B. Debe ser revisado por asesoría legal habilitada antes del lanzamiento comercial general en cada jurisdicción."}</p>
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}
