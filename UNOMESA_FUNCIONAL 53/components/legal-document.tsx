import { LegalPage, LegalSection } from "./legal-page";
import { AccountDeletionRequest } from "./account-deletion-request";
import { LEGAL_DOCUMENTS } from "@/lib/legal-content";
import type { LegalDocumentId } from "@/lib/legal-routes";
import type { AppLanguage } from "@/lib/translations";

/** Complete, server-rendered text; does not rely on the dashboard's DOM translator. */
export function LegalDocument({ document, language }: { document: LegalDocumentId; language: AppLanguage }) {
  const content = LEGAL_DOCUMENTS[document][language];
  return <LegalPage document={document} language={language} title={content.title} intro={content.intro} updatedOn={content.updatedOn}>
    {document === "accountDeletion" && <AccountDeletionRequest language={language} />}
    {content.sections.map((section, index) => <LegalSection key={index} title={section.title}>
      {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </LegalSection>)}
  </LegalPage>;
}
