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

const allowedStatuses = new Set(["draft", "submitted", "paid"]);

type TaxPaymentPayload = {
  period_start?: unknown;
  period_end?: unknown;
  taxable_amount_sek?: unknown;
  tax_amount_sek?: unknown;
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

function parseDateOnly(value: unknown) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : text;
}

function parseOreAmount(value: unknown) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 0 ? amount : null;
}

function parsePaidAt(value: unknown, status: string) {
  if (status !== "paid") return null;
  const text = String(value || "").trim();
  if (!text) return new Date().toISOString();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("tax_payments")
    .select(
      "id, period_start, period_end, currency, taxable_amount_sek, tax_amount_sek, status, paid_at, reference, notes, created_at, updated_at",
    )
    .order("period_start", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Load tax payments error:", error);
    return noStoreJson(
      { error: "Could not load tax payment records." },
      { status: 500 },
    );
  }

  return noStoreJson({ records: data || [] });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as TaxPaymentPayload;
  const reason = cleanReason(body.reason);

  if (reason.length < 5) {
    return noStoreJson(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const periodStart = parseDateOnly(body.period_start);
  const periodEnd = parseDateOnly(body.period_end);
  const taxableAmount = parseOreAmount(body.taxable_amount_sek);
  const taxAmount = parseOreAmount(body.tax_amount_sek);
  const status = String(body.status || "draft").trim();
  const paidAt = parsePaidAt(body.paid_at, status);

  if (!periodStart || !periodEnd || new Date(periodStart) >= new Date(periodEnd)) {
    return noStoreJson(
      { error: "Choose a valid tax period." },
      { status: 400 },
    );
  }

  if (taxableAmount === null || taxAmount === null) {
    return noStoreJson(
      { error: "Taxable amount and VAT amount must be non-negative whole ore values." },
      { status: 400 },
    );
  }

  if (!allowedStatuses.has(status)) {
    return noStoreJson(
      { error: "Choose a valid tax payment status." },
      { status: 400 },
    );
  }

  if (status === "paid" && !paidAt) {
    return noStoreJson(
      { error: "Choose a valid paid-at date." },
      { status: 400 },
    );
  }

  const reference = cleanString(body.reference, 160);

  if (status === "paid" && !reference) {
    return noStoreJson(
      { error: "Payment reference is required when marking a tax period paid." },
      { status: 400 },
    );
  }

  const insertPayload = {
    period_start: periodStart,
    period_end: periodEnd,
    currency: "sek",
    taxable_amount_sek: taxableAmount,
    tax_amount_sek: taxAmount,
    status,
    paid_at: paidAt,
    reference,
    notes: cleanString(body.notes, 1000),
  };

  const { data, error } = await supabaseAdmin
    .from("tax_payments")
    .insert(insertPayload)
    .select(
      "id, period_start, period_end, currency, taxable_amount_sek, tax_amount_sek, status, paid_at, reference, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Create tax payment error:", error);
    return noStoreJson(
      { error: "Could not create tax payment record." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_tax_payment_recorded",
        eventDescription: "Admin recorded a VAT/tax payment period.",
        metadata: {
          taxPaymentId: data.id,
          periodStart,
          periodEnd,
          taxableAmountSek: taxableAmount,
          taxAmountSek: taxAmount,
          status,
          paidAt,
          reference: insertPayload.reference,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Create tax payment audit error:", auditError);
    const { error: rollbackError } = await supabaseAdmin
      .from("tax_payments")
      .delete()
      .eq("id", data.id);

    if (rollbackError) {
      console.error("Create tax payment rollback error:", rollbackError);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            eventType: "admin_tax_payment_create_rollback_failed",
            title: "Tax payment creation rollback failed",
            message:
              "A VAT/tax payment record could not be removed after audit storage failed.",
            priority: "urgent",
            metadata: {
              taxPaymentId: data.id,
              periodStart,
              periodEnd,
              taxableAmountSek: taxableAmount,
              taxAmountSek: taxAmount,
              status,
              paidAt,
              reference: insertPayload.reference,
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
          "Create tax payment rollback failure notification error:",
          notificationError,
        );
        return noStoreJson(
          {
            error:
              "Tax payment audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return noStoreJson(
        {
          error:
            "Tax payment audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return noStoreJson(
      {
        error:
          "Tax payment record was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return noStoreJson({ record: data }, { status: 201 });
}
