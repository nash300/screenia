import Link from "next/link";
import "../landing.css";

export default function SubscriptionBillingPolicyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>Subscription & Billing Policy</h1>
        <p>
          This pre-launch policy describes how Screenia handles test-mode
          billing, subscription access, cancellations, pauses, VAT-ready
          records, and refunds before live launch.
        </p>

        <section className="flow-card">
          <h2>Pre-launch payment boundary</h2>
          <p>
            Screenia may use real domain email and production-like customer
            flows during testing, but live Stripe payments stay blocked until
            business registration, F/FA-skatt, VAT decision, final legal review,
            and launch checks are complete.
          </p>
        </section>

        <section className="flow-card">
          <h2>Subscriptions and display access</h2>
          <p>
            Stripe is the billing source of truth. Screenia stores synced
            entitlement state so customer portals, admin actions, and display
            devices can decide whether content may be shown. Active paid
            customers can display content. Paused, failed-payment, refunded,
            disputed, cancelled, expired, or inactive customers are blocked
            from display.
          </p>
        </section>

        <section className="flow-card">
          <h2>Cancellation and refunds</h2>
          <p>
            Customer cancellation is scheduled for the end of the paid period by
            default, so service continues until the paid-through date. Immediate
            cancellation is an admin exception. Setup-fee refunds are allowed
            only before layout/production work starts unless Screenia approves a
            manual exception.
          </p>
        </section>

        <section className="flow-card">
          <h2>VAT and records</h2>
          <p>
            Prices, Stripe checkout totals, order records, discounts, refunds,
            and subscription state must stay VAT-ready and auditable. Test-mode
            payments must be clearly separated from live accounting records.
          </p>
        </section>

        <div className="account-actions">
          <Link href="/" className="landing-button landing-button-primary">
            Till startsidan
          </Link>
        </div>
      </main>
    </div>
  );
}
