import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

type AccountingExportRow = {
  id: string;
  order_number: string | null;
  status: string | null;
  fulfillment_status: string | null;
  inventory_status: string | null;
  stripe_payment_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_invoice_id: string | null;
  screen_quantity: number | null;
  setup_fee_sek: number | null;
  base_setup_fee_sek: number | null;
  setup_included_screens: number | null;
  additional_setup_fee_per_screen_sek: number | null;
  additional_setup_screen_count: number | null;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  base_shipping_fee_sek: number | null;
  shipping_included_devices: number | null;
  additional_shipping_fee_per_device_sek: number | null;
  additional_shipping_device_count: number | null;
  monthly_fee_sek: number | null;
  total_amount_sek: number | null;
  tax_amount_sek: number | null;
  tax_status: string | null;
  trial_days: number | null;
  device_discount_percent: number | null;
  device_discount_months: number | null;
  stripe_current_period_start: string | null;
  stripe_current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  updated_at: string | null;
  customers:
    | {
        customer_number: string | null;
        name: string | null;
        email: string | null;
        billing_email: string | null;
        organisation_number: string | null;
        payment_status: string | null;
        service_access_status: string | null;
        inactive_reason: string | null;
        cancellation_reason: string | null;
        cancellation_source: string | null;
        cancelled_at: string | null;
        city: string | null;
        country: string | null;
      }
    | Array<{
        customer_number: string | null;
        name: string | null;
        email: string | null;
        billing_email: string | null;
        organisation_number: string | null;
        payment_status: string | null;
        service_access_status: string | null;
        inactive_reason: string | null;
        cancellation_reason: string | null;
        cancellation_source: string | null;
        cancelled_at: string | null;
        city: string | null;
        country: string | null;
      }>
    | null;
  pricing_plans:
    | {
        code: string | null;
        name: string | null;
        resolution: string | null;
        currency: string | null;
        tax_behavior: string | null;
      }
    | Array<{
        code: string | null;
        name: string | null;
        resolution: string | null;
        currency: string | null;
        tax_behavior: string | null;
      }>
    | null;
};

type CustomerRelation = {
    customer_number: string | null;
    name: string | null;
    email: string | null;
    billing_email: string | null;
    organisation_number: string | null;
    payment_status: string | null;
    service_access_status: string | null;
    inactive_reason: string | null;
    cancellation_reason: string | null;
    cancellation_source: string | null;
    cancelled_at: string | null;
    city: string | null;
    country: string | null;
};

type PricingRelation = {
  code: string | null;
  name: string | null;
  resolution: string | null;
  currency: string | null;
  tax_behavior: string | null;
};

const headers = [
  "exported_at",
  "order_number",
  "order_created_at",
  "customer_number",
  "customer_name",
  "customer_email",
  "billing_email",
  "organisation_number",
  "customer_payment_status",
  "service_access_status",
  "inactive_reason",
  "cancellation_reason",
  "cancellation_source",
  "cancelled_at",
  "city",
  "country",
  "plan_code",
  "plan_name",
  "resolution",
  "currency",
  "tax_behavior",
  "order_status",
  "payment_status",
  "fulfillment_status",
  "inventory_status",
  "screen_quantity",
  "setup_fee_sek",
  "base_setup_fee_sek",
  "setup_included_screens",
  "additional_setup_fee_per_screen_sek",
  "additional_setup_screen_count",
  "hardware_fee_sek",
  "shipping_fee_sek",
  "base_shipping_fee_sek",
  "shipping_included_devices",
  "additional_shipping_fee_per_device_sek",
  "additional_shipping_device_count",
  "monthly_fee_sek",
  "total_amount_ore",
  "total_amount_sek",
  "vat_amount_ore",
  "vat_amount_sek",
  "tax_status",
  "trial_days",
  "discount_percent",
  "discount_months",
  "stripe_checkout_session_id",
  "stripe_invoice_id",
  "period_start",
  "period_end",
  "cancel_at_period_end",
  "tracking_number",
  "tracking_url",
  "updated_at",
];

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function oreToSek(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return (value / 100).toFixed(2);
}

function sekValue(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return String(value);
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

  const { data, error } = await supabaseAdmin
    .from("customer_subscriptions")
    .select(
      `
        id,
        order_number,
        status,
        fulfillment_status,
        inventory_status,
        stripe_payment_status,
        stripe_checkout_session_id,
        stripe_invoice_id,
        screen_quantity,
        setup_fee_sek,
        base_setup_fee_sek,
        setup_included_screens,
        additional_setup_fee_per_screen_sek,
        additional_setup_screen_count,
        hardware_fee_sek,
        shipping_fee_sek,
        base_shipping_fee_sek,
        shipping_included_devices,
        additional_shipping_fee_per_device_sek,
        additional_shipping_device_count,
        monthly_fee_sek,
        total_amount_sek,
        tax_amount_sek,
        tax_status,
        trial_days,
        device_discount_percent,
        device_discount_months,
        stripe_current_period_start,
        stripe_current_period_end,
        cancel_at_period_end,
        tracking_number,
        tracking_url,
        created_at,
        updated_at,
        customers(customer_number, name, email, billing_email, organisation_number, payment_status, service_access_status, inactive_reason, cancellation_reason, cancellation_source, cancelled_at, city, country),
        pricing_plans(code, name, resolution, currency, tax_behavior)
      `,
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("Accounting export error:", error);
    return noStoreJson(
      { error: "Could not create accounting export." },
      { status: 500 },
    );
  }

  const exportedAt = new Date().toISOString();
  const rows = ((data || []) as unknown) as AccountingExportRow[];
  const csvRows = [
    headers.join(","),
    ...rows.map((row) => {
      const customer = firstRelation<CustomerRelation>(row.customers);
      const pricingPlan = firstRelation<PricingRelation>(row.pricing_plans);

      return [
        exportedAt,
        row.order_number,
        row.created_at,
        customer?.customer_number,
        customer?.name,
        customer?.email,
        customer?.billing_email,
        customer?.organisation_number,
        customer?.payment_status,
        customer?.service_access_status,
        customer?.inactive_reason,
        customer?.cancellation_reason,
        customer?.cancellation_source,
        customer?.cancelled_at,
        customer?.city,
        customer?.country,
        pricingPlan?.code,
        pricingPlan?.name,
        pricingPlan?.resolution,
        pricingPlan?.currency,
        pricingPlan?.tax_behavior,
        row.status,
        row.stripe_payment_status,
        row.fulfillment_status,
        row.inventory_status,
        row.screen_quantity,
        sekValue(row.setup_fee_sek),
        sekValue(row.base_setup_fee_sek),
        row.setup_included_screens,
        sekValue(row.additional_setup_fee_per_screen_sek),
        row.additional_setup_screen_count,
        sekValue(row.hardware_fee_sek),
        sekValue(row.shipping_fee_sek),
        sekValue(row.base_shipping_fee_sek),
        row.shipping_included_devices,
        sekValue(row.additional_shipping_fee_per_device_sek),
        row.additional_shipping_device_count,
        sekValue(row.monthly_fee_sek),
        row.total_amount_sek,
        oreToSek(row.total_amount_sek),
        row.tax_amount_sek,
        oreToSek(row.tax_amount_sek),
        row.tax_status,
        row.trial_days,
        row.device_discount_percent,
        row.device_discount_months,
        row.stripe_checkout_session_id,
        row.stripe_invoice_id,
        row.stripe_current_period_start,
        row.stripe_current_period_end,
        row.cancel_at_period_end,
        row.tracking_number,
        row.tracking_url,
        row.updated_at,
      ].map(csvCell).join(",");
    }),
  ];

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_accounting_export_downloaded",
        eventDescription: "Admin downloaded the accounting order export.",
        metadata: {
          exportedAt,
          format: "csv",
          rowCount: rows.length,
          maxRows: 5000,
          includedIdentifiers: [
            "order_number",
            "customer_number",
            "organisation_number",
            "customer_payment_status",
            "service_access_status",
            "cancellation_reason",
            "stripe_checkout_session_id",
            "stripe_invoice_id",
          ],
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Accounting export audit error:", auditError);
    return noStoreJson(
      { error: "Accounting export was not downloaded because audit storage failed." },
      { status: 500 },
    );
  }

  const fileDate = exportedAt.slice(0, 10);

  return new NextResponse(`\uFEFF${csvRows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="screenia-accounting-export-${fileDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
