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
