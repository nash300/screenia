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

const severities = new Set(["low", "medium", "high", "critical"]);
const statuses = new Set(["detected", "investigating", "contained", "resolved"]);

type PrivacyIncidentPayload = {
  title?: unknown;
  description?: unknown;
  severity?: unknown;
  status?: unknown;
  affected_data?: unknown;
  containment_notes?: unknown;
  authority_notification_required?: unknown;
  authority_notified_at?: unknown;
  customer_notification_required?: unknown;
  customer_notified_at?: unknown;
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

export function cleanOptionalText(value: unknown, maxLength: number) {
  return cleanText(value, maxLength) || null;
}

export function cleanReason(value: unknown) {
  return cleanText(value, 1000);
}

export function parseOptionalDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function validateIncidentPayload(body: PrivacyIncidentPayload) {
  const title = cleanText(body.title, 180);
  const description = cleanText(body.description, 2000);
  const severity = cleanText(body.severity || "medium", 20);
  const status = cleanText(body.status || "detected", 30);
  const reason = cleanReason(body.reason);
  const authorityNotifiedAt = parseOptionalDate(body.authority_notified_at);
  const customerNotifiedAt = parseOptionalDate(body.customer_notified_at);

  if (title.length < 5) return { error: "Incident title is required." };
  if (description.length < 10) {
    return { error: "Incident description must be at least 10 characters." };
  }
  if (!severities.has(severity)) return { error: "Choose a valid severity." };
  if (!statuses.has(status)) return { error: "Choose a valid status." };
  if (reason.length < 5) {
    return { error: "A reason of at least 5 characters is required." };
  }
  if (body.authority_notified_at && !authorityNotifiedAt) {
    return { error: "Choose a valid authority notification date." };
  }
  if (body.customer_notified_at && !customerNotifiedAt) {
    return { error: "Choose a valid customer notification date." };
  }

  return {
    value: {
      title,
      description,
      severity,
      status,
      affected_data: cleanOptionalText(body.affected_data, 1000),
      containment_notes: cleanOptionalText(body.containment_notes, 2000),
      authority_notification_required: Boolean(
        body.authority_notification_required,
      ),
      authority_notified_at: authorityNotifiedAt,
      customer_notification_required: Boolean(
        body.customer_notification_required,
      ),
      customer_notified_at: customerNotifiedAt,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
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
    .from("privacy_incidents")
    .select(
      "id, title, description, severity, status, affected_data, containment_notes, authority_notification_required, authority_notified_at, customer_notification_required, customer_notified_at, detected_at, resolved_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load privacy incidents error:", error);
    return NextResponse.json(
      { error: "Could not load privacy incidents." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { incidents: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PrivacyIncidentPayload;
  const validation = validateIncidentPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { reason, ...insertPayload } = validation.value;
  const { data, error } = await supabaseAdmin
    .from("privacy_incidents")
    .insert({
      ...insertPayload,
      created_by: user.id,
    })
    .select(
      "id, title, description, severity, status, affected_data, containment_notes, authority_notification_required, authority_notified_at, customer_notification_required, customer_notified_at, detected_at, resolved_at, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create privacy incident error:", error);
    return NextResponse.json(
      { error: "Could not create privacy incident." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "privacy_incident_created",
        eventDescription: "Admin recorded a privacy or security incident.",
        metadata: {
          incidentId: data.id,
          severity: data.severity,
          status: data.status,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );

    await createAdminNotification(
      supabaseAdmin,
      {
        eventType: "privacy_incident_created",
        title: "Privacy/security incident recorded",
        message: `${data.severity.toUpperCase()} incident: ${data.title}`,
        priority:
          data.severity === "critical" || data.severity === "high"
            ? "urgent"
            : "high",
        metadata: {
          incidentId: data.id,
          severity: data.severity,
          status: data.status,
        },
      },
      { throwOnError: true },
    );
  } catch (evidenceError) {
    console.error("Privacy incident creation evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("privacy_incidents")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Privacy incident creation rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Privacy incident was not saved because Screenia could not store the required audit or admin notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ incident: data }, { status: 201 });
}
