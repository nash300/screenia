import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const allowedStatuses = new Set(["draft", "submitted", "paid"]);

type TaxPaymentUpdatePayload = {
  status?: unknown;
  paid_at?: unknown;
  reference?: unknown;
  notes?: unknown;
  reason?: unknown;
};

async function getAuthenticatedAdmin() {
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

function cleanString(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function parsePaidAt(value: unknown, status: string) {
  if (status !== "paid") return null;
  const text = String(value || "").trim();
  if (!text) return new Date().toISOString();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taxPaymentId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const { taxPaymentId } = await params;
  const body = (await request.json().catch(() => ({}))) as TaxPaymentUpdatePayload;
  const reason = cleanReason(body.reason);

  if (reason.length < 5) {
    return noStoreJson(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("tax_payments")
    .select(
      "id, period_start, period_end, taxable_amount_sek, tax_amount_sek, status, paid_at, reference, notes, updated_at",
    )
    .eq("id", taxPaymentId)
    .single();

  if (existingError || !existing) {
    return noStoreJson(
      { error: "Tax payment record was not found." },
      { status: 404 },
    );
  }

  const nextStatus =
    body.status === undefined ? existing.status : String(body.status || "").trim();
  if (!allowedStatuses.has(nextStatus)) {
    return noStoreJson(
      { error: "Choose a valid tax payment status." },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, string | null> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  if (body.reference !== undefined) {
    updatePayload.reference = cleanString(body.reference, 160);
  }

  if (body.notes !== undefined) {
    updatePayload.notes = cleanString(body.notes, 1000);
  }

  if (body.paid_at !== undefined || nextStatus !== existing.status) {
    const paidAt = parsePaidAt(body.paid_at, nextStatus);
    if (nextStatus === "paid" && !paidAt) {
      return noStoreJson(
        { error: "Choose a valid paid-at date." },
        { status: 400 },
      );
    }
    updatePayload.paid_at = paidAt;
  }

  const nextReference =
    updatePayload.reference !== undefined
      ? updatePayload.reference
      : existing.reference || null;

  if (nextStatus === "paid" && !nextReference) {
    return noStoreJson(
      { error: "Payment reference is required when marking a tax period paid." },
      { status: 400 },
    );
  }

  const fieldsChanged = changedFields(existing, updatePayload);

  if (fieldsChanged.length === 0) {
    return noStoreJson({ success: true, changedFields: [] });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("tax_payments")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(
      "id, period_start, period_end, currency, taxable_amount_sek, tax_amount_sek, status, paid_at, reference, notes, created_at, updated_at",
    )
    .single();

  if (updateError) {
    console.error("Update tax payment error:", updateError);
    return noStoreJson(
      { error: "Could not update tax payment record." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_tax_payment_updated",
        eventDescription: "Admin updated a VAT/tax payment period.",
        metadata: {
          taxPaymentId: existing.id,
          periodStart: existing.period_start,
          periodEnd: existing.period_end,
          changedFields: fieldsChanged,
          before: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
          after: Object.fromEntries(
            fieldsChanged.map((field) => [field, updatePayload[field]]),
          ),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Update tax payment audit error:", auditError);
    const { error: rollbackError } = await supabaseAdmin
      .from("tax_payments")
      .update({
        status: existing.status,
        paid_at: existing.paid_at,
        reference: existing.reference,
        notes: existing.notes,
        updated_at: existing.updated_at,
      })
      .eq("id", existing.id);

    if (rollbackError) {
      console.error("Update tax payment rollback error:", rollbackError);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            eventType: "admin_tax_payment_update_rollback_failed",
            title: "Tax payment update rollback failed",
            message:
              "A VAT/tax payment record could not be restored after audit storage failed.",
            priority: "urgent",
            metadata: {
              taxPaymentId: existing.id,
              periodStart: existing.period_start,
              periodEnd: existing.period_end,
              changedFields: fieldsChanged,
              before: Object.fromEntries(
                fieldsChanged.map((field) => [
                  field,
                  (existing as Record<string, unknown>)[field],
                ]),
              ),
              after: Object.fromEntries(
                fieldsChanged.map((field) => [field, updatePayload[field]]),
              ),
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackError: rollbackError.message,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Update tax payment rollback failure notification error:",
          notificationError,
        );
        return noStoreJson(
          {
            error:
              "Tax payment update audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return noStoreJson(
        {
          error:
            "Tax payment update audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return noStoreJson(
      {
        error:
          "Tax payment update was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return noStoreJson({ record: updated, changedFields: fieldsChanged });
}
