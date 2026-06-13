"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import InfoSyncLogo from "@/components/InfoSyncLogo";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupShell>Skapar trygg inloggning...</SignupShell>}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get("plan") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=/account`
      : undefined;

  const signupWithEmail = async () => {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          account_type: "customer",
          requested_plan: selectedPlan || null,
        },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Kontot är skapat. Kontrollera din e-post om bekräftelse krävs.");
    setLoading(false);
  };

  const signupWithProvider = async (provider: "google" | "facebook") => {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams:
          provider === "google"
            ? {
                access_type: "offline",
                prompt: "consent",
              }
            : undefined,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  return (
    <SignupShell>
      <div className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="text-white">
          <Link href="/" className="inline-flex no-underline">
            <InfoSyncLogo className="infosync-logo-auth-card" />
          </Link>
          <p className="mt-12 text-sm font-black uppercase tracking-[0.22em] text-[#8cc2ff]">
            Kundkonto
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.04] tracking-tight">
            Skapa konto och följ din beställning.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
            Med ett konto kan du se order, skicka material, hantera fakturering
            och kontakta InfoSync när du behöver hjälp.
          </p>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/[0.94] p-6 shadow-[0_30px_80px_rgba(3,15,38,0.28)] backdrop-blur md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2f7df6]">
            Skapa konto
          </p>
          {selectedPlan && (
            <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-[#155ee8]">
              Valt paket: {selectedPlan}
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => signupWithProvider("google")}
              disabled={loading}
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#061942] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
            >
              Fortsätt med Google
            </button>
            <button
              type="button"
              onClick={() => signupWithProvider("facebook")}
              disabled={loading}
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#061942] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
            >
              Fortsätt med Facebook
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            eller
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
                E-post
              </span>
              <input
                type="email"
                placeholder="namn@foretag.se"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
                Lösenord
              </span>
              <input
                type="password"
                placeholder="Minst 6 tecken"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          {message && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a4a03]">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={signupWithEmail}
            disabled={loading || !email || password.length < 6}
            className="mt-7 inline-flex min-h-12 min-w-44 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2f7df6,#155ee8)] px-7 py-3 text-sm font-black text-white shadow-[0_20px_42px_rgba(47,125,246,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(47,125,246,0.42)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
          >
            {loading ? "Skapar konto..." : "Skapa konto"}
          </button>

          <div className="mt-7 flex flex-wrap gap-4 text-sm">
            <Link href="/login" className="font-bold text-[#2f7df6] no-underline">
              Jag har redan konto
            </Link>
            <button
              type="button"
              onClick={() => router.push("/#pricing")}
              className="font-bold text-[#2f7df6] no-underline"
            >
              Tillbaka till priser
            </button>
          </div>
        </section>
      </div>
    </SignupShell>
  );
}

function SignupShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#061942] px-5 py-8 text-[#061942]">
      {children}
    </main>
  );
}
