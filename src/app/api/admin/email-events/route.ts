import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EmailEvidence = {
  id: string;
  source: "outbound_attempt" | "delivery_event";
  svix_id: string | null;
  event_type: string;
  resend_email_id: string | null;
  recipient_email: string | null;
  subject: string | null;
  event_status: string;
  raw_payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
};

export async function GET() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: deliveryEvents, error: deliveryError } = await supabaseAdmin
    .from("resend_delivery_events")
    .select(
      "id, svix_id, event_type, resend_email_id, recipient_email, subject, event_status, raw_payload, received_at, processed_at",
    )
    .order("received_at", { ascending: false })
    .limit(100);

  if (deliveryError) {
    console.error("Load Resend delivery events error:", deliveryError);
    return NextResponse.json(
      { error: "Could not load email delivery events." },
      { status: 500 },
    );
  }

  const { data: outboundAttempts, error: outboundError } = await supabaseAdmin
    .from("audit_events")
    .select("id, event_type, event_description, metadata, created_at")
    .ilike("event_type", "%email%")
    .order("created_at", { ascending: false })
    .limit(100);

  if (outboundError) {
    console.error("Load outbound email audit events error:", outboundError);
    return NextResponse.json(
      { error: "Could not load outbound email evidence." },
      { status: 500 },
    );
  }

  const outboundEvidence: EmailEvidence[] = (outboundAttempts || []).map(
    (event) => {
      const metadata = (event.metadata || {}) as Record<string, unknown>;
      const recipient =
        typeof metadata.sentTo === "string"
          ? metadata.sentTo
          : typeof metadata.to === "string"
            ? metadata.to
            : null;
      const resendEmailId =
        typeof metadata.resendEmailId === "string"
          ? metadata.resendEmailId
          : null;
      const failed =
        event.event_type.includes("failed") ||
        event.event_type.includes("not_configured") ||
        event.event_type.includes("audit_failed");

      return {
        id: `audit-${event.id}`,
        source: "outbound_attempt",
        svix_id: null,
        event_type: event.event_type,
        resend_email_id: resendEmailId,
        recipient_email: recipient,
        subject:
          typeof metadata.subject === "string"
            ? metadata.subject
            : event.event_description,
        event_status: failed ? "failed" : "sent",
        raw_payload: metadata,
        received_at: event.created_at,
        processed_at: event.created_at,
      };
    },
  );

  const deliveryEvidence: EmailEvidence[] = (deliveryEvents || []).map(
    (event) => ({
      ...event,
      source: "delivery_event",
      svix_id: event.svix_id,
    }),
  );

  const events = [...outboundEvidence, ...deliveryEvidence]
    .sort(
      (a, b) =>
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
    )
    .slice(0, 150);

  return NextResponse.json(
    { events },
    { headers: { "Cache-Control": "no-store" } },
  );
}
