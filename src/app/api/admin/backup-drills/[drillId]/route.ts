import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedAdmin,
  validateBackupDrillPayload,
} from "@/app/api/admin/backup-drills/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type BackupDrillPayload = Parameters<typeof validateBackupDrillPayload>[0];

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
  { params }: { params: Promise<{ drillId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { drillId } = await params;
  const body = (await request.json().catch(() => ({}))) as BackupDrillPayload;
  const validation = validateBackupDrillPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("backup_restore_drills")
    .select(
      "id, provider, backup_scope, status, last_successful_backup_at, restore_tested_at, evidence_reference, notes, updated_by, updated_at",
    )
    .eq("id", drillId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Backup restore drill was not found." },
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
    .from("backup_restore_drills")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, provider, backup_scope, status, last_successful_backup_at, restore_tested_at, evidence_reference, notes, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update backup restore drill error:", updateError);
    return NextResponse.json(
      { error: "Could not update backup restore drill." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "backup_restore_drill_updated",
        eventDescription: "Admin updated backup or restore readiness evidence.",
        metadata: {
          drillId: existing.id,
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
    console.error("Backup restore drill update audit error:", auditError);

    const { error: rollbackError } = await supabaseAdmin
      .from("backup_restore_drills")
      .update({
        provider: existing.provider,
        backup_scope: existing.backup_scope,
        status: existing.status,
        last_successful_backup_at: existing.last_successful_backup_at,
        restore_tested_at: existing.restore_tested_at,
        evidence_reference: existing.evidence_reference,
        notes: existing.notes,
        updated_by: existing.updated_by,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Backup restore drill update rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Backup restore drill update was not saved because Screenia could not store the required audit evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ drill: updated, changedFields });
}
