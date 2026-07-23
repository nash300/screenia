"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseBrowserConfigured, supabase } from "@/lib/supabase/client";
import ScreeniaLogo from "@/components/ScreeniaLogo";

const missingSupabaseMessage =
  "Supabase saknas i lokal miljö. Lägg till NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local och starta om servern.";
const isGoogleAuthEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const urlMessage = new URLSearchParams(window.location.search).get("message");
    if (urlMessage) setMessage(urlMessage);
  }, []);

  const submit = async () => {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, mode: "customer" }),
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

    router.push(result.next || "/account");
    router.refresh();
  };

  const signInWithGoogle = async () => {
    if (!isGoogleAuthEnabled) {
      setMessage("Google-inloggning är snart klar. Använd e-post och lösenord under tiden.");
      return;
    }

    setGoogleLoading(true);
    setMessage("");

    if (!isSupabaseBrowserConfigured) {
      setMessage(missingSupabaseMessage);
      setGoogleLoading(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/account&provider=google`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setMessage(result.error || "Det gick inte att skicka återställningslänken.");
    } else {
      setMessage(
        result.message ||
          "Om e-postadressen finns hos Screenia skickar vi en återställningslänk.",
      );
    }

    setResetLoading(false);
  };

  return (
    <main className="screenia-auth-shell">
      <div className="screenia-auth-bg" />

      <div className="screenia-auth-layout">
        <section className="screenia-auth-hero screenia-auth-hero-hidden-mobile">
          <Link href="/" className="screenia-auth-logo-link">
            <ScreeniaLogo className="screenia-logo-auth-card" />
          </Link>

          <p className="screenia-auth-hero-kicker">
            Säker inloggning
          </p>
          <h1 className="screenia-auth-hero-title">
            En inloggning för order, innehåll och support.
          </h1>
        </section>

        <section className="screenia-auth-card-wrap">
          <div className="screenia-auth-card">
            <Link href="/" className="screenia-auth-logo-link screenia-auth-logo-link-mobile">
              <ScreeniaLogo className="screenia-logo-auth-inline" />
            </Link>

            <p className="screenia-auth-card-kicker screenia-auth-card-kicker-responsive">
              Screenia kundportal
            </p>

            <div className="screenia-auth-form-stack">
              <label className="screenia-auth-field">
                <span className="screenia-auth-label">
                  E-post
                </span>
                <input
                  type="email"
                  placeholder="namn@foretag.se"
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

            <div className="screenia-auth-actions">
              <button
                type="button"
                onClick={submit}
                disabled={loading || !email || !password}
                className="screenia-auth-button screenia-auth-button-full"
              >
                <span>{loading ? "Kontrollerar..." : "Logga in"}</span>
                <span className="screenia-auth-button-icon">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M10 7 8.6 8.4l2.6 2.6H3v2h8.2l-2.6 2.6L10 17l5-5-5-5Z" />
                    <path d="M13 4h5v16h-5v-2h3V6h-3V4Z" />
                  </svg>
                </span>
              </button>

              <div className="screenia-auth-divider">
                <span />
                eller
                <span />
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={googleLoading || !isGoogleAuthEnabled}
                className="screenia-auth-secondary-button"
              >
                <span
                  aria-hidden="true"
                  role="presentation"
                  className="screenia-auth-provider-mark"
                >
                  G
                </span>
                {googleLoading
                  ? "Öppnar Google..."
                  : isGoogleAuthEnabled
                    ? "Fortsätt med Google"
                    : "Google-inloggning kommer snart"}
              </button>

              <p className="screenia-auth-helper">
                {isGoogleAuthEnabled
                  ? "Google fungerar bara om e-postadressen redan hör till ett betalt Screenia-konto."
                  : "Google aktiveras när Google Cloud och Supabase OAuth är färdigkonfigurerade."}
              </p>
            </div>

            <div className="screenia-auth-link-row">
              <button
                type="button"
                onClick={sendResetEmail}
                disabled={resetLoading || !email}
                className="screenia-auth-link-button"
              >
                {resetLoading ? "Skickar..." : "Glömt lösenord?"}
              </button>
              <Link href="/" className="screenia-auth-link">
                Till startsidan
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
