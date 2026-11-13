"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ScreeniaLogo from "@/components/ScreeniaLogo";
import ScreeniaPortalGraphic from "@/components/ScreeniaPortalGraphic";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const submit = async () => {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, mode: "admin" }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      next?: string;
    };

    if (!response.ok) {
      setMessage(result.error || "E-post eller lösenord är fel.");
      setLoading(false);
      return;
    }

    router.push(result.next || "/admin");
    router.refresh();
  };

  const sendResetEmail = async () => {
    if (!email) {
      setMessage("Skriv din e-postadress först.");
      return;
    }

    setResetLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mode: "admin" }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };

    setMessage(
      response.ok
        ? result.message || "Om e-postadressen finns skickar vi en återställningslänk."
        : result.error || "Det gick inte att skicka återställningslänken.",
    );
    setResetLoading(false);
  };

  return (
    <main className="screenia-auth-shell screenia-admin-login">
      <div className="screenia-admin-login-frame">
        <section className="screenia-admin-login-overview">
          <Link href="/" className="screenia-admin-login-logo">
            <ScreeniaLogo />
          </Link>

          <div className="screenia-admin-login-overview-copy">
            <p className="screenia-admin-login-status">
              <span aria-hidden="true" />
              Intern åtkomst
            </p>
            <p className="screenia-admin-login-kicker">Screenia administration</p>
            <h1>Driftpanelen för hela kundresan.</h1>
            <p>
              Följ beställningar, betalningar, innehåll och enheter från en
              samlad och spårbar arbetsyta.
            </p>

            <ul className="screenia-admin-login-capabilities">
              <li>
                <span aria-hidden="true">01</span>
                <strong>Kund- och orderflöden</strong>
              </li>
              <li>
                <span aria-hidden="true">02</span>
                <strong>Betalning och leverans</strong>
              </li>
              <li>
                <span aria-hidden="true">03</span>
                <strong>Innehåll och enheter</strong>
              </li>
            </ul>
          </div>

          <ScreeniaPortalGraphic className="screenia-admin-login-graphic" label="Screenia operations dashboard illustration" />

          <p className="screenia-admin-login-restricted">
            Endast för behörig Screenia-personal
          </p>
        </section>

        <section className="screenia-admin-login-form-panel">
          <div className="screenia-admin-login-form-heading">
            <p>Säker administratörsinloggning</p>
            <h2>Logga in</h2>
            <span>
              Använd ditt personliga administratörskonto. Kundkonton fungerar
              inte här.
            </span>
          </div>

          <div className="screenia-admin-login-form">
            <label className="screenia-auth-field">
              <span className="screenia-auth-label">E-post</span>
              <input
                type="email"
                placeholder="admin@screenia.se"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="screenia-auth-input"
              />
            </label>

            <label className="screenia-auth-field">
              <span className="screenia-auth-label">Lösenord</span>
              <input
                type="password"
                placeholder="Ditt lösenord"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && email && password && !loading) {
                    submit();
                  }
                }}
                className="screenia-auth-input"
              />
            </label>

            {message && <p className="screenia-auth-alert">{message}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={loading || !email || !password}
              className="screenia-auth-button screenia-admin-login-submit"
            >
              <span>{loading ? "Kontrollerar..." : "Logga in som admin"}</span>
              <span className="screenia-admin-login-submit-icon" aria-hidden="true">
                →
              </span>
            </button>
          </div>

          <div className="screenia-admin-login-links">
            <button
              type="button"
              onClick={sendResetEmail}
              disabled={resetLoading || !email}
              className="screenia-auth-link-button"
            >
              {resetLoading ? "Skickar..." : "Glömt lösenord?"}
            </button>
            <Link href="/login" className="screenia-auth-link">
              Kundinloggning
            </Link>
          </div>

          <p className="screenia-admin-login-security">
            <span aria-hidden="true">✓</span>
            Krypterad anslutning och individuellt administratörskonto
          </p>
        </section>
      </div>
    </main>
  );
}
