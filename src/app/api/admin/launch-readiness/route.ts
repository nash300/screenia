import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/lib/legal/documents";
import {
  hasAccountingExportWorkflow,
  hasAdminAccessReviewWorkflow,
  hasAdminCustomerDraftWorkflow,
  hasAdminCustomerProfileEditWorkflow,
  hasBillingPortalWorkflow,
  getLivePaymentConfirmations,
  getTransactionalEmailReadiness,
  hasAdminNotificationWorkflow,
  hasBackupRestoreDrillWorkflow,
  hasCookieTrackingGovernance,
  hasCsrfProtectionPolicy,
  hasCurrentLegalDocuments,
  hasLegalBeforePaymentWorkflow,
  hasCustomerConsentManagementWorkflow,
  hasCustomerPreviewDecisionWorkflow,
  hasCustomerPasswordPolicy,
  hasCustomerSupportTicketIntakeWorkflow,
  hasCustomerSupportReplyWorkflow,
  hasCustomerDataExportWorkflow,
  hasCustomerDeletionSafetyWorkflow,
  hasDataRetentionReviewWorkflow,
  hasDataSubjectRequestWorkflow,
  hasDataProcessorRegister,
  hasDeviceManagementWorkflow,
  hasDisplayAssetReviewWorkflow,
  hasInventoryOperationsWorkflow,
  hasLegalChangeNoticeWorkflow,
  hasLoginAttemptProtection,
  hasOptInConsentDefaults,
  hasOperationalFulfillmentReadiness,
  hasPasswordResetAbuseProtection,
  hasPrivacyIncidentWorkflow,
  hasPrivateVideoBucket,
  hasPrivateSensitiveStorageBuckets,
  hasProcessorComplianceReviewWorkflow,
  hasPublicRequestIntakeWorkflow,
  hasPricingConfigurationReadiness,
  hasRequestPrivacyConsentWorkflow,
  hasRefundAndProductionBoundaryWorkflow,
  hasResendDeliveryEventWorkflow,
  hasRequiredSecurityHeaders,
  hasSensitiveNoStorePolicy,
  hasServiceWorkerCacheSafety,
  hasStripeFinancialRiskWebhookWorkflow,
  hasStripeWebhookEventLedger,
  hasSwedishRegistrationNumberValidation,
  hasSubscriptionOperationsMigration,
  hasTaxPaymentRegisterWorkflow,
  hasTextQualityCheckConfigured,
  hasTransactionalEmailWorkflow,
  hasVatSummaryWorkflow,
} from "@/lib/server/launch-readiness";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ReadinessStatus = "pass" | "warning" | "fail";

type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.app_metadata?.role === "admin" ? user : null;
}

function envSet(name: string) {
  return Boolean(process.env[name]?.trim());
}

function looksPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /your_|example|placeholder|todo|screenia$/i.test(value.trim());
}

function check(
  key: string,
  label: string,
  status: ReadinessStatus,
  detail: string,
): ReadinessCheck {
  return { key, label, status, detail };
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : "missing";
  const livePaymentsEnabled =
    process.env.SCREENIA_LIVE_PAYMENTS_ENABLED === "true";
  const livePaymentConfirmations = getLivePaymentConfirmations();
  const missingLivePaymentConfirmations = livePaymentConfirmations.filter(
    (item) => !item.confirmed,
  );
  const migration = await hasSubscriptionOperationsMigration(supabaseAdmin);
  const legalDocuments = await hasCurrentLegalDocuments(supabaseAdmin);
  const legalBeforePaymentWorkflow =
    await hasLegalBeforePaymentWorkflow(supabaseAdmin);
  const legalChangeNoticeWorkflow =
    await hasLegalChangeNoticeWorkflow(supabaseAdmin);
  const dataProcessorRegister = hasDataProcessorRegister();
  const processorComplianceReviewWorkflow =
    await hasProcessorComplianceReviewWorkflow(supabaseAdmin);
  const swedishRegistrationNumberValidation =
    await hasSwedishRegistrationNumberValidation(supabaseAdmin);
  const pricingConfiguration =
    await hasPricingConfigurationReadiness(supabaseAdmin);
  const privateVideoBucket = await hasPrivateVideoBucket(supabaseAdmin);
  const privateSensitiveStorage =
    await hasPrivateSensitiveStorageBuckets(supabaseAdmin);
  const webhookEventLedger = await hasStripeWebhookEventLedger(supabaseAdmin);
  const financialRiskWebhooks = hasStripeFinancialRiskWebhookWorkflow();
  const refundAndProductionBoundaryWorkflow =
    await hasRefundAndProductionBoundaryWorkflow(supabaseAdmin);
  const optInConsentDefaults = await hasOptInConsentDefaults(supabaseAdmin);
  const cookieTrackingGovernance = hasCookieTrackingGovernance();
  const displayAssetReviewWorkflow =
    await hasDisplayAssetReviewWorkflow(supabaseAdmin);
  const customerPreviewDecisionWorkflow =
    await hasCustomerPreviewDecisionWorkflow(supabaseAdmin);
  const requestPrivacyConsentWorkflow =
    await hasRequestPrivacyConsentWorkflow(supabaseAdmin);
  const publicRequestIntakeWorkflow =
    await hasPublicRequestIntakeWorkflow(supabaseAdmin);
  const adminNotificationWorkflow =
    await hasAdminNotificationWorkflow(supabaseAdmin);
  const adminAccessReviewWorkflow =
    await hasAdminAccessReviewWorkflow(supabaseAdmin);
  const backupRestoreDrillWorkflow =
    await hasBackupRestoreDrillWorkflow(supabaseAdmin);
  const dataRetentionReviewWorkflow =
    await hasDataRetentionReviewWorkflow(supabaseAdmin);
  const operationalFulfillment =
    await hasOperationalFulfillmentReadiness(supabaseAdmin);
  const inventoryOperationsWorkflow =
    await hasInventoryOperationsWorkflow(supabaseAdmin);
  const deviceManagementWorkflow =
    await hasDeviceManagementWorkflow(supabaseAdmin);
  const adminCustomerDraftWorkflow =
    await hasAdminCustomerDraftWorkflow(supabaseAdmin);
  const adminCustomerProfileEditWorkflow =
    await hasAdminCustomerProfileEditWorkflow(supabaseAdmin);
  const customerDataExportWorkflow =
    await hasCustomerDataExportWorkflow(supabaseAdmin);
  const dataSubjectRequestWorkflow =
    await hasDataSubjectRequestWorkflow(supabaseAdmin);
  const accountingExportWorkflow =
    await hasAccountingExportWorkflow(supabaseAdmin);
  const vatSummaryWorkflow = await hasVatSummaryWorkflow(supabaseAdmin);
  const taxPaymentRegisterWorkflow =
    await hasTaxPaymentRegisterWorkflow(supabaseAdmin);
  const privacyIncidentWorkflow =
    await hasPrivacyIncidentWorkflow(supabaseAdmin);
  const customerDeletionSafetyWorkflow =
    await hasCustomerDeletionSafetyWorkflow(supabaseAdmin);
  const securityHeaders = hasRequiredSecurityHeaders();
  const sensitiveNoStore = hasSensitiveNoStorePolicy();
  const serviceWorkerCacheSafety = hasServiceWorkerCacheSafety();
  const csrfProtection = hasCsrfProtectionPolicy();
  const textQualityCheck = hasTextQualityCheckConfigured();
  const emailReadiness = getTransactionalEmailReadiness();
  const transactionalEmailWorkflow = hasTransactionalEmailWorkflow();
  const resendDeliveryEventWorkflow =
    await hasResendDeliveryEventWorkflow(supabaseAdmin);
  const customerSupportReplyWorkflow = hasCustomerSupportReplyWorkflow();
  const customerSupportTicketIntakeWorkflow =
    await hasCustomerSupportTicketIntakeWorkflow(supabaseAdmin);
  const billingPortalWorkflow = hasBillingPortalWorkflow();
  const customerConsentManagementWorkflow =
    hasCustomerConsentManagementWorkflow();
  const passwordPolicy = hasCustomerPasswordPolicy();
  const passwordResetProtection = hasPasswordResetAbuseProtection();
  const loginAttemptProtection = hasLoginAttemptProtection();
  const termsArePrelaunch = CURRENT_TERMS_VERSION.includes("prelaunch");
  const privacyIsPrelaunch = CURRENT_PRIVACY_VERSION.includes("prelaunch");

  const checks: ReadinessCheck[] = [
    check(
      "app_url",
      "Application URL",
      appUrl.startsWith("https://")
        ? "pass"
        : appUrl.includes("localhost")
          ? "warning"
          : "fail",
      appUrl
        ? `Configured as ${appUrl}. Production should use https://screenia.se.`
        : "NEXT_PUBLIC_APP_URL is missing.",
    ),
    check(
      "stripe_mode",
      "Stripe mode",
      stripeMode === "test" ? "pass" : stripeMode === "live" ? "warning" : "fail",
      stripeMode === "live"
        ? "A live Stripe key is configured. Confirm business/tax readiness before taking payments."
        : stripeMode === "test"
          ? "Stripe test mode is active, which is correct before business registration is complete."
          : "STRIPE_SECRET_KEY is missing or not a recognizable Stripe key.",
    ),
    check(
      "live_payment_gate",
      "Live payment gate",
      stripeMode === "live" && missingLivePaymentConfirmations.length > 0
        ? "pass"
        : stripeMode === "live" && missingLivePaymentConfirmations.length === 0
          ? "warning"
          : livePaymentsEnabled
            ? "warning"
            : "pass",
      missingLivePaymentConfirmations.length > 0
        ? `Live payments are blocked until these confirmations are true: ${missingLivePaymentConfirmations
            .map((item) => item.label)
            .join(", ")}.`
        : "All live-payment confirmation flags are true. Only keep this state when live launch is approved.",
    ),
    ...livePaymentConfirmations.map((item) =>
      check(
        item.key.toLowerCase(),
        item.label,
        item.confirmed ? "pass" : "warning",
        item.confirmed ? item.detail : `${item.detail} Set ${item.key}=true only when verified.`,
      ),
    ),
    check(
      "stripe_webhook",
      "Stripe webhook secret",
      envSet("STRIPE_WEBHOOK_SECRET") ? "pass" : "fail",
      envSet("STRIPE_WEBHOOK_SECRET")
        ? "Webhook secret is configured."
        : "STRIPE_WEBHOOK_SECRET is missing, so payment/subscription state cannot sync safely.",
    ),
    check(
      "stripe_tax",
      "Stripe Tax / VAT mode",
      process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true" ? "warning" : "pass",
      process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true"
        ? "Automatic Tax is enabled. Confirm Swedish tax registration, product tax codes, and inclusive/exclusive behavior."
        : "Automatic Tax is disabled. Screenia still stores VAT-ready totals from configured prices.",
    ),
    check(
      "resend",
      "Transactional email",
      emailReadiness.productionSafe
        ? "pass"
        : emailReadiness.configured
          ? "warning"
          : "fail",
      emailReadiness.details,
    ),
    check(
      "transactional_email_workflow",
      "Transactional email workflow",
      transactionalEmailWorkflow.ok ? "pass" : "fail",
      transactionalEmailWorkflow.details,
    ),
    check(
      "resend_delivery_event_workflow",
      "Resend delivery event workflow",
      !process.env.RESEND_WEBHOOK_SECRET?.trim()
        ? "fail"
        : resendDeliveryEventWorkflow.ok
          ? "pass"
          : "fail",
      !process.env.RESEND_WEBHOOK_SECRET?.trim()
        ? "RESEND_WEBHOOK_SECRET is missing; bounce/complaint webhooks cannot be verified."
        : resendDeliveryEventWorkflow.details,
    ),
    check(
      "customer_support_reply_workflow",
      "Customer support reply workflow",
      customerSupportReplyWorkflow.ok ? "pass" : "fail",
      customerSupportReplyWorkflow.details,
    ),
    check(
      "customer_support_ticket_intake_workflow",
      "Customer support ticket intake",
      customerSupportTicketIntakeWorkflow.ok ? "pass" : "fail",
      customerSupportTicketIntakeWorkflow.details,
    ),
    check(
      "billing_portal_workflow",
      "Billing portal workflow",
      billingPortalWorkflow.ok ? "pass" : "fail",
      billingPortalWorkflow.details,
    ),
    check(
      "customer_consent_management_workflow",
      "Customer consent management",
      customerConsentManagementWorkflow.ok ? "pass" : "fail",
      customerConsentManagementWorkflow.details,
    ),
    check(
      "text_quality",
      "Customer-facing text quality",
      textQualityCheck.ok ? "pass" : "fail",
      textQualityCheck.ok
        ? `${textQualityCheck.details} Run npm.cmd run text:check before deployments.`
        : textQualityCheck.details,
    ),
    check(
      "customer_password_policy",
      "Customer password policy",
      passwordPolicy.ok ? "pass" : "fail",
      passwordPolicy.details,
    ),
    check(
      "password_reset_protection",
      "Password reset protection",
      passwordResetProtection.ok ? "pass" : "fail",
      passwordResetProtection.details,
    ),
    check(
      "login_attempt_protection",
      "Login attempt protection",
      loginAttemptProtection.ok ? "pass" : "fail",
      loginAttemptProtection.details,
    ),
    check(
      "company_identity",
      "Company identity",
      looksPlaceholder(process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER) ||
        looksPlaceholder(process.env.NEXT_PUBLIC_COMPANY_ADDRESS) ||
        looksPlaceholder(process.env.NEXT_PUBLIC_COMPANY_EMAIL)
        ? "warning"
        : "pass",
      "Confirm legal name, organisation number, registered address, and public email before live payments.",
    ),
    check(
      "swedish_registration_numbers",
      "Swedish organisation numbers",
      swedishRegistrationNumberValidation.ok ? "pass" : "fail",
      swedishRegistrationNumberValidation.details,
    ),
    check(
      "pricing_configuration",
      "Pricing configuration",
      pricingConfiguration.ok ? "pass" : "fail",
      pricingConfiguration.details,
    ),
    check(
      "legal_documents",
      "Legal documents",
      !legalDocuments.ok
        ? "fail"
        : termsArePrelaunch || privacyIsPrelaunch
          ? "warning"
          : "pass",
      !legalDocuments.ok
        ? `Current legal document versions or PDF assets are not ready: ${legalDocuments.details}`
        : termsArePrelaunch || privacyIsPrelaunch
          ? "Terms/privacy are marked pre-launch. Final legal/accounting review is still required before live customers."
        : "Terms and privacy versions are active in Supabase and not marked pre-launch.",
    ),
    check(
      "legal_before_payment_workflow",
      "Legal before payment workflow",
      legalBeforePaymentWorkflow.ok ? "pass" : "fail",
      legalBeforePaymentWorkflow.details,
    ),
    check(
      "legal_change_notice_workflow",
      "Legal change notice workflow",
      legalChangeNoticeWorkflow.ok ? "pass" : "fail",
      legalChangeNoticeWorkflow.details,
    ),
    check(
      "data_processor_register",
      "Data processor register",
      dataProcessorRegister.ok ? "pass" : "fail",
      dataProcessorRegister.details,
    ),
    check(
      "processor_compliance_review_workflow",
      "Processor compliance review workflow",
      processorComplianceReviewWorkflow.ok ? "pass" : "fail",
      processorComplianceReviewWorkflow.details,
    ),
    check(
      "opt_in_consent_defaults",
      "Opt-in consent defaults",
      optInConsentDefaults.ok ? "pass" : "fail",
      optInConsentDefaults.details,
    ),
    check(
      "cookie_tracking_governance",
      "Cookie and tracking governance",
      cookieTrackingGovernance.ok ? "pass" : "fail",
      cookieTrackingGovernance.details,
    ),
    check(
      "display_asset_review_workflow",
      "Display material review workflow",
      displayAssetReviewWorkflow.ok ? "pass" : "fail",
      displayAssetReviewWorkflow.details,
    ),
    check(
      "customer_preview_decision_workflow",
      "Customer preview decision workflow",
      customerPreviewDecisionWorkflow.ok ? "pass" : "fail",
      customerPreviewDecisionWorkflow.details,
    ),
    check(
      "request_privacy_consent_workflow",
      "Public request privacy consent",
      requestPrivacyConsentWorkflow.ok ? "pass" : "fail",
      requestPrivacyConsentWorkflow.details,
    ),
    check(
      "public_request_intake_workflow",
      "Public request intake workflow",
      publicRequestIntakeWorkflow.ok ? "pass" : "fail",
      publicRequestIntakeWorkflow.details,
    ),
    check(
      "admin_notification_workflow",
      "Admin notification workflow",
      adminNotificationWorkflow.ok ? "pass" : "fail",
      adminNotificationWorkflow.details,
    ),
    check(
      "admin_access_review_workflow",
      "Admin access review workflow",
      adminAccessReviewWorkflow.ok ? "pass" : "fail",
      adminAccessReviewWorkflow.details,
    ),
    check(
      "backup_restore_drill_workflow",
      "Backup restore drill workflow",
      backupRestoreDrillWorkflow.ok ? "pass" : "fail",
      backupRestoreDrillWorkflow.details,
    ),
    check(
      "data_retention_review_workflow",
      "Data retention review workflow",
      dataRetentionReviewWorkflow.ok ? "pass" : "fail",
      dataRetentionReviewWorkflow.details,
    ),
    check(
      "operational_fulfillment",
      "Operational fulfillment readiness",
      operationalFulfillment.ok ? "pass" : "fail",
      operationalFulfillment.details,
    ),
    check(
      "inventory_operations_workflow",
      "Inventory operations workflow",
      inventoryOperationsWorkflow.ok ? "pass" : "fail",
      inventoryOperationsWorkflow.details,
    ),
    check(
      "device_management_workflow",
      "Device management workflow",
      deviceManagementWorkflow.ok ? "pass" : "fail",
      deviceManagementWorkflow.details,
    ),
    check(
      "admin_customer_draft_workflow",
      "Admin customer draft workflow",
      adminCustomerDraftWorkflow.ok ? "pass" : "fail",
      adminCustomerDraftWorkflow.details,
    ),
    check(
      "admin_customer_profile_edit_workflow",
      "Admin customer profile edit workflow",
      adminCustomerProfileEditWorkflow.ok ? "pass" : "fail",
      adminCustomerProfileEditWorkflow.details,
    ),
    check(
      "customer_data_export_workflow",
      "Customer data export workflow",
      customerDataExportWorkflow.ok ? "pass" : "fail",
      customerDataExportWorkflow.details,
    ),
    check(
      "data_subject_request_workflow",
      "Data subject request workflow",
      dataSubjectRequestWorkflow.ok ? "pass" : "fail",
      dataSubjectRequestWorkflow.details,
    ),
    check(
      "accounting_export_workflow",
      "Accounting export workflow",
      accountingExportWorkflow.ok ? "pass" : "fail",
      accountingExportWorkflow.details,
    ),
    check(
      "vat_summary_workflow",
      "VAT summary workflow",
      vatSummaryWorkflow.ok ? "pass" : "fail",
      vatSummaryWorkflow.details,
    ),
    check(
      "tax_payment_register_workflow",
      "Tax payment register workflow",
      taxPaymentRegisterWorkflow.ok ? "pass" : "fail",
      taxPaymentRegisterWorkflow.details,
    ),
    check(
      "privacy_incident_workflow",
      "Privacy incident workflow",
      privacyIncidentWorkflow.ok ? "pass" : "fail",
      privacyIncidentWorkflow.details,
    ),
    check(
      "customer_deletion_safety_workflow",
      "Customer deletion safety workflow",
      customerDeletionSafetyWorkflow.ok ? "pass" : "fail",
      customerDeletionSafetyWorkflow.details,
    ),
    check(
      "subscription_migration",
      "Subscription entitlement migration",
      migration.ok ? "pass" : "fail",
      migration.ok
        ? "Subscription entitlement columns/table are visible in Supabase."
        : `Latest subscription migration is not visible yet: ${migration.details}`,
    ),
    check(
      "private_display_videos",
      "Private display videos",
      privateVideoBucket.ok ? "pass" : "fail",
      privateVideoBucket.ok
        ? "The videos bucket is private; displays use signed URLs after entitlement checks."
        : `Make the videos bucket private before production: ${privateVideoBucket.details}.`,
    ),
    check(
      "private_sensitive_storage",
      "Private sensitive storage",
      privateSensitiveStorage.ok ? "pass" : "fail",
      privateSensitiveStorage.details,
    ),
    check(
      "stripe_webhook_event_ledger",
      "Stripe webhook duplicate protection",
      webhookEventLedger.ok ? "pass" : "fail",
      webhookEventLedger.details,
    ),
    check(
      "stripe_financial_risk_webhooks",
      "Stripe dispute and refund webhooks",
      financialRiskWebhooks.ok ? "pass" : "fail",
      financialRiskWebhooks.details,
    ),
    check(
      "refund_production_boundary_workflow",
      "Refund and production boundary",
      refundAndProductionBoundaryWorkflow.ok ? "pass" : "fail",
      refundAndProductionBoundaryWorkflow.details,
    ),
    check(
      "security_headers",
      "Security headers",
      securityHeaders.ok ? "pass" : "fail",
      securityHeaders.details,
    ),
    check(
      "sensitive_no_store",
      "Sensitive route no-store policy",
      sensitiveNoStore.ok ? "pass" : "fail",
      sensitiveNoStore.details,
    ),
    check(
      "service_worker_cache_safety",
      "Service worker cache safety",
      serviceWorkerCacheSafety.ok ? "pass" : "fail",
      serviceWorkerCacheSafety.details,
    ),
    check(
      "csrf_protection",
      "Cross-origin request protection",
      csrfProtection.ok ? "pass" : "fail",
      csrfProtection.details,
    ),
  ];

  const summary = {
    pass: checks.filter((item) => item.status === "pass").length,
    warning: checks.filter((item) => item.status === "warning").length,
    fail: checks.filter((item) => item.status === "fail").length,
  };

  return noStoreJson({
    checkedAt: new Date().toISOString(),
    readyForLivePayments: summary.fail === 0 && summary.warning === 0,
    summary,
    checks,
  });
}
