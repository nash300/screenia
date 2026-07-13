export const CURRENT_TERMS_VERSION = "2026-07-12-prelaunch";
export const CURRENT_PRIVACY_VERSION = "2026-07-12-prelaunch";

export const CURRENT_TERMS_DOCUMENT = {
  type: "terms",
  title: "Villkor",
  version: CURRENT_TERMS_VERSION,
  effectiveDate: "2026-07-12",
  url: "/terms",
  pdfUrl: "/legal/villkor-current.pdf",
  summary:
    "Pre-launch version. Screenia can be tested with test customers and Stripe test mode, but live customer payments must wait until business, tax, and final legal readiness are complete.",
  content:
    "Screenia provides managed digital screen setup, content collection, device administration, and subscription-based display service for Swedish customers. During pre-launch, orders and payments are tested in Stripe test mode unless Screenia has explicitly enabled live payments after business registration, tax/VAT readiness, and final policy review. Customers must provide accurate company/contact, billing, and delivery details. The first setup and device preparation work may affect refund rights once layout or production work has started. Monthly subscription access depends on a paid and active subscription. If a subscription is cancelled at period end, service access continues until the paid-through date. Screenia may block display access for paused subscriptions, failed payments, refunds, cancellations, expired entitlement, misuse, or operational/security risk. Admin actions affecting billing or access must be recorded in the audit trail.",
} as const;

export const CURRENT_PRIVACY_DOCUMENT = {
  type: "privacy",
  title: "Integritetspolicy",
  version: CURRENT_PRIVACY_VERSION,
  effectiveDate: "2026-07-12",
  url: "/privacy",
  pdfUrl: "/legal/integritetspolicy-current.pdf",
  summary:
    "Pre-launch privacy version for Screenia testing and launch preparation. Final review is required before accepting live customers.",
  content:
    "Screenia stores only the customer, billing, support, consent, content, device, order, and subscription information needed to provide and administer the service. This may include company name, contact person, email, phone, delivery address, uploaded display material, messages, consent choices, Stripe identifiers, subscription status, audit events, and device/display configuration. Screenia uses Supabase for application data, authentication and storage, Stripe for payments and invoices, Resend and Supabase email services for transactional messages, Vercel for hosting and runtime infrastructure, and Loopia for domain and email services. Screenia keeps an internal data processor register and must verify processor terms, access controls, and security settings before live customer data is processed. Screenia records consent and audit history so customer actions, legal acceptance, payment events, admin changes, support updates, and deletion/refund actions can be traced. Customers can contact Screenia to request access, correction, deletion, or support with privacy questions. Some records may need to be retained for accounting, tax, fraud-prevention, security, dispute, or legal obligations.",
} as const;
