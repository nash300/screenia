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

const documentTypes = new Set([
  "terms",
  "privacy",
  "cookie",
  "subscription_billing",
  "support_service",
]);
const statuses = new Set([
  "draft",
  "approved",
  "sent",
  "not_required",
  "needs_review",
]);

type LegalChangeNoticePayload = {
  document_type?: unknown;
  document_version?: unknown;
  change_summary?: unknown;
  effective_at?: unknown;
  notice_required?: unknown;
  reacceptance_required?: unknown;
  notice_status?: unknown;
  notice_sent_at?: unknown;
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

export function parseOptionalDateTime(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function validateLegalChangeNoticePayload(
  body: LegalChangeNoticePayload,
) {
  const documentType = cleanText(body.document_type, 80);
  const documentVersion = cleanText(body.document_version, 120);
  const changeSummary = cleanText(body.change_summary, 2000);
  const noticeStatus = cleanText(body.notice_status || "draft", 40);
  const effectiveAt = parseOptionalDateTime(body.effective_at);
  const noticeSentAt = parseOptionalDateTime(body.notice_sent_at);
  const reason = cleanText(body.reason, 1000);
  const noticeRequired = Boolean(body.notice_required);

  if (!documentTypes.has(documentType)) {
    return { error: "Choose a valid document type." };
  }
  if (documentVersion.length < 2) {
    return { error: "Document version is required." };
  }
  if (changeSummary.length < 10) {
    return { error: "Change summary must be at least 10 characters." };
  }
  if (!statuses.has(noticeStatus)) {
    return { error: "Choose a valid notice status." };
  }
  if (body.effective_at && !effectiveAt) {
    return { error: "Choose a valid effective date." };
  }
  if (body.notice_sent_at && !noticeSentAt) {
    return { error: "Choose a valid notice sent date." };
  }
  if (noticeStatus === "sent" && !noticeSentAt) {
    return { error: "Sent notices require a sent date." };
  }
  if (noticeStatus === "not_required" && noticeRequired) {
    return { error: "Notice-required changes cannot be marked not required." };
  }
  if (reason.length < 5) {
    return { error: "A reason of at least 5 characters is required." };
  }

  return {
    value: {
      document_type: documentType,
      document_version: documentVersion,
      change_summary: changeSummary,
      effective_at: effectiveAt,
      notice_required: noticeRequired,
      reacceptance_required: Boolean(body.reacceptance_required),
      notice_status: noticeStatus,
      notice_sent_at: noticeStatus === "sent" ? noticeSentAt : null,
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
    .from("legal_change_notices")
    .select(
      "id, document_type, document_version, change_summary, effective_at, notice_required, reacceptance_required, notice_status, notice_sent_at, evidence_reference, notes, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load legal change notices error:", error);
    return NextResponse.json(
      { error: "Could not load legal change notices." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { notices: data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as LegalChangeNoticePayload;
  const validation = validateLegalChangeNoticePayload(body);

  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { reason, ...insertPayload } = validation.value;
  const { data, error } = await supabaseAdmin
    .from("legal_change_notices")
    .insert({
      ...insertPayload,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(
      "id, document_type, document_version, change_summary, effective_at, notice_required, reacceptance_required, notice_status, notice_sent_at, evidence_reference, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create legal change notice error:", error);
    return NextResponse.json(
      { error: "Could not create legal change notice." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "legal_change_notice_recorded",
        eventDescription: "Admin recorded a legal or policy change notice.",
        metadata: {
          noticeId: data.id,
          documentType: data.document_type,
          documentVersion: data.document_version,
          noticeRequired: data.notice_required,
          reacceptanceRequired: data.reacceptance_required,
          noticeStatus: data.notice_status,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );

    if (data.notice_required && data.notice_status !== "sent") {
      await createAdminNotification(
        supabaseAdmin,
        {
          eventType: "legal_change_notice_recorded",
          title: "Legal notice needs follow-up",
          message: `${data.document_type} ${data.document_version} requires customer notice.`,
          priority: "high",
          metadata: { noticeId: data.id, documentType: data.document_type },
        },
        { throwOnError: true },
      );
    }
  } catch (evidenceError) {
    console.error("Legal change notice creation evidence error:", evidenceError);

    const { error: rollbackError } = await supabaseAdmin
      .from("legal_change_notices")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Legal change notice creation rollback error:", rollbackError);
    }

    return NextResponse.json(
      {
        error:
          "Legal change notice was not saved because Screenia could not store the required audit or notification evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ notice: data }, { status: 201 });
}
