import Link from "next/link";
import "../landing.css";

export default function CookiePolicyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>Cookie Policy</h1>
        <p>
          Den fullständiga cookiepolicyn läggs in här när dokumentet är klart.
          Tills vidare använder InfoSync endast nödvändiga tekniska funktioner
          för att webbplatsen och kundflödet ska fungera.
        </p>

        <section className="flow-card">
          <h2>Status</h2>
          <p>Dokumentet är under förberedelse.</p>
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
