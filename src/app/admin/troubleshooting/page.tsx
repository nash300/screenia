import Link from "next/link";

export default function AdminTroubleshootingPage() {
  return (
    <div className="admin-troubleshooting-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">System support</p>
          <h1 className="admin-title">Troubleshooting</h1>
          <p className="admin-subtitle">
            Open diagnostic tools only when an operational problem needs investigation.
          </p>
        </div>
      </header>

      <section className="admin-tool-list" aria-label="Troubleshooting tools">
        <article className="admin-tool-row">
          <span className="admin-tool-icon" aria-hidden="true">EM</span>
          <div>
            <h2>Email delivery evidence</h2>
            <p>
              Check whether a customer message was sent, delivered, delayed, bounced,
              rejected, or reported as spam.
            </p>
          </div>
          <Link href="/admin/email-events" className="admin-button-secondary">
            Open email evidence
          </Link>
        </article>
      </section>
    </div>
  );
}
