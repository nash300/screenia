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
  "pending_review",
  "retain",
  "anonymize",
  "delete",
  "completed",
]);
const actions = new Set(["review", "retain", "anonymize", "delete"]);

type DataRetentionPayload = {
  record_area?: unknown;
  related_customer_id?: unknown;
  related_record_id?: unknown;
  legal_basis?: unknown;
  retention_reason?: unknown;
  retention_until?: unknown;
  review_status?: unknown;
  recommended_action?: unknown;
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

function parseOptionalDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : text.slice(0, 10);
}

export function validateDataRetentionPayload(body: DataRetentionPayload) {
  const recordArea = cleanText(body.record_area, 120);
  const legalBasis = cleanText(body.legal_basis, 240);
  const retentionReason = cleanText(body.retention_reason, 1000);
  const reviewStatus = cleanText(body.review_status || "pending_review", 40);
  const recommendedAction = cleanText(body.recommended_action || "review", 40);
  const retentionUntil = parseOptionalDate(body.retention_until);
  const reason = cleanText(body.reason, 1000);

  if (recordArea.length < 3) return { error: "Record area is required." };
  if (legalBasis.length < 5) return { error: "Legal basis is required." };
  if (retentionReason.length < 10) {
    return { error: "Retention reason must be at least 10 characters." };
  }
  if (!statuses.has(reviewStatus)) {
    return { error: "Choose a valid review status." };
  }
  if (!actions.has(recommendedAction)) {
    return { error: "Choose a valid recommended action." };
  }
  if (body.retention_until && !retentionUntil) {
    return { error: "Choose a valid retention-until date." };
  }
  if (reason.length < 5) {
    return { error: "A reason of at least 5 characters is required." };
  }

  return {
    value: {
      record_area: recordArea,
      related_customer_id: cleanText(body.related_customer_id, 80) || null,
      related_record_id: cleanText(body.related_record_id, 160) || null,
      legal_basis: legalBasis,
      retention_reason: retentionReason,
      retention_until: retentionUntil,
      review_status: reviewStatus,
      recommended_action: recommendedAction,
      completed_at:
        reviewStatus === "completed" ? new Date().toISOString() : null,
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
    .from("data_retention_reviews")
    .select(
      "id, record_area, related_customer_id, related_record_id, legal_basis, retention_reason, retention_until, review_status, recommended_action, completed_at, notes, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load data retention reviews error:", error);
    return NextResponse.json(
      { error: "Could not load data retention reviews." },
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

  const body = (await request.json().catch(() => ({}))) as DataRetentionPayload;
  const validation = validateDataRetentionPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { reason, ...insertPayload } = validation.value;
  const { data, error } = await supabaseAdmin
    .from("data_retention_reviews")
    .insert({
      ...insertPayload,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(
      "id, record_area, related_customer_id, related_record_id, legal_basis, retention_reason, retention_until, review_status, recommended_action, completed_at, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create data retention review error:", error);
    return NextResponse.json(
      { error: "Could not create data retention review." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "data_retention_review_recorded",
        eventDescription: "Admin recorded a data retention review.",
        metadata: {
          reviewId: data.id,
          recordArea: data.record_area,
          reviewStatus: data.review_status,
          recommendedAction: data.recommended_action,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );

    if (["anonymize", "delete"].includes(data.recommended_action)) {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "data_retention_review_recorded",
          title: "Data retention action needs review",
          message: `${data.record_area} is marked for ${data.recommended_action}.`,
          priority: "high",
          metadata: {
            reviewId: data.id,
            recommendedAction: data.recommended_action,
          },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Data retention review creation evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("data_retention_reviews")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Data retention review creation rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Data retention review was not saved because Screenia could not store the required audit or admin notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
