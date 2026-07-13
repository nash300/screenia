import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { hasDisplayEntitlement } from "@/lib/server/subscription-entitlements";

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
    "id, name, email, phone, contact_person, organisation_number, address, city, country, status, payment_status, stripe_customer_id, stripe_subscription_id, activated_at, cancelled_at, inactive_reason, created_at, website_url, notes, marketing_consent, analytics_consent, remote_support_consent";
  const extendedCustomerSelect =
    `${baseCustomerSelect}, service_access_status, service_access_until, business_description, opening_hours, promotions, social_media, content_option, content_collected_at, preview_status, preview_url, preview_feedback, production_status, layout_started_at, setup_fee_locked_at`;

  const loadCustomer = async (
    field: "id" | "auth_user_id" | "email",
    value: string,
  ) => {
    const result = await client
      .from("customers")
      .select(extendedCustomerSelect)
      .eq(field, value)
      .maybeSingle();

    if (result.error?.code === "PGRST204" || result.error?.code === "42703") {
      return client
        .from("customers")
        .select(baseCustomerSelect)
        .eq(field, value)
        .maybeSingle();
    }

    return result;
  };

  const metadataCustomerId =
    typeof user.user_metadata?.customer_id === "string"
      ? user.user_metadata.customer_id
      : null;

  if (metadataCustomerId) {
    const { data, error } = await loadCustomer("id", metadataCustomerId);

    if (error && error.code !== "PGRST204" && error.code !== "42703") {
      console.error("Customer account metadata lookup error:", error);
    }

    if (data && data.email?.toLowerCase() === user.email.toLowerCase()) {
      return data;
    }
  }

  if (user.id) {
    const { data, error } = await loadCustomer("auth_user_id", user.id);

    if (error && error.code !== "PGRST204" && error.code !== "42703") {
      console.error("Customer account auth lookup error:", error);
    }

    if (data) return data;
  }

  const { data, error } = await loadCustomer("email", user.email);

  if (error) {
    console.error("Customer account email lookup error:", error);
    return null;
  }

  return data;
}

export function hasCustomerServiceAccess(customer: {
  status?: string | null;
  payment_status?: string | null;
  service_access_status?: string | null;
  service_access_until?: string | null;
}) {
  return hasDisplayEntitlement({
    customerStatus: customer.status,
    paymentStatus: customer.payment_status,
    serviceAccessStatus: customer.service_access_status,
    serviceAccessUntil: customer.service_access_until,
  });
}

export function customerAccessDeniedResponse() {
  return {
    error:
      "Tjänsten är inte aktiv för det här kontot. Kontakta Screenia om du vill uppdatera material eller återaktivera tjänsten.",
  };
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}
