import Link from "next/link";
import "../landing.css";

export default function SupportServicePolicyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>Support & Service Policy</h1>
        <p>
          Screenia provides managed onboarding, display setup, content handling,
          and support for customer screens. This pre-launch policy defines the
          safe operating rules used during testing and launch preparation.
        </p>

        <section className="flow-card">
          <h2>Support channels</h2>
          <p>
            Customers should use Screenia support email or the customer portal
            for questions, content updates, delivery issues, cancellation help,
            privacy requests, and billing questions. Support events should be
            recorded in the admin history when they affect orders, access, or
            customer obligations.
          </p>
        </section>

        <section className="flow-card">
          <h2>Remote support and content</h2>
          <p>
            Remote support is provided only when requested or consented to by
            the customer. Customer-provided logos, images, text, campaigns, and
            display instructions are used only to deliver the Screenia service
            and must be handled as customer business data.
          </p>
        </section>

        <section className="flow-card">
          <h2>Operational safety</h2>
          <p>
            Admin changes that affect production work, refunds, subscription
            access, display entitlement, customer deletion, or billing must go
            through server-side actions and write audit history.
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
