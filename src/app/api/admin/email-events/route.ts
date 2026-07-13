import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedAdmin() {
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

export async function GET() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("resend_delivery_events")
    .select(
      "id, svix_id, event_type, resend_email_id, recipient_email, subject, event_status, raw_payload, received_at, processed_at",
    )
    .order("received_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load Resend delivery events error:", error);
    return NextResponse.json(
      { error: "Could not load email delivery events." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { events: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
