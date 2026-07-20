import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";
import {
  isValidSwedishRegistrationNumber,
  normalizeSwedishRegistrationNumber,
} from "@/lib/business/sweden";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const createAuthenticatedClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
};

function isMissingRelationError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}

function deleteErrorResponse(label: string, error: unknown) {
  console.error(`${label}:`, error);

  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === "development"
          ? `${label}: ${error instanceof Error ? error.message : JSON.stringify(error)}`
          : label,
    },
    { status: 500 },
  );
}

async function deleteByCustomerId(table: string, customerId: string, label: string) {
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq("customer_id", customerId);

  if (error && !isMissingRelationError(error)) {
    return deleteErrorResponse(label, error);
  }

  return null;
}

async function detachCustomerId(table: string, customerId: string, label: string) {
  const { error } = await supabaseAdmin
    .from(table)
    .update({ customer_id: null })
    .eq("customer_id", customerId);

  if (error && !isMissingRelationError(error)) {
    return deleteErrorResponse(label, error);
  }

  return null;
}

async function updateByCustomerId(
  table: string,
  customerId: string,
  payload: Record<string, unknown>,
  label: string,
) {
  const { error } = await supabaseAdmin
    .from(table)
    .update(payload)
    .eq("customer_id", customerId);

  if (error && !isMissingRelationError(error)) {
    return deleteErrorResponse(label, error);
  }

  return null;
}

async function listStoragePaths(bucket: string, prefix: string) {
  const paths: string[] = [];
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error || !data) return paths;

  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    if (item.id) {
      paths.push(path);
    } else {
      paths.push(...(await listStoragePaths(bucket, path)));
    }
  }

  return paths;
}

const anonymizedCustomerPayload = (customerId: string) => ({
  name: `Anonymized customer ${customerId.slice(0, 8)}`,
  email: null,
  phone: null,
  contact_person: null,
  organisation_number: null,
  billing_email: null,
  address: null,
  postal_code: null,
  city: null,
  country: "Sverige",
  business_category: null,
  website_url: null,
  preferred_contact_channel: null,
  remote_support_consent: false,
  analytics_consent: false,
  marketing_consent: false,
  onboarding_token: null,
  onboarding_token_expires_at: null,
  auth_user_id: null,
  business_description: null,
  opening_hours: null,
  promotions: null,
  social_media: null,
  content_option: null,
  content_collected_at: null,
  preview_url: null,
  preview_feedback: null,
  tracking_number: null,
  tracking_url: null,
  notes: `Anonymized by admin on ${new Date().toISOString()}. Payment/order/Stripe references retained for accounting, tax, dispute, and audit obligations.`,
});

const anonymizationColumnSelect = [
  "id",
  "name",
  "email",
  "phone",
  "contact_person",
  "organisation_number",
  "billing_email",
  "address",
  "postal_code",
  "city",
  "country",
  "business_category",
  "website_url",
  "preferred_contact_channel",
  "remote_support_consent",
  "analytics_consent",
  "marketing_consent",
  "onboarding_token",
  "onboarding_token_expires_at",
  "auth_user_id",
  "business_description",
  "opening_hours",
  "promotions",
  "social_media",
  "content_option",
  "content_collected_at",
  "preview_url",
  "preview_feedback",
  "tracking_number",
  "tracking_url",
  "notes",
].join(", ");

function normalizeOptionalString(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function cleanAdminReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function adminReasonIsValid(reason: string) {
  return reason.length >= 5;
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

async function rollbackCustomerProfileFields(
  customerId: string,
  fieldsChanged: string[],
  existing: Record<string, unknown>,
) {
  if (fieldsChanged.length === 0) {
    return { ok: true, errors: [] as string[] };
  }

  const { error } = await supabaseAdmin
    .from("customers")
    .update(
      Object.fromEntries(
        fieldsChanged.map((field) => [field, existing[field]]),
      ),
    )
    .eq("id", customerId);

  return { ok: !error, errors: error ? [error.message] : [] };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { customerId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();
  const reason = cleanAdminReason(body.reason);

  if (action === "publish_preview") {
    if (!adminReasonIsValid(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required before publishing a preview." },
        { status: 400 },
      );
    }

    const previewUrl = String(body.previewUrl || "").trim();
    let parsedPreviewUrl: URL;
    try {
      parsedPreviewUrl = new URL(previewUrl);
    } catch {
      return NextResponse.json(
        { error: "Enter a valid preview URL." },
        { status: 400 },
      );
    }

    if (
      !["http:", "https:"].includes(parsedPreviewUrl.protocol) ||
      previewUrl.length > 2000
    ) {
      return NextResponse.json(
        { error: "Preview links must use http or https and be shorter than 2,000 characters." },
        { status: 400 },
      );
    }

    const { data: existingPreview, error: previewLookupError } = await supabaseAdmin
      .from("customers")
      .select(
        "id, name, email, payment_status, service_access_status, preview_url, preview_status, preview_feedback, production_status",
      )
      .eq("id", customerId)
      .single();

    if (previewLookupError || !existingPreview) {
      return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
    }

    if (
      existingPreview.payment_status !== "paid" ||
      existingPreview.service_access_status !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            "Publish previews only for customers with paid, active service access. Resolve the billing or access issue first.",
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const previewUpdate = {
      preview_url: previewUrl,
      preview_status: "ready_for_review",
      preview_feedback: null,
      production_status: "ready_for_preview",
      updated_at: now,
    };
    const { error: previewUpdateError } = await supabaseAdmin
      .from("customers")
      .update(previewUpdate)
      .eq("id", existingPreview.id);

    if (previewUpdateError) {
      console.error("Publish customer preview error:", previewUpdateError);
      return NextResponse.json(
        { error: "Could not publish the customer preview." },
        { status: 500 },
      );
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: existingPreview.id,
          actorType: "admin",
          actorId: user.id,
          eventType: "customer_preview_published",
          eventDescription: "Admin published a customer design preview for review.",
          metadata: {
            previousPreviewUrl: existingPreview.preview_url,
            previousPreviewStatus: existingPreview.preview_status,
            previousPreviewFeedback: existingPreview.preview_feedback,
            previousProductionStatus: existingPreview.production_status,
            previewUrl,
            reason,
          },
          ipAddress: getRequestIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Publish customer preview audit error:", auditError);
      const { error: rollbackError } = await supabaseAdmin
        .from("customers")
        .update({
          preview_url: existingPreview.preview_url,
          preview_status: existingPreview.preview_status,
          preview_feedback: existingPreview.preview_feedback,
          production_status: existingPreview.production_status,
        })
        .eq("id", existingPreview.id);

      if (rollbackError) {
        await createAdminNotification(supabaseAdmin, {
          customerId: existingPreview.id,
          eventType: "customer_preview_publish_rollback_failed",
          title: "Preview publish rollback failed",
          message:
            "A customer preview audit failed and the previous preview state could not be restored.",
          priority: "urgent",
          metadata: {
            previewUrl,
            reason,
            auditError:
              auditError instanceof Error ? auditError.message : String(auditError),
            rollbackError: rollbackError.message,
          },
        });
      }

      return NextResponse.json(
        {
          error: rollbackError
            ? "Preview audit and rollback failed. Stop and investigate before publishing again."
            : "Preview was not published because audit evidence could not be stored.",
        },
        { status: 500 },
      );
    }

    let warning: string | null = null;
    let resendEmailId: string | null = null;
    if (existingPreview.email) {
      const accountUrl = `${new URL(request.url).origin}/account?section=content`;
      const safeName = escapeHtml(existingPreview.name || "kund");
      const safeAccountUrl = escapeHtml(accountUrl);
      const emailResult = await sendTransactionalEmail({
        to: existingPreview.email,
        subject: "Din Screenia-förhandsvisning är klar",
        text: `Hej ${existingPreview.name || "kund"},\n\nDin första förhandsvisning är klar. Logga in på ${accountUrl} för att godkänna den eller begära ändringar.\n\nScreenia`,
        html: renderBrandedEmail({
          eyebrow: "Förhandsvisning",
          title: "Din första design är klar",
          intro: `Hej ${safeName}. Granska förslaget i kundportalen och godkänn eller beskriv önskade ändringar.`,
          children: `<p style="margin:0 0 18px;color:#526579;">Öppna kundportalen för att se den aktuella förhandsvisningen. Kontrollera text, priser, bilder och helhetsintryck innan du godkänner.</p><a href="${safeAccountUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#155ee8;color:#ffffff;text-decoration:none;font-weight:700;">Granska förhandsvisningen</a>`,
        }),
      });

      if (emailResult.ok) {
        resendEmailId = emailResult.id || null;
      } else {
        warning = emailResult.error;
        await createAdminNotification(supabaseAdmin, {
          customerId: existingPreview.id,
          eventType: "customer_preview_email_failed",
          title: "Preview email was not sent",
          message: `The preview was published for ${existingPreview.name}, but the email notification failed.`,
          priority: "high",
          metadata: { previewUrl, reason, error: emailResult.error },
        });
      }
    } else {
      warning = "The preview was published, but this customer has no email address.";
    }

    await recordAuditEvent(supabaseAdmin, {
      customerId: existingPreview.id,
      actorType: "system",
      eventType: warning
        ? "customer_preview_email_failed"
        : "customer_preview_email_sent",
      eventDescription: warning
        ? "Customer preview email notification was not sent."
        : "Customer preview email notification was sent.",
      metadata: { previewUrl, warning, resendEmailId },
    });

    return NextResponse.json({ success: true, warning, resendEmailId });
  }

  const name = String(body.name || "").trim();
  const organisationNumber = normalizeOptionalString(body.organisation_number);
  const billingEmail = normalizeOptionalString(body.billing_email)?.toLowerCase() || null;
  const postalCode = normalizeOptionalString(body.postal_code)?.replace(/\s/g, "") || null;
  const preferredContactChannel =
    normalizeOptionalString(body.preferred_contact_channel) || "email";

  if (!adminReasonIsValid(reason)) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required before updating customer details." },
      { status: 400 },
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: "Company name is required." },
      { status: 400 },
    );
  }

  if (
    organisationNumber &&
    !isValidSwedishRegistrationNumber(organisationNumber)
  ) {
    return NextResponse.json(
      { error: "Enter a valid Swedish organisation number." },
      { status: 400 },
    );
  }

  if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(billingEmail)) {
    return NextResponse.json(
      { error: "Enter a valid billing email address." },
      { status: 400 },
    );
  }

  if (postalCode && !/^\d{5}$/.test(postalCode)) {
    return NextResponse.json(
      { error: "Enter a valid Swedish postal code." },
      { status: 400 },
    );
  }

  if (!["email", "phone", "sms"].includes(preferredContactChannel)) {
    return NextResponse.json(
      { error: "Choose a valid preferred contact channel." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("customers")
    .select(
      "id, name, contact_person, phone, organisation_number, billing_email, address, postal_code, city, country, business_category, website_url, preferred_contact_channel, notes",
    )
    .eq("id", customerId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  const updatePayload = {
    name,
    contact_person: normalizeOptionalString(body.contact_person),
    phone: normalizeOptionalString(body.phone),
    organisation_number: organisationNumber
      ? normalizeSwedishRegistrationNumber(organisationNumber)
      : null,
    billing_email: billingEmail,
    address: normalizeOptionalString(body.address),
    postal_code: postalCode,
    city: normalizeOptionalString(body.city),
    country: normalizeOptionalString(body.country) || "Sverige",
    business_category: normalizeOptionalString(body.business_category),
    website_url: normalizeOptionalString(body.website_url),
    preferred_contact_channel: preferredContactChannel,
    notes: normalizeOptionalString(body.notes),
  };

  const fieldsChanged = changedFields(existing, updatePayload);

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update(updatePayload)
    .eq("id", existing.id);

  if (updateError) {
    console.error("Update customer details error:", updateError);
    return NextResponse.json(
      { error: "Could not update customer details." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: existing.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_details_updated",
        eventDescription: "Admin updated customer business and contact details.",
        metadata: {
          changedFields: fieldsChanged,
          organisationNumberNormalized: Boolean(organisationNumber),
          billingEmailPresent: Boolean(billingEmail),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer detail update audit error:", auditError);
    const rollbackResult = await rollbackCustomerProfileFields(
      existing.id,
      fieldsChanged,
      existing as Record<string, unknown>,
    );

    if (!rollbackResult.ok) {
      console.error("Customer detail update rollback error:", rollbackResult.errors);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: existing.id,
            eventType: "customer_details_update_rollback_failed",
            title: "Customer detail rollback failed",
            message:
              "Customer profile fields could not be restored after audit storage failed.",
            priority: "urgent",
            metadata: {
              changedFields: fieldsChanged,
              organisationNumberNormalized: Boolean(organisationNumber),
              billingEmailPresent: Boolean(billingEmail),
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackErrors: rollbackResult.errors,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Customer detail update rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Customer detail update audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Customer detail update audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Customer details were not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, changedFields: fieldsChanged });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action !== "anonymize_customer") {
    return NextResponse.json({ error: "Unsupported customer action." }, { status: 400 });
  }

  const reason = cleanAdminReason(body.reason);

  if (!adminReasonIsValid(reason)) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required before anonymizing a customer." },
      { status: 400 },
    );
  }

  const { customerId } = await params;
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select(
      "id, name, email, status, payment_status, stripe_customer_id, stripe_subscription_id, auth_user_id",
    )
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  const profilePreflight = await supabaseAdmin
    .from("customers")
    .select(anonymizationColumnSelect)
    .eq("id", customer.id)
    .single();

  if (profilePreflight.error) {
    return deleteErrorResponse(
      "Anonymization cannot start because customer profile columns are missing. Apply the latest Supabase migrations first.",
      profilePreflight.error,
    );
  }

  const customerUpdatePayload = anonymizedCustomerPayload(customer.id);

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_anonymization_started",
        eventDescription:
          "Admin started customer anonymization before removing login access and private files.",
        metadata: {
          previousStatus: customer.status,
          previousPaymentStatus: customer.payment_status,
          hadStripeCustomer: Boolean(customer.stripe_customer_id),
          hadStripeSubscription: Boolean(customer.stripe_subscription_id),
          hasLinkedAuthUser: Boolean(customer.auth_user_id),
          reason,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    return deleteErrorResponse(
      "Customer anonymization cannot start because the audit event could not be stored.",
      auditError,
    );
  }

  if (customer.auth_user_id) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(
      customer.auth_user_id,
    );

    if (error && !/not found|does not exist/i.test(error.message)) {
      return deleteErrorResponse(
        "Could not delete linked customer auth account during anonymization.",
        error,
      );
    }
  }

  const storageBuckets = ["customer-display-assets", "customer-message-files"];
  for (const bucket of storageBuckets) {
    const paths = await listStoragePaths(bucket, customer.id);
    if (paths.length > 0) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (error) {
        return deleteErrorResponse(
          `Could not remove customer files from ${bucket}.`,
          error,
        );
      }
    }
  }

  for (const table of ["customer_message_files", "customer_messages", "customer_display_assets"]) {
    const response = await deleteByCustomerId(
      table,
      customer.id,
      `Could not delete customer operational records from ${table}.`,
    );
    if (response) return response;
  }

  for (const table of ["consent_records"]) {
    const response = await updateByCustomerId(
      table,
      customer.id,
      { ip_address: null, user_agent: null },
      `Could not remove consent technical identifiers from ${table}.`,
    );
    if (response) return response;
  }

  for (const table of ["customer_legal_agreements"]) {
    const response = await updateByCustomerId(
      table,
      customer.id,
      { accepted_ip: null, accepted_user_agent: null },
      `Could not remove legal agreement technical identifiers from ${table}.`,
    );
    if (response) return response;
  }

  for (const table of ["audit_events"]) {
    const response = await updateByCustomerId(
      table,
      customer.id,
      { ip_address: null, user_agent: null },
      `Could not remove audit technical identifiers from ${table}.`,
    );
    if (response) return response;
  }

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update(customerUpdatePayload)
    .eq("id", customer.id);

  if (updateError) {
    return deleteErrorResponse("Could not anonymize customer profile.", updateError);
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_anonymized",
        eventDescription:
          "Admin anonymized customer profile while retaining accounting and audit records.",
        metadata: {
          previousStatus: customer.status,
          previousPaymentStatus: customer.payment_status,
          hadStripeCustomer: Boolean(customer.stripe_customer_id),
          hadStripeSubscription: Boolean(customer.stripe_subscription_id),
          deletedAuthUser: Boolean(customer.auth_user_id),
          reason,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer anonymization final audit error:", auditError);

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "customer_anonymization_final_audit_failed",
          title: "Customer anonymization final audit failed",
          message:
            "Customer anonymization completed, but the final audit event could not be stored.",
          priority: "urgent",
          metadata: {
            previousStatus: customer.status,
            previousPaymentStatus: customer.payment_status,
            hadStripeCustomer: Boolean(customer.stripe_customer_id),
            hadStripeSubscription: Boolean(customer.stripe_subscription_id),
            deletedAuthUser: Boolean(customer.auth_user_id),
            reason,
            auditError:
              auditError instanceof Error ? auditError.message : String(auditError),
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Customer anonymization final audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Customer was anonymized, but final audit and urgent admin visibility could not be stored. Contact technical support before retrying.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Customer was anonymized, but the final audit event could not be stored. An urgent admin notification was created.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { customerId } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = cleanAdminReason(body.reason);
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!adminReasonIsValid(reason)) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required before deleting a customer." },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select(
      "id, name, status, payment_status, stripe_customer_id, stripe_subscription_id",
    )
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  const hasPaymentOrStripeHistory =
    Boolean(customer.stripe_customer_id || customer.stripe_subscription_id) ||
    ["paid", "failed", "refunded", "cancelled"].includes(
      customer.payment_status || "",
    );

  if (hasPaymentOrStripeHistory) {
    return NextResponse.json(
      {
        error:
          "Customers with payment or Stripe history cannot be permanently deleted. Suspend, refund, cancel, or anonymize the customer instead so accounting and dispute records remain traceable.",
      },
      { status: 409 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_deleted",
        eventDescription: "Admin deleted a customer record.",
        metadata: {
          customerName: customer.name,
          customerStatus: customer.status,
          paymentStatus: customer.payment_status,
          reason,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    return deleteErrorResponse(
      "Customer was not deleted because the audit event could not be stored.",
      auditError,
    );
  }

  const { data: devices } = await supabaseAdmin
    .from("devices")
    .select("id")
    .eq("customer_id", customer.id);
  const deviceIds = (devices || []).map((device) => device.id);

  for (const table of [
    "customer_message_files",
    "customer_messages",
    "customer_display_assets",
    "customer_legal_agreements",
    "consent_records",
    "customer_subscriptions",
  ]) {
    const response = await deleteByCustomerId(
      table,
      customer.id,
      `Could not delete customer records from ${table}.`,
    );
    if (response) return response;
  }

  for (const table of ["admin_notifications", "audit_events", "inventory_events", "inventory_items", "videos"]) {
    const response = await detachCustomerId(
      table,
      customer.id,
      `Could not detach customer records from ${table}.`,
    );
    if (response) return response;
  }

  if (deviceIds.length > 0) {
    for (const table of ["inventory_events", "inventory_items"]) {
      const { error: detachDeviceError } = await supabaseAdmin
        .from(table)
        .update({ device_id: null })
        .in("device_id", deviceIds);

      if (detachDeviceError && !isMissingRelationError(detachDeviceError)) {
        return deleteErrorResponse(
          `Could not detach device records from ${table}.`,
          detachDeviceError,
        );
      }
    }

    const { error: playlistDeleteError } = await supabaseAdmin
      .from("playlists")
      .delete()
      .in("device_id", deviceIds);

    if (playlistDeleteError) {
      return deleteErrorResponse(
        "Could not delete customer playlists.",
        playlistDeleteError,
      );
    }

    const { error: deviceDeleteError } = await supabaseAdmin
      .from("devices")
      .delete()
      .eq("customer_id", customer.id);

    if (deviceDeleteError) {
      return deleteErrorResponse("Could not delete customer devices.", deviceDeleteError);
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", customer.id);

  if (deleteError) {
    return deleteErrorResponse("Could not delete customer.", deleteError);
  }

  for (const bucket of ["customer-display-assets", "customer-message-files"]) {
    const paths = await listStoragePaths(bucket, customer.id);
    if (paths.length > 0) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
      if (error) {
        console.error("Customer delete storage cleanup error:", error);

        try {
          await createAdminNotification(
            supabaseAdmin,
            {
              eventType: "customer_delete_storage_cleanup_failed",
              title: "Deleted customer file cleanup failed",
              message:
                "Customer database records were deleted, but private storage files could not be removed.",
              priority: "urgent",
              metadata: {
                deletedCustomerId: customer.id,
                customerName: customer.name,
                customerStatus: customer.status,
                paymentStatus: customer.payment_status,
                bucket,
                pathCount: paths.length,
                samplePaths: paths.slice(0, 10),
                reason,
                cleanupError: error.message,
              },
            },
            { throwOnError: true },
          );
        } catch (notificationError) {
          console.error(
            "Customer delete storage cleanup failure notification error:",
            notificationError,
          );
          return NextResponse.json(
            {
              error:
                "Customer was deleted, but private file cleanup failed and urgent admin visibility could not be stored. Contact technical support before retrying.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Customer was deleted, but private file cleanup failed. An urgent admin notification was created.",
          },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
