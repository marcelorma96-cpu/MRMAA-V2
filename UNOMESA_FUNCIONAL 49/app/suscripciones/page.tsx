import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("subscriptions", "es");

export default function Page() {
  return <LegalDocument document="subscriptions" language="es" />;
}
