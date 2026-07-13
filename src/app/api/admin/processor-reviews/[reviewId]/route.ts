import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedAdmin,
  validateProcessorReviewPayload,
} from "@/app/api/admin/processor-reviews/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ProcessorReviewPayload = Parameters<typeof validateProcessorReviewPayload>[0];

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
  const body = (await request.json().catch(() => ({}))) as ProcessorReviewPayload;
  const validation = validateProcessorReviewPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("processor_compliance_reviews")
    .select(
      "id, provider, processing_purpose, dpa_verified, security_reviewed, account_owner_verified, region_or_location, evidence_reference, review_status, reviewed_at, next_review_due, notes, updated_by, updated_at",
    )
    .eq("id", reviewId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Processor review was not found." },
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
    .from("processor_compliance_reviews")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, provider, processing_purpose, dpa_verified, security_reviewed, account_owner_verified, region_or_location, evidence_reference, review_status, reviewed_at, next_review_due, notes, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update processor review error:", updateError);
    return NextResponse.json(
      { error: "Could not update processor review." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "processor_compliance_review_updated",
        eventDescription: "Admin updated processor compliance evidence.",
        metadata: {
          reviewId: existing.id,
          provider: existing.provider,
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
    console.error("Processor review update audit error:", auditError);

    const { error: rollbackError } = await supabaseAdmin
      .from("processor_compliance_reviews")
      .update({
        provider: existing.provider,
        processing_purpose: existing.processing_purpose,
        dpa_verified: existing.dpa_verified,
        security_reviewed: existing.security_reviewed,
        account_owner_verified: existing.account_owner_verified,
        region_or_location: existing.region_or_location,
        evidence_reference: existing.evidence_reference,
        review_status: existing.review_status,
        reviewed_at: existing.reviewed_at,
        next_review_due: existing.next_review_due,
        notes: existing.notes,
        updated_by: existing.updated_by,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Processor review update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Processor review update was not saved because Screenia could not store the required audit evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: updated, changedFields });
}
