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

  const loadReadiness = async () => {
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/launch-readiness", {
      cache: "no-store",
    });
    const nextData = await response.json();

    if (!response.ok) {
      setError(nextData.error || "Could not load launch readiness.");
      setData(null);
    } else {
      setData(nextData as ReadinessResponse);
    }

    setLoading(false);
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

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Checks</h2>
        <div className="mt-4 grid gap-3">
          {(data?.checks || []).map((check) => (
            <div
              key={check.key}
              className={`rounded-xl border p-4 ${
                check.status === "fail"
                  ? "border-red-200 bg-red-50"
                  : check.status === "warning"
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-green-200 bg-green-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold text-slate-950">{check.label}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-slate-700">
                  {statusLabel[check.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{check.detail}</p>
            </div>
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
  value: number;
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
