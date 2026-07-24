export default function AdminTrainingPage() {
  return (
    <div className="admin-training-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">Screenia learning</p>
          <h1 className="admin-title">Training catalog</h1>
          <p className="admin-subtitle">
            Compact admin procedures collected from realistic customer testing.
          </p>
        </div>
      </header>

      <section className="admin-training-panel admin-card" aria-label="Training catalog format">
        <div>
          <h2 className="admin-card-title">Scenario playbook</h2>
          <p className="admin-muted">
            Tested procedures are added here as compact references for daily
            admin work.
          </p>
        </div>
        <article className="admin-training-entry">
          <div>
            <p className="admin-operation-kicker">Customer order</p>
            <h3>Restaurant orders 2 Premium 4K and 1 Standard FHD screen</h3>
          </div>
          <p>
            Use when a small business needs mixed screen types in one order.
            Confirm the quote shows three paid slots, one setup fee, shipping
            for up to three devices, and a combined monthly subscription.
          </p>
          <p>
            Click path: landing pricing form, customer request, admin customer
            profile, Request & quote, onboarding link, Stripe Checkout, customer
            password setup, customer content setup, Device allocation, display
            previews.
          </p>
          <p>
            Evidence: customer row with mixed quote items, privacy and terms
            timestamps, Stripe paid invoice, trialing subscription, password
            setup route, three active display endpoints, playlist item per
            endpoint, and visible `/display/[code]` playback.
          </p>
          <p>
            Useful notes: customer billing should say `1 x Standard FHD + 2 x
            Premium 4K`, not only the first package. If display media is an
            image, apply the storage MIME migration before live use.
          </p>
        </article>
        <article className="admin-training-entry">
          <div>
            <p className="admin-operation-kicker">Customer order</p>
            <h3>Restaurant orders 1 Premium 4K and 4 Standard FHD screens</h3>
          </div>
          <p>
            Use when a customer combines several screen types and exceeds the
            three-screen setup and shipping thresholds. Confirm Stripe, customer
            billing, and admin quote preview all show the same first payment.
          </p>
          <p>
            Click path: landing pricing form, admin Customer work, customer
            profile, Request & quote, Gmail quote check, onboarding link, Stripe
            Checkout, Gmail activation email, customer password setup, customer
            portal, Device allocation, display endpoint.
          </p>
          <p>
            Evidence: order with `4 x Standard FHD + 1 x Premium 4K`, first
            payment `6 149 kr`, monthly price `1 345 kr`, setup `2 097 kr`,
            shipping `157 kr`, included VAT `1 229,80 kr`, paid Stripe
            subscription, activated customer account, five display endpoints,
            and visible `/display/[code]` media playback.
          </p>
          <p>
            Useful notes: mixed-package emails and pages must not collapse the
            order into the first package. If an existing paid subscription is
            being viewed, the admin preview should use stored paid totals rather
            than recalculating the quote as a new add-on. Retest confirmed the
            admin order totals must show aggregate device and monthly totals,
            and display endpoint creation must send a UUID for the live devices
            row.
          </p>
        </article>
        <article className="admin-training-entry">
          <div>
            <p className="admin-operation-kicker">Customer order</p>
            <h3>Business orders 10 Standard FHD screens</h3>
          </div>
          <p>
            Use when a customer needs many similar screens and the order passes
            the included three-screen setup and shipping limits.
          </p>
          <p>
            Click path: landing pricing form, choose 10 Standard FHD screens,
            send request, admin Customer work, Request & quote, prepare quote,
            onboarding link, Stripe Checkout.
          </p>
          <p>
            Evidence: 10 screens, setup `3 342 kr`, devices `6 990 kr`,
            shipping `302 kr`, first payment `10 634 kr`, monthly `2 490 kr`,
            included VAT `2 126,80 kr`, paid Stripe subscription, and active
            customer service access.
          </p>
        </article>
        <article className="admin-training-entry">
          <div>
            <p className="admin-operation-kicker">Billing control</p>
            <h3>Test monthly billing with Stripe Test Clock</h3>
          </div>
          <p>
            Use before launch and after pricing changes to confirm that a paid
            customer is not billed during the trial, is billed correctly when
            the trial ends, continues on the monthly cycle, and stops after
            cancellation.
          </p>
          <p>
            Click path: landing pricing form, admin Customer work, Request &
            quote, onboarding link, Stripe Checkout, Stripe Test Clock, admin
            customer profile, Orders & billing.
          </p>
          <p>
            Evidence: first invoice contains setup, device, and shipping; the
            subscription starts as trialing for 21 days; each monthly invoice
            uses the selected plan price with inclusive Swedish VAT; the admin
            page syncs payment and access state; cancellation changes access to
            cancelled and no later invoice is created.
          </p>
        </article>
      </section>
    </div>
  );
}
