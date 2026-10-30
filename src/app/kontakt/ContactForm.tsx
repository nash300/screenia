"use client";

import Image from "next/image";
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
  const publicContactEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@screenia.se";
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
            <div className="contact-intro-image">
              <Image
                src="/images/screenia-support.jpg"
                alt="Kundservice med headset vid en laptop"
                fill
                sizes="(max-width: 900px) 90vw, 34vw"
                priority
              />
              <span>Personlig hjälp när ni behöver den</span>
            </div>
            <h1 id="contact-title">Kontakta oss om er skärmlösning</h1>
            <p>
              Har ni frågor om paket, innehåll eller hur Screenia fungerar?
              Skicka ett meddelande så återkommer vi via e-post.
            </p>

            <div className="contact-channel">
              <span className="contact-channel-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <span>Föredrar ni vanlig e-post?</span>
                <a href={`mailto:${publicContactEmail}`}>{publicContactEmail}</a>
                <small>Vi hjälper gärna till med frågor om tjänsten och nästa steg.</small>
              </div>
            </div>

            <div className="contact-response-note">
              <span aria-hidden="true">✓</span>
              <span>Din fråga hanteras av Screenia kundservice.</span>
            </div>
          </div>

          <div className="contact-form-wrap">
            {caseNumber ? (
              <div className="contact-success" role="status">
                <span className="contact-success-mark" aria-hidden="true">✓</span>
                <p className="landing-eyebrow">Meddelandet är mottaget</p>
                <h2>Tack, vi återkommer via e-post.</h2>
                <p>
                  Ärendenumret är <strong>{caseNumber}</strong>. Numret kan användas
                  vid fortsatt kontakt om ärendet.
                </p>
                <p className="contact-success-note">
                  {confirmationEmailSent
                    ? "En bekräftelse med den ursprungliga frågan har skickats till angiven e-postadress."
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
                  <p className="landing-eyebrow">Skicka meddelande</p>
                  <h2>Hur kan vi hjälpa er?</h2>
                  <p>Fyll i formuläret så återkommer vi till din e-postadress. <span>* Obligatoriska fält</span></p>
                </div>

                <div className="contact-form-grid">
                  <label htmlFor="contact-name">
                    <span>Namn *</span>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      minLength={2}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label htmlFor="contact-email">
                    <span>E-post *</span>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  </label>
                  <label className="contact-form-wide" htmlFor="contact-company">
                    <span>Företag <small>(valfritt)</small></span>
                    <input
                      id="contact-company"
                      name="companyName"
                      type="text"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      autoComplete="organization"
                      maxLength={160}
                    />
                  </label>
                  <label className="contact-form-wide" htmlFor="contact-subject">
                    <span>Ämne *</span>
                    <input
                      id="contact-subject"
                      name="subject"
                      type="text"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Till exempel paket, installation eller innehåll"
                      minLength={3}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label className="contact-form-wide" htmlFor="contact-message">
                    <span>Fråga *</span>
                    <textarea
                      id="contact-message"
                      name="message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Beskriv vad ni behöver hjälp med. Ange inte känsliga personuppgifter."
                      minLength={10}
                      maxLength={4000}
                      rows={6}
                      required
                    />
                    <small>{message.length}/4 000 tecken</small>
                  </label>
                </div>

                <label className="contact-privacy" htmlFor="contact-privacy">
                  <input
                    id="contact-privacy"
                    name="privacyAccepted"
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
                  {submitting ? "Skickar…" : "Skicka meddelande"}
                </button>
                <p className="contact-form-footnote">
                  Din e-postadress används endast för att hantera din fråga.
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
          <a
            className="contact-footer-social"
            href="https://www.facebook.com/profile.php?id=61595866048813"
            target="_blank"
            rel="noreferrer"
            aria-label="Följ Screenia på Facebook"
          >
            <span className="contact-footer-social-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="12" r="12" />
                <path d="M13.65 7.1h1.7V4.95c-.3-.04-1.25-.12-2.4-.12-2.38 0-4 1.45-4 4.08v1.7H6.4v2.55h2.55v5.95h3.05v-5.95h2.35l.4-2.55H12v-1.48c0-.74.2-2.03 1.65-2.03Z" />
              </svg>
            </span>
            <span>Facebook</span>
          </a>
        </nav>
      </footer>
    </div>
  );
}
