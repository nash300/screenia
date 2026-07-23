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
      </section>
    </div>
  );
}
