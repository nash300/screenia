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

const statuses = new Set(["pending", "approved", "needs_review", "disabled"]);

type ProcessorReviewPayload = {
  provider?: unknown;
  processing_purpose?: unknown;
  dpa_verified?: unknown;
  security_reviewed?: unknown;
  account_owner_verified?: unknown;
  region_or_location?: unknown;
  evidence_reference?: unknown;
  review_status?: unknown;
  reviewed_at?: unknown;
  next_review_due?: unknown;
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

function parseOptionalDateTime(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function validateProcessorReviewPayload(body: ProcessorReviewPayload) {
  const provider = cleanText(body.provider, 120);
  const processingPurpose = cleanText(body.processing_purpose, 1000);
  const reviewStatus = cleanText(body.review_status || "pending", 40);
  const reviewedAt =
    parseOptionalDateTime(body.reviewed_at) ||
    (reviewStatus === "approved" ? new Date().toISOString() : null);
  const nextReviewDue = parseOptionalDate(body.next_review_due);
  const reason = cleanText(body.reason, 1000);

  if (provider.length < 2) return { error: "Provider is required." };
  if (processingPurpose.length < 10) {
    return { error: "Processing purpose must be at least 10 characters." };
  }
  if (!statuses.has(reviewStatus)) {
    return { error: "Choose a valid review status." };
  }
  if (body.reviewed_at && !reviewedAt) {
    return { error: "Choose a valid reviewed date." };
  }
  if (body.next_review_due && !nextReviewDue) {
    return { error: "Choose a valid next review date." };
  }
  if (reason.length < 5) {
    return { error: "A reason of at least 5 characters is required." };
  }

  return {
    value: {
      provider,
      processing_purpose: processingPurpose,
      dpa_verified: Boolean(body.dpa_verified),
      security_reviewed: Boolean(body.security_reviewed),
      account_owner_verified: Boolean(body.account_owner_verified),
      region_or_location: cleanText(body.region_or_location, 240) || null,
      evidence_reference: cleanText(body.evidence_reference, 1000) || null,
      review_status: reviewStatus,
      reviewed_at: reviewedAt,
      next_review_due: nextReviewDue,
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
    .from("processor_compliance_reviews")
    .select(
      "id, provider, processing_purpose, dpa_verified, security_reviewed, account_owner_verified, region_or_location, evidence_reference, review_status, reviewed_at, next_review_due, notes, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load processor reviews error:", error);
    return NextResponse.json(
      { error: "Could not load processor reviews." },
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

  const body = (await request.json().catch(() => ({}))) as ProcessorReviewPayload;
  const validation = validateProcessorReviewPayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { reason, ...insertPayload } = validation.value;
  const { data, error } = await supabaseAdmin
    .from("processor_compliance_reviews")
    .insert({
      ...insertPayload,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(
      "id, provider, processing_purpose, dpa_verified, security_reviewed, account_owner_verified, region_or_location, evidence_reference, review_status, reviewed_at, next_review_due, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create processor review error:", error);
    return NextResponse.json(
      { error: "Could not create processor review." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "processor_compliance_review_recorded",
        eventDescription: "Admin recorded processor compliance evidence.",
        metadata: {
          reviewId: data.id,
          provider: data.provider,
          reviewStatus: data.review_status,
          dpaVerified: data.dpa_verified,
          securityReviewed: data.security_reviewed,
          accountOwnerVerified: data.account_owner_verified,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );

    if (
      data.review_status === "needs_review" ||
      !data.dpa_verified ||
      !data.security_reviewed ||
      !data.account_owner_verified
    ) {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "processor_compliance_review_recorded",
          title: "Processor compliance needs review",
          message: `${data.provider} is not fully verified for live customer data.`,
          priority: "high",
          metadata: { reviewId: data.id, provider: data.provider },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Processor review creation evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("processor_compliance_reviews")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Processor review creation rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Processor review was not saved because Screenia could not store the required audit or admin notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
