"use client";

import Link from "next/link";

type LegalDocumentActionsProps = {
  pdfUrl?: string | null;
};

export default function LegalDocumentActions({ pdfUrl }: LegalDocumentActionsProps) {
  return (
    <div className="account-actions">
      {pdfUrl ? (
        <a href={pdfUrl} className="landing-button landing-button-secondary">
          Öppna PDF
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => window.print()}
        className="landing-button landing-button-secondary"
      >
        Skriv ut eller spara som PDF
      </button>
      <Link href="/" className="landing-button landing-button-primary">
        Till startsidan
      </Link>
    </div>
  );
}
