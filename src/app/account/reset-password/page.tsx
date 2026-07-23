"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  syncCurrentSession,
  syncEmailLinkSession,
} from "@/lib/supabase/sync-browser-session";
import ScreeniaLogo from "@/components/ScreeniaLogo";
import {
  adminPasswordPolicyDescription,
  passwordPolicyDescription,
  validateAdminPasswordPolicy,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAdminMode(new URLSearchParams(window.location.search).get("mode") === "admin");

    syncEmailLinkSession().then((result) => {
      if (cancelled) return;
      setSessionReady(result.ready);
      setMessage(result.error || "");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const savePassword = async () => {
    if (!sessionReady) {
      setMessage("Verifierar återställningslänken. Försök igen om några sekunder.");
      return;
    }

    const passwordValid = adminMode
      ? validateAdminPasswordPolicy(password)
      : validatePasswordPolicy(password);
    if (!passwordValid) {
      setMessage(
        adminMode ? adminPasswordPolicyDescription : passwordPolicyDescription,
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Lösenorden matchar inte.");
      return;
    }

    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await syncCurrentSession();
    router.replace(adminMode ? "/admin" : "/account");
    router.refresh();
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
            {adminMode ? "Admin" : "Kundportal"}
          </p>
          <h1 className="screenia-auth-hero-title">
            Återställ lösenordet och fortsätt till {adminMode ? "driftpanelen" : "dashboarden"}.
          </h1>
        </section>

        <section className="screenia-auth-card-wrap">
          <div className="screenia-auth-card">
            <Link href="/" className="screenia-auth-logo-link screenia-auth-logo-link-mobile">
              <ScreeniaLogo className="screenia-logo-auth-inline" />
            </Link>
            <p className="screenia-auth-card-kicker screenia-auth-card-kicker-responsive">
              Nytt lösenord
            </p>
            <h1 className="screenia-auth-card-title">
              Välj nytt lösenord
            </h1>
            <p className="screenia-auth-card-copy">
              Ange ett nytt lösenord för ditt Screenia-{adminMode ? "administratörskonto" : "konto"}.
            </p>

            <div className="screenia-auth-form-stack screenia-auth-form-stack-compact">
              <label className="screenia-auth-field">
                <span className="screenia-auth-label">
                  Nytt lösenord
                </span>
                <input
                  type="password"
                  placeholder={
                    adminMode
                      ? "Minst 12 tecken, bokstäver, siffror och specialtecken"
                      : "Minst 6 tecken, bokstäver och siffror"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="screenia-auth-input"
                />
              </label>
              <label className="screenia-auth-field">
                <span className="screenia-auth-label">
                  Bekräfta lösenord
                </span>
                <input
                  type="password"
                  placeholder="Skriv lösenordet igen"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !loading) savePassword();
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
              onClick={savePassword}
              disabled={loading || !sessionReady || !password || !confirmPassword}
              className="screenia-auth-button screenia-auth-button-spaced"
            >
              {loading ? "Sparar..." : "Spara lösenord"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
