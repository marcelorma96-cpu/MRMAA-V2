import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("privacy", "es");

export default function Page() {
  return <LegalDocument document="privacy" language="es" />;
}
