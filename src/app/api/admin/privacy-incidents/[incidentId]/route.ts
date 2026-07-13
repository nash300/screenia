import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedAdmin,
  validateIncidentPayload,
} from "@/app/api/admin/privacy-incidents/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type PrivacyIncidentPayload = Parameters<typeof validateIncidentPayload>[0];

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
  { params }: { params: Promise<{ incidentId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { incidentId } = await params;
  const body = (await request.json().catch(() => ({}))) as PrivacyIncidentPayload;
  const validation = validateIncidentPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("privacy_incidents")
    .select(
      "id, title, description, severity, status, affected_data, containment_notes, authority_notification_required, authority_notified_at, customer_notification_required, customer_notified_at, detected_at, resolved_at, updated_at",
    )
    .eq("id", incidentId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Privacy incident was not found." },
      { status: 404 },
    );
  }

  const { reason, ...validatedPayload } = validation.value;
  const updatePayload = {
    ...validatedPayload,
    updated_at: new Date().toISOString(),
  };
  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return NextResponse.json({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("privacy_incidents")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, title, description, severity, status, affected_data, containment_notes, authority_notification_required, authority_notified_at, customer_notification_required, customer_notified_at, detected_at, resolved_at, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update privacy incident error:", updateError);
    return NextResponse.json(
      { error: "Could not update privacy incident." },
      { status: 500 },
    );
  }

  const needsFollowUp =
    updated.status !== "resolved" &&
    (updated.severity === "critical" ||
      updated.severity === "high" ||
      (updated.authority_notification_required && !updated.authority_notified_at) ||
      (updated.customer_notification_required && !updated.customer_notified_at));

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "privacy_incident_updated",
        eventDescription: "Admin updated a privacy or security incident.",
        metadata: {
          incidentId: existing.id,
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

    if (needsFollowUp) {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "privacy_incident_updated",
          title: "Privacy/security incident needs follow-up",
          message: `${updated.severity.toUpperCase()} incident updated: ${updated.title}`,
          priority:
            updated.severity === "critical" || updated.severity === "high"
              ? "urgent"
              : "high",
          metadata: {
            incidentId: updated.id,
            severity: updated.severity,
            status: updated.status,
            changedFields: fieldsChanged,
            authorityNotificationRequired: updated.authority_notification_required,
            authorityNotifiedAt: updated.authority_notified_at,
            customerNotificationRequired: updated.customer_notification_required,
            customerNotifiedAt: updated.customer_notified_at,
          },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Privacy incident update evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("privacy_incidents")
      .update({
        title: existing.title,
        description: existing.description,
        severity: existing.severity,
        status: existing.status,
        affected_data: existing.affected_data,
        containment_notes: existing.containment_notes,
        authority_notification_required: existing.authority_notification_required,
        authority_notified_at: existing.authority_notified_at,
        customer_notification_required: existing.customer_notification_required,
        customer_notified_at: existing.customer_notified_at,
        detected_at: existing.detected_at,
        resolved_at: existing.resolved_at,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Privacy incident update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Privacy incident update was not saved because Screenia could not store the required audit or admin notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ incident: updated, changedFields });
}
