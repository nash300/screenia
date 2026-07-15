import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type VatSummaryRow = {
  id: string;
  order_number: string | null;
  status: string | null;
  stripe_payment_status: string | null;
  stripe_invoice_id: string | null;
  total_amount_sek: number | null;
  tax_amount_sek: number | null;
  created_at: string;
  updated_at: string | null;
  customers:
    | {
        customer_number: string | null;
        name: string | null;
        organisation_number: string | null;
        billing_email: string | null;
      }
    | Array<{
        customer_number: string | null;
        name: string | null;
        organisation_number: string | null;
        billing_email: string | null;
      }>
    | null;
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

function defaultPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function parseDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function oreToSek(value: number) {
  return (value / 100).toFixed(2);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const fallbackPeriod = defaultPeriod();
  const from = parseDate(url.searchParams.get("from"), fallbackPeriod.from);
  const to = parseDate(url.searchParams.get("to"), fallbackPeriod.to);
  const format = url.searchParams.get("format") || "json";

  if (new Date(from) >= new Date(to)) {
    return noStoreJson(
      { error: "Choose a valid VAT period." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("customer_subscriptions")
    .select(
      `
        id,
        order_number,
        status,
        stripe_payment_status,
        stripe_invoice_id,
        total_amount_sek,
        tax_amount_sek,
        created_at,
        updated_at,
        customers(customer_number, name, organisation_number, billing_email)
      `,
    )
    .gte("created_at", from)
    .lt("created_at", to)
    .in("status", ["paid", "active"])
    .eq("tax_status", "complete")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("VAT summary error:", error);
    return noStoreJson(
      { error: "Could not create VAT summary." },
      { status: 500 },
    );
  }

  const rows = ((data || []) as unknown) as VatSummaryRow[];
  const totals = rows.reduce(
    (sum, row) => {
      const grossOre = Number(row.total_amount_sek || 0);
      const vatOre = Number(row.tax_amount_sek || 0);
      return {
        grossOre: sum.grossOre + grossOre,
        vatOre: sum.vatOre + vatOre,
        netOre: sum.netOre + Math.max(0, grossOre - vatOre),
      };
    },
    { grossOre: 0, vatOre: 0, netOre: 0 },
  );
  const exportedAt = new Date().toISOString();

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_vat_summary_exported",
        eventDescription: "Admin generated a VAT period summary.",
        metadata: {
          from,
          to,
          format,
          rowCount: rows.length,
          grossOre: totals.grossOre,
          vatOre: totals.vatOre,
          netOre: totals.netOre,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("VAT summary audit error:", auditError);
    return noStoreJson(
      { error: "VAT summary was not downloaded because audit storage failed." },
      { status: 500 },
    );
  }

  if (format === "csv") {
    const csvRows = [
      [
        "exported_at",
        "period_from",
        "period_to",
        "order_number",
        "created_at",
        "customer_number",
        "customer_name",
        "organisation_number",
        "billing_email",
        "stripe_invoice_id",
        "gross_ore",
        "gross_sek",
        "vat_ore",
        "vat_sek",
        "net_ore",
        "net_sek",
        "payment_status",
      ].join(","),
      ...rows.map((row) => {
        const customer = firstRelation(row.customers);
        const grossOre = Number(row.total_amount_sek || 0);
        const vatOre = Number(row.tax_amount_sek || 0);
        const netOre = Math.max(0, grossOre - vatOre);

        return [
          exportedAt,
          from,
          to,
          row.order_number,
          row.created_at,
          customer?.customer_number,
          customer?.name,
          customer?.organisation_number,
          customer?.billing_email,
          row.stripe_invoice_id,
          grossOre,
          oreToSek(grossOre),
          vatOre,
          oreToSek(vatOre),
          netOre,
          oreToSek(netOre),
          row.stripe_payment_status,
        ].map(csvCell).join(",");
      }),
      [
        exportedAt,
        from,
        to,
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        totals.grossOre,
        oreToSek(totals.grossOre),
        totals.vatOre,
        oreToSek(totals.vatOre),
        totals.netOre,
        oreToSek(totals.netOre),
        "",
      ].map(csvCell).join(","),
    ];
    const fileDate = from.slice(0, 10);

    return new NextResponse(`\uFEFF${csvRows.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="screenia-vat-summary-${fileDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      exportedAt,
      period: { from, to },
      totals: {
        grossOre: totals.grossOre,
        grossSek: oreToSek(totals.grossOre),
        vatOre: totals.vatOre,
        vatSek: oreToSek(totals.vatOre),
        netOre: totals.netOre,
        netSek: oreToSek(totals.netOre),
      },
      rows,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
