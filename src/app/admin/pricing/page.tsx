"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PricingPlan = {
  id: string;
  code: string;
  name: string;
  resolution: string;
  setup_fee_sek: number;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number;
  trial_days: number;
  binding_months: number | null;
  currency: string | null;
  tax_behavior: string | null;
  is_active: boolean;
  stripe_setup_price_id: string | null;
  stripe_hardware_price_id: string | null;
  stripe_shipping_price_id: string | null;
  stripe_monthly_price_id: string | null;
  updated_at: string | null;
};

type PricingForm = {
  setupFeeSek: string;
  hardwareFeeSek: string;
  shippingFeeSek: string;
  monthlyFeeSek: string;
  trialDays: string;
  bindingMonths: string;
  isActive: boolean;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

type PricingOperation = "save" | "sync";

type PricingOperationDraft = {
  planId: string;
  operation: PricingOperation;
  reason: string;
  confirmed: boolean;
};

function formatSek(value: number | null | undefined) {
  return `${(value ?? 0).toLocaleString("sv-SE")} SEK`;
}

function includedVat(value: number | null | undefined) {
  const gross = Math.max(0, Math.round(value ?? 0));
  const net = Math.round(gross / 1.25);
  return gross - net;
}

function toForm(plan: PricingPlan): PricingForm {
  return {
    setupFeeSek: String(plan.setup_fee_sek ?? 0),
    hardwareFeeSek: String(plan.hardware_fee_sek ?? 0),
    shippingFeeSek: String(plan.shipping_fee_sek ?? 0),
    monthlyFeeSek: String(plan.monthly_fee_sek ?? 0),
    trialDays: String(plan.trial_days ?? 0),
    bindingMonths: String(plan.binding_months ?? 0),
    isActive: plan.is_active,
  };
}

function parseInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function stripeSyncStatus(plan: PricingPlan) {
  const ids = [
    plan.stripe_setup_price_id,
    plan.stripe_hardware_price_id,
    plan.stripe_shipping_price_id,
    plan.stripe_monthly_price_id,
  ];
  const syncedCount = ids.filter(Boolean).length;
  if (syncedCount === ids.length) return "Synced";
  if (syncedCount > 0) return "Partial";
  return "Not synced";
}

function shortStripeId(value: string | null) {
  if (!value) return "Missing";
  if (value.length <= 18) return value;
  return `${value.slice(0, 14)}...${value.slice(-4)}`;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [forms, setForms] = useState<Record<string, PricingForm>>({});
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [operationDraft, setOperationDraft] =
    useState<PricingOperationDraft | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/pricing-plans", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice({
        type: "error",
        message: data.error || "Could not load pricing plans.",
      });
      setLoading(false);
      return;
    }

    const loadedPlans = (data.plans || []) as PricingPlan[];
    setPlans(loadedPlans);
    setForms(
      Object.fromEntries(loadedPlans.map((plan) => [plan.id, toForm(plan)])),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const totals = useMemo(() => {
    return plans.map((plan) => {
      const form = forms[plan.id] || toForm(plan);
      const firstPayment =
        parseInteger(form.setupFeeSek) +
        parseInteger(form.hardwareFeeSek) +
        parseInteger(form.shippingFeeSek);
      return [plan.id, firstPayment] as const;
    });
  }, [forms, plans]);

  const firstPaymentByPlan = Object.fromEntries(totals);

  const updateForm = (
    planId: string,
    field: keyof PricingForm,
    value: string | boolean,
  ) => {
    setForms((current) => ({
      ...current,
      [planId]: {
        ...current[planId],
        [field]: value,
      },
    }));
  };

  const openPricingOperation = (
    plan: PricingPlan,
    operation: PricingOperation,
  ) => {
    setOperationDraft({
      planId: plan.id,
      operation,
      reason: "",
      confirmed: false,
    });
  };

  const updateOperationDraft = (
    updates: Partial<Omit<PricingOperationDraft, "planId">>,
  ) => {
    setOperationDraft((current) =>
      current ? { ...current, ...updates } : current,
    );
  };

  const savePlan = async (plan: PricingPlan, reason: string) => {
    const form = forms[plan.id];
    if (!form) return;

    setSavingPlanId(plan.id);
    setNotice({ type: "info", message: "Saving pricing plan..." });

    const response = await fetch("/api/admin/pricing-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.id,
        setupFeeSek: parseInteger(form.setupFeeSek),
        hardwareFeeSek: parseInteger(form.hardwareFeeSek),
        shippingFeeSek: parseInteger(form.shippingFeeSek),
        monthlyFeeSek: parseInteger(form.monthlyFeeSek),
        trialDays: parseInteger(form.trialDays),
        bindingMonths: parseInteger(form.bindingMonths),
        isActive: form.isActive,
        reason,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice({
        type: "error",
        message: data.error || "Could not save pricing plan.",
      });
      setSavingPlanId(null);
      return;
    }

    setPlans((current) =>
      current.map((item) => (item.id === plan.id ? data.plan : item)),
    );
    setForms((current) => ({ ...current, [plan.id]: toForm(data.plan) }));
    setOperationDraft(null);
    setNotice({ type: "success", message: `${plan.name} pricing saved.` });
    setSavingPlanId(null);
  };

  const syncStripe = async (plan: PricingPlan, reason: string) => {
    setSyncingPlanId(plan.id);
    setNotice({ type: "info", message: "Syncing Stripe prices..." });

    const response = await fetch("/api/admin/pricing-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, reason }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice({
        type: "error",
        message: data.error || "Could not sync Stripe prices.",
      });
      setSyncingPlanId(null);
      return;
    }

    setPlans((current) =>
      current.map((item) => (item.id === plan.id ? data.plan : item)),
    );
    setForms((current) => ({ ...current, [plan.id]: toForm(data.plan) }));
    setOperationDraft(null);
    setNotice({
      type: "success",
      message: `${plan.name} Stripe prices synced.`,
    });
    setSyncingPlanId(null);
  };

  const submitPricingOperation = async (plan: PricingPlan) => {
    if (!operationDraft || operationDraft.planId !== plan.id) return;
    const reason = operationDraft.reason.trim();

    if (!reason) {
      setNotice({
        type: "error",
        message: "Add a reason before saving this pricing operation.",
      });
      return;
    }

    if (!operationDraft.confirmed) {
      setNotice({
        type: "error",
        message: "Confirm the pricing operation before continuing.",
      });
      return;
    }

    if (operationDraft.operation === "save") {
      await savePlan(plan, reason);
      return;
    }

    await syncStripe(plan, reason);
  };

  return (
    <main>
      <div className="page-header">
        <p className="eyebrow">Screenia Admin</p>
        <h1>Pricing</h1>
        <p>
          Edit live package prices, then sync matching Stripe products and
          prices for tracking. Amounts are customer-pay totals including Swedish
          VAT; Checkout keeps the same totals and reports the included VAT.
        </p>
      </div>

      {notice && (
        <div className={`admin-pricing-notice admin-pricing-notice-${notice.type}`}>
          {notice.message}
        </div>
      )}

      {loading ? (
        <section className="card">
          <p className="admin-muted">Loading pricing plans...</p>
        </section>
      ) : (
        <div className="admin-pricing-grid">
          {plans.map((plan) => {
            const form = forms[plan.id] || toForm(plan);
            const saving = savingPlanId === plan.id;
            const syncing = syncingPlanId === plan.id;

            return (
              <section key={plan.id} className="card admin-pricing-card">
                <div className="admin-pricing-card-header">
                  <div>
                    <p className="eyebrow">{plan.code}</p>
                    <h2>
                      {plan.name} ({plan.resolution})
                    </h2>
                  </div>
                  <span
                    className={`admin-table-pill ${
                      plan.is_active ? "admin-table-pill-success" : ""
                    }`}
                  >
                    {plan.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="admin-pricing-fields">
                  <label>
                    Setup fee
                    <input
                      type="number"
                      min="0"
                      value={form.setupFeeSek}
                      onChange={(event) =>
                        updateForm(plan.id, "setupFeeSek", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Screen device
                    <input
                      type="number"
                      min="0"
                      value={form.hardwareFeeSek}
                      onChange={(event) =>
                        updateForm(plan.id, "hardwareFeeSek", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Shipping
                    <input
                      type="number"
                      min="0"
                      value={form.shippingFeeSek}
                      onChange={(event) =>
                        updateForm(plan.id, "shippingFeeSek", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Monthly
                    <input
                      type="number"
                      min="0"
                      value={form.monthlyFeeSek}
                      onChange={(event) =>
                        updateForm(plan.id, "monthlyFeeSek", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Trial days
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={form.trialDays}
                      onChange={(event) =>
                        updateForm(plan.id, "trialDays", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Binding months
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={form.bindingMonths}
                      onChange={(event) =>
                        updateForm(plan.id, "bindingMonths", event.target.value)
                      }
                    />
                  </label>
                </div>

                <label className="admin-pricing-toggle">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      updateForm(plan.id, "isActive", event.target.checked)
                    }
                  />
                  Available for new quotes
                </label>

                <div className="admin-pricing-summary">
                  <div>
                    <span>Initial payment incl. moms</span>
                    <strong>{formatSek(firstPaymentByPlan[plan.id])}</strong>
                    <small>{formatSek(includedVat(firstPaymentByPlan[plan.id]))} moms included</small>
                  </div>
                  <div>
                    <span>Monthly subscription incl. moms</span>
                    <strong>{formatSek(parseInteger(form.monthlyFeeSek))}</strong>
                    <small>{formatSek(includedVat(parseInteger(form.monthlyFeeSek)))} moms included</small>
                  </div>
                  <div>
                    <span>Stripe sync</span>
                    <strong>{stripeSyncStatus(plan)}</strong>
                  </div>
                </div>

                <div className="admin-pricing-stripe-list">
                  <p>
                    <strong>Setup:</strong>{" "}
                    {shortStripeId(plan.stripe_setup_price_id)}
                  </p>
                  <p>
                    <strong>Device:</strong>{" "}
                    {shortStripeId(plan.stripe_hardware_price_id)}
                  </p>
                  <p>
                    <strong>Shipping:</strong>{" "}
                    {shortStripeId(plan.stripe_shipping_price_id)}
                  </p>
                  <p>
                    <strong>Monthly:</strong>{" "}
                    {shortStripeId(plan.stripe_monthly_price_id)}
                  </p>
                </div>

                <div className="admin-pricing-actions">
                  <button
                    type="button"
                    className="admin-button-primary"
                    disabled={saving || syncing}
                    onClick={() => openPricingOperation(plan, "save")}
                  >
                    Edit pricing flow
                  </button>
                  <button
                    type="button"
                    className="admin-button-secondary"
                    disabled={saving || syncing}
                    onClick={() => openPricingOperation(plan, "sync")}
                  >
                    Stripe sync flow
                  </button>
                </div>

                {operationDraft?.planId === plan.id && (
                  <div className="admin-operation-panel admin-pricing-operation-panel">
                    <div className="admin-operation-header">
                      <div>
                        <p className="admin-operation-kicker">
                          Pricing operation flow
                        </p>
                        <h3>
                          {operationDraft.operation === "save"
                            ? "Save Screenia pricing"
                            : "Sync prices to Stripe"}
                        </h3>
                        <p>
                          Review the plan values, add an audit reason, then
                          confirm before changing billing configuration.
                        </p>
                      </div>
                      <div className="admin-operation-summary">
                        <span>Plan</span>
                        <strong>
                          {plan.name} {plan.resolution}
                        </strong>
                      </div>
                    </div>

                    <div className="admin-pricing-operation-choice">
                      <button
                        type="button"
                        className={`admin-operation-card ${
                          operationDraft.operation === "save"
                            ? "is-selected"
                            : ""
                        }`}
                        disabled={saving || syncing}
                        onClick={() =>
                          updateOperationDraft({
                            operation: "save",
                            reason: "",
                            confirmed: false,
                          })
                        }
                      >
                        <span>
                          <strong>Save pricing</strong>
                          <small>
                            Updates Screenia plan values used for quotes and
                            checkout preparation.
                          </small>
                        </span>
                        <em>
                          {operationDraft.operation === "save"
                            ? "Open"
                            : "Choose"}
                        </em>
                      </button>
                      <button
                        type="button"
                        className={`admin-operation-card admin-operation-warning ${
                          operationDraft.operation === "sync"
                            ? "is-selected"
                            : ""
                        }`}
                        disabled={saving || syncing}
                        onClick={() =>
                          updateOperationDraft({
                            operation: "sync",
                            reason: "",
                            confirmed: false,
                          })
                        }
                      >
                        <span>
                          <strong>Sync Stripe</strong>
                          <small>
                            Creates or updates Stripe price references for this
                            plan after reviewing values.
                          </small>
                        </span>
                        <em>
                          {operationDraft.operation === "sync"
                            ? "Open"
                            : "Choose"}
                        </em>
                      </button>
                    </div>

                    <div className="admin-operation-flow">
                      <div className="admin-operation-flow-header">
                        <p className="admin-operation-kicker">
                          Audit checkpoint
                        </p>
                        <h4>
                          {operationDraft.operation === "save"
                            ? "Save the edited values"
                            : "Sync the current plan with Stripe"}
                        </h4>
                        <p>
                          Current initial payment is{" "}
                          {formatSek(firstPaymentByPlan[plan.id])}; monthly is{" "}
                          {formatSek(parseInteger(form.monthlyFeeSek))}.
                        </p>
                      </div>

                      <label className="admin-operation-reason">
                        Reason for audit log
                        <textarea
                          value={operationDraft.reason}
                          disabled={saving || syncing}
                          onChange={(event) =>
                            updateOperationDraft({
                              reason: event.target.value,
                              confirmed: false,
                            })
                          }
                          placeholder={
                            operationDraft.operation === "save"
                              ? "Example: Launch pricing approved for Screenia pilot customers."
                              : "Example: Stripe prices need to match the approved Screenia pricing values."
                          }
                        />
                      </label>

                      <label className="admin-operation-confirm">
                        <input
                          type="checkbox"
                          checked={operationDraft.confirmed}
                          disabled={saving || syncing}
                          onChange={(event) =>
                            updateOperationDraft({
                              confirmed: event.target.checked,
                            })
                          }
                        />
                        <span>
                          I checked the plan values and want to save this
                          audited pricing operation.
                        </span>
                      </label>

                      <div className="admin-operation-actions">
                        <button
                          type="button"
                          className="admin-button-primary"
                          disabled={saving || syncing}
                          onClick={() => submitPricingOperation(plan)}
                        >
                          {saving || syncing
                            ? "Working..."
                            : operationDraft.operation === "save"
                              ? "Save pricing"
                              : "Sync Stripe"}
                        </button>
                        <button
                          type="button"
                          className="admin-button-secondary"
                          disabled={saving || syncing}
                          onClick={() => setOperationDraft(null)}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
