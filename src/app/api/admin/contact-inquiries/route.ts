import { NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  hasAdminPermission,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasAdminPermission(user, "customer.read")) {
    return NextResponse.json(
      { error: "This admin role cannot view visitor messages." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contact_inquiries")
    .select(
      "id, case_number, name, email, company_name, subject, message, status, privacy_accepted_at, confirmation_email_id, confirmation_email_status, admin_notification_email_id, admin_notification_email_status, first_opened_at, closed_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load contact inquiries error:", error);
    return NextResponse.json(
      { error: "Could not load visitor messages." },
      { status: 500 },
    );
  }

  const firstNew = (data || []).filter((item) => item.status === "new");
  if (firstNew.length > 0) {
    await supabaseAdmin
      .from("contact_inquiries")
      .update({ status: "open", first_opened_at: new Date().toISOString() })
      .in(
        "id",
        firstNew.map((item) => item.id),
      );
  }

  return NextResponse.json(
    {
      inquiries: (data || []).map((item) => ({
        ...item,
        status: item.status === "new" ? "open" : item.status,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasAdminPermission(user, "customer.support")) {
    return NextResponse.json(
      { error: "This admin role cannot update visitor messages." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const inquiryId = String(body?.inquiryId || "").trim();
  const status = String(body?.status || "").trim();

  if (!inquiryId || !["open", "closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status update." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("contact_inquiries")
    .update({
      status,
      closed_at: status === "closed" ? now : null,
      closed_by: status === "closed" ? user.id : null,
    })
    .eq("id", inquiryId);

  if (error) {
    return NextResponse.json(
      { error: "Could not update message status." },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin",
    actorId: user.id,
    eventType: `visitor_contact_inquiry_${status}`,
    eventDescription: `Admin marked a visitor contact inquiry as ${status}.`,
    metadata: { inquiryId },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}
