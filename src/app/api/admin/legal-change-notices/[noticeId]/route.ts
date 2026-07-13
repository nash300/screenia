import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedAdmin,
  validateLegalChangeNoticePayload,
} from "@/app/api/admin/legal-change-notices/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type LegalChangeNoticePayload = Parameters<
  typeof validateLegalChangeNoticePayload
>[0];

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
  { params }: { params: Promise<{ noticeId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { noticeId } = await params;
  const body = (await request.json().catch(() => ({}))) as LegalChangeNoticePayload;
  const validation = validateLegalChangeNoticePayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("legal_change_notices")
    .select(
      "id, document_type, document_version, change_summary, effective_at, notice_required, reacceptance_required, notice_status, notice_sent_at, evidence_reference, notes, updated_by, updated_at",
    )
    .eq("id", noticeId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Legal change notice was not found." },
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
    .from("legal_change_notices")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, document_type, document_version, change_summary, effective_at, notice_required, reacceptance_required, notice_status, notice_sent_at, evidence_reference, notes, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update legal change notice error:", updateError);
    return NextResponse.json(
      { error: "Could not update legal change notice." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "legal_change_notice_updated",
        eventDescription: "Admin updated a legal or policy change notice.",
        metadata: {
          noticeId: existing.id,
          documentType: existing.document_type,
          documentVersion: existing.document_version,
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

    if (updated.notice_required && updated.notice_status !== "sent") {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "legal_change_notice_updated",
          title: "Legal notice still needs follow-up",
          message: `${updated.document_type} ${updated.document_version} requires customer notice before it is complete.`,
          priority: "high",
          metadata: { noticeId: updated.id, documentType: updated.document_type },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Legal change notice update evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("legal_change_notices")
      .update({
        document_type: existing.document_type,
        document_version: existing.document_version,
        change_summary: existing.change_summary,
        effective_at: existing.effective_at,
        notice_required: existing.notice_required,
        reacceptance_required: existing.reacceptance_required,
        notice_status: existing.notice_status,
        notice_sent_at: existing.notice_sent_at,
        evidence_reference: existing.evidence_reference,
        notes: existing.notes,
        updated_by: existing.updated_by,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Legal change notice update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Legal change notice update was not saved because Screenia could not store the required audit or notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ notice: updated, changedFields });
}
