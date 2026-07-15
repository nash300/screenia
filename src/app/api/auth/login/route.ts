import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  LOGIN_ATTEMPT_EMAIL_LIMIT,
  LOGIN_ATTEMPT_GENERIC_ERROR,
  LOGIN_ATTEMPT_IP_LIMIT,
  LOGIN_ATTEMPT_RATE_LIMIT_ERROR,
  LOGIN_ATTEMPT_WINDOW_MS,
} from "@/lib/auth/login-attempt-policy";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getCustomerForUser,
  markCustomerAccountActivated,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";

type AuthCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

type LoginMode = "customer" | "admin";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function normalizeMode(value: unknown): LoginMode {
  return value === "admin" ? "admin" : "customer";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
    mode?: unknown;
  };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const mode = normalizeMode(body.mode);
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");
  const emailKey = email || "missing";
  const rateKeyPrefix = mode === "admin" ? "admin-login" : "customer-login";

  const ipLimit = checkRateLimit({
    key: `${rateKeyPrefix}-ip:${ipAddress || "unknown"}`,
    limit: LOGIN_ATTEMPT_IP_LIMIT,
    windowMs: LOGIN_ATTEMPT_WINDOW_MS,
  });
  const emailLimit = checkRateLimit({
    key: `${rateKeyPrefix}-email:${emailKey}`,
    limit: LOGIN_ATTEMPT_EMAIL_LIMIT,
    windowMs: LOGIN_ATTEMPT_WINDOW_MS,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    await recordAuditEvent(supabaseAdmin, {
      actorType: "system",
      eventType: "login_rate_limited",
      eventDescription: "Login attempt was rate limited.",
      metadata: {
        mode,
        emailProvided: Boolean(email),
        email,
        ipLimited: !ipLimit.allowed,
        emailLimited: !emailLimit.allowed,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      { error: LOGIN_ATTEMPT_RATE_LIMIT_ERROR },
      {
        status: 429,
        headers: rateLimitHeaders(
          ipLimit.remaining < emailLimit.remaining ? ipLimit : emailLimit,
        ),
      },
    );
  }

  if (!isValidEmail(email) || !password) {
    return NextResponse.json(
      { error: LOGIN_ATTEMPT_GENERIC_ERROR },
      { status: 401, headers: rateLimitHeaders(emailLimit) },
    );
  }

  const cookieStore = await cookies();
  const authCookies: AuthCookie[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) => {
            authCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  const jsonWithCookies = (
    payload: Record<string, unknown>,
    init?: { status?: number; headers?: HeadersInit },
  ) => {
    const response = NextResponse.json(payload, init);
    authCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  };

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordAuditEvent(supabaseAdmin, {
      actorType: "system",
      eventType: "login_failed",
      eventDescription: "Login failed.",
      metadata: {
        mode,
        email,
        error: error.message,
      },
      ipAddress,
      userAgent,
    });

    return jsonWithCookies(
      { error: LOGIN_ATTEMPT_GENERIC_ERROR },
      { status: 401, headers: rateLimitHeaders(emailLimit) },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonWithCookies(
      { error: LOGIN_ATTEMPT_GENERIC_ERROR },
      { status: 401, headers: rateLimitHeaders(emailLimit) },
    );
  }

  if (mode === "admin") {
    if (user.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      await recordAuditEvent(supabaseAdmin, {
        actorType: "system",
        actorId: user.id,
        eventType: "admin_login_denied",
        eventDescription: "Non-admin user attempted to access admin login.",
        metadata: { email },
        ipAddress,
        userAgent,
      });

      return jsonWithCookies(
        { error: LOGIN_ATTEMPT_GENERIC_ERROR },
        { status: 401, headers: rateLimitHeaders(emailLimit) },
      );
    }

    await recordAuditEvent(supabaseAdmin, {
      actorType: "admin",
      actorId: user.id,
      eventType: "admin_login_success",
      eventDescription: "Admin signed in.",
      metadata: { email },
      ipAddress,
      userAgent,
    });

    return jsonWithCookies(
      { success: true, next: "/admin" },
      { headers: rateLimitHeaders(emailLimit) },
    );
  }

  if (user.app_metadata?.role === "admin") {
    return jsonWithCookies(
      { success: true, next: "/admin" },
      { headers: rateLimitHeaders(emailLimit) },
    );
  }

  const customer = await getCustomerForUser(user);

  if (!customer) {
    await supabase.auth.signOut();
    await recordAuditEvent(supabaseAdmin, {
      actorType: "system",
      actorId: user.id,
      eventType: "customer_login_denied",
      eventDescription: "Authenticated user was not linked to a Screenia customer.",
      metadata: { email },
      ipAddress,
      userAgent,
    });

    return jsonWithCookies(
      { error: LOGIN_ATTEMPT_GENERIC_ERROR },
      { status: 401, headers: rateLimitHeaders(emailLimit) },
    );
  }

  await markCustomerAccountActivated(user);

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "customer",
    actorId: user.id,
    eventType: "customer_login_success",
    eventDescription: "Customer signed in.",
    metadata: { email },
    ipAddress,
    userAgent,
  });

  return jsonWithCookies(
    { success: true, next: "/account" },
    { headers: rateLimitHeaders(emailLimit) },
  );
}
