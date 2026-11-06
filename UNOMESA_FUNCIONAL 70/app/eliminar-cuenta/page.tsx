import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("accountDeletion", "es");
export default function Page() {
  return <LegalDocument document="accountDeletion" language="es" />;
}
