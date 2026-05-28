"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type Customer = {
  id: string;
  name: string;
  email: string | null;
};

type PricingPlan = {
  id: string;
  code: string;
  name: string;
  resolution: string;
  setup_fee_sek: number;
  hardware_fee_sek: number;
  shipping_fee_sek: number;
  monthly_fee_sek: number;
  trial_days: number;
};

export default function NewSubscriptionPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <NewSubscriptionPageContent />
    </Suspense>
  );
}

function SubscriptionFallback() {
  return (
    <main>
      <div className="admin-card p-6">
        <p className="admin-muted">Loading subscription setup...</p>
      </div>
    </main>
  );
}

function NewSubscriptionPageContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!customerId) return;

      const { data: customerData } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("id", customerId)
        .single();

      const { data: planData } = await supabase
        .from("pricing_plans")
        .select(
          "id, code, name, resolution, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, trial_days",
        )
        .eq("is_active", true)
        .order("setup_fee_sek", { ascending: true });

      setCustomer(customerData);
      setPlans(planData || []);
      setSelectedPlanCode(planData?.[0]?.code || "");
    };

    loadData();
  }, [customerId]);

  const startCheckout = async () => {
    if (!customer?.email) {
      showAdminNotification("warning", "Customer email is missing.");
      return;
    }

    if (!selectedPlanCode) {
      showAdminNotification("warning", "Select a pricing plan.");
      return;
    }

    if (!legalAccepted) {
      showAdminNotification("warning", "Accept the legal terms before checkout.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customer.id,
        email: customer.email,
        pricingPlanCode: selectedPlanCode,
        legalAccepted: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showAdminNotification("error", data.error || "Could not start checkout.");
      setLoading(false);
      return;
    }

    showAdminNotification("success", "Checkout session created.");
    window.location.href = data.url;
  };

  if (!customerId) {
    return <main>No customer selected.</main>;
  }

  return (
    <main>
      <div className="page-header">
        <p className="eyebrow">InfoSync Admin</p>
        <h1>Start subscription</h1>
        <p>Select a pricing plan and start Stripe Checkout.</p>
      </div>

      <section className="card">
        <h2>{customer?.name || "Loading customer..."}</h2>
        <p>{customer?.email || "No email"}</p>
      </section>

      <div className="grid two-columns">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlanCode(plan.code)}
            className={`card text-left ${
              selectedPlanCode === plan.code ? "ring-2 ring-cyan-400" : ""
            }`}
          >
            <h2>
              {plan.name} ({plan.resolution})
            </h2>
            <p>Setup fee: {plan.setup_fee_sek.toLocaleString("sv-SE")} SEK</p>
            <p>Hardware: {plan.hardware_fee_sek.toLocaleString("sv-SE")} SEK</p>
            <p>Shipping: {plan.shipping_fee_sek.toLocaleString("sv-SE")} SEK</p>
            <p>Monthly: {plan.monthly_fee_sek.toLocaleString("sv-SE")} SEK</p>
            <p>Trial: {plan.trial_days} days</p>
          </button>
        ))}
      </div>

      <section className="card">
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={legalAccepted}
            onChange={(event) => setLegalAccepted(event.target.checked)}
          />
          <span>
            I accept that setup starts immediately. The setup fee becomes
            non-refundable once setup work starts. Hardware follows the 14-day
            return right.
          </span>
        </label>

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          className="mt-6 rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Starting checkout..." : "Start Stripe checkout"}
        </button>
      </section>
    </main>
  );
}
