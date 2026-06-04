"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const submit = async () => {
    setLoading(true);
    setMessage("");

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

    if (user?.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      setMessage("Kontot har inte administratörsbehörighet.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#061942] px-5 py-8 text-[#061942]">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="text-white">
          <Link href="/" className="inline-flex no-underline">
            <img
              src="/brand/infosync-logo-full-transparent.png"
              alt="InfoSync"
              className="h-14 w-auto rounded-2xl bg-white/95 px-4 py-2 shadow-2xl"
            />
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

        <section className="rounded-[28px] border border-white/70 bg-white/[0.94] p-6 shadow-[0_30px_80px_rgba(3,15,38,0.28)] backdrop-blur md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2f7df6]">
            InfoSync admin
          </p>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
                E-post
              </span>
              <input
                type="email"
                placeholder="admin@infosync.se"
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

          <button
            type="button"
            onClick={submit}
            disabled={loading || !email || !password}
            className="mt-8 inline-flex min-h-12 min-w-44 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2f7df6,#155ee8)] px-7 py-3 text-sm font-black text-white shadow-[0_20px_42px_rgba(47,125,246,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(47,125,246,0.42)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
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
