import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

function cleanString(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

async function rollbackCreatedCustomerDraft(customerId: string) {
  const { error } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", customerId);

  return { ok: !error, error };
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = cleanString(body.name, 200);
  const email = cleanString(body.email, 320)?.toLowerCase() || "";

  if (!name) {
    return NextResponse.json(
      { error: "Customer name is required." },
      { status: 400 },
    );
  }

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existingError) {
    console.error("Check existing customer error:", existingError);
    return NextResponse.json(
      { error: "Could not check existing customers." },
      { status: 500 },
    );
  }

  if ((existing || []).length > 0) {
    return NextResponse.json(
      { error: "A customer with this email already exists." },
      { status: 409 },
    );
  }

  const { data: customer, error: insertError } = await supabaseAdmin
    .from("customers")
    .insert({
      name,
      email,
      country: "Sverige",
      preferred_contact_channel: "email",
      status: "draft",
      marketing_consent: false,
      analytics_consent: false,
      remote_support_consent: false,
    })
    .select("id, name, email, status")
    .single();

  if (insertError || !customer) {
    console.error("Create admin customer draft error:", insertError);
    return NextResponse.json(
      { error: insertError?.message || "Could not create customer." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_customer_draft_created",
        eventDescription: "Admin manually created a customer draft.",
        metadata: {
          customerName: customer.name,
          email: customer.email,
          status: customer.status,
          actionSource: "admin_manual_customer_draft",
          consentDefaults: {
            marketing: false,
            analytics: false,
            remoteSupport: false,
          },
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Create admin customer draft audit error:", auditError);
    const rollbackResult = await rollbackCreatedCustomerDraft(customer.id);

    if (!rollbackResult.ok) {
      console.error("Create admin customer draft rollback error:", rollbackResult.error);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: customer.id,
            eventType: "admin_customer_draft_create_rollback_failed",
            title: "Customer draft rollback failed",
            message:
              "A manually created customer draft could not be removed after audit storage failed.",
            priority: "urgent",
            metadata: {
              customerName: customer.name,
              email: customer.email,
              status: customer.status,
              actionSource: "admin_manual_customer_draft",
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackError: rollbackResult.error
                ? rollbackResult.error.message
                : null,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Create admin customer draft rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Customer draft audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Customer draft audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Customer draft was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, customer });
}
