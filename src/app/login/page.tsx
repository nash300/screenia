"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import InfoSyncLogo from "@/components/InfoSyncLogo";

export default function LoginPage() {
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
    setMessage("This login is not connected to an InfoSync account.");
    setLoading(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#061942] text-[#061942]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,125,246,0.34),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(245,158,11,0.18),transparent_26%),linear-gradient(135deg,#061942_0%,#0b245f_52%,#f5f8ff_52%,#ffffff_100%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden text-white lg:block">
          <Link href="/" className="inline-flex no-underline">
            <InfoSyncLogo className="infosync-logo-auth-card" />
          </Link>

          <p className="mt-16 text-sm font-black uppercase tracking-[0.22em] text-[#8cc2ff]">
            Secure access
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.02] tracking-tight">
            One sign-in for your screen system.
          </h1>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-white/70 bg-white/[0.92] p-6 shadow-[0_30px_80px_rgba(3,15,38,0.28)] backdrop-blur md:p-8">
            <Link href="/" className="inline-flex no-underline lg:hidden">
              <InfoSyncLogo className="infosync-logo-auth-inline" />
            </Link>

            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#2f7df6] lg:mt-0">
              InfoSync login
            </p>

            <div className="mt-7 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
                  Email
                </span>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#52617d]">
                  Password
                </span>
                <input
                  type="password"
                  placeholder="Your password"
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

            <div className="mt-10 mb-9">
              <button
                type="button"
                onClick={submit}
                disabled={loading || !email || !password}
                className="group inline-flex min-h-12 min-w-44 items-center justify-between gap-4 border border-white/50 bg-[linear-gradient(135deg,#2f7df6,#155ee8)] px-4 py-2 pl-7 text-sm font-black text-white shadow-[0_20px_42px_rgba(47,125,246,0.34)] outline outline-1 outline-[#2f7df6]/20 transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(47,125,246,0.42)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                style={{ borderRadius: "999px" }}
              >
                <span>{loading ? "Checking..." : "Login"}</span>
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
            </div>

            <div className="text-sm">
              <Link href="/" className="font-bold text-[#2f7df6] no-underline">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
