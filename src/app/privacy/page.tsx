"use client";

import Link from "next/link";
import { CURRENT_PRIVACY_DOCUMENT } from "@/lib/legal/documents";
import "../landing.css";

export default function PrivacyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>{CURRENT_PRIVACY_DOCUMENT.title}</h1>
        <p>{CURRENT_PRIVACY_DOCUMENT.summary}</p>

        <section className="flow-card">
          <h2>Version</h2>
          <p>{CURRENT_PRIVACY_DOCUMENT.version}</p>
          <p>Gäller från: {CURRENT_PRIVACY_DOCUMENT.effectiveDate}</p>
        </section>

        <section className="flow-card">
          <h2>Dokumenttext</h2>
          <p>{CURRENT_PRIVACY_DOCUMENT.content}</p>
        </section>

        <section className="flow-card">
          <h2>Personuppgiftsbiträden</h2>
          <p>
            Screenia använder endast leverantörer som behövs för att driva
            tjänsten: Supabase för databas, inloggning och lagring, Stripe för
            betalningar och fakturor, Resend och Supabase för transaktionella
            e-postmeddelanden, Vercel för drift och hosting samt Loopia för
            domän och e-posttjänster. Screenia ska kontrollera
            personuppgiftsbiträdesvillkor, åtkomst och säkerhetsinställningar
            innan livekunder tas emot.
          </p>
        </section>

        <div className="account-actions">
          <a
            href={CURRENT_PRIVACY_DOCUMENT.pdfUrl}
            className="landing-button landing-button-secondary"
          >
            Öppna PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="landing-button landing-button-secondary"
          >
            Skriv ut / spara som PDF
          </button>
          <Link href="/" className="landing-button landing-button-primary">
            Till startsidan
          </Link>
        </div>
      </main>
    </div>
  );
}
