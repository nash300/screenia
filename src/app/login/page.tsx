"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const signIn = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      alert("This account does not have admin access.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_54%,#eaf2ff_100%)] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-blue-100 bg-white/90 p-7 shadow-[0_22px_60px_rgba(7,31,84,0.14)]">
        <img
          src="/brand/infosync-logo-full-transparent.png"
          alt="InfoSync"
          className="h-12 w-auto"
        />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-[#2f7df6]">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-black text-[#061942]">Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-4 w-full rounded-xl border border-blue-100 px-3 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:ring-4 focus:ring-blue-100"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-3 w-full rounded-xl border border-blue-100 px-3 py-3 text-[#061942] outline-none transition focus:border-[#2f7df6] focus:ring-4 focus:ring-blue-100"
        />

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-[#2f7df6] py-3 font-bold text-white shadow-[0_14px_28px_rgba(47,125,246,0.24)] disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </div>
    </main>
  );
}
