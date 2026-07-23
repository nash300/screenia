import PublicLegalDocumentPage from "@/components/PublicLegalDocumentPage";
import "../landing.css";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return <PublicLegalDocumentPage documentType="privacy" />;
}
