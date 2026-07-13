import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedAdmin,
  validateAccessReviewPayload,
} from "@/app/api/admin/access-reviews/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AccessReviewPayload = Parameters<typeof validateAccessReviewPayload>[0];

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { reviewId } = await params;
  const body = (await request.json().catch(() => ({}))) as AccessReviewPayload;
  const validation = validateAccessReviewPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("admin_access_reviews")
    .select(
      "id, admin_email, auth_user_id, review_status, mfa_verified, access_confirmed, reviewed_at, reviewed_by, notes, updated_at",
    )
    .eq("id", reviewId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Admin access review was not found." },
      { status: 404 },
    );
  }

  const { reason, ...validatedPayload } = validation.value;
  const updatePayload = {
    ...validatedPayload,
    reviewed_by: validatedPayload.reviewed_at ? user.id : null,
    updated_at: new Date().toISOString(),
  };
  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("admin_access_reviews")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, admin_email, auth_user_id, review_status, mfa_verified, access_confirmed, reviewed_at, reviewed_by, notes, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update admin access review error:", updateError);
    return NextResponse.json(
      { error: "Could not update admin access review." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_access_review_updated",
        eventDescription: "Admin updated an admin access review.",
        metadata: {
          reviewId: existing.id,
          adminEmail: existing.admin_email,
          changedFields: fieldsChanged,
          before: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
          after: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (updatePayload as Record<string, unknown>)[field],
            ]),
          ),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Admin access review update audit error:", auditError);

    const { error: rollbackError } = await supabaseAdmin
      .from("admin_access_reviews")
      .update({
        admin_email: existing.admin_email,
        auth_user_id: existing.auth_user_id,
        review_status: existing.review_status,
        mfa_verified: existing.mfa_verified,
        access_confirmed: existing.access_confirmed,
        reviewed_at: existing.reviewed_at,
        reviewed_by: existing.reviewed_by,
        notes: existing.notes,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Admin access review update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Admin access review update was not saved because Screenia could not store the required audit evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: updated, changedFields });
}
