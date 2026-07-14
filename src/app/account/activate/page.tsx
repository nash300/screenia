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
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    syncEmailLinkSession().then((result) => {
      if (cancelled) return;
      setSessionReady(result.ready);
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
      <p className="text-sm font-semibold leading-6 text-[#52617d]">
        Din betalning är klar och ditt Screenia-konto är skapat. Välj ett
        lösenord för att aktivera kundportalen.
      </p>

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
        className="screenia-auth-button mt-7 inline-flex min-h-12 min-w-44 items-center justify-center px-7 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {loading ? "Aktiverar..." : "Aktivera konto"}
      </button>
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
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
          Nytt lösenord
        </span>
        <input
          type="password"
          placeholder="Minst 10 tecken, bokstäver och siffror"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onEnter();
          }}
          className="screenia-auth-input mt-2 w-full border px-4 py-3 text-[#061942] outline-none transition"
        />
      </label>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
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
          className="screenia-auth-input mt-2 w-full border px-4 py-3 text-[#061942] outline-none transition"
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
    <main className="screenia-auth-shell min-h-screen overflow-hidden bg-[#061942] text-[#061942]">
      <div className="screenia-auth-bg absolute inset-0" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden text-white lg:block">
          <Link href="/" className="inline-flex no-underline">
            <ScreeniaLogo className="screenia-logo-auth-card" />
          </Link>
          <p className="mt-16 text-sm font-black uppercase tracking-[0.22em] text-[#8cc2ff]">
            Kundportal
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.02] tracking-tight">
            En trygg plats för order, innehåll och support.
          </h1>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="screenia-auth-card border border-white/70 bg-white/[0.92] p-6 backdrop-blur md:p-8">
            <Link href="/" className="inline-flex no-underline lg:hidden">
              <ScreeniaLogo className="screenia-logo-auth-inline" />
            </Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#2f7df6] lg:mt-0">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#061942]">
              {title}
            </h1>
            <div className="mt-5">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a4a03]">
      {children}
    </p>
  );
}
