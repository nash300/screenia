import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AuthenticatedClientOptions = {
  persistSession?: boolean;
};

export async function createAuthenticatedClient(
  options: AuthenticatedClientOptions = {},
) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          if (!options.persistSession) return;

          items.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        },
      },
    },
  );
}

export async function getAuthenticatedUser(
  options?: AuthenticatedClientOptions,
) {
  const supabase = await createAuthenticatedClient(options);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getAuthenticatedAdmin(
  options?: AuthenticatedClientOptions,
) {
  const user = await getAuthenticatedUser(options);
  return user?.app_metadata?.role === "admin" ? user : null;
}
