"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { showAdminNotification } from "@/lib/admin/notifications";

type BackupDrill = {
  id: string;
  provider: string;
  backup_scope: string;
  status: string;
  last_successful_backup_at: string | null;
  restore_tested_at: string | null;
  evidence_reference: string | null;
  notes: string | null;
  updated_at: string;
};

const defaultForm = {
  provider: "Supabase",
  backup_scope: "",
  status: "planned",
  last_successful_backup_at: "",
  restore_tested_at: "",
  evidence_reference: "",
  notes: "",
  reason: "",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("sv-SE");
}

function drillToForm(drill: BackupDrill, status = drill.status) {
  return {
    provider: drill.provider,
    backup_scope: drill.backup_scope,
    status,
    last_successful_backup_at: drill.last_successful_backup_at || "",
    restore_tested_at: drill.restore_tested_at || "",
    evidence_reference: drill.evidence_reference || "",
    notes: drill.notes || "",
  };
}

export default function AdminBackupDrillsPage() {
  const [drills, setDrills] = useState<BackupDrill[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const attentionCount = useMemo(
    () =>
      drills.filter(
        (drill) =>
          drill.status !== "restore_tested" || !drill.restore_tested_at,
      ).length,
    [drills],
  );

  const loadDrills = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/backup-drills", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not load backup drills.",
      );
      setDrills([]);
    } else {
      setDrills(result.drills || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDrills();
  }, []);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitDrill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/admin/backup-drills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save backup drill.",
      );
    } else {
      setForm(defaultForm);
      await loadDrills();
      showAdminNotification("success", "Backup drill saved.");
    }

    setSaving(false);
  };

  const updateDrill = async (drill: BackupDrill, status: string) => {
    const reason = prompt(`Reason for marking ${drill.provider} as ${status}:`)?.trim();
    if (!reason) return;

    const now = new Date().toISOString();
    const payload = {
      ...drillToForm(drill, status),
      last_successful_backup_at:
        status === "backup_verified" && !drill.last_successful_backup_at
          ? now
          : drill.last_successful_backup_at || "",
      restore_tested_at:
        status === "restore_tested" && !drill.restore_tested_at
          ? now
          : drill.restore_tested_at || "",
      reason,
    };

    setUpdatingId(drill.id);
    const response = await fetch(`/api/admin/backup-drills/${drill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update backup drill.",
      );
    } else {
      await loadDrills();
      showAdminNotification("success", "Backup drill updated.");
    }

    setUpdatingId(null);
  };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header admin-dashboard-header">
        <div>
          <h1 className="admin-title">Backup restore drills</h1>
          <p className="admin-subtitle">
            Record backup coverage, restore tests, evidence references, and
            follow-up risk before live customer operations.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <div className="admin-status-chip admin-status-chip-system">
            <span className="admin-status-dot admin-status-warning" />
            {loading ? "Syncing" : `${attentionCount} need evidence`}
          </div>
          <button onClick={loadDrills} className="admin-button-primary">
            Refresh
          </button>
        </div>
      </div>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Record backup evidence</h2>
        <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={submitDrill}>
          <label className="admin-field">
            <span>Provider</span>
            <select
              value={form.provider}
              onChange={(event) => updateForm("provider", event.target.value)}
            >
              <option value="Supabase">Supabase</option>
              <option value="Vercel">Vercel</option>
              <option value="Stripe">Stripe</option>
              <option value="Resend">Resend</option>
              <option value="Loopia">Loopia</option>
              <option value="Internal">Internal</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              <option value="planned">Planned</option>
              <option value="backup_verified">Backup verified</option>
              <option value="restore_tested">Restore tested</option>
              <option value="needs_attention">Needs attention</option>
            </select>
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Backup scope</span>
            <textarea
              value={form.backup_scope}
              onChange={(event) => updateForm("backup_scope", event.target.value)}
              rows={2}
              required
            />
          </label>
          <label className="admin-field">
            <span>Last successful backup</span>
            <input
              type="datetime-local"
              value={form.last_successful_backup_at}
              onChange={(event) =>
                updateForm("last_successful_backup_at", event.target.value)
              }
            />
          </label>
          <label className="admin-field">
            <span>Restore tested</span>
            <input
              type="datetime-local"
              value={form.restore_tested_at}
              onChange={(event) =>
                updateForm("restore_tested_at", event.target.value)
              }
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Evidence reference</span>
            <input
              value={form.evidence_reference}
              onChange={(event) =>
                updateForm("evidence_reference", event.target.value)
              }
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={2}
            />
          </label>
          <label className="admin-field lg:col-span-2">
            <span>Admin reason</span>
            <input
              value={form.reason}
              onChange={(event) => updateForm("reason", event.target.value)}
              required
            />
          </label>
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="admin-button-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save backup evidence"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Backup restore register</h2>
        <div className="admin-table-wrap mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Backup</th>
                <th>Restore</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drills.map((drill) => (
                <tr key={drill.id}>
                  <td>
                    <strong>{drill.provider}</strong>
                    <br />
                    <small>{drill.evidence_reference || "No evidence reference"}</small>
                  </td>
                  <td>
                    {drill.backup_scope}
                    {drill.notes && (
                      <>
                        <br />
                        <small>{drill.notes}</small>
                      </>
                    )}
                  </td>
                  <td>{drill.status}</td>
                  <td>{formatDateTime(drill.last_successful_backup_at)}</td>
                  <td>{formatDateTime(drill.restore_tested_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === drill.id}
                        onClick={() => updateDrill(drill, "backup_verified")}
                      >
                        Backup verified
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === drill.id}
                        onClick={() => updateDrill(drill, "restore_tested")}
                      >
                        Restore tested
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary"
                        disabled={updatingId === drill.id}
                        onClick={() => updateDrill(drill, "needs_attention")}
                      >
                        Needs attention
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && drills.length === 0 && (
                <tr>
                  <td colSpan={6}>No backup restore drills recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
