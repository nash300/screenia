import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_IP_LIMIT,
  PASSWORD_RESET_WINDOW_MS,
} from "@/lib/auth/password-reset-policy";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function appOrigin(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/u, "");

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function notifyPasswordResetControlFailure({
  eventType,
  title,
  message,
  email,
  error,
}: {
  eventType: string;
  title: string;
  message: string;
  email: string;
  error: unknown;
}) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  await createAdminNotification(
    supabaseAdmin,
    {
      eventType,
      title,
      message,
      priority: "urgent",
      metadata: {
        email,
        error: errorMessage,
      },
    },
    { throwOnError: true },
  );
}

export async function POST(request: Request) {
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = String(body.email || "").trim().toLowerCase();
  const emailKey = email || "missing";

  const ipLimit = checkRateLimit({
    key: `password-reset-ip:${ipAddress || "unknown"}`,
    limit: PASSWORD_RESET_IP_LIMIT,
    windowMs: PASSWORD_RESET_WINDOW_MS,
  });
  const emailLimit = checkRateLimit({
    key: `password-reset-email:${emailKey}`,
    limit: PASSWORD_RESET_EMAIL_LIMIT,
    windowMs: PASSWORD_RESET_WINDOW_MS,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          actorType: "system",
          eventType: "password_reset_rate_limited",
          eventDescription: "Password reset request was rate limited.",
          metadata: {
            emailProvided: Boolean(email),
            email,
            ipLimited: !ipLimit.allowed,
            emailLimited: !emailLimit.allowed,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Password reset rate-limit audit was not stored:", auditError);
      await notifyPasswordResetControlFailure({
        eventType: "password_reset_audit_failed",
        title: "Password reset audit missing",
        message:
          "A rate-limited password reset attempt was blocked, but audit evidence was not stored.",
        email,
        error: auditError,
      }).catch((notificationError) => {
        console.error(
          "Password reset audit failure notification was not stored:",
          notificationError,
        );
      });
    }

    return NextResponse.json(
      { error: "För många återställningsförsök. Försök igen senare." },
      {
        status: 429,
        headers: rateLimitHeaders(
          ipLimit.remaining < emailLimit.remaining ? ipLimit : emailLimit,
        ),
      },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { success: true, message: PASSWORD_RESET_GENERIC_MESSAGE },
      { headers: rateLimitHeaders(emailLimit) },
    );
  }

  const redirectTo = `${appOrigin(request)}/auth/callback?next=/account/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "system",
        eventType: error
          ? "password_reset_email_failed"
          : "password_reset_email_requested",
        eventDescription: error
          ? "System could not request a customer password reset email."
          : "Customer requested a password reset email.",
        metadata: {
          email,
          error: error?.message || null,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Password reset audit was not stored:", auditError);
    await notifyPasswordResetControlFailure({
      eventType: "password_reset_audit_failed",
      title: "Password reset audit missing",
      message:
        "A password reset request was processed, but audit evidence was not stored.",
      email,
      error: auditError,
    }).catch((notificationError) => {
      console.error(
        "Password reset audit failure notification was not stored:",
        notificationError,
      );
    });
  }

  if (error) {
    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "password_reset_email_failed",
          title: "Password reset email failed",
          message:
            "Supabase could not send a password reset email. Check Supabase Auth email settings and sender/domain configuration.",
          priority: "urgent",
          metadata: {
            email,
            error: error.message,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Password reset failure admin notification was not stored:",
        notificationError,
      );
      await recordAuditEvent(supabaseAdmin, {
        actorType: "system",
        eventType: "password_reset_email_notification_failed",
        eventDescription:
          "Password reset email failed, but admin notification storage also failed.",
        metadata: {
          email,
          emailError: error.message,
          notificationError:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        },
        ipAddress,
        userAgent,
      });
    }
  }

  return NextResponse.json(
    { success: true, message: PASSWORD_RESET_GENERIC_MESSAGE },
    { headers: rateLimitHeaders(emailLimit) },
  );
}
