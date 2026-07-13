import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  cleanOptionalText,
  cleanText,
  getAuthenticatedAdmin,
} from "@/app/api/admin/data-subject-requests/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const statuses = new Set([
  "received",
  "in_progress",
  "waiting_for_customer",
  "completed",
  "rejected",
]);

type DataSubjectRequestUpdatePayload = {
  status?: unknown;
  admin_notes?: unknown;
  reason?: unknown;
};

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
  { params }: { params: Promise<{ requestId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { requestId } = await params;
  const body = (await request.json().catch(() => ({}))) as DataSubjectRequestUpdatePayload;
  const status = cleanText(body.status, 40);
  const reason = cleanText(body.reason, 1000);
  const adminNotes = cleanOptionalText(body.admin_notes, 2000);

  if (!statuses.has(status)) {
    return NextResponse.json(
      { error: "Choose a valid request status." },
      { status: 400 },
    );
  }

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  if (
    ["completed", "rejected"].includes(status) &&
    (!adminNotes || adminNotes.length < 10)
  ) {
    return NextResponse.json(
      {
        error:
          "Completion or rejection requires outcome notes of at least 10 characters.",
      },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("data_subject_requests")
    .select("id, customer_id, request_type, status, admin_notes, completed_at, updated_at")
    .eq("id", requestId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Data subject request was not found." },
      { status: 404 },
    );
  }

  const updatePayload = {
    status,
    admin_notes: adminNotes,
    completed_at:
      status === "completed" || status === "rejected"
        ? existing.completed_at || new Date().toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };
  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("data_subject_requests")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, customer_id, source_message_id, request_type, status, description, due_at, completed_at, admin_notes, created_at, updated_at, customers(name, email, customer_number)",
    )
    .single();

  if (updateError) {
    console.error("Update data subject request error:", updateError);
    return NextResponse.json(
      { error: "Could not update data subject request." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: existing.customer_id,
        actorType: "admin",
        actorId: user.id,
        eventType: "data_subject_request_updated",
        eventDescription: "Admin updated a data subject request.",
        metadata: {
          dataSubjectRequestId: existing.id,
          requestType: existing.request_type,
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
    console.error("Data subject request update audit error:", auditError);

    const { error: rollbackError } = await supabaseAdmin
      .from("data_subject_requests")
      .update({
        status: existing.status,
        admin_notes: existing.admin_notes,
        completed_at: existing.completed_at,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Data subject request update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Data subject request update was not saved because Screenia could not store the required audit evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ request: updated, changedFields });
}
