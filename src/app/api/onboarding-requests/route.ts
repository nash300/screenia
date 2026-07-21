import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { getRequestIp, recordAuditEvent, recordConsent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { CURRENT_PRIVACY_DOCUMENT } from "@/lib/legal/documents";
import {
  escapeHtml,
  formatSek,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";
import {
  ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
  INCLUDED_SETUP_SCREEN_COUNT,
  additionalSetupScreenCount,
  calculateSetupFeeSek,
} from "@/lib/pricing/setup-fee";
import {
  ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
  BASE_SHIPPING_FEE_SEK,
  INCLUDED_SHIPPING_DEVICE_COUNT,
  additionalShippingDeviceCount,
  calculateShippingFeeSek,
} from "@/lib/pricing/shipping-fee";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const validPlanCodes = new Set<string>(PRICING_PLANS.map((plan) => plan.code));
const requestRateLimitWindowMs = 60 * 60 * 1000;
const requestRateLimitMax = 5;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidOptionalPhone = (value: string) => {
  if (!value) return true;
  if (!/^[+0-9().\-\s]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

type RequestPlan = (typeof PRICING_PLANS)[number];
type RequestQuoteItem = { plan: RequestPlan; quantity: number };

function requestReceivedAt(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function sendRequestConfirmationEmail({
  email,
  companyName,
  contactPerson,
  quoteItems,
  message,
  requestedAt,
}: {
  email: string;
  companyName: string;
  contactPerson: string;
  quoteItems: RequestQuoteItem[];
  message: string;
  requestedAt: string;
}) {
  const screenQuantity = quoteItems.reduce((sum, item) => sum + item.quantity, 0);
  const baseSetupFeeSek = quoteItems[0]?.plan.setupFeeSek || 0;
  const setupFeeSek = calculateSetupFeeSek(screenQuantity, baseSetupFeeSek);
  const additionalSetupScreens = additionalSetupScreenCount(screenQuantity);
  const hardwareTotalSek = quoteItems.reduce(
    (sum, item) => sum + item.plan.hardwareFeeSek * item.quantity,
    0,
  );
  const additionalShippingDevices = additionalShippingDeviceCount(screenQuantity);
  const shippingTotalSek = calculateShippingFeeSek(screenQuantity);
  const monthlyTotalSek = quoteItems.reduce(
    (sum, item) => sum + item.plan.monthlyFeeSek * item.quantity,
    0,
  );
  const firstPaymentSek = setupFeeSek + hardwareTotalSek + shippingTotalSek;
  const selectionText = quoteItems
    .map(({ plan, quantity }) => `${quantity} x ${plan.name} ${plan.resolution}`)
    .join(", ");
  const selectionHtml = quoteItems
    .map(
      ({ plan, quantity }) =>
        `<p><strong>${quantity} &times; ${escapeHtml(plan.name)} ${escapeHtml(plan.resolution)}</strong><br />Sk&auml;rmenheter: ${formatSek(plan.hardwareFeeSek * quantity)} inkl. moms<br />Abonnemang: ${formatSek(plan.monthlyFeeSek * quantity)}/m&aring;nad inkl. moms efter provperioden</p>`,
    )
    .join("");
  const receivedAt = requestReceivedAt(requestedAt);
  const safeCompanyName = escapeHtml(companyName);
  const safeContactPerson = contactPerson ? escapeHtml(contactPerson) : "";
  const safeMessage = message ? escapeHtml(message) : "";

  return sendTransactionalEmail({
    to: email,
    subject: "Screenia har tagit emot din förfrågan",
    text: `Hej ${companyName},

Tack för din förfrågan. Vi har tagit emot följande:

Företag: ${companyName}
${contactPerson ? `Kontaktperson: ${contactPerson}\n` : ""}E-post: ${email}
Valda skärmar: ${selectionText}
Totalt antal skärmar/enheter: ${screenQuantity}
Första betalningen: ${formatSek(firstPaymentSek)} inkl. moms
- Start- och konfigurationsavgift: ${formatSek(setupFeeSek)}
- Grundavgiften ${formatSek(baseSetupFeeSek)} täcker upp till ${INCLUDED_SETUP_SCREEN_COUNT} skärmar${additionalSetupScreens > 0 ? `; ${additionalSetupScreens} extra skärm${additionalSetupScreens === 1 ? "" : "ar"} kostar ${formatSek(ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK)} per skärm` : ""}
- Skärmenheter: ${formatSek(hardwareTotalSek)}
- Frakt: ${formatSek(shippingTotalSek)} (${formatSek(BASE_SHIPPING_FEE_SEK)} för upp till ${INCLUDED_SHIPPING_DEVICE_COUNT} enheter${additionalShippingDevices > 0 ? ` + ${additionalShippingDevices} extra enhet${additionalShippingDevices === 1 ? "" : "er"} à ${formatSek(ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK)}` : ""})
Efter 21 dagars kostnadsfri provperiod: ${formatSek(monthlyTotalSek)}/månad inkl. moms
Mottaget: ${receivedAt}
${message ? `\nMeddelande: ${message}\n` : ""}
Screenia granskar uppgifterna och återkommer med nästa steg. Du behöver inte skicka logotyp, meny eller bilder innan betalning.

Vänliga hälsningar,
Screenia`,
    html: renderBrandedEmail({
      eyebrow: "Screenia",
      title: "F&ouml;rfr&aring;gan mottagen",
      intro: "Vi har tagit emot din f&ouml;rfr&aring;gan och sammanfattningen finns h&auml;r.",
      footer: "V&auml;nliga h&auml;lsningar,<br />Screenia",
      children: `
        <p>Hej ${safeCompanyName},</p>
        <p>Vi har tagit emot din förfrågan och sammanfattningen nedan.</p>
        <div style="border: 1px solid #d9e5f7; border-radius: 14px; padding: 16px; background: #f7fbff;">
          <p><strong>Företag:</strong> ${safeCompanyName}</p>
          ${safeContactPerson ? `<p><strong>Kontaktperson:</strong> ${safeContactPerson}</p>` : ""}
          <p><strong>E-post:</strong> ${escapeHtml(email)}</p>
          <p><strong>Valda sk&auml;rmar:</strong></p>
          ${selectionHtml}
          <p><strong>Totalt antal sk&auml;rmar/enheter:</strong> ${screenQuantity}</p>
          <p><strong>F&ouml;rsta betalningen:</strong> ${formatSek(firstPaymentSek)} inkl. moms</p>
          <p>Startavgift ${formatSek(setupFeeSek)} + sk&auml;rmenheter ${formatSek(hardwareTotalSek)} + frakt ${formatSek(shippingTotalSek)}</p>
          <p>Grundavgiften ${formatSek(baseSetupFeeSek)} t&auml;cker upp till ${INCLUDED_SETUP_SCREEN_COUNT} sk&auml;rmar${additionalSetupScreens > 0 ? `; ${additionalSetupScreens} extra sk&auml;rm${additionalSetupScreens === 1 ? "" : "ar"} &times; ${formatSek(ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK)}` : ""}.</p>
          <p>Frakten ${formatSek(BASE_SHIPPING_FEE_SEK)} t&auml;cker upp till ${INCLUDED_SHIPPING_DEVICE_COUNT} enheter${additionalShippingDevices > 0 ? `; ${additionalShippingDevices} extra enhet${additionalShippingDevices === 1 ? "" : "er"} &times; ${formatSek(ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK)}` : ""}.</p>
          <p><strong>Efter 21 dagars kostnadsfri provperiod:</strong> ${formatSek(monthlyTotalSek)}/m&aring;nad inkl. moms</p>
          <p><strong>Mottaget:</strong> ${receivedAt}</p>
          ${safeMessage ? `<p><strong>Meddelande:</strong> ${safeMessage}</p>` : ""}
        </div>
        <p>Screenia granskar uppgifterna och återkommer med nästa steg. Du behöver inte skicka logotyp, meny eller bilder innan betalning.</p>
      `,
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const legacyPlanCode = String(body.planCode || "").trim();
    const companyName = String(body.companyName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const contactPerson = String(body.contactPerson || "").trim();
    const phone = String(body.phone || "").trim();
    const legacyScreenQuantity = Math.min(
      50,
      Math.max(1, Number(body.screenQuantity) || 1),
    );
    const message = String(body.message || "").trim();
    const privacyAccepted = Boolean(body.privacyAccepted);
    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");
    const website = String(body.website || "").trim();

    if (website) {
      return NextResponse.json({ success: true, received: true });
    }

    const rateLimitKey = `landing-request:${ipAddress || email || "unknown"}`;
    const rateLimit = checkRateLimit({
      key: rateLimitKey,
      limit: requestRateLimitMax,
      windowMs: requestRateLimitWindowMs,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen senare." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimit),
        },
      );
    }

    const rawQuoteItems = Array.isArray(body.quoteItems)
      ? body.quoteItems
      : legacyPlanCode
        ? [{ pricingPlanCode: legacyPlanCode, quantity: legacyScreenQuantity }]
        : [];
    const mergedQuantities = new Map<string, number>();
    let invalidSelection = false;

    for (const rawItem of rawQuoteItems) {
      const code = String(rawItem?.pricingPlanCode || "").trim();
      const quantity = Number(rawItem?.quantity);
      if (!validPlanCodes.has(code) || !Number.isInteger(quantity) || quantity < 1) {
        invalidSelection = true;
        continue;
      }
      mergedQuantities.set(code, (mergedQuantities.get(code) || 0) + quantity);
    }

    const quoteItems: RequestQuoteItem[] = Array.from(mergedQuantities.entries())
      .map(([code, quantity]) => ({
        plan: PRICING_PLANS.find((plan) => plan.code === code),
        quantity,
      }))
      .filter((item): item is RequestQuoteItem => Boolean(item.plan));
    const screenQuantity = quoteItems.reduce((sum, item) => sum + item.quantity, 0);

    if (invalidSelection || quoteItems.length === 0 || screenQuantity > 50) {
      return NextResponse.json(
        { error: "Välj mellan 1 och 50 skärmar i en giltig kombination." },
        { status: 400 },
      );
    }

    const planCode = quoteItems.length === 1 ? quoteItems[0].plan.code : "mixed";
    const planName = quoteItems
      .map(({ plan, quantity }) => `${quantity} x ${plan.name} ${plan.resolution}`)
      .join(", ");
    const requestedQuoteItems = quoteItems.map(({ plan, quantity }) => ({
      pricingPlanCode: plan.code,
      name: plan.name,
      resolution: plan.resolution,
      quantity,
      hardwareFeeSek: plan.hardwareFeeSek,
      shippingFeeSek: plan.shippingFeeSek,
      monthlyFeeSek: plan.monthlyFeeSek,
    }));

    if (!companyName) {
      return NextResponse.json(
        { error: "Företagsnamn måste anges." },
        { status: 400 },
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Ange en giltig e-postadress." },
        { status: 400 },
      );
    }

    if (!isValidOptionalPhone(phone)) {
      return NextResponse.json(
        {
          error:
            "Ange ett giltigt telefonnummer med 7–15 siffror, eller lämna fältet tomt.",
        },
        { status: 400 },
      );
    }

    if (!privacyAccepted) {
      return NextResponse.json(
        {
          error:
            "Du måste bekräfta att du har läst integritetspolicyn innan förfrågan skickas.",
        },
        { status: 400 },
      );
    }

    const { data: existingCustomer, error: existingCustomerError } =
      await supabaseAdmin
        .from("customers")
        .select("id, name, status")
        .eq("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (existingCustomerError) {
      console.error("Check repeated landing request error:", existingCustomerError);
      return NextResponse.json(
        { error: "Det gick inte att kontrollera tidigare förfrågningar." },
        { status: 500 },
      );
    }

    if (existingCustomer) {
      const duplicateAt = new Date().toISOString();
      const duplicateMetadata = {
        submittedCompanyName: companyName,
        submittedEmail: email,
        existingCustomerStatus: existingCustomer.status,
        planCode,
        planName,
        quoteItems: requestedQuoteItems,
        screenQuantity,
        submittedAt: duplicateAt,
      };

      const [auditResult, notificationResult] = await Promise.allSettled([
        recordAuditEvent(supabaseAdmin, {
          customerId: existingCustomer.id,
          actorType: "customer",
          eventType: "landing_purchase_request_duplicate_blocked",
          eventDescription:
            "A repeated landing request using an existing customer email was blocked.",
          metadata: duplicateMetadata,
          ipAddress,
          userAgent,
        }),
        createAdminNotification(supabaseAdmin, {
          customerId: existingCustomer.id,
          eventType: "landing_purchase_request_duplicate_blocked",
          title: "Repeated customer request needs review",
          message: `${companyName} submitted another request using ${email}. Review the existing customer before creating another order.`,
          priority: "high",
          metadata: duplicateMetadata,
        }),
      ]);

      if (auditResult.status === "rejected") {
        console.error("Repeated request audit error:", auditResult.reason);
      }
      if (notificationResult.status === "rejected") {
        console.error(
          "Repeated request admin notification error:",
          notificationResult.reason,
        );
      }

      return NextResponse.json(
        {
          error:
            "Det finns redan en förfrågan eller kund med den här e-postadressen. Kontakta service@screenia.se om du vill lägga till fler skärmar eller ändra din beställning.",
          existingRequest: true,
        },
        { status: 409, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const requestedAt = new Date().toISOString();
    const notes = [
      "Landing purchase request",
      `Requested screens: ${planName}`,
      `Requested screens/devices: ${screenQuantity}`,
      `Submitted at: ${requestedAt}`,
      message ? `Message: ${message}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({
        id: crypto.randomUUID(),
        name: companyName,
        email,
        contact_person: contactPerson || null,
        phone: phone || null,
        country: "Sverige",
        preferred_contact_channel: "email",
        requested_screen_quantity: screenQuantity,
        requested_quote_items: requestedQuoteItems,
        status: "new_request",
        notes,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Create onboarding request error:", error);
      return NextResponse.json(
        { error: "Det gick inte att skapa förfrågan." },
        { status: 500 },
      );
    }

    try {
      await recordConsent(
        supabaseAdmin,
        {
          customerId: data.id,
          consentType: "privacy_request",
          granted: true,
          statement:
            "I have read the privacy policy and understand that Screenia stores these details to handle my request.",
          documentName: CURRENT_PRIVACY_DOCUMENT.title,
          documentVersion: CURRENT_PRIVACY_DOCUMENT.version,
          documentUrl: CURRENT_PRIVACY_DOCUMENT.url,
          collectionPoint: "landing_request_form",
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (consentError) {
      console.error("Landing request privacy consent was not stored:", consentError);
      await supabaseAdmin.from("customers").delete().eq("id", data.id);
      return NextResponse.json(
        {
          error:
            "Det gick inte att spara integritetsbekräftelsen. Försök igen innan förfrågan skickas.",
        },
        { status: 500 },
      );
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: data.id,
          actorType: "customer",
          eventType: "landing_purchase_request_created",
          eventDescription:
            "Customer submitted a package request from the landing page.",
          metadata: {
            planCode,
            planName,
            quoteItems: requestedQuoteItems,
            screenQuantity,
            privacyVersion: CURRENT_PRIVACY_DOCUMENT.version,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Landing request audit was not stored:", auditError);
      await supabaseAdmin.from("customers").delete().eq("id", data.id);

      return NextResponse.json(
        {
          error:
            "Det gick inte att spara revisionshistoriken. Forsok igen innan forfragan skickas.",
        },
        { status: 500 },
      );
    }

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: data.id,
          eventType: "landing_purchase_request_created",
          title: "New customer request",
          message: `${companyName} requested ${screenQuantity} screen(s): ${planName}.`,
          priority: "high",
          metadata: {
            planCode,
            planName,
            quoteItems: requestedQuoteItems,
            screenQuantity,
            customerEmail: email,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      const notificationErrorMessage =
        notificationError instanceof Error
          ? notificationError.message
          : "Unknown admin notification storage error";
      console.error("Landing request admin notification was not stored:", notificationError);
      await recordAuditEvent(supabaseAdmin, {
        customerId: data.id,
        actorType: "system",
        eventType: "landing_purchase_request_notification_failed",
        eventDescription:
          "Landing purchase request was saved, but admin notification storage failed.",
        metadata: {
          planCode,
          planName,
          quoteItems: requestedQuoteItems,
          screenQuantity,
          customerEmail: email,
          error: notificationErrorMessage,
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json(
        {
          id: data.id,
          success: false,
          error:
            "Forfragan sparades, men Screenia kunde inte skapa adminaviseringen. Kontakta support om du inte far aterkoppling.",
        },
        { status: 500, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const emailResult = await sendRequestConfirmationEmail({
      email,
      companyName,
      contactPerson,
      quoteItems,
      message,
      requestedAt,
    });

    if (emailResult.ok) {
      try {
        await recordAuditEvent(
          supabaseAdmin,
          {
            customerId: data.id,
            actorType: "system",
            eventType: "request_confirmation_email_sent",
            eventDescription: "System sent request confirmation email to customer.",
            metadata: {
              sentTo: email,
              resendEmailId: emailResult.id || null,
              planCode,
              screenQuantity,
              quoteItems: requestedQuoteItems,
            },
            ipAddress,
            userAgent,
          },
          { throwOnError: true },
        );
      } catch (emailAuditError) {
        const emailAuditErrorMessage =
          emailAuditError instanceof Error
            ? emailAuditError.message
            : "Unknown confirmation email audit error";
        console.error(
          "Request confirmation email audit was not stored:",
          emailAuditError,
        );
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: data.id,
            eventType: "request_confirmation_email_audit_failed",
            title: "Confirmation email audit missing",
            message: `Confirmation email to ${email} was sent, but audit evidence was not stored.`,
            priority: "urgent",
            metadata: {
              planCode,
              screenQuantity,
              quoteItems: requestedQuoteItems,
              customerEmail: email,
              resendEmailId: emailResult.id || null,
              error: emailAuditErrorMessage,
            },
          },
          { throwOnError: true },
        );

        return NextResponse.json(
          {
            id: data.id,
            success: false,
            emailSent: true,
            error:
              "Forfragan sparades och bekraftelsemejl skickades, men Screenia kunde inte spara e-posthistoriken. Vi foljer upp manuellt.",
          },
          { status: 500, headers: rateLimitHeaders(rateLimit) },
        );
      }
    } else {
      const eventType = emailResult.configured
        ? "request_confirmation_email_failed"
        : "request_confirmation_email_not_configured";

      try {
        await recordAuditEvent(
          supabaseAdmin,
          {
            customerId: data.id,
            actorType: "system",
            eventType,
            eventDescription: emailResult.configured
              ? "System could not send request confirmation email."
              : "Request confirmation email was not sent because email is not configured.",
            metadata: {
              sentTo: email,
              error: emailResult.error,
              planCode,
              screenQuantity,
              quoteItems: requestedQuoteItems,
            },
            ipAddress,
            userAgent,
          },
          { throwOnError: true },
        );
      } catch (emailAuditError) {
        const emailAuditErrorMessage =
          emailAuditError instanceof Error
            ? emailAuditError.message
            : "Unknown confirmation email failure audit error";
        console.error(
          "Request confirmation email failure audit was not stored:",
          emailAuditError,
        );
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: data.id,
            eventType: "request_confirmation_email_audit_failed",
            title: "Confirmation email failure audit missing",
            message: `Confirmation email to ${email} was not sent, and the failure audit was not stored.`,
            priority: "urgent",
            metadata: {
              planCode,
              screenQuantity,
              quoteItems: requestedQuoteItems,
              customerEmail: email,
              emailError: emailResult.error,
              auditError: emailAuditErrorMessage,
            },
          },
          { throwOnError: true },
        );

        return NextResponse.json(
          {
            id: data.id,
            success: false,
            emailSent: false,
            error:
              "Forfragan sparades, men Screenia kunde inte skicka eller logga bekraftelsemejlet. Vi foljer upp manuellt.",
          },
          { status: 500, headers: rateLimitHeaders(rateLimit) },
        );
      }

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: data.id,
            eventType,
            title: "Customer email not sent",
            message: `Confirmation email to ${email} was not sent: ${emailResult.error}`,
            priority: "urgent",
            metadata: {
              planCode,
              screenQuantity,
              quoteItems: requestedQuoteItems,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        const notificationErrorMessage =
          notificationError instanceof Error
            ? notificationError.message
            : "Unknown confirmation email notification error";
        console.error(
          "Request confirmation email failure notification was not stored:",
          notificationError,
        );
        await recordAuditEvent(supabaseAdmin, {
          customerId: data.id,
          actorType: "system",
          eventType: "request_confirmation_email_notification_failed",
          eventDescription:
            "Request confirmation email failed, but admin notification storage also failed.",
          metadata: {
            sentTo: email,
            emailError: emailResult.error,
            notificationError: notificationErrorMessage,
            planCode,
            screenQuantity,
            quoteItems: requestedQuoteItems,
          },
          ipAddress,
          userAgent,
        });

        return NextResponse.json(
          {
            id: data.id,
            success: false,
            emailSent: false,
            error:
              "Forfragan sparades, men Screenia kunde inte skicka bekraftelsemejlet eller skapa adminaviseringen. Vi foljer upp manuellt.",
          },
          { status: 500, headers: rateLimitHeaders(rateLimit) },
        );
      }
    }

    return NextResponse.json({
      id: data.id,
      success: true,
      emailSent: emailResult.ok,
      warning: emailResult.ok ? null : emailResult.error,
    }, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    console.error("Onboarding request error:", error);
    return NextResponse.json(
      { error: "Det gick inte att skapa forfragan." },
      { status: 500 },
    );
  }
}
