"use client";

import { useCallback, useEffect, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type ReconciliationIssue = {
  severity: "warning" | "urgent";
  code: string;
  message: string;
};

type ReconciliationResult = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string | null;
  stripeSubscriptionId: string;
  localStatus: string | null;
  localPaymentStatus: string | null;
  localScreenQuantity: number | null;
  stripeStatus: string | null;
  stripeScreenQuantity: number | null;
  issues: ReconciliationIssue[];
};

type ReconciliationResponse = {
  checkedAt: string;
  summary: {
    checked: number;
    healthy: number;
    warnings: number;
    urgent: number;
  };
  results: ReconciliationResult[];
};

export default function ReconciliationPage() {
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReconciliation = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/reconciliation", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not run reconciliation.");
      setLoading(false);
      return;
    }

    setData(result as ReconciliationResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReconciliation();
  }, [loadReconciliation]);

  return (
    <div>
      <div className="admin-page-header admin-reconciliation-header">
        <div>
          <p className="admin-eyebrow">BILLING CONTROL</p>
          <h1 className="admin-title">Stripe reconciliation</h1>
          <p className="admin-subtitle">
            Compare Stripe subscription status and paid screen quantity with Screenia&apos;s local records before changing customer access.
          </p>
        </div>
        <button
          type="button"
          className="admin-button-primary"
          onClick={loadReconciliation}
          disabled={loading}
        >
          {loading ? "Checking..." : "Run reconciliation"}
        </button>
      </div>

      {data ? (
        <>
          <div className="admin-reconciliation-summary">
            <SummaryTile label="Checked" value={data.summary.checked} />
            <SummaryTile label="Healthy" value={data.summary.healthy} tone="healthy" />
            <SummaryTile label="Warnings" value={data.summary.warnings} tone="warning" />
            <SummaryTile label="Urgent" value={data.summary.urgent} tone="urgent" />
          </div>

          <div className="admin-card admin-reconciliation-panel">
            <p className="admin-muted">
              Last checked {new Date(data.checkedAt).toLocaleString("sv-SE")}. This view is read-only; resolve differences through the customer subscription or Stripe workflow so the correction is audited.
            </p>
            {data.results.length === 0 ? (
              <p className="admin-muted">No connected Stripe subscriptions found.</p>
            ) : (
              <div className="admin-scroll-region admin-reconciliation-list">
                {data.results.map((item) => (
                  <article key={item.id} className="admin-reconciliation-row">
                    <div>
                      <strong>{item.customerName}</strong>
                      <p>{item.customerEmail || item.customerId}</p>
                      <small>Subscription: {item.stripeSubscriptionId}</small>
                    </div>
                    <div className="admin-reconciliation-values">
                      <span>Local: {item.localStatus || "missing"} / {item.localScreenQuantity || 0} screen(s)</span>
                      <span>Stripe: {item.stripeStatus || "unavailable"} / {item.stripeScreenQuantity ?? "?"} screen(s)</span>
                    </div>
                    <div className="admin-reconciliation-issues">
                      {item.issues.length === 0 ? (
                        <span className="admin-reconciliation-status admin-reconciliation-status-healthy">Healthy</span>
                      ) : (
                        item.issues.map((issue) => (
                          <span
                            key={`${item.id}-${issue.code}`}
                            className={`admin-reconciliation-status admin-reconciliation-status-${issue.severity}`}
                          >
                            {issue.message}
                          </span>
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      ) : loading ? (
        <div className="admin-card"><p className="admin-muted">Running first reconciliation...</p></div>
      ) : null}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={`admin-reconciliation-tile ${tone ? `admin-reconciliation-tile-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
