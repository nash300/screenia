import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { securityHeaders } from "@/lib/security-headers";
import {
  isCsrfExemptPath,
  shouldDisableRouteCaching,
  shouldRejectCrossOriginUnsafeRequest,
} from "../../proxy";
import type { CheckResult } from "./live-checkout-readiness-types";

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
  "src/lib/server/live-checkout-security-readiness.ts",
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

export function projectFilePath(...segments: string[]) {
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

export function securityHeaderReadiness(): CheckResult {
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

export function serviceWorkerCacheSafetyReadiness(): CheckResult {
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

export function sensitiveNoStorePolicyReadiness(): CheckResult {
  const notificationsRouteSource = readFileSync(
    projectFilePath("src/app/api/admin/notifications/route.ts"),
    "utf8",
  );
  const sensitiveRoutes = [
    "/api/account",
    "/api/admin/customers",
    "/api/admin/notifications",
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
    !notificationsRouteSource.includes("response.headers.set(\"Cache-Control\", \"no-store\")")
      ? "admin notifications API response is missing an explicit no-store header"
      : null,
    !notificationsRouteSource.includes("return noStoreJson")
      ? "admin notifications API does not use the no-store response helper"
      : null,
  ].filter(Boolean);

  return {
    ok: missing.length === 0 && sourceIssues.length === 0,
    details:
      missing.length > 0
        ? `Sensitive routes may be cacheable: ${missing.join(", ")}`
        : sourceIssues.length > 0
          ? sourceIssues.join(" | ")
          : "Sensitive routes are marked no-store, and the admin notifications API returns explicit no-store responses.",
  };
}

export function csrfProtectionReadiness(): CheckResult {
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

export function cookieTrackingGovernanceReadiness(): CheckResult {
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

export function stripeFinancialRiskWebhookReadiness(): CheckResult {
  const webhookSource = [
    "src/app/api/stripe/webhook/route.ts",
    "src/app/api/stripe/webhook/stripe-financial-risk-handlers.ts",
  ]
    .map((path) => readFileSync(projectFilePath(path), "utf8"))
    .join("\n");
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

export function dataProcessorRegisterReadiness(): CheckResult {
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
