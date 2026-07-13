import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedAdmin,
  validateDataRetentionPayload,
} from "@/app/api/admin/data-retention/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DataRetentionPayload = Parameters<typeof validateDataRetentionPayload>[0];

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
  const body = (await request.json().catch(() => ({}))) as DataRetentionPayload;
  const validation = validateDataRetentionPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("data_retention_reviews")
    .select(
      "id, record_area, related_customer_id, related_record_id, legal_basis, retention_reason, retention_until, review_status, recommended_action, completed_at, notes, updated_by, updated_at",
    )
    .eq("id", reviewId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Data retention review was not found." },
      { status: 404 },
    );
  }

  const { reason, ...validatedPayload } = validation.value;
  const updatePayload = {
    ...validatedPayload,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("data_retention_reviews")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, record_area, related_customer_id, related_record_id, legal_basis, retention_reason, retention_until, review_status, recommended_action, completed_at, notes, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update data retention review error:", updateError);
    return NextResponse.json(
      { error: "Could not update data retention review." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "data_retention_review_updated",
        eventDescription: "Admin updated a data retention review.",
        metadata: {
          reviewId: existing.id,
          recordArea: existing.record_area,
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
    console.error("Data retention review update audit error:", auditError);

    const { error: rollbackError } = await supabaseAdmin
      .from("data_retention_reviews")
      .update({
        record_area: existing.record_area,
        related_customer_id: existing.related_customer_id,
        related_record_id: existing.related_record_id,
        legal_basis: existing.legal_basis,
        retention_reason: existing.retention_reason,
        retention_until: existing.retention_until,
        review_status: existing.review_status,
        recommended_action: existing.recommended_action,
        completed_at: existing.completed_at,
        notes: existing.notes,
        updated_by: existing.updated_by,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Data retention review update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Data retention review update was not saved because Screenia could not store the required audit evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: updated, changedFields });
}
