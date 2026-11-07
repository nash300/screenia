import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lifecycleAuditContracts = [
  {
    stage: "customer request",
    route: "src/app/api/onboarding-requests/route.ts",
    events: [
      "landing_purchase_request_created",
      "landing_purchase_request_duplicate_blocked",
      "request_confirmation_email_sent",
    ],
  },
  {
    stage: "quote and onboarding invitation",
    route: "src/app/api/admin/prepare-onboarding/route.ts",
    events: [
      "quote_onboarding_prepared",
      "quote_onboarding_email_sent",
      "quote_onboarding_email_failed",
    ],
  },
  {
    stage: "legal onboarding",
    route: "src/app/api/onboarding/complete-profile/route.ts",
    events: [
      "onboarding_profile_completed",
      "onboarding_profile_evidence_failed",
    ],
  },
  {
    stage: "checkout start",
    route: [
      "src/app/api/stripe/checkout/route.ts",
      "src/app/api/stripe/checkout/stripe-checkout-failure.ts",
    ],
    events: [
      "stripe_checkout_started",
      "stripe_checkout_failed",
      "stripe_checkout_local_sync_failed",
    ],
  },
  {
    stage: "payment webhook",
    route: [
      "src/app/api/stripe/webhook/route.ts",
      "src/app/api/stripe/webhook/stripe-financial-risk-handlers.ts",
      "src/app/api/stripe/webhook/stripe-subscription-sync.ts",
    ],
    events: [
      "payment_completed",
      "payment_failed",
      "payment_recovered",
      "payment_refunded_externally",
      "payment_refund_updated",
      "subscription_synced",
    ],
  },
  {
    stage: "content setup",
    route: "src/app/api/account/content-setup/route.ts",
    events: [
      "content_setup_submitted",
      "content_setup_audit_failed",
      "content_setup_sync_failed",
    ],
  },
  {
    stage: "device allocation",
    route: "src/app/api/admin/devices/route.ts",
    events: [
      "admin_device_created",
      "admin_device_create_rollback_failed",
    ],
  },
  {
    stage: "customer support request",
    route: "src/app/api/account/messages/route.ts",
    events: [
      "customer_message_sent",
      "customer_message_audit_failed",
      "customer_message_notification_failed",
    ],
  },
  {
    stage: "admin support reply",
    route: "src/app/api/admin/customer-messages/route.ts",
    events: [
      "customer_support_reply_sent",
      "customer_support_reply_audit_failed",
      "customer_support_reply_email_audit_failed",
    ],
  },
  {
    stage: "subscription pause",
    route: "src/app/api/account/pause-subscription/route.ts",
    events: ["customer_subscription_paused", "customer_pause_sync_failed"],
  },
  {
    stage: "subscription resume",
    route: "src/app/api/account/resume-subscription/route.ts",
    events: ["customer_subscription_resumed", "customer_resume_sync_failed"],
  },
  {
    stage: "subscription cancellation",
    route: "src/app/api/account/cancel-subscription/route.ts",
    events: [
      "subscription_cancel_scheduled",
      "customer_cancellation_audit_failed",
      "customer_cancellation_sync_failed",
    ],
  },
  {
    stage: "billing portal access",
    route: "src/app/api/account/billing-portal/route.ts",
    events: ["billing_portal_session_created", "billing_portal_session_failed"],
  },
  {
    stage: "individual device pause",
    route: "src/app/api/account/pause-device/route.ts",
    events: ["customer_device_subscription_paused"],
  },
  {
    stage: "individual device cancellation",
    route: "src/app/api/account/cancel-devices/route.ts",
    events: ["customer_device_subscription_cancel_scheduled"],
  },
  {
    stage: "customer consent settings",
    route: "src/app/api/account/consents/route.ts",
    events: ["customer_consent_settings_updated", "customer_consent_evidence_failed"],
  },
  {
    stage: "preview approval and changes",
    route: "src/app/api/account/preview-decision/route.ts",
    events: [
      "customer_preview_approved",
      "customer_preview_changes_requested",
      "customer_preview_decision_audit_failed",
    ],
  },
  {
    stage: "display material upload",
    route: "src/app/api/account/display-assets/route.ts",
    events: [
      "customer_display_material_uploaded",
      "customer_display_material_notification_failed",
    ],
  },
  {
    stage: "Premium video upload",
    route: "src/app/api/account/video-upload/route.ts",
    events: ["customer_video_uploaded", "customer_video_notification_failed"],
  },
  {
    stage: "refund",
    route: [
      "src/app/api/admin/customers/[customerId]/refund/route.ts",
      "src/app/api/admin/customers/[customerId]/refund-case/route.ts",
    ],
    events: [
      "payment_refunded",
      "payment_refund_local_sync_failed",
      "post_layout_refund_request_denied",
    ],
  },
  {
    stage: "customer data export",
    route: "src/app/api/account/export/route.ts",
    events: [
      "customer_data_export_downloaded",
      "customer_data_export_failed",
      "customer_data_export_rate_limited",
    ],
  },
  {
    stage: "customer removal",
    route: "src/app/api/admin/customers/[customerId]/route.ts",
    events: [
      "customer_anonymization_started",
      "customer_anonymized",
      "customer_deleted",
    ],
  },
] as const;

describe("complete customer lifecycle audit contract", () => {
  it.each(lifecycleAuditContracts)(
    "$stage keeps its required success, failure, and rollback evidence",
    ({ route, events }) => {
      const routes = (
        typeof route === "string" ? [route] : route
      ) as readonly string[];
      const source = routes
        .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
        .join("\n");

      for (const event of events) {
        expect(
          source,
          `${routes.join(", ")} must retain audit event ${event}`,
        ).toContain(event);
      }
    },
  );
});
