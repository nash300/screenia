"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LandingNav } from "@/components/LandingNav";
import ScreeniaLogo from "@/components/ScreeniaLogo";

type SubmitResult = {
  success?: boolean;
  caseNumber?: string;
  confirmationEmailSent?: boolean;
  error?: string;
};

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(true);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/contact-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          companyName,
          subject,
          message,
          privacyAccepted,
          website: "",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as SubmitResult;

      if (!response.ok || !result.success) {
        setError(result.error || "Meddelandet kunde inte skickas. Försök igen.");
        return;
      }

      setCaseNumber(result.caseNumber || "");
      setConfirmationEmailSent(result.confirmationEmailSent !== false);
      setName("");
      setEmail("");
      setCompanyName("");
      setSubject("");
      setMessage("");
      setPrivacyAccepted(false);
    } catch {
      setError("Meddelandet kunde inte skickas. Kontrollera anslutningen och försök igen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing-page contact-page">
      <LandingNav currentPath="/kontakt" />

      <main className="contact-main">
        <section className="contact-intro" aria-labelledby="contact-title">
          <div className="contact-intro-copy">
            <p className="landing-eyebrow">Kontakt</p>
            <h1 id="contact-title">Vad vill du veta?</h1>
            <p>
              Berätta vad du funderar på så återkommer Screenia till den
              e-postadress du anger. Du får en bekräftelse med din fråga och ett
              ärendenummer direkt efter att formuläret skickats.
            </p>

            <div className="contact-process" aria-label="Så hanteras din fråga">
              <div>
                <span>01</span>
                <p><strong>Du skriver</strong><small>Frågan sparas säkert med tidpunkt.</small></p>
              </div>
              <div>
                <span>02</span>
                <p><strong>Vi läser</strong><small>Admin får avisering och hela underlaget.</small></p>
              </div>
              <div>
                <span>03</span>
                <p><strong>Du får svar</strong><small>Vårt svar och din fråga visas i samma mejl.</small></p>
              </div>
            </div>

            <div className="contact-direct">
              <span>Föredrar du vanlig e-post?</span>
              <a href="mailto:service@screenia.se">service@screenia.se</a>
            </div>
          </div>

          <div className="contact-form-wrap">
            {caseNumber ? (
              <div className="contact-success" role="status">
                <span className="contact-success-mark" aria-hidden="true">✓</span>
                <p className="landing-eyebrow">Meddelandet är mottaget</p>
                <h2>Tack, vi återkommer via e-post.</h2>
                <p>
                  Ditt ärendenummer är <strong>{caseNumber}</strong>. Spara det om
                  du behöver hänvisa till frågan senare.
                </p>
                <p className="contact-success-note">
                  {confirmationEmailSent
                    ? "En bekräftelse med din ursprungliga fråga har skickats till din e-postadress."
                    : "Ärendet är sparat, men bekräftelsemejlet kunde inte skickas. Screenia har fått en intern varning och följer upp manuellt."}
                </p>
                <div className="contact-success-actions">
                  <button
                    type="button"
                    className="landing-button landing-button-secondary"
                    onClick={() => setCaseNumber("")}
                  >
                    Skicka en ny fråga
                  </button>
                  <Link href="/" className="landing-button landing-button-primary">
                    Till startsidan
                  </Link>
                </div>
              </div>
            ) : (
              <form className="contact-form" onSubmit={submit} noValidate>
                <div className="contact-form-heading">
                  <p className="landing-eyebrow">Skriv till oss</p>
                  <h2>Hur kan vi hjälpa dig?</h2>
                  <p>Fält markerade med * måste fyllas i.</p>
                </div>

                <div className="contact-form-grid">
                  <label>
                    <span>Namn *</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      minLength={2}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    <span>E-post *</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  </label>
                  <label className="contact-form-wide">
                    <span>Företag <small>(valfritt)</small></span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      autoComplete="organization"
                      maxLength={160}
                    />
                  </label>
                  <label className="contact-form-wide">
                    <span>Ämne *</span>
                    <input
                      type="text"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Till exempel paket, installation eller innehåll"
                      minLength={3}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label className="contact-form-wide">
                    <span>Din fråga *</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Beskriv vad du vill ha hjälp med. Undvik känsliga personuppgifter."
                      minLength={10}
                      maxLength={4000}
                      rows={7}
                      required
                    />
                    <small>{message.length}/4 000 tecken</small>
                  </label>
                </div>

                <label className="contact-privacy">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                    required
                  />
                  <span>
                    Jag har läst Screenias <Link href="/privacy">integritetspolicy</Link>{" "}
                    och godkänner att uppgifterna används för att hantera min fråga.
                  </span>
                </label>

                {error && <p className="contact-form-error" role="alert">{error}</p>}

                <button
                  type="submit"
                  className="landing-button landing-button-primary contact-submit"
                  disabled={submitting}
                >
                  {submitting ? "Skickar…" : "Skicka fråga"}
                </button>
                <p className="contact-form-footnote">
                  Vi använder din e-post endast för att hantera detta ärende.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="contact-footer">
        <Link href="/" aria-label="Screenia startsida">
          <ScreeniaLogo className="screenia-logo-footer" />
        </Link>
        <p>Digital skyltning, tydligt hanterad.</p>
        <nav aria-label="Kontakt sidfot">
          <Link href="/privacy">Integritet</Link>
          <Link href="/terms">Villkor</Link>
          <Link href="/login">Kundinloggning</Link>
        </nav>
      </footer>
    </div>
  );
}
