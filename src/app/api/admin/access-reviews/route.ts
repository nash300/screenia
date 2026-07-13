import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const statuses = new Set(["pending", "approved", "needs_review", "removed"]);

type AccessReviewPayload = {
  admin_email?: unknown;
  auth_user_id?: unknown;
  review_status?: unknown;
  mfa_verified?: unknown;
  access_confirmed?: unknown;
  notes?: unknown;
  reason?: unknown;
};

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

export function validateAccessReviewPayload(body: AccessReviewPayload) {
  const adminEmail = cleanText(body.admin_email, 254).toLowerCase();
  const reviewStatus = cleanText(body.review_status || "pending", 30);
  const reason = cleanText(body.reason, 1000);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(adminEmail)) {
    return { error: "A valid admin email is required." };
  }
  if (!statuses.has(reviewStatus)) {
    return { error: "Choose a valid review status." };
  }
  if (reason.length < 5) {
    return { error: "A reason of at least 5 characters is required." };
  }

  return {
    value: {
      admin_email: adminEmail,
      auth_user_id: cleanText(body.auth_user_id, 120) || null,
      review_status: reviewStatus,
      mfa_verified: Boolean(body.mfa_verified),
      access_confirmed: Boolean(body.access_confirmed),
      notes: cleanText(body.notes, 2000) || null,
      reviewed_at:
        reviewStatus === "approved" || reviewStatus === "removed"
          ? new Date().toISOString()
          : null,
      reason,
    },
  };
}

export async function GET() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("admin_access_reviews")
    .select(
      "id, admin_email, auth_user_id, review_status, mfa_verified, access_confirmed, reviewed_at, reviewed_by, notes, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load admin access reviews error:", error);
    return NextResponse.json(
      { error: "Could not load admin access reviews." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { reviews: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as AccessReviewPayload;
  const validation = validateAccessReviewPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { reason, ...insertPayload } = validation.value;
  const { data, error } = await supabaseAdmin
    .from("admin_access_reviews")
    .insert({
      ...insertPayload,
      created_by: user.id,
      reviewed_by: insertPayload.reviewed_at ? user.id : null,
    })
    .select(
      "id, admin_email, auth_user_id, review_status, mfa_verified, access_confirmed, reviewed_at, reviewed_by, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create admin access review error:", error);
    return NextResponse.json(
      { error: "Could not create admin access review." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_access_review_recorded",
        eventDescription: "Admin recorded an admin access review.",
        metadata: {
          reviewId: data.id,
          adminEmail: data.admin_email,
          reviewStatus: data.review_status,
          mfaVerified: data.mfa_verified,
          accessConfirmed: data.access_confirmed,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );

    if (data.review_status === "needs_review" || !data.mfa_verified) {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "admin_access_review_recorded",
          title: "Admin access needs review",
          message: `${data.admin_email} is marked ${data.review_status}; MFA verified: ${
            data.mfa_verified ? "yes" : "no"
          }.`,
          priority: "high",
          metadata: { reviewId: data.id, adminEmail: data.admin_email },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Admin access review creation evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("admin_access_reviews")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Admin access review creation rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Admin access review was not saved because Screenia could not store the required audit or notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
