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
  passwordPolicyDescription,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";

export default function ActivateAccountPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get("error")) {
      setLinkInvalid(true);
      setMessage(
        "Kontolänken är ogiltig, har redan använts eller har gått ut. Begär en ny säker länk för att fortsätta.",
      );
      return () => {
        cancelled = true;
      };
    }

    syncEmailLinkSession().then((result) => {
      if (cancelled) return;
      setSessionReady(result.ready);
      setLinkInvalid(!result.ready && Boolean(result.error));
      setMessage(result.error || "");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const activate = async () => {
    if (!sessionReady) {
      setMessage("Verifierar kontolänken. Försök igen om några sekunder.");
      return;
    }

    if (!validatePasswordPolicy(password)) {
      setMessage(passwordPolicyDescription);
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
    router.replace("/account");
    router.refresh();
  };

  return (
    <AuthShell eyebrow="Aktivera kundkonto" title="Välj ditt lösenord">
      <p className="screenia-auth-card-copy">
        Din betalning är klar och ditt Screenia-konto är skapat. Välj ett
        lösenord för att aktivera kundportalen.
      </p>

      {linkInvalid ? (
        <>
          {message && <Alert>{message}</Alert>}
          <Link
            href="/login"
            className="screenia-auth-button screenia-auth-button-spaced"
          >
            Begär en ny kontolänk
          </Link>
        </>
      ) : (
        <>
          <PasswordFields
            password={password}
            confirmPassword={confirmPassword}
            onPassword={setPassword}
            onConfirmPassword={setConfirmPassword}
            onEnter={() => {
              if (!loading && password && confirmPassword) activate();
            }}
          />

          {message && <Alert>{message}</Alert>}

          <button
            type="button"
            onClick={activate}
            disabled={loading || !sessionReady || !password || !confirmPassword}
            className="screenia-auth-button screenia-auth-button-spaced"
          >
            {loading ? "Aktiverar..." : "Aktivera konto"}
          </button>
        </>
      )}
    </AuthShell>
  );
}

function PasswordFields({
  password,
  confirmPassword,
  onPassword,
  onConfirmPassword,
  onEnter,
}: {
  password: string;
  confirmPassword: string;
  onPassword: (value: string) => void;
  onConfirmPassword: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="screenia-auth-form-stack screenia-auth-form-stack-compact">
      <label className="screenia-auth-field">
        <span className="screenia-auth-label">
          Nytt lösenord
        </span>
        <input
          type="password"
          placeholder="Minst 6 tecken, bokstäver och siffror"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onEnter();
          }}
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
          onChange={(event) => onConfirmPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onEnter();
          }}
          className="screenia-auth-input"
        />
      </label>
    </div>
  );
}

function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="screenia-auth-shell">
      <div className="screenia-auth-bg" />
      <div className="screenia-auth-layout">
        <section className="screenia-auth-hero screenia-auth-hero-hidden-mobile">
          <Link href="/" className="screenia-auth-logo-link">
            <ScreeniaLogo className="screenia-logo-auth-card" />
          </Link>
          <p className="screenia-auth-hero-kicker">
            Kundportal
          </p>
          <h1 className="screenia-auth-hero-title">
            En trygg plats för order, innehåll och support.
          </h1>
        </section>

        <section className="screenia-auth-card-wrap">
          <div className="screenia-auth-card">
            <Link href="/" className="screenia-auth-logo-link screenia-auth-logo-link-mobile">
              <ScreeniaLogo className="screenia-logo-auth-inline" />
            </Link>
            <p className="screenia-auth-card-kicker screenia-auth-card-kicker-responsive">
              {eyebrow}
            </p>
            <h1 className="screenia-auth-card-title">
              {title}
            </h1>
            <div>{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="screenia-auth-alert">
      {children}
    </p>
  );
}
