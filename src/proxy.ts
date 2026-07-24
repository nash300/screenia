import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function applyNoStoreHeaders(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  return response;
}

function getRequestSourceOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return "invalid";
  }
}

export function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isSameOriginUnsafeRequest(request: NextRequest) {
  const sourceOrigin = getRequestSourceOrigin(request);

  return Boolean(
    sourceOrigin &&
      (sourceOrigin === request.nextUrl.origin ||
        isEquivalentLocalDevOrigin(sourceOrigin, request.nextUrl.origin)),
  );
}

function isEquivalentLocalDevOrigin(sourceOrigin: string, targetOrigin: string) {
  try {
    const source = new URL(sourceOrigin);
    const target = new URL(targetOrigin);
    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

    return (
      source.protocol === target.protocol &&
      source.port === target.port &&
      localHosts.has(source.hostname) &&
      localHosts.has(target.hostname)
    );
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const pathname = request.nextUrl.pathname;
  const shouldDisableCaching = shouldDisableRouteCaching(pathname);

  if (shouldDisableCaching) {
    applyNoStoreHeaders(response);
  }

  if (
    shouldRejectCrossOriginUnsafeRequest({
      pathname,
      method: request.method,
      isSameOrigin: isSameOriginUnsafeRequest(request),
    })
  ) {
    return applyNoStoreHeaders(
      NextResponse.json(
        { error: "Cross-origin state-changing requests are not allowed." },
        { status: 403 },
      ),
    );
  }

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isAdminRoute) {
    return response;
  }

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

  const isAdmin = user?.app_metadata?.role === "admin";

  if (!isAdmin) {
    const redirectResponse = NextResponse.redirect(
      new URL("/admin-login", request.url)
    );
    applyNoStoreHeaders(redirectResponse);

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

export function isCsrfExemptPath(pathname: string) {
  return pathname === "/api/stripe/webhook" || pathname === "/api/resend/webhook";
}

export function shouldDisableRouteCaching(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/display") ||
    pathname.startsWith("/onboarding") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/admin-login"
  );
}

export function shouldRejectCrossOriginUnsafeRequest({
  pathname,
  method,
  isSameOrigin,
}: {
  pathname: string;
  method: string;
  isSameOrigin: boolean;
}) {
  return (
    pathname.startsWith("/api/") &&
    isUnsafeMethod(method) &&
    !isCsrfExemptPath(pathname) &&
    !isSameOrigin
  );
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/auth/:path*",
    "/account/:path*",
    "/display/:path*",
    "/onboarding/:path*",
    "/login",
    "/admin-login",
  ],
};
