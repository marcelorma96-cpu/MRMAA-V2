import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("dataProcessing", "es");

export default function Page() {
  return <LegalDocument document="dataProcessing" language="es" />;
}
