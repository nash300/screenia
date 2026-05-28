"use client";

import { PRICING_PLANS } from "@/lib/pricing/plans";

export default function PricingPage() {
  return (
    <main>
      <div className="page-header">
        <p className="eyebrow">InfoSync Admin</p>
        <h1>Pricing</h1>
        <p>
          Manage setup fees, device fees, shipping, monthly subscriptions, trial
          rules, and legal billing rules.
        </p>
      </div>

      <div className="grid two-columns">
        {PRICING_PLANS.map((plan) => (
          <section key={plan.code} className="card">
            <h2>
              {plan.name} ({plan.resolution})
            </h2>

            <p>
              <strong>Setup fee:</strong>{" "}
              {plan.setupFeeSek.toLocaleString("sv-SE")} SEK
            </p>

            <p>
              <strong>Hardware:</strong>{" "}
              {plan.hardwareFeeSek.toLocaleString("sv-SE")} SEK
            </p>

            <p>
              <strong>Shipping:</strong>{" "}
              {plan.shippingFeeSek.toLocaleString("sv-SE")} SEK
            </p>

            <p>
              <strong>Monthly subscription:</strong>{" "}
              {plan.monthlyFeeSek.toLocaleString("sv-SE")} SEK
            </p>

            <p>
              <strong>Trial:</strong> {plan.trialDays} days
            </p>

            <p>
              <strong>Binding:</strong> {plan.binding}
            </p>

            <hr />

            <p>
              <strong>Setup fee:</strong> Service starts immediately and becomes
              non-refundable once setup work starts.
            </p>

            <p>
              <strong>Hardware:</strong> Customer has 14-day return right.
              Customer pays return shipping and hardware must be returned in
              good condition.
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
