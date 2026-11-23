import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("terms", "es");

export default function Page() {
  return <LegalDocument document="terms" language="es" />;
}
