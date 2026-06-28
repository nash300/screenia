import { supabase } from "@/lib/supabase/client";

type SyncResult = {
  ready: boolean;
  error?: string;
};

async function syncServerCookies(accessToken: string, refreshToken: string) {
  const response = await fetch("/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Kunde inte verifiera sessionslänken.");
  }
}

export async function syncEmailLinkSession(): Promise<SyncResult> {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return { ready: false, error: error.message };
    }

    try {
      await syncServerCookies(accessToken, refreshToken);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error.message : "Kunde inte verifiera sessionslänken.",
      };
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      ready: false,
      error: "Öppna länken från mejlet igen. Den här sidan saknar en aktiv session.",
    };
  }

  return { ready: true };
}

export async function syncCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token && session.refresh_token) {
    await syncServerCookies(session.access_token, session.refresh_token);
  }
}
