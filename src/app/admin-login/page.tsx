"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ScreeniaLogo from "@/components/ScreeniaLogo";

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
    <main className="screenia-auth-shell">
      <div className="screenia-auth-bg" />
      <div className="screenia-auth-layout screenia-auth-layout-admin">
        <section className="screenia-auth-hero">
          <Link href="/" className="screenia-auth-logo-link">
            <ScreeniaLogo className="screenia-logo-auth-card" />
          </Link>
          <p className="screenia-auth-hero-kicker">
            Admin
          </p>
          <h1 className="screenia-auth-hero-title">
            Säker åtkomst till driftpanelen.
          </h1>
          <p className="screenia-auth-hero-copy">
            Använd ditt personliga administratörskonto. Kundkonton fungerar
            inte här.
          </p>
        </section>

        <section className="screenia-auth-card">
          <p className="screenia-auth-card-kicker screenia-auth-card-kicker-flush">
            Screenia admin
          </p>

          <div className="screenia-auth-form-stack">
            <label className="screenia-auth-field">
              <span className="screenia-auth-label">
                E-post
              </span>
              <input
                type="email"
                placeholder="admin@screenia.se"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="screenia-auth-input"
              />
            </label>

            <label className="screenia-auth-field">
              <span className="screenia-auth-label">
                Lösenord
              </span>
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
          </div>

          {message && (
            <p className="screenia-auth-alert">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={loading || !email || !password}
            className="screenia-auth-button screenia-auth-button-admin"
          >
            {loading ? "Kontrollerar..." : "Logga in som admin"}
          </button>

          <div className="screenia-auth-link-row screenia-auth-link-row-admin">
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
        </section>
      </div>
    </main>
  );
}
