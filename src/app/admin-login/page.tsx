"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ScreeniaLogo from "@/components/ScreeniaLogo";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <main className="screenia-auth-shell min-h-screen overflow-hidden bg-[#061942] px-5 py-8 text-[#061942]">
      <div className="screenia-auth-bg absolute inset-0" />
      <div className="relative mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="text-white">
          <Link href="/" className="inline-flex no-underline">
            <ScreeniaLogo className="screenia-logo-auth-card" />
          </Link>
          <p className="mt-12 text-sm font-black uppercase tracking-[0.22em] text-[#8cc2ff]">
            Admin
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.04] tracking-tight">
            Säker åtkomst till driftpanelen.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100">
            Använd ditt personliga administratörskonto. Kundkonton fungerar
            inte här.
          </p>
        </section>

        <section className="screenia-auth-card border border-white/70 bg-white/[0.94] p-6 backdrop-blur md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2f7df6]">
            Screenia admin
          </p>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
                E-post
              </span>
              <input
                type="email"
                placeholder="admin@screenia.se"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="screenia-auth-input mt-2 w-full border px-4 py-3 text-[#061942] outline-none transition"
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
                className="screenia-auth-input mt-2 w-full border px-4 py-3 text-[#061942] outline-none transition"
              />
            </label>
          </div>

          {message && (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a4a03]">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={loading || !email || !password}
            className="screenia-auth-button mt-8 inline-flex min-h-12 min-w-44 items-center justify-center px-7 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {loading ? "Kontrollerar..." : "Logga in som admin"}
          </button>

          <div className="mt-7 text-sm">
            <Link href="/login" className="font-bold text-[#2f7df6] no-underline">
              Kundinloggning
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
