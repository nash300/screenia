import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const isSupabaseBrowserConfigured =
  isValidSupabaseUrl(supabaseUrl) && Boolean(supabaseAnonKey);

const missingSupabaseConfigError = new Error(
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the development server."
);

function createMissingSupabaseClient() {
  return new Proxy(
    {
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: missingSupabaseConfigError,
        }),
        getUser: async () => ({
          data: { user: null },
          error: missingSupabaseConfigError,
        }),
        signOut: async () => ({ error: missingSupabaseConfigError }),
        resetPasswordForEmail: async () => ({
          data: {},
          error: missingSupabaseConfigError,
        }),
        updateUser: async () => ({
          data: { user: null },
          error: missingSupabaseConfigError,
        }),
      },
    },
    {
      get(target, property, receiver) {
        if (property in target) {
          return Reflect.get(target, property, receiver);
        }

        throw missingSupabaseConfigError;
      },
    }
  ) as unknown as SupabaseClient;
}

export const supabase = isSupabaseBrowserConfigured
  ? createBrowserClient(supabaseUrl!, supabaseAnonKey!)
  : createMissingSupabaseClient();
