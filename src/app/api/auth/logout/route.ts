import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut({ scope: "local" });

  if (user?.app_metadata?.role === "admin") {
    await recordAuditEvent(supabaseAdmin, {
      actorType: "admin",
      actorId: user.id,
      eventType: "admin_logout",
      eventDescription: "Admin signed out.",
      metadata: { email: user.email || null },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  }

  return response;
}
