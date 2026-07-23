import PublicLegalDocumentPage from "@/components/PublicLegalDocumentPage";
import "../landing.css";

export const dynamic = "force-dynamic";

export default function SubscriptionBillingPolicyPage() {
  return <PublicLegalDocumentPage documentType="subscription_billing" />;
}
