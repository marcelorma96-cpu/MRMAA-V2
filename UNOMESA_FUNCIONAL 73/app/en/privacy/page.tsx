import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("privacy", "en");

export default function Page() {
  return <LegalDocument document="privacy" language="en" />;
}
