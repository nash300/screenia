import type { SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../../package.json";
import {
  PASSWORD_POLICY_MIN_LENGTH,
  passwordPolicyDescription,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import {
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_IP_LIMIT,
  PASSWORD_RESET_WINDOW_MS,
} from "@/lib/auth/password-reset-policy";
import {
  LOGIN_ATTEMPT_EMAIL_LIMIT,
  LOGIN_ATTEMPT_GENERIC_ERROR,
  LOGIN_ATTEMPT_IP_LIMIT,
  LOGIN_ATTEMPT_RATE_LIMIT_ERROR,
  LOGIN_ATTEMPT_WINDOW_MS,
} from "@/lib/auth/login-attempt-policy";
import { isValidSwedishRegistrationNumber } from "@/lib/business/sweden";
import {
  CLIENT_COMMUNICATION_FROM_EMAIL,
  NEWSLETTER_FROM_EMAIL,
  getConfiguredNewsletterSender,
  getConfiguredTransactionalSender,
} from "@/lib/server/email";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/lib/legal/documents";
import { securityHeaders } from "@/lib/security-headers";
import {
  isCsrfExemptPath,
  shouldDisableRouteCaching,
  shouldRejectCrossOriginUnsafeRequest,
} from "../../proxy";

const LIVE_PAYMENT_CONFIRMATION_FLAGS = [
  {
    key: "SCREENIA_LIVE_PAYMENTS_ENABLED",
    label: "Live payments enabled",
  },
  {
    key: "SCREENIA_BUSINESS_REGISTRATION_CONFIRMED",
    label: "Business registration",
  },
  {
    key: "SCREENIA_VERCEL_PRO_CONFIRMED",
    label: "Vercel Pro / commercial hosting",
  },
  {
    key: "SCREENIA_VAT_DECISION_CONFIRMED",
    label: "VAT decision",
  },
  {
    key: "SCREENIA_LEGAL_REVIEW_CONFIRMED",
    label: "Legal review",
  },
  {
    key: "SCREENIA_LIVE_WEBHOOK_VERIFIED",
    label: "Live webhook verified",
  },
  {
    key: "SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED",
    label: "Supabase Auth email verified",
  },
] as const;

const TRACKING_SOURCE_ROOTS = [
  "src/app",
  "src/components",
  "src/lib",
  "src/proxy.ts",
  "next.config.ts",
  "package.json",
];

const TRACKING_SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"];

const TRACKING_SCAN_EXCLUDED_PATHS = [
  "src/lib/server/launch-readiness.ts",
  "src/lib/server/live-checkout-readiness.ts",
];

const NON_ESSENTIAL_TRACKING_PATTERNS = [
  { label: "Google Analytics", pattern: /\bgtag\b|GoogleAnalytics|G-[A-Z0-9]{6,}/u },
  { label: "Google Tag Manager", pattern: /GTM-[A-Z0-9]+|googletagmanager/u },
  { label: "Meta Pixel", pattern: /\bfbq\s*\(|facebook\.net\/tr/u },
  { label: "Hotjar", pattern: /hotjar|hj\(/iu },
  { label: "Microsoft Clarity", pattern: /clarity\.ms|\bclarity\s*\(/iu },
  { label: "Plausible", pattern: /plausible\.io|plausible\(/iu },
  { label: "PostHog", pattern: /posthog/iu },
  { label: "TikTok Pixel", pattern: /ttq\.|analytics\.tiktok\.com/iu },
  { label: "LinkedIn Insight", pattern: /snap\.licdn\.com|lintrk/iu },
];

type CheckResult = {
  ok: boolean;
  details: string;
};

function projectFilePath(...segments: string[]) {
  return join(/*turbopackIgnore: true*/ process.cwd(), ...segments);
}

function isTrackingScanFile(path: string) {
  return TRACKING_SCAN_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function collectTrackingSourceFiles() {
  const files = new Set<string>();
  const excludedPaths = new Set(TRACKING_SCAN_EXCLUDED_PATHS);

  const collect = (path: string) => {
    if (excludedPaths.has(path) || !existsSync(projectFilePath(path))) return;
    const stats = statSync(projectFilePath(path));

    if (stats.isDirectory()) {
      for (const entry of readdirSync(projectFilePath(path), { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        collect(`${path}/${entry.name}`);
      }
      return;
    }

    if (stats.isFile() && isTrackingScanFile(path)) {
      files.add(path);
    }
  };

  TRACKING_SOURCE_ROOTS.forEach(collect);
  return Array.from(files).sort();
}

function looksPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /your_|example|placeholder|todo|screenia$/i.test(value.trim());
}

function missingLivePaymentConfirmations() {
  return LIVE_PAYMENT_CONFIRMATION_FLAGS.filter(
    (flag) => process.env[flag.key] !== "true",
  ).map((flag) => flag.label);
}

function applicationUrlReadiness(): CheckResult {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const ok = appUrl.startsWith("https://") && !appUrl.includes("localhost");

  return {
    ok,
    details: ok
      ? `Production app URL is configured as ${appUrl}.`
      : appUrl
        ? `NEXT_PUBLIC_APP_URL is ${appUrl}; live checkout requires a production HTTPS URL.`
        : "NEXT_PUBLIC_APP_URL is missing.",
  };
}

function companyIdentityReadiness(): CheckResult {
  const missing = [
    looksPlaceholder(process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER)
      ? "organisation number"
      : null,
    looksPlaceholder(process.env.NEXT_PUBLIC_COMPANY_ADDRESS)
      ? "registered address"
      : null,
    looksPlaceholder(process.env.NEXT_PUBLIC_COMPANY_EMAIL) ? "public email" : null,
  ].filter(Boolean);

  return {
    ok: missing.length === 0,
    details:
      missing.length === 0
        ? "Company identity fields are configured."
        : `Company identity is not live-ready: ${missing.join(", ")}.`,
  };
}

function finalLegalVersionReadiness(): CheckResult {
  const prelaunchVersions = [
    CURRENT_TERMS_VERSION.includes("prelaunch") ? "terms" : null,
    CURRENT_PRIVACY_VERSION.includes("prelaunch") ? "privacy" : null,
  ].filter(Boolean);

  return {
    ok: prelaunchVersions.length === 0,
    details:
      prelaunchVersions.length === 0
        ? "Terms and privacy versions are final live versions."
        : `Final legal review is required before live checkout; pre-launch versions remain for ${prelaunchVersions.join(
            ", ",
          )}.`,
  };
}

function extractEmailAddress(value: string) {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^<>@\s]+@[^<>@\s]+)>/u);

  return (angleMatch?.[1] || trimmed).toLowerCase();
}

function transactionalEmailReadiness(): CheckResult {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = getConfiguredTransactionalSender();
  const newsletterFrom = getConfiguredNewsletterSender();
  const email = from ? extractEmailAddress(from) : "";
  const newsletterEmail = newsletterFrom ? extractEmailAddress(newsletterFrom) : "";
  const domain = email.includes("@") ? email.split("@").pop() || "" : "";
  const usesScreeniaDomain =
    domain === "screenia.se" || domain.endsWith(".screenia.se");

  if (!apiKey) {
    return {
      ok: false,
      details: "RESEND_API_KEY is missing; onboarding and notification emails may fail.",
    };
  }

  if (!email.includes("@")) {
    return {
      ok: false,
      details:
        "RESEND_FROM_EMAIL is configured, but it does not contain a valid sender email address.",
    };
  }

  if (!usesScreeniaDomain) {
    return {
      ok: false,
      details: `Resend sender is ${email}. Use a verified screenia.se sender before real customers.`,
    };
  }

  if (email !== CLIENT_COMMUNICATION_FROM_EMAIL) {
    return {
      ok: false,
      details: `Client communication sender is ${email}. Use ${CLIENT_COMMUNICATION_FROM_EMAIL} for customer communication.`,
    };
  }

  if (newsletterEmail !== NEWSLETTER_FROM_EMAIL) {
    return {
      ok: false,
      details: `Newsletter sender is ${newsletterEmail || "not configured"}. Use ${NEWSLETTER_FROM_EMAIL} for newsletters.`,
    };
  }

  return {
    ok: true,
    details: `Resend client sender is ${email}; newsletter sender is ${newsletterEmail}.`,
  };
}

function transactionalEmailWorkflowReadiness(): CheckResult {
  const emailRouteFiles = [
    "src/app/api/admin/send-onboarding-link/route.ts",
    "src/app/api/admin/prepare-onboarding/route.ts",
    "src/app/api/onboarding-requests/route.ts",
  ];
  const issues = emailRouteFiles.flatMap((file) => {
    const source = readFileSync(projectFilePath(file), "utf8");

    return [
      source.includes("api.resend.com/emails")
        ? `${file} sends through Resend directly`
        : null,
      !source.includes("sendTransactionalEmail")
        ? `${file} does not use the shared transactional email sender`
        : null,
      !source.includes("recordAuditEvent")
        ? `${file} does not audit email delivery state`
        : null,
      !source.includes("createAdminNotification")
        ? `${file} does not notify admins about email delivery failures`
        : null,
      file.includes("/api/admin/") &&
      !source.includes("A reason of at least 5 characters is required")
        ? `${file} does not require an admin reason before creating onboarding/payment links`
        : null,
      file.includes("/api/admin/") && !source.includes("reason")
        ? `${file} does not audit the admin reason for onboarding/payment links`
        : null,
      file.endsWith("send-onboarding-link/route.ts") &&
      (!source.includes("{ throwOnError: true }") ||
        !source.includes("onboarding_link_audit_failed") ||
        !source.includes("onboarding_email_audit_failed") ||
        !source.includes("Onboarding email failure evidence was not stored"))
        ? `${file} does not fail visibly when onboarding link/email audit or notification evidence fails`
        : null,
      file.endsWith("prepare-onboarding/route.ts") &&
      (!source.includes("quote_onboarding_status_sync_failed") ||
        !source.includes("quote_onboarding_email_audit_failed") ||
        !source.includes("Quote onboarding email sent audit was not stored") ||
        !source.includes("Quote onboarding not-configured evidence was not stored") ||
        !source.includes("Quote onboarding email failure evidence was not stored"))
        ? `${file} does not fail visibly when sent quote status or delivery audit evidence fails`
        : null,
    ].filter(Boolean);
  });
  const adminCustomerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/[customerId]/page.tsx"),
    "utf8",
  );
  if (
    !adminCustomerPageSource.includes(
      "Reason for preparing this quote and onboarding link",
    )
  ) {
    issues.push(
      "admin customer page does not prompt for quote/onboarding preparation reasons",
    );
  }
  const sharedEmailSource = readFileSync(
    projectFilePath("src/lib/server/email.ts"),
    "utf8",
  );
  const sharedSenderOk =
    sharedEmailSource.includes("export async function sendTransactionalEmail") &&
    sharedEmailSource.includes("https://api.resend.com/emails") &&
    sharedEmailSource.includes("configured: false") &&
    sharedEmailSource.includes("getResendErrorMessage") &&
    sharedEmailSource.includes("catch (error)") &&
    sharedEmailSource.includes("Resend request failed before a response was received");

  if (!sharedSenderOk) {
    issues.push(
      "shared transactional email sender is missing configuration/error handling",
    );
  }

  return {
    ok: issues.length === 0,
    details:
      issues.length === 0
        ? "Transactional emails use the shared audited sender."
        : issues.join(" | "),
  };
}

function billingPortalWorkflowReadiness(): CheckResult {
  const billingPortalRouteSource = readFileSync(
    projectFilePath("src/app/api/account/billing-portal/route.ts"),
    "utf8",
  );
  const accountPageSource = readFileSync(
    projectFilePath("src/app/account/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !billingPortalRouteSource.includes("getAuthenticatedUser") ||
    !billingPortalRouteSource.includes("getCustomerForUser")
      ? "billing portal route does not authenticate the customer"
      : null,
    !billingPortalRouteSource.includes("customer.stripe_customer_id")
      ? "billing portal route does not require a linked Stripe customer"
      : null,
    !billingPortalRouteSource.includes("stripe.billingPortal.sessions.create")
      ? "billing portal route does not create Stripe portal sessions"
      : null,
    !billingPortalRouteSource.includes("return_url: `${appUrl}/account`")
      ? "billing portal route does not return customers to the account portal"
      : null,
    !billingPortalRouteSource.includes("billing_portal_session_created") ||
    !billingPortalRouteSource.includes("billingPortalSessionId")
      ? "successful billing portal sessions are not audited with session evidence"
      : null,
    !billingPortalRouteSource.includes("{ throwOnError: true }") ||
    !billingPortalRouteSource.includes("Billing portal success audit error") ||
    !billingPortalRouteSource.includes("could not store access evidence")
      ? "billing portal can return a Stripe portal URL without stored success audit evidence"
      : null,
    !billingPortalRouteSource.includes("billing_portal_session_failed")
      ? "billing portal failures are not audited"
      : null,
    !billingPortalRouteSource.includes("createAdminNotification")
      ? "billing portal failures do not create admin notifications"
      : null,
    !billingPortalRouteSource.includes("priority: \"urgent\"")
      ? "billing portal failures are not marked urgent"
      : null,
    !billingPortalRouteSource.includes("Billing portal failure evidence error") ||
    !billingPortalRouteSource.includes("could not store failure evidence")
      ? "billing portal failures do not fail visibly when audit or notification evidence cannot be stored"
      : null,
    !accountPageSource.includes("/api/account/billing-portal") ||
    !accountPageSource.includes("openBillingPortal") ||
    !accountPageSource.includes("window.location.href = result.url")
      ? "customer account billing section does not expose billing portal redirect"
      : null,
  ].filter(Boolean);

  return {
    ok: sourceIssues.length === 0,
    details:
      sourceIssues.length === 0
        ? "Customer billing portal access is authenticated, Stripe-bound, audited, and failure-notified."
        : sourceIssues.join(" | "),
  };
}

function customerConsentManagementReadiness(): CheckResult {
  const accountConsentRouteSource = readFileSync(
    projectFilePath("src/app/api/account/consents/route.ts"),
    "utf8",
  );
  const accountPageSource = readFileSync(
    projectFilePath("src/app/account/page.tsx"),
    "utf8",
  );
  const customerAccountSource = readFileSync(
    projectFilePath("src/lib/server/customer-account.ts"),
    "utf8",
  );
  const sourceIssues = [
    !accountConsentRouteSource.includes("export async function PATCH")
      ? "customer consent settings are missing an account API"
      : null,
    !accountConsentRouteSource.includes("getAuthenticatedUser") ||
    !accountConsentRouteSource.includes("getCustomerForUser")
      ? "customer consent settings route does not authenticate the customer"
      : null,
    !accountConsentRouteSource.includes("marketingConsent") ||
    !accountConsentRouteSource.includes("analyticsConsent") ||
    !accountConsentRouteSource.includes("remoteSupportConsent")
      ? "customer consent settings route does not handle all optional consent types"
      : null,
    !accountConsentRouteSource.includes("recordConsent")
      ? "customer consent changes do not write consent records"
      : null,
    !accountConsentRouteSource.includes("granted: consent.granted")
      ? "customer consent withdrawals may not be recorded"
      : null,
    !accountConsentRouteSource.includes("CURRENT_PRIVACY_DOCUMENT.version") ||
    !accountConsentRouteSource.includes("customer_account_consent_settings")
      ? "customer consent records do not include current privacy version and collection point"
      : null,
    !accountConsentRouteSource.includes("customer_consent_settings_updated")
      ? "customer consent changes are not audited"
      : null,
    !accountConsentRouteSource.includes("{ throwOnError: true }") ||
    !accountConsentRouteSource.includes("rollbackConsentFlags") ||
    !accountConsentRouteSource.includes("customer_consent_evidence_failed") ||
    !accountConsentRouteSource.includes("Consent settings were not saved because Screenia could not store the required consent evidence")
      ? "customer consent changes do not fail closed and roll back when consent/audit evidence fails"
      : null,
    !accountPageSource.includes("Spara samtycken") ||
    !accountPageSource.includes("marketingConsent") ||
    !accountPageSource.includes("analyticsConsent") ||
    !accountPageSource.includes("remoteSupportConsent")
      ? "customer account legal section does not expose all optional consent settings"
      : null,
    !customerAccountSource.includes("marketing_consent") ||
    !customerAccountSource.includes("analytics_consent") ||
    !customerAccountSource.includes("remote_support_consent")
      ? "customer account data does not expose optional consent flags"
      : null,
  ].filter(Boolean);

  return {
    ok: sourceIssues.length === 0,
    details:
      sourceIssues.length === 0
        ? "Customers can grant and withdraw optional consent with current-version records and audit history."
        : sourceIssues.join(" | "),
  };
}

function resendWebhookSecretReadiness(): CheckResult {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() || "";

  return {
    ok: Boolean(secret),
    details: secret
      ? "Resend webhook signing secret is configured."
      : "RESEND_WEBHOOK_SECRET is missing; delivery event webhooks cannot be verified.",
  };
}

function textQualityCheckReadiness(): CheckResult {
  const scripts = (packageJson as { scripts?: Record<string, string> }).scripts || {};
  const command = scripts["text:check"] || "";

  return {
    ok: command.includes("check-text-quality.mjs"),
    details: command
      ? `text:check is configured as "${command}".`
      : "package.json is missing a text:check script.",
  };
}

function passwordPolicyReadiness(): CheckResult {
  const rejectsShortPassword = !validatePasswordPolicy("abc12");
  const rejectsNoNumber = !validatePasswordPolicy("abcdef");
  const rejectsNoLetter = !validatePasswordPolicy("123456");
  const acceptsValidPassword = validatePasswordPolicy("abc123");
  const descriptionMatches = passwordPolicyDescription.includes(
    String(PASSWORD_POLICY_MIN_LENGTH),
  );
  const ok =
    PASSWORD_POLICY_MIN_LENGTH >= 6 &&
    rejectsShortPassword &&
    rejectsNoNumber &&
    rejectsNoLetter &&
    acceptsValidPassword &&
    descriptionMatches;

  return {
    ok,
    details: ok
      ? `Customer passwords require at least ${PASSWORD_POLICY_MIN_LENGTH} characters with letters and numbers.`
      : "Customer password policy is weaker than the launch baseline or the visible guidance is out of sync.",
  };
}

function passwordResetReadiness(): CheckResult {
  const routeSource = readFileSync(
    projectFilePath("src/app/api/auth/password-reset/route.ts"),
    "utf8",
  );
  const policyOk =
    PASSWORD_RESET_WINDOW_MS >= 60 * 60 * 1000 &&
    PASSWORD_RESET_EMAIL_LIMIT <= 3 &&
    PASSWORD_RESET_IP_LIMIT <= 10 &&
    !PASSWORD_RESET_GENERIC_MESSAGE.toLowerCase().includes("hittades") &&
    !PASSWORD_RESET_GENERIC_MESSAGE.toLowerCase().includes("saknas");
  const sourceIssues = [
    !routeSource.includes("checkRateLimit")
      ? "password reset route does not rate limit requests"
      : null,
    !routeSource.includes("password-reset-ip") ||
    !routeSource.includes("password-reset-email")
      ? "password reset route does not rate limit both IP and email"
      : null,
    !routeSource.includes("PASSWORD_RESET_GENERIC_MESSAGE")
      ? "password reset route does not use a generic response"
      : null,
    !routeSource.includes("password_reset_rate_limited")
      ? "password reset rate limiting is not audited"
      : null,
    !routeSource.includes("password_reset_email_failed")
      ? "password reset email failures are not audited"
      : null,
    !routeSource.includes("createAdminNotification") ||
    !routeSource.includes("priority: \"urgent\"")
      ? "password reset email failures do not create urgent admin notifications"
      : null,
    !routeSource.includes("{ throwOnError: true }") ||
    !routeSource.includes("password_reset_audit_failed") ||
    !routeSource.includes("password_reset_email_notification_failed")
      ? "password reset audit or admin-notification failures do not create internal operational visibility"
      : null,
  ].filter(Boolean);
  const ok = policyOk && sourceIssues.length === 0;

  return {
    ok,
    details: ok
      ? "Password reset requests have launch-baseline abuse protection."
      : [
          !policyOk
            ? "Password reset request protection is weaker than the launch baseline or may reveal account existence."
            : null,
          ...sourceIssues,
        ]
          .filter(Boolean)
          .join(" | "),
  };
}

function loginAttemptReadiness(): CheckResult {
  const routeSource = readFileSync(
    projectFilePath("src/app/api/auth/login/route.ts"),
    "utf8",
  );
  const policyOk =
    LOGIN_ATTEMPT_WINDOW_MS >= 15 * 60 * 1000 &&
    LOGIN_ATTEMPT_EMAIL_LIMIT <= 5 &&
    LOGIN_ATTEMPT_IP_LIMIT <= 20 &&
    LOGIN_ATTEMPT_GENERIC_ERROR.length > 0 &&
    LOGIN_ATTEMPT_RATE_LIMIT_ERROR.length > 0;
  const sourceIssues = [
    !routeSource.includes("checkRateLimit")
      ? "login route does not rate limit requests"
      : null,
    !routeSource.includes("-ip:") || !routeSource.includes("-email:")
      ? "login route does not rate limit both IP and email"
      : null,
    !routeSource.includes("LOGIN_ATTEMPT_GENERIC_ERROR")
      ? "login route does not use a generic failed-login message"
      : null,
    routeSource.includes("administrat") || routeSource.includes("kopplad")
      ? "login denial responses may reveal role or account-link details"
      : null,
    !routeSource.includes("LOGIN_ATTEMPT_RATE_LIMIT_ERROR")
      ? "login route does not use a distinct rate-limit message"
      : null,
    !routeSource.includes("login_rate_limited")
      ? "login rate limiting is not audited"
      : null,
    !routeSource.includes("login_failed")
      ? "failed login attempts are not audited"
      : null,
    !routeSource.includes("admin_login_denied") ||
    !routeSource.includes("customer_login_denied")
      ? "login route does not audit admin/customer access denials"
      : null,
  ].filter(Boolean);
  const ok = policyOk && sourceIssues.length === 0;

  return {
    ok,
    details: ok
      ? "Email/password login attempts have launch-baseline abuse protection."
      : [
          !policyOk ? "Login attempt protection is weaker than the launch baseline." : null,
          ...sourceIssues,
        ]
          .filter(Boolean)
          .join(" | "),
  };
}

async function publicRequestIntakeReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const requestRouteSource = readFileSync(
    projectFilePath("src/app/api/onboarding-requests/route.ts"),
    "utf8",
  );
  const landingPageSource = readFileSync(
    projectFilePath("src/app/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !requestRouteSource.includes("checkRateLimit") ||
    !requestRouteSource.includes("landing-request")
      ? "public request route does not rate limit repeated submissions"
      : null,
    !requestRouteSource.includes("body.website") ||
    !landingPageSource.includes("landing-honeypot")
      ? "public request form does not have a server-checked honeypot"
      : null,
    !requestRouteSource.includes("privacyAccepted") ||
    !requestRouteSource.includes("recordConsent") ||
    !requestRouteSource.includes("privacy_request") ||
    !requestRouteSource.includes("throwOnError: true")
      ? "public request route does not require persisted privacy consent"
      : null,
    !requestRouteSource.includes("landing_purchase_request_created") ||
    !requestRouteSource.includes("createAdminNotification")
      ? "public request submissions are not audited and surfaced to admins"
      : null,
    !requestRouteSource.includes("{ throwOnError: true }") ||
    !requestRouteSource.includes("Landing request audit was not stored") ||
    !requestRouteSource.includes("landing_purchase_request_notification_failed") ||
    !requestRouteSource.includes("Forfragan sparades, men Screenia kunde inte skapa adminaviseringen")
      ? "public request submissions do not fail visibly when audit or admin notification storage fails"
      : null,
    !requestRouteSource.includes("sendTransactionalEmail") ||
    !requestRouteSource.includes("request_confirmation_email_sent") ||
    !requestRouteSource.includes("request_confirmation_email_failed") ||
    !requestRouteSource.includes("request_confirmation_email_not_configured")
      ? "public request confirmation emails do not record delivery state"
      : null,
    !requestRouteSource.includes("request_confirmation_email_audit_failed") ||
    !requestRouteSource.includes("request_confirmation_email_notification_failed") ||
    !requestRouteSource.includes("Request confirmation email audit was not stored") ||
    !requestRouteSource.includes("Request confirmation email failure notification was not stored")
      ? "public request confirmation email delivery failures do not fail visibly with audit and admin visibility"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Public request intake workflow", [
    supabaseAdmin
      .from("customers")
      .select(
        "id, status, requested_screen_quantity, requested_quote_items, preferred_contact_channel",
      )
      .limit(1),
    supabaseAdmin
      .from("consent_records")
      .select("id, consent_type, document_version")
      .limit(1),
    supabaseAdmin.from("audit_events").select("id, event_type, metadata").limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function customerSupportReplyReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const adminMessageRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customer-messages/route.ts"),
    "utf8",
  );
  const adminCustomerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/[customerId]/page.tsx"),
    "utf8",
  );
  const accountRouteSource = readFileSync(
    projectFilePath("src/app/api/account/route.ts"),
    "utf8",
  );
  const sourceIssues = [
    !adminMessageRouteSource.includes("export async function POST")
      ? "admin support replies are missing a server action"
      : null,
    !adminMessageRouteSource.includes("export async function PATCH")
      ? "admin support message review updates are missing a server action"
      : null,
    !adminMessageRouteSource.includes("A reason of at least 5 characters") ||
    !adminMessageRouteSource.includes("changedFields") ||
    !adminMessageRouteSource.includes("before") ||
    !adminMessageRouteSource.includes("after")
      ? "admin support message review updates do not require a reason with before/after audit evidence"
      : null,
    !adminMessageRouteSource.includes("reply.length < 5") ||
    !adminMessageRouteSource.includes("reply.length > 4000")
      ? "admin support reply route does not enforce reply length bounds"
      : null,
    !adminMessageRouteSource.includes("MESSAGE_STATUSES.has(status)")
      ? "admin support reply route does not validate ticket status"
      : null,
    !adminMessageRouteSource.includes("related_ticket_number")
      ? "admin support replies do not keep ticket threading"
      : null,
    !adminMessageRouteSource.includes("resolved_at") ||
    !adminMessageRouteSource.includes("waiting_for_customer")
      ? "admin support replies do not update the original ticket state"
      : null,
    !adminMessageRouteSource.includes("sendTransactionalEmail")
      ? "admin support replies do not email customers through the shared sender"
      : null,
    !adminMessageRouteSource.includes("customer_support_reply_sent") ||
    !adminMessageRouteSource.includes("customer_support_reply_audit_failed") ||
    !adminMessageRouteSource.includes("Customer support reply audit error") ||
    !adminMessageRouteSource.includes("rollbackSupportReply") ||
    !adminMessageRouteSource.includes("customer_message_admin_update") ||
    !adminMessageRouteSource.includes("customer_support_reply_email_sent") ||
    !adminMessageRouteSource.includes("customer_support_reply_email_failed") ||
    !adminMessageRouteSource.includes("customer_support_reply_email_not_configured") ||
    !adminMessageRouteSource.includes("customer_support_reply_email_audit_failed") ||
    !adminMessageRouteSource.includes("customer_support_reply_email_notification_failed") ||
    !adminMessageRouteSource.includes("Customer support reply email failure notification error") ||
    !adminMessageRouteSource.includes("Customer support reply email audit error")
      ? "admin support replies and message review updates do not audit reply, review, failure, and email delivery state"
      : null,
    !adminMessageRouteSource.includes("{ throwOnError: true }") ||
    !adminMessageRouteSource.includes("Customer message review was not saved because the audit event could not be stored") ||
    !adminMessageRouteSource.includes("Customer message review audit error")
      ? "admin support message review updates do not fail closed and roll back when audit storage fails"
      : null,
    !adminMessageRouteSource.includes("createAdminNotification") ||
    !adminMessageRouteSource.includes("priority: \"urgent\"")
      ? "admin support reply email failures do not notify admins urgently"
      : null,
    !adminCustomerPageSource.includes("Customer-visible reply") ||
    !adminCustomerPageSource.includes("sendCustomerMessageReply")
      ? "admin customer page does not expose the customer-visible reply action"
      : null,
    !adminCustomerPageSource.includes(
      "Reason for updating this support message review",
    )
      ? "admin customer page does not prompt for support review update reasons"
      : null,
    !accountRouteSource.includes("related_ticket_number")
      ? "customer account history does not expose ticket threading"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Customer support reply workflow", [
    supabaseAdmin
      .from("customer_messages")
      .select("id, customer_id, ticket_number, related_ticket_number, status")
      .limit(1),
    supabaseAdmin.from("audit_events").select("id, event_type, metadata").limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function customerSupportTicketIntakeReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const accountMessageRouteSource = readFileSync(
    projectFilePath("src/app/api/account/messages/route.ts"),
    "utf8",
  );
  const accountPageSource = readFileSync(
    projectFilePath("src/app/account/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !accountMessageRouteSource.includes("getAuthenticatedUser") ||
    !accountMessageRouteSource.includes("getCustomerForUser")
      ? "customer support ticket route does not authenticate the customer"
      : null,
    !accountMessageRouteSource.includes("MAX_FILE_BYTES") ||
    !accountMessageRouteSource.includes("MAX_FILES")
      ? "customer support ticket route does not limit attachment count and size"
      : null,
    !accountMessageRouteSource.includes("MAX_SUBJECT_LENGTH") ||
    !accountMessageRouteSource.includes("MAX_MESSAGE_LENGTH")
      ? "customer support ticket route does not limit subject and message length"
      : null,
    !accountMessageRouteSource.includes("ALLOWED_FILE_TYPES")
      ? "customer support ticket route does not restrict attachment file types"
      : null,
    !accountMessageRouteSource.includes("bytes.byteLength !== fileSize")
      ? "customer support ticket route does not verify uploaded file payload size"
      : null,
    !accountMessageRouteSource.includes("MESSAGE_FILE_BUCKET") ||
    !accountMessageRouteSource.includes("customer-message-files")
      ? "customer support attachments do not use the private message file bucket"
      : null,
    !accountMessageRouteSource.includes("failAttachmentSave") ||
    !accountMessageRouteSource.includes("customer_message_attachment_failed") ||
    !accountMessageRouteSource.includes("Customer message attachment failure evidence error") ||
    !accountMessageRouteSource.includes("remove(uploadedStoragePaths)") ||
    !accountMessageRouteSource.includes(".delete().eq(\"id\", savedMessage.id)")
      ? "customer support attachment failures do not clean up partial records with audit/admin visibility"
      : null,
    !accountMessageRouteSource.includes("ticket_number") ||
    !accountMessageRouteSource.includes("related_ticket_number")
      ? "customer support tickets do not create/thread ticket numbers"
      : null,
    !accountMessageRouteSource.includes("customer_message_sent")
      ? "customer support tickets are not audited"
      : null,
    !accountMessageRouteSource.includes("{ throwOnError: true }") ||
    !accountMessageRouteSource.includes("cleanupSavedTicket") ||
    !accountMessageRouteSource.includes("customer_message_audit_failed") ||
    !accountMessageRouteSource.includes("Customer message audit failure notification error") ||
    !accountMessageRouteSource.includes("customer_message_notification_failed") ||
    !accountMessageRouteSource.includes("Customer message notification failure audit error") ||
    !accountMessageRouteSource.includes("Arendet sparades inte eftersom revisionshistoriken inte kunde lagras")
      ? "customer support tickets do not fail visibly when audit or admin notification storage fails"
      : null,
    !accountMessageRouteSource.includes("createAdminNotification")
      ? "customer support tickets do not notify admins"
      : null,
    !accountMessageRouteSource.includes("priority === \"urgent\"")
      ? "urgent customer support tickets are not escalated to urgent admin notifications"
      : null,
    !accountMessageRouteSource.includes("data_subject_requests") ||
    !accountMessageRouteSource.includes("data_subject_request_received") ||
    !accountMessageRouteSource.includes("Data subject request receipt audit error") ||
    !accountMessageRouteSource.includes("data_subject_request_audit_failed") ||
    !accountMessageRouteSource.includes("Data subject request audit failure notification error")
      ? "privacy support tickets do not create deadline-tracked data subject requests"
      : null,
    !accountMessageRouteSource.includes("data_subject_request_register_failed") ||
    !accountMessageRouteSource.includes("priority: \"urgent\"") ||
    !accountMessageRouteSource.includes("Data subject request register failure notification error")
      ? "failed privacy request registration does not notify admins urgently"
      : null,
    !accountPageSource.includes("/api/account/messages") ||
    !accountPageSource.includes("privacy_request") ||
    !accountPageSource.includes("support-files")
      ? "customer account page does not expose support/privacy ticket submission with attachments"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Customer support ticket intake", [
    supabaseAdmin
      .from("customer_messages")
      .select(
        "id, customer_id, subject, message, status, ticket_number, request_type, priority",
      )
      .limit(1),
    supabaseAdmin
      .from("customer_message_files")
      .select("id, message_id, customer_id, storage_bucket, storage_path")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function adminNotificationWorkflowReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const notificationRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/notifications/route.ts"),
    "utf8",
  );
  const adminPageSource = readFileSync(projectFilePath("src/app/admin/page.tsx"), "utf8");
  const sourceIssues = [
    !notificationRouteSource.includes("export async function PATCH")
      ? "admin notification acknowledgements are missing a server route"
      : null,
    !notificationRouteSource.includes("mark_read") ||
    !notificationRouteSource.includes("mark_unread") ||
    !notificationRouteSource.includes("mark_all_read")
      ? "admin notification route does not support read, unread, and all-read actions"
      : null,
    !notificationRouteSource.includes("read_at")
      ? "admin notification route does not update read_at state"
      : null,
    !notificationRouteSource.includes("admin_notification_acknowledged")
      ? "admin notification acknowledgements are not audited"
      : null,
    !notificationRouteSource.includes("{ throwOnError: true }") ||
    !notificationRouteSource.includes("Notification state was not saved because the audit event could not be stored") ||
    !notificationRouteSource.includes("previousReadAt") ||
    !notificationRouteSource.includes("rollbackNotificationAcknowledgement") ||
    !notificationRouteSource.includes(
      "admin_notification_acknowledgement_rollback_failed",
    ) ||
    !notificationRouteSource.includes(
      "Admin notification acknowledgement rollback failure notification error",
    )
      ? "admin notification acknowledgements do not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !notificationRouteSource.includes("A reason of at least 5 characters is required before bulk acknowledging notifications") ||
    !notificationRouteSource.includes("reason: adminReason")
      ? "bulk admin notification acknowledgement does not require and audit a reason"
      : null,
    !notificationRouteSource.includes("updatedCount") ||
    !notificationRouteSource.includes("urgentCount")
      ? "admin notification bulk acknowledgements do not preserve useful audit metadata"
      : null,
    !adminPageSource.includes("/api/admin/notifications") ||
    !adminPageSource.includes("mark_all_read") ||
    !adminPageSource.includes("mark_unread") ||
    !adminPageSource.includes("Reason for marking all admin notifications as read")
      ? "admin dashboard does not expose notification acknowledgement actions"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Admin notification workflow", [
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority, read_at, metadata")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, actor_type, metadata")
      .limit(1),
  ]);
}

async function customerDataExportReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const exportRouteSource = readFileSync(
    projectFilePath("src/app/api/account/export/route.ts"),
    "utf8",
  );
  const accountPageSource = readFileSync(
    projectFilePath("src/app/account/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !exportRouteSource.includes("getAuthenticatedUser") ||
    !exportRouteSource.includes("getCustomerForUser")
      ? "customer export does not require an authenticated linked customer"
      : null,
    exportRouteSource.includes(".select(\"*\")")
      ? "customer export uses wildcard subscription/data selects"
      : null,
    exportRouteSource.includes("admin_note")
      ? "customer export includes internal admin notes"
      : null,
    !exportRouteSource.includes("CUSTOMER_EXPORT_FIELDS") ||
    !exportRouteSource.includes("buildCustomerExport") ||
    !exportRouteSource.includes("customer: customerExport")
      ? "customer export does not use an explicit customer field allowlist"
      : null,
    exportRouteSource.includes("event_description, metadata")
      ? "customer export includes raw audit metadata"
      : null,
    !exportRouteSource.includes("actor_type !== \"stripe\"")
      ? "customer export does not filter provider/internal audit records"
      : null,
    !exportRouteSource.includes("checkRateLimit")
      ? "customer export is not rate limited"
      : null,
    !exportRouteSource.includes("customer_data_export_rate_limited")
      ? "customer export rate-limit events are not audited"
      : null,
    !exportRouteSource.includes("customer_data_export_downloaded")
      ? "customer export downloads are not audited"
      : null,
    !exportRouteSource.includes("sourceErrors") ||
    !exportRouteSource.includes("customer_data_export_failed") ||
    !exportRouteSource.includes("createAdminNotification")
      ? "customer export source failures do not block partial exports with audit/admin visibility"
      : null,
    !exportRouteSource.includes("\"Content-Disposition\"") ||
    !exportRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "customer export does not force a no-store JSON download"
      : null,
    !accountPageSource.includes("/api/account/export") ||
    !accountPageSource.includes("Dataexport") ||
    !accountPageSource.includes("downloadDataExport")
      ? "customer account page does not expose the data export download"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Customer data export workflow", [
    supabaseAdmin.from("customers").select("id, email, status").limit(1),
    supabaseAdmin.from("customer_subscriptions").select("id, customer_id").limit(1),
    supabaseAdmin.from("customer_messages").select("id, customer_id").limit(1),
    supabaseAdmin.from("customer_display_assets").select("id, customer_id").limit(1),
    supabaseAdmin.from("customer_legal_agreements").select("id, customer_id").limit(1),
    supabaseAdmin.from("consent_records").select("id, customer_id").limit(1),
    supabaseAdmin.from("audit_events").select("id, customer_id, event_type").limit(1),
  ]);
}

async function customerDeletionSafetyReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const customerRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customers/[customerId]/route.ts"),
    "utf8",
  );
  const customerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/[customerId]/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !customerRouteSource.includes("cleanAdminReason")
      ? "customer delete/anonymize route is missing reason handling"
      : null,
    !customerRouteSource.includes("A reason of at least 5 characters is required before anonymizing")
      ? "customer anonymization does not require an admin reason"
      : null,
    !customerRouteSource.includes("A reason of at least 5 characters is required before deleting")
      ? "customer deletion does not require an admin reason"
      : null,
    !customerRouteSource.includes("Customers with payment or Stripe history cannot be permanently deleted")
      ? "customer deletion does not block payment/Stripe history records"
      : null,
    !customerRouteSource.includes("supabaseAdmin.auth.admin.deleteUser")
      ? "customer anonymization does not delete linked auth users"
      : null,
    !customerRouteSource.includes("customer-display-assets") ||
    !customerRouteSource.includes("customer-message-files") ||
    !customerRouteSource.includes("supabaseAdmin.storage.from(bucket).remove")
      ? "customer anonymization does not remove private uploaded/support files"
      : null,
    !customerRouteSource.includes("ip_address: null") ||
    !customerRouteSource.includes("user_agent: null")
      ? "customer anonymization does not remove retained technical identifiers"
      : null,
    !customerRouteSource.includes("customer_anonymized") ||
    !customerRouteSource.includes("customer_deleted")
      ? "customer anonymization/deletion actions are not audited"
      : null,
    !customerRouteSource.includes("customer_anonymization_started") ||
    !customerRouteSource.includes("Customer anonymization cannot start because the audit event could not be stored") ||
    !customerRouteSource.includes("before removing login access and private files")
      ? "customer anonymization does not fail closed before auth/file removal when audit storage fails"
      : null,
    !customerRouteSource.includes("customer_anonymization_final_audit_failed") ||
    !customerRouteSource.includes("Customer anonymization final audit error") ||
    !customerRouteSource.includes("Customer was anonymized, but the final audit event could not be stored")
      ? "customer anonymization does not create urgent visibility when final audit storage fails"
      : null,
    !customerRouteSource.includes("{ throwOnError: true }") ||
    !customerRouteSource.includes("Customer was not deleted because the audit event could not be stored")
      ? "permanent customer deletion does not fail closed before destructive deletes when audit storage fails"
      : null,
    !customerRouteSource.includes("customer_delete_storage_cleanup_failed") ||
    !customerRouteSource.includes("Customer delete storage cleanup error") ||
    !customerRouteSource.includes("Customer was deleted, but private file cleanup failed")
      ? "permanent customer deletion does not create urgent visibility when private file cleanup fails"
      : null,
    !customerRouteSource.includes("detachCustomerId") ||
    !customerRouteSource.includes("customer_subscriptions")
      ? "customer deletion does not preserve accounting/audit traceability boundaries"
      : null,
    !customerPageSource.includes("Reason for anonymizing this customer")
      ? "admin UI does not prompt for anonymization reason"
      : null,
    !customerPageSource.includes("Reason for permanently deleting this draft customer")
      ? "admin UI does not prompt for deletion reason"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Customer deletion safety workflow", [
    supabaseAdmin.from("audit_events").select("id, event_type, metadata").limit(1),
    supabaseAdmin
      .from("customer_subscriptions")
      .select("id, customer_id, stripe_checkout_session_id")
      .limit(1),
  ]);
}

async function dataSubjectRequestReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const accountMessageSource = readFileSync(
    projectFilePath("src/app/api/account/messages/route.ts"),
    "utf8",
  );
  const requestRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/data-subject-requests/route.ts"),
    "utf8",
  );
  const requestUpdateRouteSource = readFileSync(
    projectFilePath(
      "src/app/api/admin/data-subject-requests/[requestId]/route.ts",
    ),
    "utf8",
  );
  const requestPageSource = readFileSync(
    projectFilePath("src/app/admin/data-subject-requests/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120010_data_subject_request_register.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !accountMessageSource.includes("privacy_request")
      ? "customer account cannot submit privacy request tickets"
      : null,
    !accountMessageSource.includes("data_subject_requests")
      ? "customer privacy tickets do not create data subject request records"
      : null,
    !accountMessageSource.includes("data_subject_request_received") ||
    !accountMessageSource.includes("Data subject request receipt audit error")
      ? "data subject request receipt is not audited"
      : null,
    !accountMessageSource.includes("data_subject_request_register_failed") ||
    !accountMessageSource.includes("priority: \"urgent\"") ||
    !accountMessageSource.includes("Data subject request register failure notification error")
      ? "failed data subject request registration does not create an urgent admin notification"
      : null,
    !requestRouteSource.includes("export async function GET")
      ? "data subject requests cannot be listed through an admin API"
      : null,
    !requestRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "data subject request list response is missing no-store caching"
      : null,
    !requestUpdateRouteSource.includes("export async function PATCH")
      ? "data subject requests cannot be updated through an admin API"
      : null,
    !requestUpdateRouteSource.includes("data_subject_request_updated")
      ? "data subject request updates are not audited"
      : null,
    !requestUpdateRouteSource.includes("A reason of at least 5 characters")
      ? "data subject request updates do not require an admin reason"
      : null,
    !requestUpdateRouteSource.includes("Completion or rejection requires outcome notes") ||
    !requestUpdateRouteSource.includes("[\"completed\", \"rejected\"].includes(status)")
      ? "data subject request completion/rejection does not require outcome evidence notes"
      : null,
    !requestUpdateRouteSource.includes("before") ||
    !requestUpdateRouteSource.includes("after") ||
    !requestUpdateRouteSource.includes("changedFields")
      ? "data subject request updates do not audit before/after changed fields"
      : null,
    !requestUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "data subject request audit metadata does not store the computed changed-field list"
      : null,
    !requestUpdateRouteSource.includes("{ throwOnError: true }") ||
    !requestUpdateRouteSource.includes("Data subject request update audit error") ||
    !requestUpdateRouteSource.includes("Data subject request update rollback error")
      ? "data subject request updates do not roll back when audit storage fails"
      : null,
    !requestPageSource.includes("Data subject request register")
      ? "admin data subject request page does not expose the register"
      : null,
    !requestPageSource.includes("Overdue")
      ? "admin data subject request page does not surface overdue requests"
      : null,
    !requestPageSource.includes("Completion or rejection requires outcome notes")
      ? "admin data subject request page does not warn about terminal outcome notes"
      : null,
    !navSource.includes("/admin/data-subject-requests")
      ? "admin navigation does not expose data subject requests"
      : null,
    !migrationSource.includes("due_at")
      ? "data subject request migration does not track deadlines"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Data subject request register", [
    supabaseAdmin
      .from("data_subject_requests")
      .select("id, customer_id, request_type, status, due_at, completed_at")
      .limit(1),
    supabaseAdmin
      .from("customer_messages")
      .select("id, request_type, ticket_number")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function accountingExportReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const exportRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/accounting-export/route.ts"),
    "utf8",
  );
  const ordersPageSource = readFileSync(
    projectFilePath("src/app/admin/orders/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    exportRouteSource.includes(".select(\"*\")")
      ? "accounting export uses wildcard selects"
      : null,
    !exportRouteSource.includes("getAuthenticatedAdmin")
      ? "accounting export is missing admin authentication"
      : null,
    !exportRouteSource.includes("admin_accounting_export_downloaded")
      ? "accounting export downloads are not audited"
      : null,
    !exportRouteSource.includes("{ throwOnError: true }") ||
    !exportRouteSource.includes("Accounting export was not downloaded because audit storage failed")
      ? "accounting export does not fail closed when audit storage fails"
      : null,
    !exportRouteSource.includes("text/csv; charset=utf-8")
      ? "accounting export does not return CSV"
      : null,
    !exportRouteSource.includes("Content-Disposition")
      ? "accounting export is missing download headers"
      : null,
    !exportRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "accounting export is missing no-store headers"
      : null,
    !exportRouteSource.includes("stripe_invoice_id") ||
    !exportRouteSource.includes("stripe_checkout_session_id")
      ? "accounting export is missing Stripe payment identifiers"
      : null,
    !exportRouteSource.includes("tax_amount_sek") ||
    !exportRouteSource.includes("total_amount_sek")
      ? "accounting export is missing VAT/total amount fields"
      : null,
    !exportRouteSource.includes("organisation_number") ||
    !exportRouteSource.includes("billing_email")
      ? "accounting export is missing customer tax/billing identifiers"
      : null,
    !exportRouteSource.includes("service_access_status") ||
    !exportRouteSource.includes("cancellation_reason") ||
    !exportRouteSource.includes("cancellation_source")
      ? "accounting export is missing customer access/cancellation evidence"
      : null,
    !ordersPageSource.includes("/api/admin/accounting-export")
      ? "orders admin page does not expose the accounting export"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Accounting export workflow", [
    supabaseAdmin
      .from("customer_subscriptions")
      .select(
        "id, order_number, stripe_invoice_id, tax_amount_sek, total_amount_sek, stripe_payment_status",
      )
      .limit(1),
    supabaseAdmin
      .from("customers")
      .select(
        "id, customer_number, billing_email, organisation_number, service_access_status, cancellation_reason, cancellation_source",
      )
      .limit(1),
    supabaseAdmin
      .from("pricing_plans")
      .select("id, code, currency, tax_behavior")
      .limit(1),
    supabaseAdmin.from("audit_events").select("id, event_type, metadata").limit(1),
  ]);
}

async function vatSummaryReady(supabaseAdmin: SupabaseClient): Promise<CheckResult> {
  const vatRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/vat-summary/route.ts"),
    "utf8",
  );
  const ordersPageSource = readFileSync(
    projectFilePath("src/app/admin/orders/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    vatRouteSource.includes(".select(\"*\")")
      ? "VAT summary uses wildcard selects"
      : null,
    !vatRouteSource.includes("getAuthenticatedAdmin")
      ? "VAT summary is missing admin authentication"
      : null,
    !vatRouteSource.includes("admin_vat_summary_exported")
      ? "VAT summary exports are not audited"
      : null,
    !vatRouteSource.includes("{ throwOnError: true }") ||
    !vatRouteSource.includes("VAT summary was not downloaded because audit storage failed")
      ? "VAT summary does not fail closed when audit storage fails"
      : null,
    !vatRouteSource.includes("text/csv; charset=utf-8")
      ? "VAT summary does not support CSV exports"
      : null,
    !vatRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "VAT summary is missing no-store headers"
      : null,
    !vatRouteSource.includes("\"TOTAL\"") ||
    !vatRouteSource.includes("grossOre") ||
    !vatRouteSource.includes("vatOre") ||
    !vatRouteSource.includes("netOre")
      ? "VAT summary is missing total gross/VAT/net evidence"
      : null,
    !vatRouteSource.includes("tax_amount_sek") ||
    !vatRouteSource.includes("total_amount_sek")
      ? "VAT summary is missing VAT/total amount fields"
      : null,
    !vatRouteSource.includes("stripe_invoice_id")
      ? "VAT summary is missing Stripe invoice identifiers"
      : null,
    !vatRouteSource.includes('.in("status", ["paid", "active"])') ||
    !vatRouteSource.includes('.eq("tax_status", "complete")')
      ? "VAT summary does not restrict rows to active paid subscription records with complete tax evidence"
      : null,
    !ordersPageSource.includes("/api/admin/vat-summary?format=csv")
      ? "orders admin page does not expose the VAT summary export"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "VAT summary workflow", [
    supabaseAdmin
      .from("customer_subscriptions")
      .select(
        "id, order_number, stripe_invoice_id, tax_amount_sek, total_amount_sek, stripe_payment_status",
      )
      .limit(1),
    supabaseAdmin
      .from("tax_payments")
      .select("id, period_start, period_end, tax_amount_sek, status")
      .limit(1),
    supabaseAdmin.from("audit_events").select("id, event_type, metadata").limit(1),
  ]);
}

async function taxPaymentRegisterReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const taxRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/tax-payments/route.ts"),
    "utf8",
  );
  const taxUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/tax-payments/[taxPaymentId]/route.ts"),
    "utf8",
  );
  const taxPageSource = readFileSync(
    projectFilePath("src/app/admin/tax-payments/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const sourceIssues = [
    !taxRouteSource.includes("export async function GET")
      ? "tax payment records cannot be listed through an admin API"
      : null,
    !taxRouteSource.includes("export async function POST")
      ? "tax payment records cannot be created through an admin API"
      : null,
    !taxRouteSource.includes("getAuthenticatedAdmin") ||
    !taxUpdateRouteSource.includes("getAuthenticatedAdmin")
      ? "tax payment routes are missing admin authentication"
      : null,
    !taxRouteSource.includes("\"Cache-Control\": \"no-store\"") &&
    !taxRouteSource.includes("\"Cache-Control\", \"no-store\"")
      ? "tax payment list response is missing no-store caching"
      : null,
    !taxRouteSource.includes("allowedStatuses") ||
    !taxUpdateRouteSource.includes("allowedStatuses")
      ? "tax payment routes do not validate status values"
      : null,
    !taxRouteSource.includes("parseDateOnly") ||
    !taxRouteSource.includes("parseOreAmount")
      ? "tax payment creation does not validate period dates and ore amounts"
      : null,
    !taxRouteSource.includes("Payment reference is required when marking a tax period paid") ||
    !taxUpdateRouteSource.includes("Payment reference is required when marking a tax period paid")
      ? "tax payment paid status does not require payment reference"
      : null,
    !taxRouteSource.includes("A reason of at least 5 characters") ||
    !taxUpdateRouteSource.includes("A reason of at least 5 characters")
      ? "tax payment records do not require an admin reason"
      : null,
    !taxRouteSource.includes("admin_tax_payment_recorded") ||
    !taxUpdateRouteSource.includes("admin_tax_payment_updated")
      ? "tax payment creates/updates are not audited"
      : null,
    !taxRouteSource.includes("{ throwOnError: true }") ||
    !taxRouteSource.includes("Tax payment record was not saved because the audit event could not be stored") ||
    !taxRouteSource.includes(".delete()") ||
    !taxRouteSource.includes(".eq(\"id\", data.id)") ||
    !taxRouteSource.includes("Create tax payment rollback error")
      ? "tax payment creation does not fail closed and roll back when audit storage fails"
      : null,
    !taxRouteSource.includes("admin_tax_payment_create_rollback_failed") ||
    !taxRouteSource.includes("Create tax payment rollback failure notification error") ||
    !taxRouteSource.includes("Tax payment audit failed, rollback failed, and urgent admin visibility could not be stored")
      ? "tax payment creation rollback failures do not create urgent admin visibility"
      : null,
    !taxUpdateRouteSource.includes("{ throwOnError: true }") ||
    !taxUpdateRouteSource.includes("Tax payment update was not saved because the audit event could not be stored") ||
    !taxUpdateRouteSource.includes("status: existing.status") ||
    !taxUpdateRouteSource.includes("paid_at: existing.paid_at") ||
    !taxUpdateRouteSource.includes("updated_at: existing.updated_at") ||
    !taxUpdateRouteSource.includes("Update tax payment rollback error")
      ? "tax payment updates do not fail closed and roll back when audit storage fails"
      : null,
    !taxUpdateRouteSource.includes("admin_tax_payment_update_rollback_failed") ||
    !taxUpdateRouteSource.includes("Update tax payment rollback failure notification error") ||
    !taxUpdateRouteSource.includes("Tax payment update audit failed, rollback failed, and urgent admin visibility could not be stored")
      ? "tax payment update rollback failures do not create urgent admin visibility"
      : null,
    !taxUpdateRouteSource.includes("changedFields") ||
    !taxUpdateRouteSource.includes("before") ||
    !taxUpdateRouteSource.includes("after")
      ? "tax payment updates do not audit changed fields with before/after evidence"
      : null,
    !taxPageSource.includes("Record VAT period")
      ? "admin tax payment page does not expose the record form"
      : null,
    !taxPageSource.includes("Mark submitted") ||
    !taxPageSource.includes("Mark paid")
      ? "admin tax payment page does not expose status update actions"
      : null,
    !taxPageSource.includes("Payment reference is required")
      ? "admin tax payment page does not prompt for paid payment reference"
      : null,
    !navSource.includes("/admin/tax-payments")
      ? "admin navigation does not expose the tax payment register"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Tax payment register", [
    supabaseAdmin
      .from("tax_payments")
      .select(
        "id, period_start, period_end, taxable_amount_sek, tax_amount_sek, status, paid_at, reference",
      )
      .limit(1),
    supabaseAdmin.from("audit_events").select("id, event_type, metadata").limit(1),
  ]);
}

async function privacyIncidentReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const incidentRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/privacy-incidents/route.ts"),
    "utf8",
  );
  const incidentUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/privacy-incidents/[incidentId]/route.ts"),
    "utf8",
  );
  const incidentPageSource = readFileSync(
    projectFilePath("src/app/admin/privacy-incidents/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120009_privacy_incident_register.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !incidentRouteSource.includes("export async function GET")
      ? "privacy incidents cannot be listed through an admin API"
      : null,
    !incidentRouteSource.includes("export async function POST")
      ? "privacy incidents cannot be created through an admin API"
      : null,
    !incidentRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "privacy incident list response is missing no-store caching"
      : null,
    !incidentUpdateRouteSource.includes("export async function PATCH")
      ? "privacy incidents cannot be updated through an admin API"
      : null,
    !incidentRouteSource.includes("validateIncidentPayload") ||
    !incidentUpdateRouteSource.includes("validateIncidentPayload")
      ? "privacy incident create/update routes do not share validation"
      : null,
    !incidentRouteSource.includes("A reason of at least 5 characters")
      ? "privacy incident actions do not require an admin reason"
      : null,
    !incidentRouteSource.includes("privacy_incident_created") ||
    !incidentUpdateRouteSource.includes("privacy_incident_updated")
      ? "privacy incident create/update actions are not audited"
      : null,
    !incidentUpdateRouteSource.includes("before") ||
    !incidentUpdateRouteSource.includes("after") ||
    !incidentUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "privacy incident updates do not audit before/after changed fields"
      : null,
    !incidentRouteSource.includes("createAdminNotification")
      ? "privacy incidents do not create admin notifications"
      : null,
    !incidentRouteSource.includes("{ throwOnError: true }") ||
    !incidentRouteSource.includes("Privacy incident creation evidence error") ||
    !incidentRouteSource.includes("Privacy incident creation rollback error")
      ? "privacy incident creation does not roll back when audit or notification evidence fails"
      : null,
    !incidentUpdateRouteSource.includes("createAdminNotification") ||
    !incidentUpdateRouteSource.includes("needsFollowUp") ||
    !incidentUpdateRouteSource.includes("authority_notification_required") ||
    !incidentUpdateRouteSource.includes("customer_notification_required")
      ? "privacy incident updates do not notify admins when escalation or notification follow-up is needed"
      : null,
    !incidentUpdateRouteSource.includes("{ throwOnError: true }") ||
    !incidentUpdateRouteSource.includes("Privacy incident update evidence error") ||
    !incidentUpdateRouteSource.includes("Privacy incident update rollback error")
      ? "privacy incident updates do not roll back when audit or notification evidence fails"
      : null,
    !incidentRouteSource.includes("data.severity === \"critical\"") ||
    !incidentRouteSource.includes("data.severity === \"high\"") ||
    !incidentRouteSource.includes("? \"urgent\"")
      ? "high/critical privacy incidents are not escalated as urgent notifications"
      : null,
    !incidentPageSource.includes("Incident register") ||
    !incidentPageSource.includes("Authority notification required") ||
    !incidentPageSource.includes("Customer notification required")
      ? "admin privacy incident page does not expose notification decisions"
      : null,
    !navSource.includes("/admin/privacy-incidents")
      ? "admin navigation does not expose privacy incidents"
      : null,
    !migrationSource.includes("authority_notification_required") ||
    !migrationSource.includes("customer_notification_required")
      ? "privacy incident migration does not track notification decisions"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Privacy incident register", [
    supabaseAdmin
      .from("privacy_incidents")
      .select(
        "id, title, severity, status, authority_notification_required, customer_notification_required",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function adminAccessReviewReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const accessRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/access-reviews/route.ts"),
    "utf8",
  );
  const accessUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/access-reviews/[reviewId]/route.ts"),
    "utf8",
  );
  const accessPageSource = readFileSync(
    projectFilePath("src/app/admin/access-reviews/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120011_admin_access_reviews.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !accessRouteSource.includes("export async function GET")
      ? "admin access reviews cannot be listed through an admin API"
      : null,
    !accessRouteSource.includes("export async function POST")
      ? "admin access reviews cannot be created through an admin API"
      : null,
    !accessRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "admin access review list response is missing no-store caching"
      : null,
    !accessUpdateRouteSource.includes("export async function PATCH")
      ? "admin access reviews cannot be updated through an admin API"
      : null,
    !accessRouteSource.includes("validateAccessReviewPayload") ||
    !accessUpdateRouteSource.includes("validateAccessReviewPayload")
      ? "admin access review create/update routes do not share validation"
      : null,
    !accessRouteSource.includes("admin_access_review_recorded") ||
    !accessUpdateRouteSource.includes("admin_access_review_updated")
      ? "admin access review create/update actions are not audited"
      : null,
    !accessUpdateRouteSource.includes("before") ||
    !accessUpdateRouteSource.includes("after") ||
    !accessUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "admin access review updates do not audit before/after changed fields"
      : null,
    !accessRouteSource.includes("createAdminNotification") ||
    !accessRouteSource.includes('review_status === "needs_review"') ||
    !accessRouteSource.includes("!data.mfa_verified")
      ? "admin access reviews do not notify admins when access or MFA needs review"
      : null,
    !accessRouteSource.includes("{ throwOnError: true }") ||
    !accessRouteSource.includes("Admin access review creation evidence error") ||
    !accessRouteSource.includes("Admin access review creation rollback error")
      ? "admin access review creation does not roll back when audit or notification evidence fails"
      : null,
    !accessUpdateRouteSource.includes("{ throwOnError: true }") ||
    !accessUpdateRouteSource.includes("Admin access review update audit error") ||
    !accessUpdateRouteSource.includes("Admin access review update rollback error")
      ? "admin access review updates do not roll back when audit evidence fails"
      : null,
    !accessRouteSource.includes("A reason of at least 5 characters") ||
    !accessUpdateRouteSource.includes("validateAccessReviewPayload")
      ? "admin access review actions do not require an admin reason"
      : null,
    !accessPageSource.includes("Access review register") ||
    !accessPageSource.includes("MFA verified") ||
    !accessPageSource.includes("Access still required")
      ? "admin access review page does not expose required access evidence fields"
      : null,
    !navSource.includes("/admin/access-reviews")
      ? "admin navigation does not expose access reviews"
      : null,
    !migrationSource.includes("mfa_verified") ||
    !migrationSource.includes("access_confirmed") ||
    !migrationSource.includes("reviewed_at") ||
    !migrationSource.includes("reviewed_by")
      ? "admin access review migration does not track MFA, access confirmation, reviewer, and review time"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Admin access review register", [
    supabaseAdmin
      .from("admin_access_reviews")
      .select(
        "id, admin_email, review_status, mfa_verified, access_confirmed, reviewed_at",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function backupRestoreDrillReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const drillRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/backup-drills/route.ts"),
    "utf8",
  );
  const drillUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/backup-drills/[drillId]/route.ts"),
    "utf8",
  );
  const drillPageSource = readFileSync(
    projectFilePath("src/app/admin/backup-drills/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120012_backup_restore_drills.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !drillRouteSource.includes("export async function GET")
      ? "backup restore drills cannot be listed through an admin API"
      : null,
    !drillRouteSource.includes("export async function POST")
      ? "backup restore drills cannot be created through an admin API"
      : null,
    !drillRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "backup restore drill list response is missing no-store caching"
      : null,
    !drillUpdateRouteSource.includes("export async function PATCH")
      ? "backup restore drills cannot be updated through an admin API"
      : null,
    !drillRouteSource.includes("validateBackupDrillPayload") ||
    !drillUpdateRouteSource.includes("validateBackupDrillPayload")
      ? "backup restore drill create/update routes do not share validation"
      : null,
    !drillRouteSource.includes("Restore-tested records require a restore test date")
      ? "restore-tested backup drills do not require restore-test evidence"
      : null,
    !drillRouteSource.includes("backup_restore_drill_recorded") ||
    !drillUpdateRouteSource.includes("backup_restore_drill_updated")
      ? "backup restore drill create/update actions are not audited"
      : null,
    !drillUpdateRouteSource.includes("before") ||
    !drillUpdateRouteSource.includes("after") ||
    !drillUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "backup restore drill updates do not audit before/after changed fields"
      : null,
    !drillRouteSource.includes("createAdminNotification") ||
    !drillRouteSource.includes('status === "needs_attention"')
      ? "backup restore drills do not create urgent notifications when attention is needed"
      : null,
    !drillRouteSource.includes("{ throwOnError: true }") ||
    !drillRouteSource.includes("Backup restore drill creation evidence error") ||
    !drillRouteSource.includes("Backup restore drill creation rollback error")
      ? "backup restore drill creation does not roll back when audit or notification evidence fails"
      : null,
    !drillUpdateRouteSource.includes("{ throwOnError: true }") ||
    !drillUpdateRouteSource.includes("Backup restore drill update audit error") ||
    !drillUpdateRouteSource.includes("Backup restore drill update rollback error")
      ? "backup restore drill updates do not roll back when audit evidence fails"
      : null,
    !drillRouteSource.includes("A reason of at least 5 characters") ||
    !drillUpdateRouteSource.includes("validateBackupDrillPayload")
      ? "backup restore drill actions do not require an admin reason"
      : null,
    !drillPageSource.includes("Backup restore register") ||
    !drillPageSource.includes("Last successful backup") ||
    !drillPageSource.includes("Restore tested") ||
    !drillPageSource.includes("Evidence reference")
      ? "admin backup restore page does not expose required recovery evidence fields"
      : null,
    !navSource.includes("/admin/backup-drills")
      ? "admin navigation does not expose backup restore drills"
      : null,
    !migrationSource.includes("restore_tested_at") ||
    !migrationSource.includes("last_successful_backup_at") ||
    !migrationSource.includes("evidence_reference")
      ? "backup restore drill migration does not track backup and restore evidence"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Backup restore drill register", [
    supabaseAdmin
      .from("backup_restore_drills")
      .select(
        "id, provider, backup_scope, status, last_successful_backup_at, restore_tested_at, evidence_reference",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function dataRetentionReviewReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const retentionRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/data-retention/route.ts"),
    "utf8",
  );
  const retentionUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/data-retention/[reviewId]/route.ts"),
    "utf8",
  );
  const retentionPageSource = readFileSync(
    projectFilePath("src/app/admin/data-retention/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120013_data_retention_reviews.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !retentionRouteSource.includes("export async function GET")
      ? "data retention reviews cannot be listed through an admin API"
      : null,
    !retentionRouteSource.includes("export async function POST")
      ? "data retention reviews cannot be created through an admin API"
      : null,
    !retentionRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "data retention review list response is missing no-store caching"
      : null,
    !retentionUpdateRouteSource.includes("export async function PATCH")
      ? "data retention reviews cannot be updated through an admin API"
      : null,
    !retentionRouteSource.includes("validateDataRetentionPayload") ||
    !retentionUpdateRouteSource.includes("validateDataRetentionPayload")
      ? "data retention review create/update routes do not share validation"
      : null,
    !retentionRouteSource.includes("data_retention_review_recorded") ||
    !retentionUpdateRouteSource.includes("data_retention_review_updated")
      ? "data retention review create/update actions are not audited"
      : null,
    !retentionUpdateRouteSource.includes("before") ||
    !retentionUpdateRouteSource.includes("after") ||
    !retentionUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "data retention review updates do not audit before/after changed fields"
      : null,
    !retentionRouteSource.includes("createAdminNotification") ||
    !retentionRouteSource.includes('["anonymize", "delete"].includes')
      ? "data retention reviews do not notify admins when deletion/anonymization is recommended"
      : null,
    !retentionRouteSource.includes("{ throwOnError: true }") ||
    !retentionRouteSource.includes("Data retention review creation evidence error") ||
    !retentionRouteSource.includes("Data retention review creation rollback error")
      ? "data retention review creation does not roll back when audit or notification evidence fails"
      : null,
    !retentionUpdateRouteSource.includes("{ throwOnError: true }") ||
    !retentionUpdateRouteSource.includes("Data retention review update audit error") ||
    !retentionUpdateRouteSource.includes("Data retention review update rollback error")
      ? "data retention review updates do not roll back when audit evidence fails"
      : null,
    !retentionRouteSource.includes("A reason of at least 5 characters") ||
    !retentionUpdateRouteSource.includes("validateDataRetentionPayload")
      ? "data retention review actions do not require an admin reason"
      : null,
    !retentionPageSource.includes("Data retention register") ||
    !retentionPageSource.includes("Legal basis") ||
    !retentionPageSource.includes("Retention reason") ||
    !retentionPageSource.includes("Recommended action")
      ? "admin data retention page does not expose required retention decision fields"
      : null,
    !navSource.includes("/admin/data-retention")
      ? "admin navigation does not expose data retention reviews"
      : null,
    !migrationSource.includes("legal_basis") ||
    !migrationSource.includes("retention_reason") ||
    !migrationSource.includes("retention_until") ||
    !migrationSource.includes("recommended_action") ||
    !migrationSource.includes("completed_at")
      ? "data retention migration does not track legal basis, retention reason/date, action, and completion"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Data retention review register", [
    supabaseAdmin
      .from("data_retention_reviews")
      .select(
        "id, record_area, legal_basis, retention_until, review_status, recommended_action",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function operationalFulfillmentReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const orderUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/orders/[orderId]/route.ts"),
    "utf8",
  );
  const sourceIssues = [
    !orderUpdateRouteSource.includes("getAuthenticatedAdmin")
      ? "admin order operations are missing admin authentication"
      : null,
    !orderUpdateRouteSource.includes("A reason of at least 5 characters")
      ? "admin order operations do not require an admin reason"
      : null,
    !orderUpdateRouteSource.includes("admin_order_operation_updated")
      ? "admin order operations are not audited"
      : null,
    !orderUpdateRouteSource.includes("{ throwOnError: true }") ||
    !orderUpdateRouteSource.includes("Order operation was not saved because the audit event could not be stored") ||
    !orderUpdateRouteSource.includes("Order operation audit error") ||
    !orderUpdateRouteSource.includes("fieldsChanged.map") ||
    !orderUpdateRouteSource.includes("rollbackOrderOperation") ||
    !orderUpdateRouteSource.includes("admin_order_operation_rollback_failed") ||
    !orderUpdateRouteSource.includes(
      "Order operation rollback failure notification error",
    )
      ? "admin order operations do not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !orderUpdateRouteSource.includes(
      "Shipped or completed orders require tracking evidence",
    )
      ? "admin order operations can mark shipped/completed without tracking evidence"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Operational fulfillment", [
    supabaseAdmin
      .from("customers")
      .select("id, status, payment_status, service_access_status")
      .limit(1),
    supabaseAdmin.from("devices").select("id, customer_id, is_active").limit(1),
    supabaseAdmin.from("playlists").select("id, device_id").limit(1),
    supabaseAdmin
      .from("customer_subscriptions")
      .select("id, fulfillment_status, inventory_status, tracking_number")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, actor_type, metadata")
      .limit(1),
  ]);
}

async function inventoryOperationsReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const inventoryCreateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/inventory/route.ts"),
    "utf8",
  );
  const inventoryUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/inventory/[itemId]/route.ts"),
    "utf8",
  );
  const inventoryPageSource = readFileSync(
    projectFilePath("src/app/admin/inventory/page.tsx"),
    "utf8",
  );
  const inventoryMigrationPath = projectFilePath(
    "supabase/migrations/202606070000_inventory_management.sql",
  );
  const inventoryMigrationSource = existsSync(inventoryMigrationPath)
    ? readFileSync(inventoryMigrationPath, "utf8")
    : "";
  const sourceIssues = [
    !inventoryCreateRouteSource.includes("export async function POST")
      ? "inventory stock creation is missing a server route"
      : null,
    !inventoryUpdateRouteSource.includes("export async function PATCH")
      ? "inventory stock updates are missing a server route"
      : null,
    !inventoryCreateRouteSource.includes("getAuthenticatedAdmin") ||
    !inventoryUpdateRouteSource.includes("getAuthenticatedAdmin")
      ? "inventory routes are missing admin authentication"
      : null,
    !inventoryCreateRouteSource.includes("A reason of at least 5 characters") ||
    !inventoryUpdateRouteSource.includes("A reason of at least 5 characters")
      ? "inventory operations do not require an admin reason"
      : null,
    !inventoryCreateRouteSource.includes("itemTypes") ||
    !inventoryCreateRouteSource.includes("statuses") ||
    !inventoryCreateRouteSource.includes("conditions") ||
    !inventoryUpdateRouteSource.includes("itemTypes") ||
    !inventoryUpdateRouteSource.includes("statuses") ||
    !inventoryUpdateRouteSource.includes("conditions")
      ? "inventory routes do not validate item type, status, and condition"
      : null,
    !inventoryCreateRouteSource.includes("Serial number is required") ||
    !inventoryUpdateRouteSource.includes("Serial number is required")
      ? "inventory routes do not require serial numbers"
      : null,
    !inventoryCreateRouteSource.includes("admin_inventory_item_created") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_item_updated") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_status_updated") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_allocated_to_new_device") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_linked_to_existing_device")
      ? "inventory create, update, status, allocate, or link actions are not audited"
      : null,
    !inventoryCreateRouteSource.includes("{ throwOnError: true }") ||
    !inventoryCreateRouteSource.includes("Inventory item was not saved because the audit event could not be stored") ||
    !inventoryCreateRouteSource.includes("rollbackCreatedInventoryItem") ||
    !inventoryCreateRouteSource.includes("admin_inventory_item_create_rollback_failed") ||
    !inventoryCreateRouteSource.includes(
      "Create inventory item rollback failure notification error",
    )
      ? "inventory creation does not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !inventoryUpdateRouteSource.includes("{ throwOnError: true }") ||
    !inventoryUpdateRouteSource.includes("Inventory item update was not saved because the audit event could not be stored") ||
    !inventoryUpdateRouteSource.includes("Inventory status update was not saved because the audit event could not be stored") ||
    !inventoryUpdateRouteSource.includes("Inventory item update audit error") ||
    !inventoryUpdateRouteSource.includes("Inventory status update audit error") ||
    !inventoryUpdateRouteSource.includes("rollbackInventoryFields") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_item_update_rollback_failed") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_status_update_rollback_failed") ||
    !inventoryUpdateRouteSource.includes(
      "Inventory item update rollback failure notification error",
    ) ||
    !inventoryUpdateRouteSource.includes(
      "Inventory status update rollback failure notification error",
    )
      ? "inventory detail/status updates do not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !inventoryUpdateRouteSource.includes("allocate_new_device") ||
    !inventoryUpdateRouteSource.includes("link_existing_device")
      ? "inventory route does not support allocation to new and existing devices"
      : null,
    !inventoryUpdateRouteSource.includes("Device was created, but inventory could not be linked") ||
    !inventoryUpdateRouteSource.includes("rollbackInventoryDeviceAllocation") ||
    !inventoryUpdateRouteSource.includes("Inventory allocation was not saved because the audit event could not be stored") ||
    !inventoryUpdateRouteSource.includes("Inventory allocation audit error") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_allocation_rollback_failed") ||
    !inventoryUpdateRouteSource.includes(
      "Inventory allocation rollback failure notification error",
    )
      ? "inventory allocation to a new device does not verify rollback and notify admins when rollback fails"
      : null,
    !inventoryUpdateRouteSource.includes("Inventory device link was not saved because the audit event could not be stored") ||
    !inventoryUpdateRouteSource.includes("Inventory device link audit error") ||
    !inventoryUpdateRouteSource.includes("inventory_status: existingDevice.inventory_status") ||
    !inventoryUpdateRouteSource.includes("assigned_at: existing.assigned_at") ||
    !inventoryUpdateRouteSource.includes("admin_inventory_device_link_rollback_failed") ||
    !inventoryUpdateRouteSource.includes(
      "Inventory device link rollback failure notification error",
    )
      ? "inventory linking to an existing device does not verify rollback and notify admins when rollback fails"
      : null,
    !inventoryUpdateRouteSource.includes("This inventory item is already linked to a device")
      ? "inventory allocation does not prevent double-linking devices"
      : null,
    !inventoryMigrationSource.includes("log_inventory_item_change") ||
    !inventoryMigrationSource.includes("log_inventory_items_change") ||
    !inventoryMigrationSource.includes("inventory_events")
      ? "inventory migration does not preserve item event history"
      : null,
    !inventoryPageSource.includes("/api/admin/inventory") ||
    !inventoryPageSource.includes("allocate_new_device") ||
    !inventoryPageSource.includes("link_existing_device")
      ? "admin inventory page does not route stock operations through server APIs"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Inventory operations", [
    supabaseAdmin
      .from("inventory_items")
      .select(
        "id, item_code, status, condition, serial_number, customer_id, device_id, assigned_at, shipped_at, returned_at",
      )
      .limit(1),
    supabaseAdmin
      .from("inventory_events")
      .select("id, inventory_item_id, event_type, from_status, to_status")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, actor_type, metadata")
      .limit(1),
  ]);
}

async function deviceManagementReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const deviceCreateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/devices/route.ts"),
    "utf8",
  );
  const deviceUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/devices/[deviceId]/route.ts"),
    "utf8",
  );
  const deviceMediaRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/devices/[deviceId]/media/route.ts"),
    "utf8",
  );
  const newDevicePageSource = readFileSync(
    projectFilePath("src/app/admin/devices/new/page.tsx"),
    "utf8",
  );
  const deviceDetailPageSource = readFileSync(
    projectFilePath("src/app/admin/devices/[deviceId]/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !deviceCreateRouteSource.includes("export async function POST")
      ? "device creation is missing a server route"
      : null,
    !deviceUpdateRouteSource.includes("export async function PATCH") ||
    !deviceUpdateRouteSource.includes("export async function DELETE")
      ? "device update/delete operations are missing server routes"
      : null,
    !deviceMediaRouteSource.includes("export async function POST") ||
    !deviceMediaRouteSource.includes("export async function DELETE")
      ? "device media add/remove operations are missing server routes"
      : null,
    !deviceCreateRouteSource.includes("getAuthenticatedAdmin") ||
    !deviceUpdateRouteSource.includes("getAuthenticatedAdmin") ||
    !deviceMediaRouteSource.includes("getAuthenticatedAdmin")
      ? "device routes are missing admin authentication"
      : null,
    !deviceCreateRouteSource.includes("A reason of at least 5 characters") ||
    !deviceUpdateRouteSource.includes("A reason of at least 5 characters") ||
    !deviceMediaRouteSource.includes("A reason of at least 5 characters")
      ? "device operations do not require an admin reason"
      : null,
    !deviceCreateRouteSource.includes("Select a customer before creating a device") ||
    !deviceCreateRouteSource.includes("Device name is required")
      ? "device creation does not validate customer and device name"
      : null,
    !deviceCreateRouteSource.includes("admin_device_created")
      ? "device creation is not audited"
      : null,
    !deviceCreateRouteSource.includes("{ throwOnError: true }") ||
    !deviceCreateRouteSource.includes("Device was not saved because the audit event could not be stored") ||
    !deviceCreateRouteSource.includes("rollbackCreatedDevice") ||
    !deviceCreateRouteSource.includes("admin_device_create_rollback_failed") ||
    !deviceCreateRouteSource.includes(
      "Create device rollback failure notification error",
    )
      ? "device creation does not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !deviceUpdateRouteSource.includes("admin_device_renamed") ||
    !deviceUpdateRouteSource.includes("admin_device_details_updated") ||
    !deviceUpdateRouteSource.includes("admin_device_activated") ||
    !deviceUpdateRouteSource.includes("admin_device_deactivated") ||
    !deviceUpdateRouteSource.includes("admin_device_deleted")
      ? "device rename/detail/status/delete actions are not audited"
      : null,
    !deviceUpdateRouteSource.includes("changedFields") ||
    !deviceUpdateRouteSource.includes("before") ||
    !deviceUpdateRouteSource.includes("after")
      ? "device updates do not audit changed fields with before/after evidence"
      : null,
    !deviceUpdateRouteSource.includes("{ throwOnError: true }") ||
    !deviceUpdateRouteSource.includes("Device update was not saved because the audit event could not be stored") ||
    !deviceUpdateRouteSource.includes("Device update audit error") ||
    !deviceUpdateRouteSource.includes("rollbackDeviceFields") ||
    !deviceUpdateRouteSource.includes("admin_device_update_rollback_failed") ||
    !deviceUpdateRouteSource.includes(
      "Device update rollback failure notification error",
    )
      ? "device updates do not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !deviceUpdateRouteSource.includes(".from(\"playlists\")") ||
    !deviceUpdateRouteSource.includes(".delete()") ||
    !deviceUpdateRouteSource.includes("rollbackDeletedDevice") ||
    !deviceUpdateRouteSource.includes("Device deletion audit error") ||
    !deviceUpdateRouteSource.includes("admin_device_delete_rollback_failed") ||
    !deviceUpdateRouteSource.includes(
      "Device deletion rollback failure notification error",
    )
      ? "device deletion does not remove playlist records with required audit, rollback, and rollback-failure visibility"
      : null,
    !deviceMediaRouteSource.includes("file.type !== \"video/mp4\"") ||
    !deviceMediaRouteSource.includes("Only MP4 videos are supported")
      ? "device media upload does not enforce MP4-only playback files"
      : null,
    !deviceMediaRouteSource.includes(".from(\"videos\")") ||
    !deviceMediaRouteSource.includes(".from(\"playlists\")") ||
    !deviceMediaRouteSource.includes("admin_device_media_added") ||
    !deviceMediaRouteSource.includes("admin_device_media_removed")
      ? "device media add/remove workflow does not persist playlist records and audit events"
      : null,
    !deviceMediaRouteSource.includes("await supabaseAdmin.storage.from(\"videos\").remove([storagePath])")
      ? "device media upload does not clean up storage when metadata/playlist writes fail"
      : null,
    !deviceMediaRouteSource.includes("{ throwOnError: true }") ||
    !deviceMediaRouteSource.includes("Device media upload was not saved because the audit event could not be stored") ||
    !deviceMediaRouteSource.includes("Device media removal was not saved because the audit event could not be stored") ||
    !deviceMediaRouteSource.includes("Device media upload audit error") ||
    !deviceMediaRouteSource.includes("Device media removal audit error") ||
    !deviceMediaRouteSource.includes("rollbackUploadedDeviceMedia") ||
    !deviceMediaRouteSource.includes("rollbackRemovedPlaylistItem") ||
    !deviceMediaRouteSource.includes("admin_device_media_upload_rollback_failed") ||
    !deviceMediaRouteSource.includes("admin_device_media_removal_rollback_failed") ||
    !deviceMediaRouteSource.includes(
      "Device media upload rollback failure notification error",
    ) ||
    !deviceMediaRouteSource.includes(
      "Device media removal rollback failure notification error",
    )
      ? "device media add/remove operations do not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !newDevicePageSource.includes("/api/admin/devices") ||
    !deviceDetailPageSource.includes("/api/admin/devices") ||
    !deviceDetailPageSource.includes("/media")
      ? "admin device pages do not route creation, edits, and media through server APIs"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Device management", [
    supabaseAdmin.from("devices").select("id, device_code, customer_id").limit(1),
    supabaseAdmin.from("videos").select("id, storage_bucket, storage_path").limit(1),
    supabaseAdmin.from("playlists").select("id, device_id, video_id").limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, actor_type, metadata")
      .limit(1),
  ]);
}

async function adminCustomerDraftReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const customerRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customers/route.ts"),
    "utf8",
  );
  const customerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !customerRouteSource.includes("export async function POST")
      ? "admin customer draft creation is missing a server route"
      : null,
    !customerRouteSource.includes("getAuthenticatedAdmin")
      ? "admin customer draft creation does not authenticate admins"
      : null,
    !customerRouteSource.includes("isValidEmail")
      ? "admin customer draft creation does not validate email addresses"
      : null,
    !customerRouteSource.includes("A reason of at least 5 characters")
      ? "admin customer draft creation does not require an admin reason"
      : null,
    !customerRouteSource.includes("A customer with this email already exists")
      ? "admin customer draft creation does not prevent duplicate customer emails"
      : null,
    !customerRouteSource.includes('status: "draft"') ||
    !customerRouteSource.includes("marketing_consent: false") ||
    !customerRouteSource.includes("analytics_consent: false") ||
    !customerRouteSource.includes("remote_support_consent: false")
      ? "admin customer draft creation does not enforce draft status and opt-in-safe consent defaults"
      : null,
    !customerRouteSource.includes("admin_customer_draft_created") ||
    !customerRouteSource.includes("consentDefaults")
      ? "admin customer draft creation is not audited with reason and consent-default evidence"
      : null,
    !customerRouteSource.includes("{ throwOnError: true }") ||
    !customerRouteSource.includes("Customer draft was not saved because the audit event could not be stored") ||
    !customerRouteSource.includes("rollbackCreatedCustomerDraft") ||
    !customerRouteSource.includes("admin_customer_draft_create_rollback_failed") ||
    !customerRouteSource.includes(
      "Create admin customer draft rollback failure notification error",
    )
      ? "admin customer draft creation does not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !customerPageSource.includes("/api/admin/customers") ||
    !customerPageSource.includes("Reason for manually creating this customer draft")
      ? "admin customers page does not route manual draft creation through the audited API"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Admin customer draft", [
    supabaseAdmin
      .from("customers")
      .select(
        "id, name, email, status, marketing_consent, analytics_consent, remote_support_consent",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, actor_type, metadata")
      .limit(1),
  ]);
}

async function adminCustomerProfileEditReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const customerRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customers/[customerId]/route.ts"),
    "utf8",
  );
  const customerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/[customerId]/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !customerRouteSource.includes("export async function PATCH")
      ? "admin customer profile edits are missing a server PATCH route"
      : null,
    !customerRouteSource.includes("user?.app_metadata.role !== \"admin\"")
      ? "admin customer profile edits do not authenticate admins"
      : null,
    !customerRouteSource.includes("isValidSwedishRegistrationNumber") ||
    !customerRouteSource.includes("normalizeSwedishRegistrationNumber")
      ? "customer profile edits do not validate and normalize Swedish organisation numbers"
      : null,
    !customerRouteSource.includes("valid billing email address")
      ? "customer profile edits do not validate billing email"
      : null,
    !customerRouteSource.includes("valid Swedish postal code")
      ? "customer profile edits do not validate postal code"
      : null,
    !customerRouteSource.includes("Choose a valid preferred contact channel")
      ? "customer profile edits do not validate preferred contact channel"
      : null,
    !customerRouteSource.includes("A reason of at least 5 characters is required before updating customer details")
      ? "customer profile edits do not require an admin reason"
      : null,
    !customerRouteSource.includes("customer_details_updated") ||
    !customerRouteSource.includes("changedFields") ||
    !customerRouteSource.includes("organisationNumberNormalized") ||
    !customerRouteSource.includes("billingEmailPresent") ||
    !customerRouteSource.includes("reason")
      ? "customer profile edits are not audited with changed fields, normalized org evidence, billing email evidence, and reason"
      : null,
    !customerRouteSource.includes("{ throwOnError: true }") ||
    !customerRouteSource.includes("Customer details were not saved because the audit event could not be stored") ||
    !customerRouteSource.includes("Customer detail update audit error") ||
    !customerRouteSource.includes("fieldsChanged.map") ||
    !customerRouteSource.includes("rollbackCustomerProfileFields") ||
    !customerRouteSource.includes("customer_details_update_rollback_failed") ||
    !customerRouteSource.includes(
      "Customer detail update rollback failure notification error",
    )
      ? "customer profile edits do not fail closed, verify rollback, and notify admins when rollback fails"
      : null,
    !customerPageSource.includes("saveCustomerDetails") ||
    !customerPageSource.includes("Reason for this customer detail change")
      ? "admin customer page does not collect a customer detail edit reason"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Admin customer profile edit", [
    supabaseAdmin
      .from("customers")
      .select("id, organisation_number, billing_email, postal_code")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
  ]);
}

function securityHeaderReadiness(): CheckResult {
  const configuredHeaders = new Map(
    securityHeaders.map((header) => [header.key.toLowerCase(), header.value]),
  );
  const requiredHeaders = new Map([
    ["strict-transport-security", "max-age=63072000; includeSubDomains; preload"],
    ["x-frame-options", "SAMEORIGIN"],
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "origin-when-cross-origin"],
    [
      "permissions-policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    ],
  ]);
  const missing = Array.from(requiredHeaders.entries())
    .filter(([key, value]) => configuredHeaders.get(key) !== value)
    .map(([key]) => key);

  return {
    ok: missing.length === 0,
    details: missing.length
      ? `Missing/mismatched headers: ${missing.join(", ")}`
      : "Required security headers are configured.",
  };
}

function serviceWorkerCacheSafetyReadiness(): CheckResult {
  const serviceWorkerPath = projectFilePath("public/sw.js");
  const serviceWorkerSource = existsSync(serviceWorkerPath)
    ? readFileSync(serviceWorkerPath, "utf8")
    : "";
  const issues = [
    !serviceWorkerSource ? "service worker is missing" : null,
    !serviceWorkerSource.includes("NEVER_CACHE_PREFIXES")
      ? "service worker does not define never-cache routes"
      : null,
    !serviceWorkerSource.includes('"/api/"') ||
    !serviceWorkerSource.includes('"/auth/"') ||
    !serviceWorkerSource.includes('"/account"') ||
    !serviceWorkerSource.includes('"/admin"') ||
    !serviceWorkerSource.includes('"/display"') ||
    !serviceWorkerSource.includes('"/onboarding"') ||
    !serviceWorkerSource.includes('"/login"')
      ? "service worker never-cache list is missing sensitive route prefixes"
      : null,
    !serviceWorkerSource.includes("CACHEABLE_STATIC_PREFIXES") ||
    !serviceWorkerSource.includes('"/_next/static/"')
      ? "service worker does not restrict caching to explicit static asset prefixes"
      : null,
    !serviceWorkerSource.includes("responseAllowsCaching") ||
    !serviceWorkerSource.includes("no-store") ||
    !serviceWorkerSource.includes("private")
      ? "service worker does not respect no-store/private cache-control responses"
      : null,
    !serviceWorkerSource.includes("caches.delete")
      ? "service worker does not clear older caches"
      : null,
  ].filter(Boolean);

  return {
    ok: issues.length === 0,
    details: issues.length
      ? issues.join(" | ")
      : "Service worker caching excludes sensitive routes and is restricted to static assets.",
  };
}

function sensitiveNoStorePolicyReadiness(): CheckResult {
  const launchReadinessRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/launch-readiness/route.ts"),
    "utf8",
  );
  const sensitiveRoutes = [
    "/api/account",
    "/api/admin/customers",
    "/api/admin/launch-readiness",
    "/api/stripe/checkout",
    "/auth/session",
    "/account",
    "/admin",
    "/display/device-1",
    "/onboarding/test-token",
    "/login",
    "/admin-login",
  ];
  const missing = sensitiveRoutes.filter(
    (route) => !shouldDisableRouteCaching(route),
  );
  const sourceIssues = [
    !launchReadinessRouteSource.includes("\"Cache-Control\", \"no-store\"")
      ? "launch readiness API response is missing an explicit no-store header"
      : null,
    !launchReadinessRouteSource.includes("return noStoreJson")
      ? "launch readiness API does not use the no-store response helper"
      : null,
  ].filter(Boolean);

  return {
    ok: missing.length === 0 && sourceIssues.length === 0,
    details:
      missing.length > 0
        ? `Sensitive routes may be cacheable: ${missing.join(", ")}`
        : sourceIssues.length > 0
          ? sourceIssues.join(" | ")
          : "Sensitive routes are marked no-store, and the launch-readiness API returns explicit no-store responses.",
  };
}

function csrfProtectionReadiness(): CheckResult {
  const proxySource = readFileSync(projectFilePath("src/proxy.ts"), "utf8");
  const blocksCrossOriginApiPost = shouldRejectCrossOriginUnsafeRequest({
    pathname: "/api/account/messages",
    method: "POST",
    isSameOrigin: false,
  });
  const allowsSameOriginApiPost = !shouldRejectCrossOriginUnsafeRequest({
    pathname: "/api/account/messages",
    method: "POST",
    isSameOrigin: true,
  });
  const exemptsStripeWebhook =
    isCsrfExemptPath("/api/stripe/webhook") &&
    !shouldRejectCrossOriginUnsafeRequest({
      pathname: "/api/stripe/webhook",
      method: "POST",
      isSameOrigin: false,
    });
  const exemptsResendWebhook =
    isCsrfExemptPath("/api/resend/webhook") &&
    !shouldRejectCrossOriginUnsafeRequest({
      pathname: "/api/resend/webhook",
      method: "POST",
      isSameOrigin: false,
    });
  const missing = [
    !blocksCrossOriginApiPost ? "cross-origin API POST blocking" : null,
    !allowsSameOriginApiPost ? "same-origin API POST allowance" : null,
    !proxySource.includes("Boolean(sourceOrigin && sourceOrigin === request.nextUrl.origin)")
      ? "missing-origin API POST fail-closed check"
      : null,
    !exemptsStripeWebhook ? "Stripe webhook exemption" : null,
    !exemptsResendWebhook ? "Resend webhook exemption" : null,
  ].filter(Boolean);

  return {
    ok: missing.length === 0,
    details: missing.length
      ? `CSRF policy issue: ${missing.join(", ")}`
      : "Unsafe cross-origin or missing-origin API requests are blocked; webhooks are exempt.",
  };
}

function cookieTrackingGovernanceReadiness(): CheckResult {
  const matches = collectTrackingSourceFiles().flatMap((file) => {
    const source = readFileSync(projectFilePath(file), "utf8");

    return NON_ESSENTIAL_TRACKING_PATTERNS.filter(({ pattern }) =>
      pattern.test(source),
    ).map(({ label }) => `${label} in ${file}`);
  });

  return {
    ok: matches.length === 0,
    details: matches.length
      ? `Non-essential tracking found before consent tooling: ${matches.join(", ")}`
      : "No non-essential tracking scripts are present before consent tooling.",
  };
}

function stripeFinancialRiskWebhookReadiness(): CheckResult {
  const webhookSource = readFileSync(
    projectFilePath("src/app/api/stripe/webhook/route.ts"),
    "utf8",
  );
  const issues = [
    !webhookSource.includes("charge.dispute.created")
      ? "Stripe dispute-created webhook is not handled"
      : null,
    !webhookSource.includes("charge.dispute.closed")
      ? "Stripe dispute-closed webhook is not handled"
      : null,
    !webhookSource.includes("charge.refunded")
      ? "Stripe external refund webhook is not handled"
      : null,
    !webhookSource.includes("payment_disputed") ||
    !webhookSource.includes("payment_refunded_externally")
      ? "Stripe financial-risk events are not audited"
      : null,
    !webhookSource.includes("Payment disputed") ||
    !webhookSource.includes("Payment refunded in Stripe")
      ? "Stripe financial-risk events do not notify admins"
      : null,
    !webhookSource.includes("stripe_dispute_sync_failed") ||
    !webhookSource.includes("stripe_dispute_evidence_failed") ||
    !webhookSource.includes("Stripe dispute evidence storage error")
      ? "Stripe dispute failures do not fail closed with urgent visibility"
      : null,
    !webhookSource.includes("stripe_refund_sync_failed") ||
    !webhookSource.includes("stripe_refund_evidence_failed") ||
    !webhookSource.includes("Stripe refund evidence storage error")
      ? "Stripe refund failures do not fail closed with urgent visibility"
      : null,
    !webhookSource.includes('service_access_status: "refunded"') ||
    !webhookSource.includes('payment_status: "refunded"')
      ? "Full external refunds do not block paid display access"
      : null,
  ].filter(Boolean);

  return {
    ok: issues.length === 0,
    details:
      issues.length === 0
        ? "Stripe disputes and external refunds are audited, notify admins, and block display access when needed."
        : issues.join(" | "),
  };
}

function dataProcessorRegisterReadiness(): CheckResult {
  const registerPath = projectFilePath("docs/data-processor-register.md");
  const registerExists = existsSync(registerPath);
  const registerSource = registerExists ? readFileSync(registerPath, "utf8") : "";
  const privacyPageSource = readFileSync(
    projectFilePath("src/app/privacy/page.tsx"),
    "utf8",
  );
  const privacyDocumentSource = readFileSync(
    projectFilePath("src/lib/legal/documents.ts"),
    "utf8",
  );
  const requiredProviders = ["Supabase", "Stripe", "Resend", "Vercel", "Loopia"];
  const missingProviders = requiredProviders.filter(
    (provider) =>
      !registerSource.includes(provider) ||
      !privacyPageSource.includes(provider) ||
      !privacyDocumentSource.includes(provider),
  );
  const issues = [
    !registerExists ? "data processor register document is missing" : null,
    missingProviders.length > 0
      ? `processor disclosure is missing: ${missingProviders.join(", ")}`
      : null,
    !registerSource.includes("DPA") &&
    !registerSource.includes("data processing terms")
      ? "processor register does not require DPA/data-processing evidence"
      : null,
  ].filter(Boolean);

  return {
    ok: issues.length === 0,
    details:
      issues.length === 0
        ? "Data processor register and public processor disclosure are present."
        : issues.join(" | "),
  };
}

async function legalDocumentRowsReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const { data, error } = await supabaseAdmin
    .from("legal_documents")
    .select("document_type, version, status")
    .in("document_type", ["terms", "privacy"])
    .eq("status", "active")
    .in("version", [CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION]);

  if (error) return { ok: false, details: error.message };

  const hasTerms = data?.some(
    (item) =>
      item.document_type === "terms" && item.version === CURRENT_TERMS_VERSION,
  );
  const hasPrivacy = data?.some(
    (item) =>
      item.document_type === "privacy" &&
      item.version === CURRENT_PRIVACY_VERSION,
  );

  return {
    ok: Boolean(hasTerms && hasPrivacy),
    details: `terms=${hasTerms ? "yes" : "no"}, privacy=${
      hasPrivacy ? "yes" : "no"
    }`,
  };
}

async function legalBeforePaymentReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const onboardingRouteSource = readFileSync(
    projectFilePath("src/app/api/onboarding/complete-profile/route.ts"),
    "utf8",
  );
  const checkoutRouteSource = readFileSync(
    projectFilePath("src/app/api/stripe/checkout/route.ts"),
    "utf8",
  );
  const sourceIssues = [
    !onboardingRouteSource.includes("recordLegalAgreement") ||
    !onboardingRouteSource.includes("recordConsent")
      ? "onboarding does not store required legal evidence"
      : null,
    !onboardingRouteSource.includes("throwOnError: true")
      ? "onboarding does not block payment preparation when legal evidence fails"
      : null,
    onboardingRouteSource.includes("Promise.allSettled") ||
    !onboardingRouteSource.includes("onboarding_profile_evidence_failed") ||
    !onboardingRouteSource.includes("Onboarding profile evidence was not stored")
      ? "onboarding does not fail visibly and roll back when optional consent or completion audit evidence fails"
      : null,
    !checkoutRouteSource.includes("hasRequiredLegalEvidence")
      ? "checkout does not verify legal evidence before payment"
      : null,
    !checkoutRouteSource.includes("customer_legal_agreements") ||
    !checkoutRouteSource.includes("consent_records")
      ? "checkout does not check both agreement and consent records"
      : null,
    !checkoutRouteSource.includes("stripe_checkout_failed") ||
    !checkoutRouteSource.includes("createAdminNotification") ||
    !checkoutRouteSource.includes("priority: \"urgent\"")
      ? "checkout does not audit and urgently notify admins when Stripe checkout creation fails"
      : null,
    !checkoutRouteSource.includes("Stripe checkout failure evidence was not stored")
      ? "checkout does not fail visibly when checkout failure evidence cannot be stored"
      : null,
    !checkoutRouteSource.includes("stripe_checkout_local_sync_failed") ||
    !checkoutRouteSource.includes("Stripe checkout local sync failed") ||
    !checkoutRouteSource.includes("checkout_session")
      ? "checkout does not audit and urgently notify admins when Stripe succeeds but local checkout sync fails"
      : null,
    !checkoutRouteSource.includes("Stripe checkout local sync failure evidence was not stored") ||
    !checkoutRouteSource.includes("Stripe customer local sync failure evidence was not stored")
      ? "checkout does not fail visibly when local-sync failure evidence cannot be stored"
      : null,
    !checkoutRouteSource.includes("stripe_checkout_started_audit_failed") ||
    !checkoutRouteSource.includes("Stripe checkout started audit was not stored") ||
    !checkoutRouteSource.includes("{ throwOnError: true }")
      ? "checkout can return a Stripe URL without stored checkout-start audit evidence"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return { ok: false, details: sourceIssues.join(" | ") };
  }

  return tableColumnsReady(supabaseAdmin, "Legal before payment", [
    supabaseAdmin
      .from("consent_records")
      .select("id, customer_id, consent_type, granted, document_version")
      .limit(1),
    supabaseAdmin
      .from("customer_legal_agreements")
      .select("id, customer_id, document_type, document_version, content_snapshot")
      .limit(1),
    supabaseAdmin
      .from("legal_documents")
      .select("id, document_type, version, status")
      .limit(1),
  ]);
}

async function displayAssetReviewReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const contentSetupRouteSource = readFileSync(
    projectFilePath("src/app/api/account/content-setup/route.ts"),
    "utf8",
  );
  const displayAssetsRouteSource = readFileSync(
    projectFilePath("src/app/api/account/display-assets/route.ts"),
    "utf8",
  );
  const adminAssetsRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customer-assets/route.ts"),
    "utf8",
  );
  const displayAssetsHelperSource = readFileSync(
    projectFilePath("src/lib/server/display-assets.ts"),
    "utf8",
  );
  const accountPageSource = readFileSync(
    projectFilePath("src/app/account/page.tsx"),
    "utf8",
  );
  const adminCustomerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/[customerId]/page.tsx"),
    "utf8",
  );
  const sourceIssues = [
    !contentSetupRouteSource.includes("hasCustomerServiceAccess") ||
    !displayAssetsRouteSource.includes("hasCustomerServiceAccess")
      ? "customer display material routes do not verify paid service access"
      : null,
    !contentSetupRouteSource.includes("validateDisplayAssetRequest") ||
    !displayAssetsRouteSource.includes("validateDisplayAssetRequest")
      ? "customer display material routes do not validate files and descriptions"
      : null,
    !displayAssetsHelperSource.includes("MAX_DISPLAY_FILES") ||
    !displayAssetsHelperSource.includes("MAX_DISPLAY_TOTAL_BYTES") ||
    !displayAssetsHelperSource.includes("MAX_DISPLAY_FILE_BYTES") ||
    !displayAssetsHelperSource.includes("MAX_LOGO_FILE_BYTES") ||
    !displayAssetsHelperSource.includes("ALLOWED_DISPLAY_FILE_TYPES")
      ? "display material helper does not enforce file count, size, and type limits"
      : null,
    !displayAssetsHelperSource.includes("DISPLAY_ASSET_BUCKET") ||
    !displayAssetsHelperSource.includes("customer-display-assets")
      ? "display material helper does not use the private customer asset bucket"
      : null,
    !displayAssetsHelperSource.includes("remove([storagePath])")
      ? "display material helper does not clean up uploaded storage when database writes fail"
      : null,
    !displayAssetsHelperSource.includes("storedAssetIds") ||
    !displayAssetsHelperSource.includes("storagePaths")
      ? "display material helper does not expose saved asset identifiers for later rollback"
      : null,
    !contentSetupRouteSource.includes("content_setup_submitted") ||
    !displayAssetsRouteSource.includes("customer_display_material_uploaded") ||
    !displayAssetsRouteSource.includes("createAdminNotification")
      ? "customer display material submissions are not audited and surfaced to admins"
      : null,
    !displayAssetsRouteSource.includes("cleanupUploadedDisplayAssets") ||
    !displayAssetsRouteSource.includes("{ throwOnError: true }") ||
    !displayAssetsRouteSource.includes("customer_display_material_notification_failed") ||
    !displayAssetsRouteSource.includes("Customer display material notification failure audit error") ||
    !displayAssetsRouteSource.includes("Materialet sparades inte eftersom revisionshistoriken inte kunde lagras")
      ? "standalone display material uploads do not fail visibly when audit or notification storage fails"
      : null,
    !contentSetupRouteSource.includes("preview_status: \"waiting_for_admin\"") ||
    !contentSetupRouteSource.includes("fulfillment_status")
      ? "content setup does not move customer/order state into admin review"
      : null,
    !contentSetupRouteSource.includes("rollbackContentSetup") ||
    !contentSetupRouteSource.includes("content_setup_sync_failed") ||
    !contentSetupRouteSource.includes("content_setup_audit_failed") ||
    !contentSetupRouteSource.includes("content_setup_notification_failed") ||
    !contentSetupRouteSource.includes("Content setup sync failure notification error") ||
    !contentSetupRouteSource.includes("Content setup audit failure notification error") ||
    !contentSetupRouteSource.includes("Content setup admin notification error") ||
    !contentSetupRouteSource.includes("Content setup notification failure audit error") ||
    !contentSetupRouteSource.includes("{ throwOnError: true }")
      ? "content setup does not roll back customer/order/material changes when fulfillment sync, audit, or notification storage fails"
      : null,
    !adminAssetsRouteSource.includes("createSignedUrl") ||
    !adminAssetsRouteSource.includes("60 * 15")
      ? "admin display material route does not serve short-lived signed URLs"
      : null,
    !adminAssetsRouteSource.includes("ASSET_STATUSES") ||
    !adminAssetsRouteSource.includes("admin_note") ||
    !adminAssetsRouteSource.includes("reviewed_at") ||
    !adminAssetsRouteSource.includes("reviewed_by")
      ? "admin display material review does not constrain status and record review evidence"
      : null,
    !adminAssetsRouteSource.includes("customer_display_asset_admin_update")
      ? "admin display material review updates are not audited"
      : null,
    !adminAssetsRouteSource.includes("{ throwOnError: true }") ||
    !adminAssetsRouteSource.includes("Display material review was not saved because the audit event could not be stored") ||
    !adminAssetsRouteSource.includes("Customer display material review audit error") ||
    !adminAssetsRouteSource.includes("customer_display_asset_review_audit_failed") ||
    !adminAssetsRouteSource.includes(
      "Customer display material review audit failure notification error",
    )
      ? "admin display material review updates do not fail closed, roll back, and notify admins when audit storage fails"
      : null,
    !adminAssetsRouteSource.includes("A reason of at least 5 characters") ||
    !adminAssetsRouteSource.includes("changedFields") ||
    !adminAssetsRouteSource.includes("before") ||
    !adminAssetsRouteSource.includes("after")
      ? "admin display material review updates do not require a reason with before/after audit evidence"
      : null,
    !accountPageSource.includes("/api/account/content-setup") ||
    !accountPageSource.includes("/api/account/display-assets")
      ? "customer account page does not expose content setup and display material upload"
      : null,
    !adminCustomerPageSource.includes("/api/admin/customer-assets") ||
    !adminCustomerPageSource.includes("Reviewed") ||
    !adminCustomerPageSource.includes("Archived")
      ? "admin customer page does not expose display material review actions"
      : null,
    !adminCustomerPageSource.includes(
      "Reason for updating this display material review",
    )
      ? "admin customer page does not prompt for display material review reasons"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return supabaseAdmin
    .rpc("screenia_display_asset_review_workflow_ready")
    .then((result) => ({
      ok: !result.error && result.data === true,
      details: result.error
        ? result.error.message
        : result.data === true
          ? "Display material upload and admin review workflow is ready."
          : "Display material review workflow is not ready.",
    }));
}

async function customerPreviewDecisionReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const accountRouteSource = readFileSync(
    projectFilePath("src/app/api/account/route.ts"),
    "utf8",
  );
  const decisionRouteSource = readFileSync(
    projectFilePath("src/app/api/account/preview-decision/route.ts"),
    "utf8",
  );
  const accountPageSource = readFileSync(
    projectFilePath("src/app/account/page.tsx"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120017_customer_preview_decisions.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !accountRouteSource.includes("customer_preview_decisions")
      ? "customer account API does not expose preview decision history"
      : null,
    !decisionRouteSource.includes("export async function POST")
      ? "customer preview decision API is missing"
      : null,
    !decisionRouteSource.includes("getAuthenticatedUser") ||
    !decisionRouteSource.includes("getCustomerForUser")
      ? "customer preview decision API does not authenticate the customer"
      : null,
    !decisionRouteSource.includes("hasCustomerServiceAccess")
      ? "customer preview decision API does not verify paid service access"
      : null,
    !decisionRouteSource.includes("There is no preview available")
      ? "customer preview decisions are not blocked when no preview exists"
      : null,
    !decisionRouteSource.includes("feedback.length < 5")
      ? "preview change requests do not require feedback"
      : null,
    !decisionRouteSource.includes("customer_preview_approved") ||
    !decisionRouteSource.includes("customer_preview_changes_requested")
      ? "customer preview decisions are not audited"
      : null,
    !decisionRouteSource.includes("createAdminNotification")
      ? "customer preview decisions do not notify admins"
      : null,
    !decisionRouteSource.includes("preview_status") ||
    !decisionRouteSource.includes("fulfillment_status") ||
    !decisionRouteSource.includes("preview_approved") ||
    !decisionRouteSource.includes("content_pending")
      ? "customer preview decisions do not update customer and fulfillment state"
      : null,
    !decisionRouteSource.includes("rollbackPreviewDecision") ||
    !decisionRouteSource.includes("{ throwOnError: true }") ||
    !decisionRouteSource.includes("Preview decision subscription lookup error") ||
    !decisionRouteSource.includes("customer_preview_decision_sync_failed") ||
    !decisionRouteSource.includes("customer_preview_decision_audit_failed") ||
    !decisionRouteSource.includes("customer_preview_decision_notification_failed") ||
    !decisionRouteSource.includes("Preview decision sync failure notification error") ||
    !decisionRouteSource.includes("Preview decision audit failure notification error") ||
    !decisionRouteSource.includes("Preview decision admin notification error") ||
    !decisionRouteSource.includes("Preview decision notification failure audit error") ||
    !decisionRouteSource.includes("Preview response was not saved because Screenia could not store the required audit evidence")
      ? "customer preview decisions do not roll back when fulfillment sync, audit, or notification storage fails"
      : null,
    !accountPageSource.includes("/api/account/preview-decision") ||
    !accountPageSource.includes("submitPreviewDecision")
      ? "customer account page does not expose preview approval/change actions"
      : null,
    !migrationSource.includes("customer_preview_decisions") ||
    !migrationSource.includes("decision text not null") ||
    !migrationSource.includes("feedback text") ||
    !migrationSource.includes("ip_address") ||
    !migrationSource.includes("user_agent")
      ? "customer preview decision migration is missing decision, feedback, and request evidence"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Customer preview decision workflow", [
    supabaseAdmin
      .from("customer_preview_decisions")
      .select("id, customer_id, decision, feedback, decided_at, ip_address")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function subscriptionMigrationReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const accountCancelRouteSource = readFileSync(
    projectFilePath("src/app/api/account/cancel-subscription/route.ts"),
    "utf8",
  );
  const adminSubscriptionRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customers/[customerId]/subscription/route.ts"),
    "utf8",
  );
  const legacyAdminCancelRouteSource = readFileSync(
    projectFilePath("src/app/api/stripe/cancel-subscription/route.ts"),
    "utf8",
  );
  const stripeWebhookSource = readFileSync(
    projectFilePath("src/app/api/stripe/webhook/route.ts"),
    "utf8",
  );
  const adminCustomerPageSource = readFileSync(
    projectFilePath("src/app/admin/customers/[customerId]/page.tsx"),
    "utf8",
  );
  const accountPageSource = readFileSync(projectFilePath("src/app/account/page.tsx"), "utf8");
  const sourceIssues = [
    !accountCancelRouteSource.includes("cancel_at_period_end: true") ||
    !accountCancelRouteSource.includes("active_until_period_end") ||
    !accountCancelRouteSource.includes("service_access_until")
      ? "customer cancellation does not preserve access until the paid-through period end"
      : null,
    !accountCancelRouteSource.includes("allowedCancellationReasons") ||
    !accountCancelRouteSource.includes("subscription_cancel_scheduled")
      ? "customer cancellation reason and audit evidence are missing"
      : null,
    !accountCancelRouteSource.includes("customer_cancellation_sync_failed") ||
    !accountCancelRouteSource.includes("customer_cancellation_audit_failed") ||
    !accountCancelRouteSource.includes("{ throwOnError: true }") ||
    !accountCancelRouteSource.includes("Stripe accepted the cancellation, but Screenia could not fully update your account") ||
    !accountCancelRouteSource.includes("Customer cancellation sync failure evidence error") ||
    !accountCancelRouteSource.includes("could not sync your account or store urgent failure evidence") ||
    !accountCancelRouteSource.includes("Customer cancellation audit failure notification error") ||
    !accountCancelRouteSource.includes("could not store the audit record or urgent review notification")
      ? "customer cancellation does not fail visibly when local sync, audit, or urgent failure evidence storage fails after Stripe accepts cancellation"
      : null,
    !adminSubscriptionRouteSource.includes("cancel_period_end") ||
    !adminSubscriptionRouteSource.includes("cancel_immediately") ||
    !adminSubscriptionRouteSource.includes("subscription_cancel_scheduled") ||
    !adminSubscriptionRouteSource.includes("subscription_cancelled_immediately")
      ? "admin cancellation workflows are missing period-end and immediate audited paths"
      : null,
    !adminSubscriptionRouteSource.includes("pause_subscription") ||
    !adminSubscriptionRouteSource.includes("pause_collection") ||
    !adminSubscriptionRouteSource.includes("service_access_status: \"paused\"") ||
    !adminSubscriptionRouteSource.includes("subscription_paused")
      ? "admin pause workflow does not pause Stripe collection and block display access"
      : null,
    !adminSubscriptionRouteSource.includes("resume_subscription") ||
    !adminSubscriptionRouteSource.includes("pause_collection: \"\"") ||
    !adminSubscriptionRouteSource.includes("subscription_resumed")
      ? "admin resume workflow does not clear Stripe pause collection and audit the action"
      : null,
    !adminSubscriptionRouteSource.includes("apply_temporary_discount") ||
    !adminSubscriptionRouteSource.includes("stripe.coupons.create") ||
    !adminSubscriptionRouteSource.includes("subscription_adjustments") ||
    !adminSubscriptionRouteSource.includes("subscription_discount_applied")
      ? "admin temporary discount workflow does not create Stripe coupons, store adjustments, and audit"
      : null,
    !adminSubscriptionRouteSource.includes("admin_subscription_local_sync_failed") ||
    !adminSubscriptionRouteSource.includes("createAdminNotification") ||
    !adminSubscriptionRouteSource.includes("No local customer_subscriptions row matched") ||
    !adminSubscriptionRouteSource.includes("Admin subscription local sync failure evidence error") ||
    !adminSubscriptionRouteSource.includes("could not update the local subscription row or store urgent failure evidence")
      ? "admin Stripe subscription operations do not fail visibly when local subscription sync failure evidence cannot be stored"
      : null,
    !adminSubscriptionRouteSource.includes("admin_subscription_customer_sync_failed") ||
    !adminSubscriptionRouteSource.includes("updateCustomerAccessAfterStripe") ||
    !adminSubscriptionRouteSource.includes("Stripe operation succeeded, but Screenia could not update customer access") ||
    !adminSubscriptionRouteSource.includes("Stripe discount was applied, but Screenia could not store the local discount record") ||
    !adminSubscriptionRouteSource.includes("Admin subscription customer sync failure evidence error") ||
    !adminSubscriptionRouteSource.includes("could not update customer access or store urgent failure evidence")
      ? "admin Stripe subscription operations do not fail visibly when customer access or adjustment sync failure evidence cannot be stored"
      : null,
    !adminSubscriptionRouteSource.includes("recordRequiredSubscriptionAudit") ||
    !adminSubscriptionRouteSource.includes("Admin subscription success audit error") ||
    !adminSubscriptionRouteSource.includes("admin_subscription_success_audit_failed") ||
    !adminSubscriptionRouteSource.includes("Subscription operation succeeded, but Screenia could not store the required success audit evidence")
      ? "admin Stripe subscription operations can return success without required success audit evidence"
      : null,
    !adminSubscriptionRouteSource.includes("function requireAdminReason") ||
    !adminSubscriptionRouteSource.includes("A reason of at least 5 characters is required") ||
    !adminSubscriptionRouteSource.includes("activate_customer") ||
    !adminSubscriptionRouteSource.includes("resume_subscription")
      ? "admin subscription and access operations do not require meaningful reasons"
      : null,
    !adminSubscriptionRouteSource.includes("Customer activation audit error") ||
    !adminSubscriptionRouteSource.includes("Customer activation rollback error") ||
    !adminSubscriptionRouteSource.includes("Customer activation subscription rollback error") ||
    !adminSubscriptionRouteSource.includes("Customer activation was not saved because Screenia could not store the required audit evidence")
      ? "admin customer activation does not roll back entitlement changes when audit storage fails"
      : null,
    !adminSubscriptionRouteSource.includes("Customer suspension audit error") ||
    !adminSubscriptionRouteSource.includes("Customer suspension rollback error") ||
    !adminSubscriptionRouteSource.includes("Customer suspension subscription rollback error") ||
    !adminSubscriptionRouteSource.includes("Customer suspension was not saved because Screenia could not store the required audit evidence")
      ? "admin customer suspension does not roll back entitlement changes when audit storage fails"
      : null,
    !legacyAdminCancelRouteSource.includes("A reason of at least 5 characters is required") ||
    !legacyAdminCancelRouteSource.includes("cancellation_details: reason") ||
    !legacyAdminCancelRouteSource.includes("reason,")
      ? "legacy admin Stripe cancellation route does not require and audit an admin reason"
      : null,
    !legacyAdminCancelRouteSource.includes("cancel_at_period_end: true") ||
    !legacyAdminCancelRouteSource.includes("active_until_period_end") ||
    !legacyAdminCancelRouteSource.includes("service_access_until")
      ? "legacy admin Stripe cancellation route does not preserve paid-through access"
      : null,
    !stripeWebhookSource.includes("customer.subscription.updated") ||
    !stripeWebhookSource.includes("syncStripeSubscription")
      ? "Stripe subscription updates are not synced to local entitlement state"
      : null,
    !stripeWebhookSource.includes("stripe_subscription_customer_sync_failed") ||
    !stripeWebhookSource.includes("stripe_subscription_local_sync_failed") ||
    !stripeWebhookSource.includes("stripe_subscription_synced_audit_failed") ||
    !stripeWebhookSource.includes("Stripe subscription sync failure visibility error") ||
    !stripeWebhookSource.includes("No Screenia customer matched stripe_customer_id") ||
    !stripeWebhookSource.includes("Stripe subscription local sync failed") ||
    !stripeWebhookSource.includes("subscription_synced") ||
    !stripeWebhookSource.includes("{ throwOnError: true }")
      ? "Stripe subscription sync failures do not create urgent admin visibility"
      : null,
    !stripeWebhookSource.includes("customer.subscription.deleted") ||
    !stripeWebhookSource.includes("service_access_status: refundBeforeProduction ? \"refunded\" : \"cancelled\"") ||
    !stripeWebhookSource.includes("stripe_subscription_deleted_sync_failed") ||
    !stripeWebhookSource.includes("stripe_subscription_deleted_evidence_failed") ||
    !stripeWebhookSource.includes("Subscription deleted evidence storage error") ||
    !stripeWebhookSource.includes("Stripe subscription deletion")
      ? "Stripe subscription deletion does not block display access"
      : null,
    !stripeWebhookSource.includes("invoice.payment_failed") ||
    !stripeWebhookSource.includes("service_access_status: \"payment_failed\"") ||
    !stripeWebhookSource.includes("stripe_invoice_payment_failed_sync_failed") ||
    !stripeWebhookSource.includes("stripe_invoice_payment_failed_evidence_failed") ||
    !stripeWebhookSource.includes("Payment failed evidence storage error") ||
    !stripeWebhookSource.includes("Stripe webhook failure visibility error")
      ? "failed invoices do not block display access"
      : null,
    !stripeWebhookSource.includes("invoice.paid") ||
    !stripeWebhookSource.includes("subscription_invoice_paid") ||
    !stripeWebhookSource.includes("stripe_invoice_paid_sync_failed") ||
    !stripeWebhookSource.includes("stripe_invoice_paid_evidence_failed") ||
    !stripeWebhookSource.includes("Invoice paid evidence storage error") ||
    !stripeWebhookSource.includes("Stripe paid invoice")
      ? "paid invoices are not synced and audited"
      : null,
    !stripeWebhookSource.includes("Invoice paid customer access restore error") ||
    !stripeWebhookSource.includes("syncedEntitlement.serviceAccessStatus === \"active\"") ||
    !stripeWebhookSource.includes("customer.inactive_reason === \"payment_failed\"") ||
    !stripeWebhookSource.includes("service_access_status: syncedEntitlement.serviceAccessStatus") ||
    !stripeWebhookSource.includes("status: \"active\"")
      ? "paid invoices do not restore customers suspended by failed payments"
      : null,
    !adminCustomerPageSource.includes("pauseSubscription") ||
    !adminCustomerPageSource.includes("resumeSubscription") ||
    !adminCustomerPageSource.includes("apply_temporary_discount") ||
    !adminCustomerPageSource.includes("Reason for activating this customer") ||
    !adminCustomerPageSource.includes("Reason for resuming billing and display access") ||
    !adminCustomerPageSource.includes("A reason of at least 5 characters is required")
      ? "admin customer page does not expose reason-required access and subscription actions"
      : null,
    !accountPageSource.includes("/api/account/cancel-subscription") ||
    !accountPageSource.includes("active_until_period_end")
      ? "customer account page does not expose period-end cancellation status"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  const [customerResult, subscriptionResult, adjustmentResult] =
    await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("service_access_status, service_access_until")
        .limit(1),
      supabaseAdmin
        .from("customer_subscriptions")
        .select("stripe_current_period_end, cancel_at_period_end, pause_reason")
        .limit(1),
      supabaseAdmin.from("subscription_adjustments").select("id").limit(1),
    ]);
  const errors = [
    customerResult.error,
    subscriptionResult.error,
    adjustmentResult.error,
  ].filter(Boolean);

  return {
    ok: errors.length === 0,
    details: errors.map((error) => error?.message).join(" | "),
  };
}

async function swedishRegistrationNumbersReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const validatorOk =
    isValidSwedishRegistrationNumber("556016-0680") &&
    !isValidSwedishRegistrationNumber("556016-0681");

  if (!validatorOk) {
    return {
      ok: false,
      details:
        "Swedish organisation-number checksum validation is not behaving as expected.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id, status, payment_status, organisation_number")
    .limit(1000);

  if (error) return { ok: false, details: error.message };

  const invalidCount = (data || []).filter((customer) => {
    const status = String(customer.status || "");
    const paymentStatus = String(customer.payment_status || "");
    const needsValidNumber =
      ["accepted_terms", "completed_profile", "active"].includes(status) ||
      ["paid", "failed", "refunded", "cancelled"].includes(paymentStatus);

    return (
      needsValidNumber &&
      !isValidSwedishRegistrationNumber(
        String(customer.organisation_number || ""),
      )
    );
  }).length;

  return {
    ok: invalidCount === 0,
    details:
      invalidCount === 0
        ? "Current post-onboarding/payment customer records pass Swedish organisation-number validation."
        : `${invalidCount} post-onboarding/payment customer record(s) have missing or invalid Swedish organisation numbers.`,
  };
}

async function pricingReady(supabaseAdmin: SupabaseClient): Promise<CheckResult> {
  const { data, error } = await supabaseAdmin
    .from("pricing_plans")
    .select(
      "id, code, is_active, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, currency, tax_behavior, stripe_setup_price_id, stripe_hardware_price_id, stripe_shipping_price_id, stripe_monthly_price_id",
    );

  if (error) return { ok: false, details: error.message };

  const activePlans = (data || []).filter((plan) => plan.is_active);
  const issues = activePlans.flatMap((plan) => {
    const label = String(plan.code || plan.id || "unknown");
    const hardwareFee = Number(plan.hardware_fee_sek || 0);
    const planIssues = [];

    if (String(plan.currency || "").toLowerCase() !== "sek") {
      planIssues.push(`${label}: currency is not SEK`);
    }
    if (plan.tax_behavior !== "inclusive") {
      planIssues.push(`${label}: tax_behavior is not inclusive`);
    }
    if (Number(plan.setup_fee_sek || 0) <= 0) {
      planIssues.push(`${label}: setup fee is missing`);
    }
    if (Number(plan.monthly_fee_sek || 0) <= 0) {
      planIssues.push(`${label}: monthly fee is missing`);
    }
    if (!plan.stripe_setup_price_id) {
      planIssues.push(`${label}: setup Stripe price is missing`);
    }
    if (hardwareFee > 0 && !plan.stripe_hardware_price_id) {
      planIssues.push(`${label}: hardware Stripe price is missing`);
    }
    if (!plan.stripe_shipping_price_id) {
      planIssues.push(`${label}: shipping Stripe price is missing`);
    }
    if (!plan.stripe_monthly_price_id) {
      planIssues.push(`${label}: monthly Stripe price is missing`);
    }

    return planIssues;
  });

  return {
    ok: activePlans.length > 0 && issues.length === 0,
    details:
      activePlans.length === 0
        ? "No active pricing plans are available for quotes and checkout."
        : issues.length === 0
          ? `${activePlans.length} active pricing plan(s) are VAT-inclusive, SEK-based, and synced to Stripe price IDs.`
          : issues.slice(0, 6).join(" | "),
  };
}

async function legalChangeNoticeReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const noticeRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/legal-change-notices/route.ts"),
    "utf8",
  );
  const noticeUpdateRouteSource = readFileSync(
    projectFilePath(
      "src/app/api/admin/legal-change-notices/[noticeId]/route.ts",
    ),
    "utf8",
  );
  const noticePageSource = readFileSync(
    projectFilePath("src/app/admin/legal-change-notices/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath("supabase/migrations/202607120016_legal_change_notices.sql"),
    "utf8",
  );
  const sourceIssues = [
    !noticeRouteSource.includes("export async function GET")
      ? "legal change notices cannot be listed through an admin API"
      : null,
    !noticeRouteSource.includes("export async function POST")
      ? "legal change notices cannot be created through an admin API"
      : null,
    !noticeRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "legal change notice list response is missing no-store caching"
      : null,
    !noticeUpdateRouteSource.includes("export async function PATCH")
      ? "legal change notices cannot be updated through an admin API"
      : null,
    !noticeRouteSource.includes("validateLegalChangeNoticePayload") ||
    !noticeUpdateRouteSource.includes("validateLegalChangeNoticePayload")
      ? "legal change notice create/update routes do not share validation"
      : null,
    !noticeRouteSource.includes("Sent notices require a sent date")
      ? "sent legal notices do not require sent-date evidence"
      : null,
    !noticeRouteSource.includes("Notice-required changes cannot be marked not required")
      ? "notice-required legal changes can be incorrectly marked not required"
      : null,
    !noticeRouteSource.includes("legal_change_notice_recorded") ||
    !noticeUpdateRouteSource.includes("legal_change_notice_updated")
      ? "legal change notice create/update actions are not audited"
      : null,
    !noticeUpdateRouteSource.includes("before") ||
    !noticeUpdateRouteSource.includes("after") ||
    !noticeUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "legal change notice updates do not audit before/after changed fields"
      : null,
    !noticeRouteSource.includes("createAdminNotification") ||
    !noticeRouteSource.includes("data.notice_required && data.notice_status !== \"sent\"")
      ? "legal notices do not notify admins when customer notice is required"
      : null,
    !noticeUpdateRouteSource.includes("createAdminNotification") ||
    !noticeUpdateRouteSource.includes("updated.notice_required && updated.notice_status !== \"sent\"")
      ? "legal notice updates do not notify admins when customer notice remains required"
      : null,
    !noticeRouteSource.includes("{ throwOnError: true }") ||
    !noticeRouteSource.includes("Legal change notice creation evidence error") ||
    !noticeRouteSource.includes("Legal change notice creation rollback error")
      ? "legal change notice creation does not roll back when audit or notification evidence fails"
      : null,
    !noticeUpdateRouteSource.includes("{ throwOnError: true }") ||
    !noticeUpdateRouteSource.includes("Legal change notice update evidence error") ||
    !noticeUpdateRouteSource.includes("Legal change notice update rollback error")
      ? "legal change notice updates do not roll back when audit or notification evidence fails"
      : null,
    !noticeRouteSource.includes("A reason of at least 5 characters") ||
    !noticeUpdateRouteSource.includes("validateLegalChangeNoticePayload")
      ? "legal notice actions do not require an admin reason"
      : null,
    !noticePageSource.includes("Legal change register") ||
    !noticePageSource.includes("Customer notice required") ||
    !noticePageSource.includes("Re-acceptance required") ||
    !noticePageSource.includes("Evidence reference")
      ? "admin legal notice page does not expose required notice/reacceptance evidence fields"
      : null,
    !navSource.includes("/admin/legal-change-notices")
      ? "admin navigation does not expose legal change notices"
      : null,
    !migrationSource.includes("notice_required") ||
    !migrationSource.includes("reacceptance_required") ||
    !migrationSource.includes("notice_sent_at") ||
    !migrationSource.includes("evidence_reference")
      ? "legal notice migration does not track notice/reacceptance and sent evidence"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Legal change notice register", [
    supabaseAdmin
      .from("legal_change_notices")
      .select(
        "id, document_type, document_version, notice_required, reacceptance_required, notice_status, notice_sent_at",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function processorComplianceReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const processorRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/processor-reviews/route.ts"),
    "utf8",
  );
  const processorUpdateRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/processor-reviews/[reviewId]/route.ts"),
    "utf8",
  );
  const processorPageSource = readFileSync(
    projectFilePath("src/app/admin/processor-reviews/page.tsx"),
    "utf8",
  );
  const navSource = readFileSync(
    projectFilePath("src/lib/admin/navigation.ts"),
    "utf8",
  );
  const migrationSource = readFileSync(
    projectFilePath(
      "supabase/migrations/202607120014_processor_compliance_reviews.sql",
    ),
    "utf8",
  );
  const sourceIssues = [
    !processorRouteSource.includes("export async function GET")
      ? "processor reviews cannot be listed through an admin API"
      : null,
    !processorRouteSource.includes("export async function POST")
      ? "processor reviews cannot be created through an admin API"
      : null,
    !processorRouteSource.includes("\"Cache-Control\": \"no-store\"")
      ? "processor review list response is missing no-store caching"
      : null,
    !processorUpdateRouteSource.includes("export async function PATCH")
      ? "processor reviews cannot be updated through an admin API"
      : null,
    !processorRouteSource.includes("validateProcessorReviewPayload") ||
    !processorUpdateRouteSource.includes("validateProcessorReviewPayload")
      ? "processor review create/update routes do not share validation"
      : null,
    !processorRouteSource.includes("processor_compliance_review_recorded") ||
    !processorUpdateRouteSource.includes("processor_compliance_review_updated")
      ? "processor review create/update actions are not audited"
      : null,
    !processorUpdateRouteSource.includes("before") ||
    !processorUpdateRouteSource.includes("after") ||
    !processorUpdateRouteSource.includes("changedFields: fieldsChanged")
      ? "processor review updates do not audit before/after changed fields"
      : null,
    !processorRouteSource.includes("createAdminNotification")
      ? "processor reviews do not notify admins when provider evidence is incomplete"
      : null,
    !processorRouteSource.includes("{ throwOnError: true }") ||
    !processorRouteSource.includes("Processor review creation evidence error") ||
    !processorRouteSource.includes("Processor review creation rollback error")
      ? "processor review creation does not roll back when audit or notification evidence fails"
      : null,
    !processorUpdateRouteSource.includes("{ throwOnError: true }") ||
    !processorUpdateRouteSource.includes("Processor review update audit error") ||
    !processorUpdateRouteSource.includes("Processor review update rollback error")
      ? "processor review updates do not roll back when audit evidence fails"
      : null,
    !processorRouteSource.includes("A reason of at least 5 characters") ||
    !processorUpdateRouteSource.includes("validateProcessorReviewPayload")
      ? "processor review actions do not require an admin reason"
      : null,
    !processorPageSource.includes("Processor review register") ||
    !processorPageSource.includes("DPA verified") ||
    !processorPageSource.includes("Security reviewed") ||
    !processorPageSource.includes("Account owner verified")
      ? "admin processor review page does not expose required evidence fields"
      : null,
    !navSource.includes("/admin/processor-reviews")
      ? "admin navigation does not expose processor reviews"
      : null,
    !migrationSource.includes("dpa_verified") ||
    !migrationSource.includes("security_reviewed") ||
    !migrationSource.includes("account_owner_verified") ||
    !migrationSource.includes("next_review_due")
      ? "processor compliance migration does not track DPA, security, account-owner, and next-review checks"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Processor compliance review register", [
    supabaseAdmin
      .from("processor_compliance_reviews")
      .select(
        "id, provider, dpa_verified, security_reviewed, account_owner_verified, review_status, next_review_due",
      )
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function refundProductionBoundaryReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const refundRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customers/[customerId]/refund/route.ts"),
    "utf8",
  );
  const productionRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/customers/[customerId]/production/route.ts"),
    "utf8",
  );
  const sourceIssues = [
    !refundRouteSource.includes("stripe.refunds.create")
      ? "admin refund route does not create Stripe refunds"
      : null,
    !refundRouteSource.includes("A refund reason is required before refunding a customer")
      ? "admin refund route does not require a refund reason"
      : null,
    !refundRouteSource.includes("setup_fee_locked_at") ||
    !refundRouteSource.includes("Handle this refund manually")
      ? "admin refund route does not block automatic refunds after layout starts"
      : null,
    !refundRouteSource.includes("admin_reason") ||
    !refundRouteSource.includes("adminReason")
      ? "admin refund route does not store the admin reason in Stripe/audit metadata"
      : null,
    !refundRouteSource.includes("service_access_status: \"refunded\"") ||
    !refundRouteSource.includes("service_access_until: null")
      ? "admin refund route does not block service access after refund"
      : null,
    !refundRouteSource.includes("payment_refunded") ||
    !refundRouteSource.includes("createAdminNotification")
      ? "admin refunds are not audited and notified"
      : null,
    !refundRouteSource.includes("payment_refund_local_sync_failed") ||
    !refundRouteSource.includes("payment_refund_subscription_cancel_failed") ||
    !refundRouteSource.includes("subscriptionCancellationError")
      ? "admin refund post-Stripe failure states do not create urgent operational visibility"
      : null,
    !productionRouteSource.includes("A reason is required before starting layout work") ||
    !productionRouteSource.includes("setup_fee_locked_at") ||
    !productionRouteSource.includes("reason")
      ? "layout-start route does not require and audit a reason before locking the setup fee"
      : null,
    !productionRouteSource.includes("hasDisplayEntitlement")
      ? "layout-start route does not require active paid entitlement"
      : null,
    !productionRouteSource.includes("layout_work_started") ||
    !productionRouteSource.includes("layout_started")
      ? "layout-start route does not audit and mark production state"
      : null,
    !productionRouteSource.includes("{ throwOnError: true }") ||
    !productionRouteSource.includes("rollbackLayoutStart") ||
    !productionRouteSource.includes("layout_start_rollback_failed") ||
    !productionRouteSource.includes("Layout start subscription fulfillment sync error") ||
    !productionRouteSource.includes("Layout start audit error") ||
    !productionRouteSource.includes("Layout start rollback failure notification error")
      ? "layout-start route does not fail closed, roll back, and notify admins when fulfillment sync or audit storage fails"
      : null,
  ].filter(Boolean);

  if (sourceIssues.length > 0) {
    return {
      ok: false,
      details: sourceIssues.join(" | "),
    };
  }

  return tableColumnsReady(supabaseAdmin, "Refund and production boundary", [
    supabaseAdmin
      .from("customers")
      .select(
        "id, payment_status, service_access_status, service_access_until, production_status, layout_started_at, setup_fee_locked_at",
      )
      .limit(1),
    supabaseAdmin
      .from("customer_subscriptions")
      .select("id, status, fulfillment_status, stripe_payment_intent_id")
      .limit(1),
    supabaseAdmin
      .from("audit_events")
      .select("id, event_type, metadata")
      .limit(1),
    supabaseAdmin
      .from("admin_notifications")
      .select("id, event_type, priority")
      .limit(1),
  ]);
}

async function tableColumnsReady(
  supabaseAdmin: SupabaseClient,
  label: string,
  queries: Array<PromiseLike<{ error: { message: string } | null }>>,
): Promise<CheckResult> {
  const results = await Promise.all(queries);
  const errors = results.map((result) => result.error).filter(Boolean);

  return {
    ok: errors.length === 0,
    details: errors.length
      ? errors.map((error) => error?.message).join(" | ")
      : `${label} storage is available.`,
  };
}

async function sensitiveStorageReady(
  supabaseAdmin: SupabaseClient,
): Promise<CheckResult> {
  const requiredBuckets = [
    "videos",
    "customer-display-assets",
    "customer-message-files",
  ];
  const { data, error } = await supabaseAdmin.storage.listBuckets();

  if (error) return { ok: false, details: error.message };

  const bucketMap = new Map((data || []).map((bucket) => [bucket.id, bucket]));
  const issues = requiredBuckets.flatMap((bucketId) => {
    const bucket = bucketMap.get(bucketId);
    if (!bucket) return [`${bucketId} bucket is missing`];
    return bucket.public === false ? [] : [`${bucketId} bucket is public`];
  });
  const displayPlaylistSource = readFileSync(
    projectFilePath("src/app/api/display/[deviceId]/playlist/route.ts"),
    "utf8",
  );
  const adminAssetSource = readFileSync(
    projectFilePath("src/app/api/admin/customer-assets/route.ts"),
    "utf8",
  );
  const supportMessageSource = readFileSync(
    projectFilePath("src/app/api/admin/customer-messages/route.ts"),
    "utf8",
  );
  const displayPlaylistJsonResponses = displayPlaylistSource.match(/NextResponse\.json\(/g) || [];
  const sourceIssues = [
    !displayPlaylistSource.includes("createSignedUrl")
      ? "display playlist API does not use signed video URLs"
      : null,
    displayPlaylistSource.includes('row.src?.startsWith("http")')
      ? "display playlist API still allows direct public HTTP video URLs"
      : null,
    !displayPlaylistSource.includes("hasDisplayEntitlement")
      ? "display playlist API does not check billing entitlement"
      : null,
    !displayPlaylistSource.includes("service_access_status") ||
    !displayPlaylistSource.includes("service_access_until")
      ? "display playlist API does not read entitlement status and paid-through date"
      : null,
    !displayPlaylistSource.includes("function noStoreJson") ||
    !displayPlaylistSource.includes('"Cache-Control": "no-store"') ||
    displayPlaylistJsonResponses.length !== 1
      ? "display playlist API does not return no-store success and error responses"
      : null,
    !adminAssetSource.includes("createSignedUrl")
      ? "admin display material API does not use signed URLs"
      : null,
    !supportMessageSource.includes("createSignedUrl")
      ? "admin support attachment API does not use signed URLs"
      : null,
  ].filter(Boolean);
  const allIssues = [...issues, ...sourceIssues];

  return {
    ok: allIssues.length === 0,
    details:
      allIssues.length === 0
        ? "Sensitive upload buckets are private and served through entitlement-checked signed URLs."
        : allIssues.join(" | "),
  };
}

export async function getLiveCheckoutBlockers(supabaseAdmin: SupabaseClient) {
  const [
    legalDocuments,
    legalBeforePayment,
    legalChangeNoticeTables,
    subscriptionMigration,
    swedishRegistrationNumbers,
    pricing,
    processorComplianceTables,
    privateVideoBucket,
    sensitiveStorage,
    webhookLedger,
    optInDefaults,
    displayReview,
    customerPreviewDecision,
    requestPrivacy,
    publicRequestIntake,
    adminNotifications,
    resendDeliveryEvents,
    refundProductionBoundaryTables,
    customerSupportReplyTables,
    customerSupportTicketTables,
    operationalTables,
    inventoryTables,
    deviceTables,
    customerDraftTables,
    customerProfileEditTables,
    customerExportTables,
    dataSubjectRequestTables,
    accountingExportTables,
    vatSummaryTables,
    taxPaymentTables,
    privacyIncidentTables,
    adminAccessReviewTables,
    backupRestoreDrillTables,
    dataRetentionReviewTables,
    deletionSafetyTables,
  ] = await Promise.all([
    legalDocumentRowsReady(supabaseAdmin),
    legalBeforePaymentReady(supabaseAdmin),
    legalChangeNoticeReady(supabaseAdmin),
    subscriptionMigrationReady(supabaseAdmin),
    swedishRegistrationNumbersReady(supabaseAdmin),
    pricingReady(supabaseAdmin),
    processorComplianceReady(supabaseAdmin),
    supabaseAdmin
      .schema("storage")
      .from("buckets")
      .select("public")
      .eq("id", "videos")
      .maybeSingle()
      .then((result) => ({
        ok: !result.error && result.data?.public === false,
        details: result.error
          ? result.error.message
          : result.data?.public === false
            ? "videos bucket is private"
            : "videos bucket is missing or public",
      })),
    sensitiveStorageReady(supabaseAdmin),
    tableColumnsReady(supabaseAdmin, "Stripe webhook ledger", [
      supabaseAdmin
        .from("stripe_webhook_events")
        .select("stripe_event_id, event_type, processing_status")
        .limit(1),
    ]),
    supabaseAdmin.rpc("screenia_consent_defaults_are_opt_in").then((result) => ({
      ok: !result.error && result.data === true,
      details: result.error
        ? result.error.message
        : result.data === true
          ? "Optional consent defaults are opt-in safe."
          : "Optional consent defaults or draft customer consent values are not opt-in safe.",
    })),
    displayAssetReviewReady(supabaseAdmin),
    customerPreviewDecisionReady(supabaseAdmin),
    supabaseAdmin
      .rpc("screenia_request_privacy_consent_ready", {
        required_privacy_version: CURRENT_PRIVACY_VERSION,
      })
      .then((result) => ({
        ok: !result.error && result.data === true,
        details: result.error
          ? result.error.message
          : result.data === true
            ? "Public request privacy consent workflow is ready."
            : "Public request privacy consent workflow is not ready.",
      })),
    publicRequestIntakeReady(supabaseAdmin),
    adminNotificationWorkflowReady(supabaseAdmin),
    tableColumnsReady(supabaseAdmin, "Resend delivery event ledger", [
      supabaseAdmin
        .from("resend_delivery_events")
        .select("id, svix_id, event_type, event_status, recipient_email")
        .limit(1),
      supabaseAdmin
        .from("audit_events")
        .select("id, event_type, metadata")
        .limit(1),
      supabaseAdmin
        .from("admin_notifications")
        .select("id, event_type, priority")
        .limit(1),
    ]),
    refundProductionBoundaryReady(supabaseAdmin),
    customerSupportReplyReady(supabaseAdmin),
    customerSupportTicketIntakeReady(supabaseAdmin),
    operationalFulfillmentReady(supabaseAdmin),
    inventoryOperationsReady(supabaseAdmin),
    deviceManagementReady(supabaseAdmin),
    adminCustomerDraftReady(supabaseAdmin),
    adminCustomerProfileEditReady(supabaseAdmin),
    customerDataExportReady(supabaseAdmin),
    dataSubjectRequestReady(supabaseAdmin),
    accountingExportReady(supabaseAdmin),
    vatSummaryReady(supabaseAdmin),
    taxPaymentRegisterReady(supabaseAdmin),
    privacyIncidentReady(supabaseAdmin),
    adminAccessReviewReady(supabaseAdmin),
    backupRestoreDrillReady(supabaseAdmin),
    dataRetentionReviewReady(supabaseAdmin),
    customerDeletionSafetyReady(supabaseAdmin),
  ]);
  const directChecks = [
    ["Application URL", applicationUrlReadiness()],
    ["Company identity", companyIdentityReadiness()],
    ["Final legal versions", finalLegalVersionReadiness()],
    ["Legal documents", legalDocuments],
    ["Legal before payment workflow", legalBeforePayment],
    ["Legal change notice workflow", legalChangeNoticeTables],
    ["Subscription entitlement migration", subscriptionMigration],
    ["Swedish organisation-number validation", swedishRegistrationNumbers],
    ["Pricing configuration", pricing],
    ["Data processor register", dataProcessorRegisterReadiness()],
    ["Processor compliance review workflow", processorComplianceTables],
    ["Private display video bucket", privateVideoBucket],
    ["Private sensitive storage", sensitiveStorage],
    ["Stripe webhook event ledger", webhookLedger],
    ["Stripe dispute and refund webhooks", stripeFinancialRiskWebhookReadiness()],
    ["Opt-in consent defaults", optInDefaults],
    ["Customer consent management", customerConsentManagementReadiness()],
    ["Cookie and tracking governance", cookieTrackingGovernanceReadiness()],
    ["Display material review workflow", displayReview],
    ["Customer preview decision workflow", customerPreviewDecision],
    ["Public request privacy consent", requestPrivacy],
    ["Public request intake workflow", publicRequestIntake],
    ["Admin notification workflow", adminNotifications],
    ["Resend webhook secret", resendWebhookSecretReadiness()],
    ["Resend delivery event workflow", resendDeliveryEvents],
    ["Refund and production boundary workflow", refundProductionBoundaryTables],
    ["Customer support reply workflow", customerSupportReplyTables],
    ["Customer support ticket intake workflow", customerSupportTicketTables],
    ["Billing portal workflow", billingPortalWorkflowReadiness()],
    ["Operational fulfillment readiness", operationalTables],
    ["Inventory operations workflow", inventoryTables],
    ["Device management workflow", deviceTables],
    ["Admin customer draft workflow", customerDraftTables],
    ["Admin customer profile edit workflow", customerProfileEditTables],
    ["Customer data export workflow", customerExportTables],
    ["Data subject request workflow", dataSubjectRequestTables],
    ["Accounting export workflow", accountingExportTables],
    ["VAT summary workflow", vatSummaryTables],
    ["Tax payment register workflow", taxPaymentTables],
    ["Privacy incident workflow", privacyIncidentTables],
    ["Admin access review workflow", adminAccessReviewTables],
    ["Backup restore drill workflow", backupRestoreDrillTables],
    ["Data retention review workflow", dataRetentionReviewTables],
    ["Customer deletion safety workflow", deletionSafetyTables],
    ["Security headers", securityHeaderReadiness()],
    ["Sensitive route no-store policy", sensitiveNoStorePolicyReadiness()],
    ["Service worker cache safety", serviceWorkerCacheSafetyReadiness()],
    ["CSRF protection policy", csrfProtectionReadiness()],
    ["Text quality check", textQualityCheckReadiness()],
    ["Production email sender", transactionalEmailReadiness()],
    ["Transactional email workflow", transactionalEmailWorkflowReadiness()],
    ["Customer password policy", passwordPolicyReadiness()],
    ["Password reset abuse protection", passwordResetReadiness()],
    ["Login attempt protection", loginAttemptReadiness()],
  ] as Array<[string, CheckResult]>;

  return [
    ...missingLivePaymentConfirmations(),
    ...directChecks.flatMap(([label, result]) =>
      result.ok ? [] : [`${label} (${result.details})`],
    ),
  ];
}
