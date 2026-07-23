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
            Each tested scenario will add one short entry here: admin action,
            when to use it, click path, evidence to check, and follow-up.
          </p>
        </div>
        <div className="admin-training-empty-note">
          <strong>No tested procedures recorded yet.</strong>
          <span>Run the first realistic scenario, then add its compact procedure.</span>
        </div>
      </section>
    </div>
  );
}
