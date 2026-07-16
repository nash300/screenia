"use client";

import { useEffect, useMemo, useState } from "react";

type ReadinessStatus = "pass" | "warning" | "fail";

type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

type ReadinessResponse = {
  checkedAt: string;
  readyForLivePayments: boolean;
  summary: Record<ReadinessStatus, number>;
  checks: ReadinessCheck[];
};

const statusLabel: Record<ReadinessStatus, string> = {
  pass: "Pass",
  warning: "Review",
  fail: "Blocked",
};

const manualGateKeys = new Set([
  "screenia_business_registration_confirmed",
  "screenia_vercel_pro_confirmed",
  "screenia_vat_decision_confirmed",
  "screenia_legal_review_confirmed",
  "screenia_live_webhook_verified",
  "screenia_supabase_auth_email_verified",
  "company_identity",
  "legal_documents",
  "stripe_tax",
]);

const categoryDefinitions = [
  {
    label: "Manual launch gates",
    description: "Human, business, tax, legal, and external-service proof.",
    match: (check: ReadinessCheck) => manualGateKeys.has(check.key),
  },
  {
    label: "Billing and subscriptions",
    description: "Stripe, checkout, VAT exports, refunds, and entitlement logic.",
    match: (check: ReadinessCheck) =>
      /stripe|payment|billing|vat|tax|subscription|refund/u.test(check.key),
  },
  {
    label: "Email and auth",
    description: "Resend, Supabase Auth, password reset, login, and support email.",
    match: (check: ReadinessCheck) =>
      /email|resend|auth|password|login|support/u.test(check.key),
  },
  {
    label: "Customer operations",
    description: "Requests, onboarding, content, displays, hardware stock, and support.",
    match: (check: ReadinessCheck) =>
      /customer|request|display|device|inventory|fulfillment|preview|consent/u.test(
        check.key,
      ),
  },
  {
    label: "Governance and security",
    description: "Legal records, privacy, processors, cache, headers, and CSRF.",
    match: (check: ReadinessCheck) =>
      /legal|privacy|processor|retention|deletion|security|csrf|cache|cookie|access|backup|storage/u.test(
        check.key,
      ),
  },
];

function progressPercent(summary: Record<ReadinessStatus, number> | undefined) {
  if (!summary) return 0;
  const total = summary.pass + summary.warning + summary.fail;
  if (!total) return 0;
  return Math.round((summary.pass / total) * 100);
}

function statusRank(status: ReadinessStatus) {
  if (status === "fail") return 0;
  if (status === "warning") return 1;
  return 2;
}

function getCategoryGroups(checks: ReadinessCheck[]) {
  const assigned = new Set<string>();
  const groups = categoryDefinitions.map((category) => {
    const categoryChecks = checks.filter((check) => {
      if (assigned.has(check.key) || !category.match(check)) return false;
      assigned.add(check.key);
      return true;
    });

    return {
      ...category,
      checks: categoryChecks.sort((a, b) => statusRank(a.status) - statusRank(b.status)),
    };
  });

  const remainingChecks = checks.filter((check) => !assigned.has(check.key));

  return [
    ...groups,
    {
      label: "Technical foundation",
      description: "Base app configuration and source-level safety checks.",
      checks: remainingChecks.sort((a, b) => statusRank(a.status) - statusRank(b.status)),
    },
  ].filter((group) => group.checks.length > 0);
}

export default function LaunchReadinessPage() {
  const [data, setData] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const blockedChecks = useMemo(
    () => data?.checks.filter((check) => check.status === "fail") || [],
    [data],
  );
  const warningChecks = useMemo(
    () => data?.checks.filter((check) => check.status === "warning") || [],
    [data],
  );
  const reviewFirstChecks = useMemo(
    () =>
      [...blockedChecks, ...warningChecks]
        .filter((check) => manualGateKeys.has(check.key))
        .sort((a, b) => statusRank(a.status) - statusRank(b.status)),
    [blockedChecks, warningChecks],
  );
  const categoryGroups = useMemo(
    () => getCategoryGroups(data?.checks || []),
    [data],
  );
  const progress = progressPercent(data?.summary);

  const loadReadiness = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/launch-readiness", {
        cache: "no-store",
      });
      const responseText = await response.text();
      const nextData = responseText
        ? (JSON.parse(responseText) as Partial<ReadinessResponse> & {
            error?: string;
          })
        : null;

      if (!response.ok) {
        setError(nextData?.error || "Sign in as an admin to check readiness.");
        setData(null);
      } else {
        setData(nextData as ReadinessResponse);
      }
    } catch {
      setError("Could not load launch readiness. Refresh or sign in again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReadiness();
  }, []);

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Operational readiness</h1>
          <p className="admin-subtitle">
            Permanent safety checks for launch, payments, email, legal status,
            migrations, security, and production operations.
          </p>
        </div>

        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span
              className={`admin-status-dot ${
                data?.readyForLivePayments
                  ? "admin-status-success"
                  : blockedChecks.length
                    ? "admin-status-danger"
                    : "admin-status-warning"
              }`}
            />
            {loading
              ? "Checking"
              : data?.readyForLivePayments
                ? "Ready"
                : "Not ready"}
          </div>

          <button onClick={loadReadiness} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-card p-6">
          <h2 className="admin-card-title text-xl">Could not check readiness</h2>
          <p className="admin-muted mt-2">{error}</p>
        </div>
      )}

      <section className="admin-dashboard-kpis">
        <ReadinessStat label="Passed" value={data?.summary.pass || 0} />
        <ReadinessStat label="Needs review" value={data?.summary.warning || 0} />
        <ReadinessStat label="Blocked" value={data?.summary.fail || 0} />
        <ReadinessStat label="Progress" value={`${progress}%`} />
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">
          Live payment and operations decision
        </h2>
        <p className="admin-muted mt-2">
          {data?.readyForLivePayments
            ? "All checks currently pass. Keep using this page before accepting live customers, changing billing rules, or making major production updates."
            : "Do not enable live Stripe payments or major production changes yet. Resolve blocked items and review warnings first."}
        </p>
        {data?.checkedAt && (
          <p className="admin-muted mt-2 text-sm">
            Last checked: {new Date(data.checkedAt).toLocaleString()}
          </p>
        )}
      </section>

      {reviewFirstChecks.length > 0 && (
        <section className="admin-card p-6">
          <h2 className="admin-card-title text-xl">Manual gates to finish first</h2>
          <p className="admin-muted mt-2">
            These are the business/service proofs we should complete before a long
            real-world checkout and display test pass.
          </p>
          <div className="mt-4 grid gap-3">
            {reviewFirstChecks.map((check) => (
              <ReadinessCheckCard key={`manual-${check.key}`} check={check} />
            ))}
          </div>
        </section>
      )}

      {categoryGroups.length > 0 && (
        <section className="admin-card p-6">
          <h2 className="admin-card-title text-xl">Grouped readiness map</h2>
          <div className="mt-4 grid gap-4">
            {categoryGroups.map((group) => {
              const groupSummary = {
                pass: group.checks.filter((check) => check.status === "pass").length,
                warning: group.checks.filter((check) => check.status === "warning").length,
                fail: group.checks.filter((check) => check.status === "fail").length,
              };

              return (
                <details key={group.label} className="admin-readiness-group" open={groupSummary.fail > 0 || groupSummary.warning > 0}>
                  <summary>
                    <span>
                      <strong>{group.label}</strong>
                      <small>{group.description}</small>
                    </span>
                    <span className="admin-readiness-group-counts">
                      {groupSummary.pass} pass / {groupSummary.warning} review /{" "}
                      {groupSummary.fail} blocked
                    </span>
                  </summary>
                  <div className="admin-readiness-group-body">
                    {group.checks.map((check) => (
                      <ReadinessCheckCard key={`${group.label}-${check.key}`} check={check} />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Checks</h2>
        <div className="mt-4 grid gap-3">
          {(data?.checks || []).map((check) => (
            <ReadinessCheckCard key={check.key} check={check} />
          ))}

          {loading && <p className="admin-muted">Loading readiness checks...</p>}
        </div>
      </section>

      {(blockedChecks.length > 0 || warningChecks.length > 0) && (
        <section className="admin-card p-6">
          <h2 className="admin-card-title text-xl">Next actions</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {blockedChecks.map((check) => (
              <li key={`blocked-${check.key}`}>
                Resolve blocked item: <strong>{check.label}</strong>.
              </li>
            ))}
            {warningChecks.map((check) => (
              <li key={`warning-${check.key}`}>
                Review before launch or production change:{" "}
                <strong>{check.label}</strong>.
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReadinessStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="admin-card admin-stat-card">
      <span className="admin-stat-icon admin-stat-neutral" />
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{value}</p>
      <p className="admin-stat-meta">Operational checks</p>
    </div>
  );
}

function ReadinessCheckCard({ check }: { check: ReadinessCheck }) {
  return (
    <div
      className={`admin-readiness-check admin-readiness-check-${check.status}`}
    >
      <div className="admin-readiness-check-heading">
        <h3>{check.label}</h3>
        <span>{statusLabel[check.status]}</span>
      </div>
      <p>{check.detail}</p>
    </div>
  );
}
