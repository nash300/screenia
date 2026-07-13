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

const statuses = new Set([
  "planned",
  "backup_verified",
  "restore_tested",
  "needs_attention",
]);

type BackupDrillPayload = {
  provider?: unknown;
  backup_scope?: unknown;
  status?: unknown;
  last_successful_backup_at?: unknown;
  restore_tested_at?: unknown;
  evidence_reference?: unknown;
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

export function parseOptionalDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function validateBackupDrillPayload(body: BackupDrillPayload) {
  const provider = cleanText(body.provider, 120);
  const backupScope = cleanText(body.backup_scope, 500);
  const status = cleanText(body.status || "planned", 40);
  const lastSuccessfulBackupAt = parseOptionalDate(
    body.last_successful_backup_at,
  );
  const restoreTestedAt = parseOptionalDate(body.restore_tested_at);
  const reason = cleanText(body.reason, 1000);

  if (provider.length < 2) return { error: "Provider is required." };
  if (backupScope.length < 5) {
    return { error: "Backup scope must be at least 5 characters." };
  }
  if (!statuses.has(status)) return { error: "Choose a valid backup status." };
  if (body.last_successful_backup_at && !lastSuccessfulBackupAt) {
    return { error: "Choose a valid successful backup date." };
  }
  if (body.restore_tested_at && !restoreTestedAt) {
    return { error: "Choose a valid restore test date." };
  }
  if (status === "restore_tested" && !restoreTestedAt) {
    return { error: "Restore-tested records require a restore test date." };
  }
  if (reason.length < 5) {
    return { error: "A reason of at least 5 characters is required." };
  }

  return {
    value: {
      provider,
      backup_scope: backupScope,
      status,
      last_successful_backup_at: lastSuccessfulBackupAt,
      restore_tested_at: restoreTestedAt,
      evidence_reference: cleanText(body.evidence_reference, 1000) || null,
      notes: cleanText(body.notes, 2000) || null,
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
    .from("backup_restore_drills")
    .select(
      "id, provider, backup_scope, status, last_successful_backup_at, restore_tested_at, evidence_reference, notes, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load backup restore drills error:", error);
    return NextResponse.json(
      { error: "Could not load backup restore drills." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { drills: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as BackupDrillPayload;
  const validation = validateBackupDrillPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { reason, ...insertPayload } = validation.value;
  const { data, error } = await supabaseAdmin
    .from("backup_restore_drills")
    .insert({
      ...insertPayload,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(
      "id, provider, backup_scope, status, last_successful_backup_at, restore_tested_at, evidence_reference, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create backup restore drill error:", error);
    return NextResponse.json(
      { error: "Could not create backup restore drill." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "backup_restore_drill_recorded",
        eventDescription: "Admin recorded backup or restore readiness evidence.",
        metadata: {
          drillId: data.id,
          provider: data.provider,
          status: data.status,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );

    if (data.status === "needs_attention") {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "backup_restore_drill_recorded",
          title: "Backup/restore needs attention",
          message: `${data.provider} backup scope needs attention: ${data.backup_scope}`,
          priority: "urgent",
          metadata: { drillId: data.id, provider: data.provider },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Backup restore drill creation evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("backup_restore_drills")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Backup restore drill creation rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Backup restore drill was not saved because Screenia could not store the required audit or notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ drill: data }, { status: 201 });
}
