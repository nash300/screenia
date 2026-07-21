import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

export const dynamic = "force-dynamic";
export const DATA_EXPORT_LIMIT = 3;
export const DATA_EXPORT_WINDOW_MS = 60 * 60 * 1000;

type AuditEventExportRow = {
  id: string;
  actor_type: string;
  event_type: string;
  event_description: string;
  created_at: string;
};

const CUSTOMER_EXPORT_FIELDS = [
  "id",
  "name",
  "email",
  "phone",
  "contact_person",
  "organisation_number",
  "address",
  "city",
  "country",
  "status",
  "payment_status",
  "activated_at",
  "cancelled_at",
  "inactive_reason",
  "created_at",
  "website_url",
  "marketing_consent",
  "analytics_consent",
  "remote_support_consent",
  "service_access_status",
  "service_access_until",
  "business_description",
  "opening_hours",
  "promotions",
  "social_media",
  "content_option",
  "content_collected_at",
  "preview_status",
  "preview_url",
  "preview_feedback",
  "production_status",
] as const;

function buildCustomerExport(customer: Record<string, unknown>) {
  return Object.fromEntries(
    CUSTOMER_EXPORT_FIELDS.map((field) => [field, customer[field] ?? null]),
  );
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    key: `account-export:${customer.id}`,
    limit: DATA_EXPORT_LIMIT,
    windowMs: DATA_EXPORT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    await recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "customer",
      actorId: user.id,
      eventType: "customer_data_export_rate_limited",
      eventDescription: "Customer data export request was rate limited.",
      metadata: {
        limit: DATA_EXPORT_LIMIT,
        windowMs: DATA_EXPORT_WINDOW_MS,
      },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      { error: "För många dataexporter. Försök igen senare." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimit),
      },
    );
  }

  const [
    subscriptionsResult,
    devicesResult,
    messagesResult,
    displayAssetsResult,
    agreementsResult,
    consentsResult,
    auditEventsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("customer_subscriptions")
      .select(
        "id, order_number, status, setup_fee_paid, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, base_shipping_fee_sek, shipping_included_devices, additional_shipping_fee_per_device_sek, additional_shipping_device_count, monthly_fee_sek, trial_days, trial_starts_at, trial_ends_at, tax_status, tax_amount_sek, total_amount_sek, fulfillment_status, inventory_status, tracking_number, tracking_url, stripe_payment_status, stripe_current_period_start, stripe_current_period_end, cancel_at_period_end, cancellation_effective_at, pause_started_at, pause_resumes_at, pause_reason, created_at, updated_at",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("devices")
      .select(
        "id, device_code, name, is_active, make, model, serial_number, location, inventory_status, assigned_at, created_at, updated_at",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("customer_messages")
      .select(
        "id, ticket_number, request_type, priority, related_ticket_number, subject, message, status, resolved_at, created_at, customer_message_files(id, file_name, content_type, file_size, created_at)",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("customer_display_assets")
      .select(
        "id, file_name, content_type, file_size, asset_category, description, source, status, reviewed_at, created_at",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("customer_legal_agreements")
      .select(
        "id, document_type, document_title, document_version, document_effective_at, document_url, pdf_url, content_snapshot, collection_point, accepted_at",
      )
      .eq("customer_id", customer.id)
      .order("accepted_at", { ascending: false }),
    supabaseAdmin
      .from("consent_records")
      .select(
        "id, consent_type, granted, statement, document_name, document_version, document_url, collection_point, created_at",
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("audit_events")
      .select("id, actor_type, event_type, event_description, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const sourceErrors = [
    { section: "subscriptions", error: subscriptionsResult.error },
    { section: "devices", error: devicesResult.error },
    { section: "messages", error: messagesResult.error },
    { section: "displayAssets", error: displayAssetsResult.error },
    { section: "legalAgreements", error: agreementsResult.error },
    { section: "consentRecords", error: consentsResult.error },
    { section: "auditEvents", error: auditEventsResult.error },
  ].filter((item) => item.error);

  if (sourceErrors.length > 0) {
    const failedSections = sourceErrors.map((item) => item.section);
    const errorMessages = sourceErrors.map(
      (item) => `${item.section}: ${item.error?.message || "unknown error"}`,
    );

    await Promise.all([
      recordAuditEvent(supabaseAdmin, {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
        eventType: "customer_data_export_failed",
        eventDescription:
          "Customer data export failed because one or more source sections could not be loaded.",
        metadata: {
          failedSections,
          errors: errorMessages,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      }),
      createAdminNotification(supabaseAdmin, {
        customerId: customer.id,
        eventType: "customer_data_export_failed",
        title: "Customer data export failed",
        message: `A customer data export failed for sections: ${failedSections.join(", ")}.`,
        priority: "urgent",
        metadata: {
          failedSections,
          errors: errorMessages,
        },
      }),
    ]);

    return NextResponse.json(
      {
        error:
          "Dataexporten kunde inte skapas fullständigt. Kontakta Screenia support.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          ...rateLimitHeaders(rateLimit),
        },
      },
    );
  }

  const subscriptions = subscriptionsResult.data;
  const devices = devicesResult.data;
  const messages = messagesResult.data;
  const displayAssets = displayAssetsResult.data;
  const agreements = agreementsResult.data;
  const consents = consentsResult.data;
  const auditEvents = auditEventsResult.data;
  const customerExport = buildCustomerExport(customer as Record<string, unknown>);

  const exportedAt = new Date().toISOString();
  const payload = {
    export: {
      product: "Screenia",
      type: "customer_data_export",
      exportedAt,
      customerId: customer.id,
      formatVersion: 1,
      note:
        "This export contains customer-visible Screenia account, subscription, device, message, uploaded-material metadata, consent, legal agreement, and customer audit records. Internal admin notes, raw audit metadata, and provider secrets are excluded.",
    },
    customer: customerExport,
    subscriptions: subscriptions || [],
    devices: devices || [],
    messages: messages || [],
    displayAssets: displayAssets || [],
    legalAgreements: agreements || [],
    consentRecords: consents || [],
    auditEvents: ((auditEvents || []) as AuditEventExportRow[]).filter(
      (event) => event.actor_type !== "stripe",
    ),
  };

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "customer",
    actorId: user.id,
    eventType: "customer_data_export_downloaded",
    eventDescription: "Customer downloaded account data export.",
    metadata: {
      exportedAt,
      formatVersion: 1,
      includedSections: [
        "customer",
        "subscriptions",
        "devices",
        "messages",
        "displayAssets",
        "legalAgreements",
        "consentRecords",
        "auditEvents",
      ],
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  const fileDate = exportedAt.slice(0, 10);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="screenia-data-export-${fileDate}.json"`,
      "Cache-Control": "no-store",
      ...rateLimitHeaders(rateLimit),
    },
  });
}
