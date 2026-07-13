import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent, recordConsent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { CURRENT_PRIVACY_DOCUMENT } from "@/lib/legal/documents";

type ConsentPayload = {
  marketingConsent?: boolean;
  analyticsConsent?: boolean;
  remoteSupportConsent?: boolean;
};

const consentDefinitions = [
  {
    bodyKey: "marketingConsent",
    column: "marketing_consent",
    consentType: "marketing",
    documentName: "Samtycke till marknadsforing",
    statement:
      "Screenia far kontakta kunden med nyheter, erbjudanden och marknadsforing.",
  },
  {
    bodyKey: "analyticsConsent",
    column: "analytics_consent",
    consentType: "analytics",
    documentName: "Samtycke till statistik",
    statement:
      "Screenia far anvanda frivillig statistik for att forbattra tjansten.",
  },
  {
    bodyKey: "remoteSupportConsent",
    column: "remote_support_consent",
    consentType: "remote_support",
    documentName: "Samtycke till fjarrsupport",
    statement:
      "Screenia far kontakta kunden och ge fjarrsupport nar kunden ber om hjalp.",
  },
] as const;

async function rollbackConsentFlags(
  customerId: string,
  changedConsents: Array<{ consentType: string; previousValue: boolean }>,
) {
  const rollbackPayload: Record<string, boolean> = {};

  for (const consent of changedConsents) {
    const definition = consentDefinitions.find(
      (item) => item.consentType === consent.consentType,
    );
    if (definition) {
      rollbackPayload[definition.column] = consent.previousValue;
    }
  }

  if (Object.keys(rollbackPayload).length === 0) return;

  await supabaseAdmin.from("customers").update(rollbackPayload).eq("id", customerId);
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ConsentPayload;
  const updatePayload: Record<string, boolean> = {};
  const changedConsents: Array<{
    consentType: string;
    granted: boolean;
    previousValue: boolean;
    statement: string;
    documentName: string;
  }> = [];

  for (const definition of consentDefinitions) {
    const nextValue = body[definition.bodyKey as keyof ConsentPayload];
    if (typeof nextValue !== "boolean") continue;

    const previousValue = Boolean(
      (customer as Record<string, unknown>)[definition.column],
    );

    if (nextValue === previousValue) continue;

    updatePayload[definition.column] = nextValue;
    changedConsents.push({
      consentType: definition.consentType,
      granted: nextValue,
      previousValue,
      statement: definition.statement,
      documentName: definition.documentName,
    });
  }

  if (changedConsents.length === 0) {
    return NextResponse.json({
      success: true,
      changedConsents: [],
      customer: {
        marketing_consent: Boolean(customer.marketing_consent),
        analytics_consent: Boolean(customer.analytics_consent),
        remote_support_consent: Boolean(customer.remote_support_consent),
      },
    });
  }

  const { data: updatedCustomer, error } = await supabaseAdmin
    .from("customers")
    .update(updatePayload)
    .eq("id", customer.id)
    .select("marketing_consent, analytics_consent, remote_support_consent")
    .single();

  if (error || !updatedCustomer) {
    console.error("Update customer consent error:", error);
    return NextResponse.json(
      { error: "Could not update consent settings." },
      { status: 500 },
    );
  }

  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    await Promise.all(
      changedConsents.map((consent) =>
        recordConsent(
          supabaseAdmin,
          {
            customerId: customer.id,
            consentType: consent.consentType,
            granted: consent.granted,
            statement: consent.statement,
            documentName: consent.documentName,
            documentVersion: CURRENT_PRIVACY_DOCUMENT.version,
            documentUrl: CURRENT_PRIVACY_DOCUMENT.url,
            collectionPoint: "customer_account_consent_settings",
            ipAddress,
            userAgent,
          },
          { throwOnError: true },
        ),
      ),
    );

    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
        eventType: "customer_consent_settings_updated",
        eventDescription: "Customer updated optional consent settings.",
        metadata: {
          changedConsents,
          privacyVersion: CURRENT_PRIVACY_DOCUMENT.version,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (evidenceError) {
    const message =
      evidenceError instanceof Error
        ? evidenceError.message
        : "Unknown consent evidence storage error";
    await rollbackConsentFlags(customer.id, changedConsents);
    await createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "customer_consent_evidence_failed",
      title: "Customer consent evidence failed",
      message:
        "A customer consent change was rolled back because consent record or audit evidence could not be stored.",
      priority: "urgent",
      metadata: {
        changedConsents,
        privacyVersion: CURRENT_PRIVACY_DOCUMENT.version,
        error: message,
      },
    });

    return NextResponse.json(
      {
        error:
          "Consent settings were not saved because Screenia could not store the required consent evidence.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    changedConsents,
    customer: updatedCustomer,
  });
}
