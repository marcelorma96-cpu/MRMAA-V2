import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("terms", "en");

export default function Page() {
  return <LegalDocument document="terms" language="en" />;
}
