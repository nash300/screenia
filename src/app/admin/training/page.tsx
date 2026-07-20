export default function AdminTrainingPage() {
  return (
    <div className="admin-training-empty">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">Screenia learning</p>
          <h1 className="admin-title">Training catalog</h1>
          <p className="admin-subtitle">
            This workspace is reserved for future training material.
          </p>
        </div>
      </header>

      <section className="admin-empty-state" aria-label="Empty training catalog">
        <span className="admin-empty-state-icon" aria-hidden="true">TR</span>
        <h2>No training content yet</h2>
        <p>Lessons and reference material will be added here later.</p>
      </section>
    </div>
  );
}
