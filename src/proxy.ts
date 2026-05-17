import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  let authCookies: Parameters<typeof response.cookies.set>[] = [];
  let authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies, headers) => {
          authCookies = [];
          authHeaders = headers;

          cookies.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookies.forEach(({ name, value, options }) => {
            authCookies.push([name, value, options]);
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isAdmin = user?.app_metadata?.role === "admin";

  if (isAdminRoute && !isAdmin) {
    const redirectResponse = NextResponse.redirect(
      new URL("/login", request.url)
    );

    authCookies.forEach((cookie) => {
      redirectResponse.cookies.set(...cookie);
    });

    Object.entries(authHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
