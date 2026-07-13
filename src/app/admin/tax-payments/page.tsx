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
  const totalVatOre = useMemo(
    () =>
      records
        .filter((record) => record.status === "paid")
        .reduce((sum, record) => sum + Number(record.tax_amount_sek || 0), 0),
    [records],
  );

  const loadRecords = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/tax-payments", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load tax payment records.",
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
        result.error || "Could not save tax payment record.",
      );
    } else {
      setForm(defaultForm);
      await loadRecords();
      showAdminNotification("success", "Tax payment record saved.");
    }

    setSaving(false);
  };

  const updateRecordStatus = async (
    record: TaxPaymentRecord,
    status: "submitted" | "paid",
  ) => {
    const reason = prompt(
      `Reason for marking ${formatDate(record.period_start)} - ${formatDate(
        record.period_end,
      )} as ${status}:`,
    )?.trim();

    if (!reason) return;

    const reference =
      status === "paid"
        ? prompt("Payment reference or Skatteverket reference:", record.reference || "")?.trim()
        : record.reference || "";

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
        result.error || "Could not update tax payment record.",
      );
    } else {
      await loadRecords();
      showAdminNotification("success", "Tax payment record updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Tax payments</h1>
          <p className="admin-subtitle">
            Record VAT/moms period evidence for accounting follow-up and audit
            history.
          </p>
        </div>

        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-success" />
            {loading ? "Syncing" : `${records.length} records`}
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
          <p className="admin-stat-meta">All paid records</p>
        </div>
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Draft periods</p>
          <p className="admin-stat-value">
            {records.filter((record) => record.status === "draft").length}
          </p>
          <p className="admin-stat-meta">Need review</p>
        </div>
        <div className="admin-card admin-stat-card">
          <span className="admin-stat-icon admin-stat-neutral" />
          <p className="admin-stat-label">Submitted periods</p>
          <p className="admin-stat-value">
            {records.filter((record) => record.status === "submitted").length}
          </p>
          <p className="admin-stat-meta">Awaiting payment evidence</p>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Record VAT period</h2>
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
              {saving ? "Saving..." : "Save tax record"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">VAT period records</h2>
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
                  <td>{record.status}</td>
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
                          onClick={() => updateRecordStatus(record, "submitted")}
                        >
                          Mark submitted
                        </button>
                      )}
                      {record.status !== "paid" && (
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={updatingId === record.id}
                          onClick={() => updateRecordStatus(record, "paid")}
                        >
                          Mark paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={7}>No tax payment records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
