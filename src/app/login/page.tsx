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

    if (!isSupabaseBrowserConfigured) {
      setMessage(missingSupabaseMessage);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.app_metadata?.role === "admin") {
      router.push("/admin");
      router.refresh();
      return;
    }

    const accountResponse = await fetch("/api/account");

    if (accountResponse.ok) {
      router.push("/account");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    setMessage("Den här inloggningen är inte kopplad till ett Screenia-konto.");
    setLoading(false);
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

    if (!isSupabaseBrowserConfigured) {
      setMessage(missingSupabaseMessage);
      setResetLoading(false);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/account/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Vi har skickat en återställningslänk om e-postadressen finns hos Screenia.");
    }

    setResetLoading(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#061942] text-[#061942]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,125,246,0.34),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(245,158,11,0.18),transparent_26%),linear-gradient(135deg,#061942_0%,#0b245f_52%,#f5f8ff_52%,#ffffff_100%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden text-white lg:block">
          <Link href="/" className="inline-flex no-underline">
            <ScreeniaLogo className="screenia-logo-auth-card" />
          </Link>

          <p className="mt-16 text-sm font-black uppercase tracking-[0.22em] text-[#8cc2ff]">
            Säker inloggning
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.02] tracking-tight">
            En inloggning för order, innehåll och support.
          </h1>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-white/70 bg-white/[0.92] p-6 shadow-[0_30px_80px_rgba(3,15,38,0.28)] backdrop-blur md:p-8">
            <Link href="/" className="inline-flex no-underline lg:hidden">
              <ScreeniaLogo className="screenia-logo-auth-inline" />
            </Link>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#2f7df6] lg:mt-0">
              Screenia kundportal
            </p>

            <div className="mt-7 space-y-4">
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
                  placeholder="Ditt lösenord"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && email && password && !loading) {
                      submit();
                    }
                  }}
                  className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            {message && (
              <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a4a03]">
                {message}
              </p>
            )}

            <div className="mt-10 space-y-4">
              <button
                type="button"
                onClick={submit}
                disabled={loading || !email || !password}
                className="group inline-flex min-h-12 w-full items-center justify-between gap-4 border border-white/50 bg-[linear-gradient(135deg,#2f7df6,#155ee8)] px-4 py-2 pl-7 text-sm font-black text-white shadow-[0_20px_42px_rgba(47,125,246,0.34)] outline outline-1 outline-[#2f7df6]/20 transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(47,125,246,0.42)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                style={{ borderRadius: "999px" }}
              >
                <span>{loading ? "Kontrollerar..." : "Logga in"}</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#155ee8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] transition group-hover:translate-x-0.5">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M10 7 8.6 8.4l2.6 2.6H3v2h8.2l-2.6 2.6L10 17l5-5-5-5Z" />
                    <path d="M13 4h5v16h-5v-2h3V6h-3V4Z" />
                  </svg>
                </span>
              </button>

              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-[#7b8aaa]">
                <span className="h-px flex-1 bg-blue-100" />
                eller
                <span className="h-px flex-1 bg-blue-100" />
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={googleLoading || !isGoogleAuthEnabled}
                className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#061942] shadow-[0_14px_34px_rgba(6,25,66,0.08)] transition hover:-translate-y-0.5 hover:border-[#2f7df6] hover:shadow-[0_18px_44px_rgba(6,25,66,0.12)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-black text-[#4285f4]"
                >
                  G
                </span>
                {googleLoading
                  ? "Öppnar Google..."
                  : isGoogleAuthEnabled
                    ? "Fortsätt med Google"
                    : "Google-inloggning kommer snart"}
              </button>

              <p className="text-xs font-semibold leading-5 text-[#52617d]">
                {isGoogleAuthEnabled
                  ? "Google fungerar bara om e-postadressen redan hör till ett betalt Screenia-konto."
                  : "Google aktiveras när Google Cloud och Supabase OAuth är färdigkonfigurerade."}
              </p>
            </div>

            <div className="mt-9 flex flex-wrap gap-4 text-sm">
              <button
                type="button"
                onClick={sendResetEmail}
                disabled={resetLoading || !email}
                className="font-bold text-[#2f7df6] no-underline disabled:opacity-50"
              >
                {resetLoading ? "Skickar..." : "Glömt lösenord?"}
              </button>
              <Link href="/" className="font-bold text-[#2f7df6] no-underline">
                Till startsidan
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
