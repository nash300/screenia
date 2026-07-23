import PublicLegalDocumentPage from "@/components/PublicLegalDocumentPage";
import "../landing.css";

export const dynamic = "force-dynamic";

export default function CookiePolicyPage() {
  return <PublicLegalDocumentPage documentType="cookie" />;
}
