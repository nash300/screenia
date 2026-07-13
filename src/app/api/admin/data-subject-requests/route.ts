import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function getAuthenticatedAdmin() {
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

  return user?.app_metadata?.role === "admin" ? user : null;
}

export function cleanText(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : "";
}

export function cleanOptionalText(value: unknown, maxLength: number) {
  return cleanText(value, maxLength) || null;
}

export async function GET() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("data_subject_requests")
    .select(
      "id, customer_id, source_message_id, request_type, status, description, due_at, completed_at, admin_notes, created_at, updated_at, customers(name, email, customer_number)",
    )
    .order("due_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Load data subject requests error:", error);
    return NextResponse.json(
      { error: "Could not load data subject requests." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { requests: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
