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
        className="mt-7 inline-flex min-h-12 min-w-44 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2f7df6,#155ee8)] px-7 py-3 text-sm font-black text-white shadow-[0_20px_42px_rgba(47,125,246,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(47,125,246,0.42)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
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
          placeholder="Minst 6 tecken, bokstäver och siffror"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onEnter();
          }}
          className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:bg-white focus:ring-4 focus:ring-blue-100"
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
          className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:bg-white focus:ring-4 focus:ring-blue-100"
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
    <main className="min-h-screen overflow-hidden bg-[#061942] text-[#061942]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,125,246,0.34),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(245,158,11,0.18),transparent_26%),linear-gradient(135deg,#061942_0%,#0b245f_52%,#f5f8ff_52%,#ffffff_100%)]" />
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
          <div className="rounded-[28px] border border-white/70 bg-white/[0.92] p-6 shadow-[0_30px_80px_rgba(3,15,38,0.28)] backdrop-blur md:p-8">
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
    <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a4a03]">
      {children}
    </p>
  );
}
