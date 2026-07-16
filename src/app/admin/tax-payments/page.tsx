"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type TaxPaymentRecord = {
  id: string;
  period_start: string;
  period_end: string;
  currency: string;
  taxable_amount_sek: number;
  tax_amount_sek: number;
  status: string;
  paid_at: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const defaultForm = {
  period_start: "",
  period_end: "",
  taxable_amount_sek: "",
  tax_amount_sek: "",
  status: "draft",
  paid_at: "",
  reference: "",
  notes: "",
  reason: "",
};

function formatSekOre(value: number) {
  return `${(Number(value || 0) / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("sv-SE");
}

function formatChoice(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toOreInput(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : NaN;
}

export default function AdminTaxPaymentsPage() {
  const [records, setRecords] = useState<TaxPaymentRecord[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionDrafts, setActionDrafts] = useState<
    Record<string, { status: "submitted" | "paid"; reason: string; reference: string }>
  >({});
  const totalVatOre = useMemo(
    () =>
      records
        .filter((record) => record.status === "paid")
        .reduce((sum, record) => sum + Number(record.tax_amount_sek || 0), 0),
    [records],
  );
  const draftCount = useMemo(
    () => records.filter((record) => record.status === "draft").length,
    [records],
  );
  const submittedCount = useMemo(
    () => records.filter((record) => record.status === "submitted").length,
    [records],
  );
  const paidCount = useMemo(
    () => records.filter((record) => record.status === "paid").length,
    [records],
  );
  const evidencedCount = useMemo(
    () =>
      records.filter(
        (record) => record.status === "paid" && Boolean(record.reference),
      ).length,
    [records],
  );
  const vatWorkflow = [
    {
      stage: "1",
      label: "Prepare period",
      value: records.length,
      description: "Record the taxable sales and VAT for the filing period.",
    },
    {
      stage: "2",
      label: "Submit return",
      value: submittedCount + paidCount,
      description: "Mark the period submitted after Skatteverket filing.",
    },
    {
      stage: "3",
      label: "Pay VAT",
      value: paidCount,
      description: "Record payment date and payment reference.",
    },
    {
      stage: "4",
      label: "Keep evidence",
      value: evidencedCount,
      description: "Retain references and notes for accounting/audit follow-up.",
    },
  ];

  const loadRecords = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/tax-payments", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load VAT filing periods.",
      );
      setRecords([]);
    } else {
      setRecords(result.records || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const taxableOre = toOreInput(form.taxable_amount_sek);
    const taxOre = toOreInput(form.tax_amount_sek);

    if (Number.isNaN(taxableOre) || Number.isNaN(taxOre)) {
      showAdminNotification("error", "Amounts must be valid SEK values.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/admin/tax-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        taxable_amount_sek: taxableOre,
        tax_amount_sek: taxOre,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save VAT filing period.",
      );
    } else {
      setForm(defaultForm);
      await loadRecords();
      showAdminNotification("success", "VAT filing period saved.");
    }

    setSaving(false);
  };

  const updateRecordStatus = async (
    record: TaxPaymentRecord,
    status: "submitted" | "paid",
  ) => {
    const draft = actionDrafts[record.id];
    const reason = draft?.reason.trim() || "";
    if (reason.length < 5) {
      showAdminNotification("error", "Add a reason of at least 5 characters.");
      return;
    }

    const reference = status === "paid" ? draft?.reference.trim() || "" : record.reference || "";

    if (status === "paid" && !reference) {
      showAdminNotification("error", "Payment reference is required.");
      return;
    }

    setUpdatingId(record.id);
    const response = await fetch(`/api/admin/tax-payments/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        reference,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update VAT filing period.",
      );
    } else {
      setActionDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await loadRecords();
      showAdminNotification("success", "VAT filing period updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">VAT filing</h1>
          <p className="admin-subtitle">
            Prepare VAT/moms periods, submission status, payment evidence, and audit
            history.
          </p>
        </div>

        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-success" />
            {loading ? "Syncing" : `${records.length} periods`}
          </div>
          <button onClick={loadRecords} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-dashboard-kpis">
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Paid VAT recorded</p>
          <p className="admin-stat-value">{formatSekOre(totalVatOre)}</p>
          <p className="admin-stat-meta">All paid periods</p>
        </div>
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Draft periods</p>
          <p className="admin-stat-value">
            {draftCount}
          </p>
          <p className="admin-stat-meta">Need review</p>
        </div>
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Submitted periods</p>
          <p className="admin-stat-value">
            {submittedCount}
          </p>
          <p className="admin-stat-meta">Awaiting payment evidence</p>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">VAT filing workflow</h2>
        <div className="admin-tax-workflow" aria-label="VAT filing workflow">
          {vatWorkflow.map((item) => (
            <div key={item.stage} className="admin-tax-workflow-step">
              <span>{item.stage}</span>
              <strong>
                {item.label}
                <em>{item.value}</em>
              </strong>
              <small>{item.description}</small>
            </div>
          ))}
        </div>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitRecord}>
          <label className="admin-field">
            <span>Period start</span>
            <input
              type="date"
              value={form.period_start}
              onChange={(event) => updateForm("period_start", event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Period end</span>
            <input
              type="date"
              value={form.period_end}
              onChange={(event) => updateForm("period_end", event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Taxable amount, SEK</span>
            <input
              inputMode="decimal"
              value={form.taxable_amount_sek}
              onChange={(event) =>
                updateForm("taxable_amount_sek", event.target.value)
              }
              placeholder="10000.00"
              required
            />
          </label>
          <label className="admin-field">
            <span>VAT amount, SEK</span>
            <input
              inputMode="decimal"
              value={form.tax_amount_sek}
              onChange={(event) => updateForm("tax_amount_sek", event.target.value)}
              placeholder="2500.00"
              required
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Paid at</span>
            <input
              type="datetime-local"
              value={form.paid_at}
              onChange={(event) => updateForm("paid_at", event.target.value)}
              disabled={form.status !== "paid"}
            />
          </label>
          <label className="admin-field">
            <span>Reference</span>
            <input
              value={form.reference}
              onChange={(event) => updateForm("reference", event.target.value)}
              placeholder="Skatteverket reference or payment id"
            />
          </label>
          <label className="admin-field">
            <span>Admin reason</span>
            <input
              value={form.reason}
              onChange={(event) => updateForm("reason", event.target.value)}
              placeholder="Why this record is being created"
              required
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={3}
              placeholder="Internal accounting notes"
            />
          </label>
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="admin-button-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save VAT period"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">VAT filing periods</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Taxable</th>
                <th>VAT</th>
                <th>Paid at</th>
                <th>Reference</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    {formatDate(record.period_start)} - {formatDate(record.period_end)}
                  </td>
                  <td>{formatChoice(record.status)}</td>
                  <td>{formatSekOre(record.taxable_amount_sek)}</td>
                  <td>{formatSekOre(record.tax_amount_sek)}</td>
                  <td>{formatDate(record.paid_at)}</td>
                  <td>{record.reference || "-"}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {record.status === "draft" && (
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === record.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [record.id]: {
                                status: "submitted",
                                reason: current[record.id]?.reason || "",
                                reference:
                                  current[record.id]?.reference ||
                                  record.reference ||
                                  "",
                              },
                            }))
                          }
                        >
                          Mark submitted
                        </button>
                      )}
                      {record.status !== "paid" && (
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === record.id}
                          onClick={() =>
                            setActionDrafts((current) => ({
                              ...current,
                              [record.id]: {
                                status: "paid",
                                reason: current[record.id]?.reason || "",
                                reference:
                                  current[record.id]?.reference ||
                                  record.reference ||
                                  "",
                              },
                            }))
                          }
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                    {actionDrafts[record.id] && (
                      <div className="admin-inline-flow">
                        {actionDrafts[record.id].status === "paid" && (
                          <label>
                            <span>Payment reference</span>
                            <input
                              value={actionDrafts[record.id].reference}
                              onChange={(event) =>
                                setActionDrafts((current) => ({
                                  ...current,
                                  [record.id]: {
                                    ...current[record.id],
                                    reference: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        )}
                        <label>
                          <span>Reason for {actionDrafts[record.id].status}</span>
                          <textarea
                            value={actionDrafts[record.id].reason}
                            onChange={(event) =>
                              setActionDrafts((current) => ({
                                ...current,
                                [record.id]: {
                                  ...current[record.id],
                                  reason: event.target.value,
                                },
                              }))
                            }
                            rows={2}
                          />
                        </label>
                        <div className="admin-inline-flow-actions">
                          <button
                            type="button"
                            className="admin-button-primary"
                            disabled={updatingId === record.id}
                            onClick={() =>
                              updateRecordStatus(
                                record,
                                actionDrafts[record.id].status,
                              )
                            }
                          >
                            {updatingId === record.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={updatingId === record.id}
                            onClick={() =>
                              setActionDrafts((current) => {
                                const next = { ...current };
                                delete next[record.id];
                                return next;
                              })
                            }
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={7}>No VAT filing periods yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
