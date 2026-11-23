import { LegalDocument } from "@/components/legal-document";
import { legalMetadata } from "@/lib/legal-seo";

export const metadata = legalMetadata("accountDeletion", "en");
export default function Page() {
  return <LegalDocument document="accountDeletion" language="en" />;
}
