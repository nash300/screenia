import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCustomerForUser(
  user: User | null,
  client: SupabaseClient = supabaseAdmin,
) {
  if (!user?.email) return null;

  const baseCustomerSelect =
    "id, name, email, phone, contact_person, organisation_number, address, city, country, status, payment_status, stripe_customer_id, stripe_subscription_id, activated_at, cancelled_at, inactive_reason, created_at";

  if (user.id) {
    const { data, error } = await client
      .from("customers")
      .select(baseCustomerSelect)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST204" && error.code !== "42703") {
      console.error("Customer account auth lookup error:", error);
    }

    if (data) return data;
  }

  const { data, error } = await client
    .from("customers")
    .select(baseCustomerSelect)
    .eq("email", user.email)
    .maybeSingle();

  if (error) {
    console.error("Customer account email lookup error:", error);
    return null;
  }

  return data;
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}
