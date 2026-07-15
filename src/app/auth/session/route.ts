import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { markCustomerAccountActivated } from "@/lib/server/customer-account";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = String(body?.accessToken || "");
  const refreshToken = String(body?.refreshToken || "");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing session tokens." }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  const cookieStore = await cookies();
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

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.app_metadata?.role !== "admin") {
    await markCustomerAccountActivated(user);
  }

  return response;
}
