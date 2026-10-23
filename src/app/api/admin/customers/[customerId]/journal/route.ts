import { NextResponse } from "next/server";

import {
  getAuthenticatedAdmin,
  hasAdminPermission,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const allowedCategories = new Set([
  "general",
  "customer_question",
  "investigation",
  "troubleshooting",
  "decision",
  "follow_up",
]);

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const user = await getAuthenticatedAdmin({ persistSession: true });
  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  if (!hasAdminPermission(user, "customer.support")) {
    return noStoreJson(
      { error: "This admin role cannot add customer journal entries." },
      { status: 403 },
    );
  }

  const { customerId } = await params;
  const body = await request.json().catch(() => ({}));
  const category = String(body.category || "general").trim();
  const title = String(body.title || "").trim().slice(0, 120);
  const note = String(body.note || "").trim();

  if (!allowedCategories.has(category)) {
    return noStoreJson({ error: "Choose a valid journal category." }, { status: 400 });
  }
  if (note.length < 5 || note.length > 4000) {
    return noStoreJson(
      { error: "Journal entries must contain between 5 and 4,000 characters." },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return noStoreJson({ error: "Customer not found." }, { status: 404 });
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_journal_entry_created",
        eventDescription: "Admin added a customer journal entry.",
        metadata: { category, title: title || null, note },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (error) {
    console.error("Create customer journal entry error:", error);
    return noStoreJson(
      { error: "The journal entry could not be saved." },
      { status: 500 },
    );
  }

  return noStoreJson({ success: true });
}
