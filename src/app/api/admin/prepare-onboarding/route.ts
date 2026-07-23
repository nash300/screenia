import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { includedVatFromGross } from "@/lib/pricing/vat";
import {
  ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
  INCLUDED_SETUP_SCREEN_COUNT,
  calculateIncrementalSetupFeeSek,
  incrementalAdditionalSetupScreenCount,
} from "@/lib/pricing/setup-fee";
import {
  ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
  INCLUDED_SHIPPING_DEVICE_COUNT,
  additionalShippingDeviceCount,
  calculateShippingFeeSek,
} from "@/lib/pricing/shipping-fee";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { renderBrandedEmail, sendTransactionalEmail } from "@/lib/server/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DEFAULT_SHIPPING_FEE_SEK = 99;

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatSek = (amount: number | null | undefined) => {
  const value = amount ?? 0;
  const formatter = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });

  return `${formatter.format(value)} kr`;
};

type QuoteItemInput = {
  pricingPlanCode?: string;
  quantity?: number;
};

const paidSubscriptionStatuses = new Set([
  "active",
  "paid",
  "trialing",
  "content_received",
  "layout_started",
]);

const paidStripeStatuses = new Set(["paid", "trialing", "active"]);

type ExistingSubscriptionRow = {
  id: string;
  status: string | null;
  stripe_payment_status: string | null;
  screen_quantity: number | null;
};

function subscriptionCountsTowardPaidScreens(subscription: ExistingSubscriptionRow) {
  const status = String(subscription.status || "").toLowerCase();
  const stripeStatus = String(subscription.stripe_payment_status || "").toLowerCase();

  return paidSubscriptionStatuses.has(status) || paidStripeStatuses.has(stripeStatus);
}

export async function POST(request: Request) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const customerId = String(body.customerId || "");
  const pricingPlanCode = String(body.pricingPlanCode || "");
  const quoteNotes = String(body.quoteNotes || "").trim();
  const rawQuoteItems: QuoteItemInput[] = Array.isArray(body.quoteItems)
    ? body.quoteItems
    : [];
  const normalizedQuoteItems = rawQuoteItems
    .map((item) => ({
      pricingPlanCode: String(item.pricingPlanCode || ""),
      quantity: Math.min(50, Math.max(1, Number(item.quantity) || 1)),
    }))
    .filter((item) => item.pricingPlanCode);
  const screenQuantity = Math.min(
    50,
    Math.max(
      1,
      normalizedQuoteItems.reduce((sum, item) => sum + item.quantity, 0) ||
        Number(body.screenQuantity) ||
        1,
    ),
  );
  const deviceDiscountPercent = Math.min(
    100,
    Math.max(0, Number(body.deviceDiscountPercent) || 0),
  );
  const deviceDiscountMonths = Math.min(
    36,
    Math.max(0, Number(body.deviceDiscountMonths) || 0),
  );
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  const primaryPlanCode = normalizedQuoteItems[0]?.pricingPlanCode || pricingPlanCode;

  if (!customerId || !primaryPlanCode) {
    return NextResponse.json(
      { error: "Customer and pricing plan are required." },
      { status: 400 },
    );
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, notes")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  if (!customer.email) {
    return NextResponse.json(
      { error: "Customer must have an email before the quote can be sent." },
      { status: 400 },
    );
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from("pricing_plans")
    .select(
      "id, code, name, resolution, setup_fee_sek, setup_included_screens, additional_setup_fee_sek, hardware_fee_sek, shipping_fee_sek, shipping_included_devices, additional_shipping_fee_sek, monthly_fee_sek, trial_days",
    )
    .eq("code", primaryPlanCode)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return NextResponse.json(
      { error: "Pricing plan was not found." },
      { status: 404 },
    );
  }

  const configuredPlan = PRICING_PLANS.find((item) => item.code === plan.code);
  const hardwareFeeSek =
    plan.hardware_fee_sek ?? configuredPlan?.hardwareFeeSek ?? 0;
  const shippingFeeSek =
    plan.shipping_fee_sek ??
    configuredPlan?.shippingFeeSek ?? DEFAULT_SHIPPING_FEE_SEK;
  const currency = "sek";
  const quoteItems =
    normalizedQuoteItems.length > 0
      ? normalizedQuoteItems
      : [{ pricingPlanCode: plan.code, quantity: screenQuantity }];
  const planCodes = Array.from(
    new Set(quoteItems.map((item) => item.pricingPlanCode)),
  );
  const { data: quotePlans } = await supabaseAdmin
    .from("pricing_plans")
    .select("code, name, resolution, setup_fee_sek, setup_included_screens, additional_setup_fee_sek, hardware_fee_sek, shipping_fee_sek, shipping_included_devices, additional_shipping_fee_sek, monthly_fee_sek, trial_days")
    .in("code", planCodes);
  const quotePlanRows = quotePlans || [];
  const quoteItemDetails = quoteItems.map((item) => {
    const itemPlan =
      quotePlanRows.find((row) => row.code === item.pricingPlanCode) || plan;
    const configuredItemPlan = PRICING_PLANS.find(
      (pricingPlan) => pricingPlan.code === itemPlan.code,
    );
    const itemHardwareFee =
      itemPlan.hardware_fee_sek ?? configuredItemPlan?.hardwareFeeSek ?? 0;
    const itemShippingFee =
      itemPlan.shipping_fee_sek ??
      configuredItemPlan?.shippingFeeSek ??
      DEFAULT_SHIPPING_FEE_SEK;

    return {
      pricingPlanCode: itemPlan.code,
      name: itemPlan.name,
      resolution: itemPlan.resolution,
      quantity: item.quantity,
      hardwareFeeSek: itemHardwareFee,
      shippingFeeSek: itemShippingFee,
      monthlyFeeSek: itemPlan.monthly_fee_sek,
    };
  });
  const deviceSubtotalSek = quoteItemDetails.reduce(
    (sum, item) => sum + item.hardwareFeeSek * item.quantity,
    0,
  );
  const monthlySubtotalSek = quoteItemDetails.reduce(
    (sum, item) => sum + item.monthlyFeeSek * item.quantity,
    0,
  );
  const deviceDiscountAmountSek = 0;
  const monthlyDiscountAmountSek =
    deviceDiscountMonths > 0
      ? Math.round(monthlySubtotalSek * (deviceDiscountPercent / 100))
      : 0;
  const shippingIncludedDevices =
    plan.shipping_included_devices ?? INCLUDED_SHIPPING_DEVICE_COUNT;
  const additionalShippingFeeSek =
    plan.additional_shipping_fee_sek ?? ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK;
  const additionalShippingDevices = additionalShippingDeviceCount(
    screenQuantity,
    shippingIncludedDevices,
  );
  const shippingSubtotalSek = calculateShippingFeeSek(
    screenQuantity,
    shippingFeeSek,
    shippingIncludedDevices,
    additionalShippingFeeSek,
  );
  const baseSetupFeeSek = plan.setup_fee_sek;
  const setupIncludedScreens = plan.setup_included_screens ?? INCLUDED_SETUP_SCREEN_COUNT;
  const additionalSetupFeeSek =
    plan.additional_setup_fee_sek ?? ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK;
  const { data: existingPaidSubscriptions } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id, status, stripe_payment_status, screen_quantity")
    .eq("customer_id", customer.id);
  const existingPaidScreenQuantity = ((existingPaidSubscriptions || []) as ExistingSubscriptionRow[])
    .filter(subscriptionCountsTowardPaidScreens)
    .reduce(
      (sum, subscription) =>
        sum + Math.max(0, Number(subscription.screen_quantity) || 0),
      0,
    );
  const setupFeeSek = calculateIncrementalSetupFeeSek(
    existingPaidScreenQuantity,
    screenQuantity,
    baseSetupFeeSek,
    setupIncludedScreens,
    additionalSetupFeeSek,
  );
  const additionalSetupScreens = incrementalAdditionalSetupScreenCount(
    existingPaidScreenQuantity,
    screenQuantity,
    setupIncludedScreens,
  );
  const baseSetupChargedSek =
    existingPaidScreenQuantity <= 0 && screenQuantity > 0 ? baseSetupFeeSek : 0;
  const orderType =
    existingPaidScreenQuantity > 0 ? "existing_customer_add_on" : "new_setup";
  const firstPaymentGrossSek =
    setupFeeSek +
    deviceSubtotalSek +
    shippingSubtotalSek;
  const firstPaymentVat = includedVatFromGross(firstPaymentGrossSek);
  const monthlyGrossSek = monthlySubtotalSek - monthlyDiscountAmountSek;
  const monthlyVat = includedVatFromGross(monthlyGrossSek);

  const { data: existingOrder } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id, order_number")
    .eq("customer_id", customer.id)
    .eq("pricing_plan_id", plan.id)
    .in("status", ["quote_prepared", "quote_sent", "checkout_started"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderPayload = {
    customer_id: customer.id,
    pricing_plan_id: plan.id,
    status: "quote_prepared",
    currency,
    setup_fee_sek: setupFeeSek,
    base_setup_fee_sek: baseSetupChargedSek,
    setup_included_screens: setupIncludedScreens,
    additional_setup_fee_per_screen_sek: additionalSetupFeeSek,
    additional_setup_screen_count: additionalSetupScreens,
    hardware_fee_sek: hardwareFeeSek,
    shipping_fee_sek: shippingSubtotalSek,
    base_shipping_fee_sek: shippingFeeSek,
    shipping_included_devices: shippingIncludedDevices,
    additional_shipping_fee_per_device_sek: additionalShippingFeeSek,
    additional_shipping_device_count: additionalShippingDevices,
    monthly_fee_sek: plan.monthly_fee_sek,
    trial_days: plan.trial_days,
    tax_status: "not_calculated",
    fulfillment_status: "pending",
    inventory_status: "not_reserved",
    screen_quantity: screenQuantity,
    device_discount_percent: deviceDiscountPercent,
    device_discount_months: deviceDiscountMonths,
    device_discount_amount_sek: deviceDiscountAmountSek,
    monthly_discount_amount_sek: monthlyDiscountAmountSek,
    quote_notes: quoteNotes || null,
    quote_items: quoteItemDetails.map((item) => ({
      ...item,
      orderType,
      existingPaidScreenQuantity,
    })),
  };

  const { data: order, error: orderError } = existingOrder
    ? await supabaseAdmin
        .from("customer_subscriptions")
        .update(orderPayload)
        .eq("id", existingOrder.id)
        .select("id, order_number")
        .single()
    : await supabaseAdmin
        .from("customer_subscriptions")
        .insert(orderPayload)
        .select("id, order_number")
        .single();

  if (orderError || !order) {
    if (orderError?.code === "42703" || orderError?.code === "PGRST204") {
      return NextResponse.json(
        {
          error:
            "Database migrations are not applied yet. Apply the latest Supabase migrations before sending quote/onboarding emails.",
        },
        { status: 409 },
      );
    }

    console.error("Prepare quote order error:", orderError);
    return NextResponse.json(
      { error: "Could not prepare the quote order." },
      { status: 500 },
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${new URL(request.url).protocol}//${new URL(request.url).host}`;
  const onboardingUrl = `${appUrl}/onboarding/${token}`;

  const noteLines = [
    `Quote prepared: ${new Date().toISOString()}`,
    `Quoted plan: ${plan.name} ${plan.resolution} (${plan.code})`,
    `Quoted screens/devices: ${screenQuantity}`,
    existingPaidScreenQuantity > 0
      ? `Existing paid screens/devices before this quote: ${existingPaidScreenQuantity}`
      : "",
    existingPaidScreenQuantity > 0
      ? `Add-on setup charged only for marginal setup: ${formatSek(setupFeeSek)}`
      : "",
    `Quote items: ${quoteItemDetails
      .map((item) => `${item.quantity} x ${item.name} ${item.resolution}`)
      .join(", ")}`,
    deviceDiscountPercent > 0
      ? `Monthly introductory discount: ${deviceDiscountPercent}% for ${deviceDiscountMonths} months`
      : "",
    `Quote order: ${order.order_number}`,
    quoteNotes ? `Quote note: ${quoteNotes}` : "",
  ].filter(Boolean);
  const existingNotes = String(customer.notes || "").trim();

  const { error: customerUpdateError } = await supabaseAdmin
    .from("customers")
    .update({
      status: "invited",
      onboarding_token: token,
      onboarding_token_expires_at: expiresAt.toISOString(),
      notes: existingNotes
        ? `${existingNotes}\n${noteLines.join("\n")}`
        : noteLines.join("\n"),
    })
    .eq("id", customer.id);

  if (customerUpdateError) {
    console.error("Prepare customer onboarding error:", customerUpdateError);
    return NextResponse.json(
      { error: "Quote was prepared, but onboarding could not be updated." },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "admin",
    actorId: user.id,
    eventType: "quote_onboarding_prepared",
    eventDescription: "Admin prepared a quote order and onboarding link.",
    metadata: {
      orderId: order.id,
      orderNumber: order.order_number,
      pricingPlanCode: plan.code,
      expiresAt: expiresAt.toISOString(),
      actionSource: "admin_request_quote_workflow",
    },
    ipAddress,
    userAgent,
  });

  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
  const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const canSendEmail = Boolean(resendApiKey && resendFromEmail);

  if (!canSendEmail) {
    const missingConfig = [
      !resendApiKey ? "RESEND_API_KEY" : null,
      !resendFromEmail ? "RESEND_FROM_EMAIL" : null,
    ].filter(Boolean);

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "system",
          eventType: "quote_onboarding_email_not_configured",
          eventDescription:
            "Quote and onboarding email was not sent because email is not fully configured.",
          metadata: {
            sentTo: customer.email,
            orderNumber: order.order_number,
            pricingPlanCode: plan.code,
            missingConfig,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );

      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "quote_onboarding_email_not_configured",
          title: "Onboarding email not sent",
          message: `Quote and onboarding link were prepared, but email config is missing: ${missingConfig.join(", ")}.`,
          priority: "urgent",
          metadata: {
            orderNumber: order.order_number,
            pricingPlanCode: plan.code,
            missingConfig,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error(
        "Quote onboarding not-configured evidence was not stored:",
        evidenceError,
      );

      return NextResponse.json(
        {
          error:
            "Quote and onboarding link were prepared, but Screenia could not store email configuration failure evidence.",
          onboardingUrl,
          orderNumber: order.order_number,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: false,
      onboardingUrl,
      orderNumber: order.order_number,
      warning:
        "Quote and onboarding link prepared. Email sending is not fully configured, so copy the link manually.",
    });
  }

  const safeCustomerName = escapeHtml(customer.name);
  const safeQuoteNotes = quoteNotes ? escapeHtml(quoteNotes) : "";
  const setupExplanationText =
    existingPaidScreenQuantity > 0
      ? `Tidigare betalda skärmar/enheter: ${existingPaidScreenQuantity}. Denna offert debiterar endast marginalkostnad för setup av nya extra skärmar: ${formatSek(setupFeeSek)}.`
      : `Grundavgiften ${formatSek(baseSetupFeeSek)} täcker upp till ${setupIncludedScreens} skärmar${additionalSetupScreens > 0 ? `; ${additionalSetupScreens} extra skärm${additionalSetupScreens === 1 ? "" : "ar"} kostar ${formatSek(additionalSetupFeeSek)} per skärm` : ""}.`;
  const setupExplanationHtml =
    existingPaidScreenQuantity > 0
      ? `Tidigare betalda sk&auml;rmar/enheter: ${existingPaidScreenQuantity}. Denna offert debiterar endast marginalkostnad f&ouml;r setup av nya extra sk&auml;rmar: ${formatSek(setupFeeSek)}.`
      : `Grundavgiften ${formatSek(baseSetupFeeSek)} t&auml;cker upp till ${setupIncludedScreens} sk&auml;rmar${additionalSetupScreens > 0 ? `; ${additionalSetupScreens} extra sk&auml;rm${additionalSetupScreens === 1 ? "" : "ar"} &times; ${formatSek(additionalSetupFeeSek)}` : ""}.`;

  const emailResult = await sendTransactionalEmail({
      to: customer.email,
      subject: `Din Screenia-offert ${order.order_number}`,
      text: `Hej ${customer.name},

Här är din Screenia-offert.

Paket: ${plan.name} ${plan.resolution}
Start- och konfigurationsavgift: ${formatSek(setupFeeSek)}
${setupExplanationText}
Skärmenhet: ${formatSek(deviceSubtotalSek)} inkl. moms
Frakt: ${formatSek(shippingSubtotalSek)} inkl. moms
Fraktregel: ${formatSek(shippingFeeSek)} för upp till ${shippingIncludedDevices} enheter${additionalShippingDevices > 0 ? ` + ${additionalShippingDevices} extra enhet${additionalShippingDevices === 1 ? "" : "er"} à ${formatSek(additionalShippingFeeSek)}` : ""}
Screens/devices: ${screenQuantity}
Månadsabonnemang: ${formatSek(monthlySubtotalSek)} inkl. moms per månad
Månadsrabatt: ${deviceDiscountMonths > 0 ? `${deviceDiscountPercent}% i ${deviceDiscountMonths} månader` : "Ingen"}
Kostnadsfri provperiod: ${plan.trial_days} dagar
Priserna ovan är totalsummor kunden betalar inklusive svensk moms.
Initial betalning (startavgift + skärmenhet + frakt): ${formatSek(firstPaymentVat.gross)} inkl. moms, varav moms ${formatSek(firstPaymentVat.vat)}.
Månadsabonnemang efter provperiod: ${formatSek(monthlyVat.gross)} inkl. moms, varav moms ${formatSek(monthlyVat.vat)}.
Ordernummer: ${order.order_number}
${quoteNotes ? `\nMeddelande: ${quoteNotes}\n` : ""}
Fortsätt här för att bekräfta uppgifter och gå vidare till betalning. Material samlas in efter betalning:
${onboardingUrl}

Länken gäller i 14 dagar.

Vänliga hälsningar,
Screenia`,
      html: renderBrandedEmail({
        eyebrow: "Offert",
        title: "Din Screenia-offert",
        children: `
        <div style="font-family: Arial, sans-serif; color: #102033; line-height: 1.6;">
          <p>Hej ${safeCustomerName},</p>
          <p>Här är offerten för din beställning. Fortsätt via länken för att bekräfta uppgifter och gå vidare till säker betalning. Material samlas in efter betalning.</p>
          <div style="border: 1px solid #d9e5f7; border-radius: 14px; padding: 16px; background: #f7fbff;">
            <p><strong>Ordernummer:</strong> ${order.order_number}</p>
            <p><strong>Paket:</strong> ${escapeHtml(plan.name)} ${escapeHtml(plan.resolution)}</p>
            <p><strong>Start- och konfigurationsavgift:</strong> ${formatSek(setupFeeSek)}</p>
            <p>${setupExplanationHtml}</p>
            <p><strong>Skärmenhet:</strong> ${formatSek(deviceSubtotalSek)} inkl. moms</p>
            <p><strong>Antal skärmar/enheter:</strong> ${screenQuantity}</p>
            <p><strong>Frakt:</strong> ${formatSek(shippingSubtotalSek)} inkl. moms</p>
            <p style="margin: 4px 0 0; color: #52657f;">${formatSek(shippingFeeSek)} f&ouml;r upp till ${shippingIncludedDevices} enheter${additionalShippingDevices > 0 ? ` + ${additionalShippingDevices} extra enhet${additionalShippingDevices === 1 ? "" : "er"} &times; ${formatSek(additionalShippingFeeSek)}` : ""}.</p>
            <p><strong>Månadsabonnemang:</strong> ${formatSek(monthlySubtotalSek)} inkl. moms per månad</p>
            <p><strong>Månadsrabatt:</strong> ${
              deviceDiscountMonths > 0
                ? `${deviceDiscountPercent}% i ${deviceDiscountMonths} månader`
                : "Ingen"
            }</p>
            <p><strong>Kostnadsfri provperiod:</strong> ${plan.trial_days} dagar</p>
            ${safeQuoteNotes ? `<p><strong>Meddelande:</strong> ${safeQuoteNotes}</p>` : ""}
          </div>
          <div style="border: 1px solid #ffd9bf; border-radius: 14px; padding: 16px; background: #fff7f0; margin-top: 14px;">
            <p style="margin: 0 0 8px;"><strong>Moms:</strong> Priserna ovan är totalsummor kunden betalar inklusive svensk moms.</p>
            <p style="margin: 0;"><strong>Initial betalning (startavgift + skärmenhet + frakt):</strong> ${formatSek(firstPaymentVat.gross)} inkl. moms, varav moms ${formatSek(firstPaymentVat.vat)}.</p>
            <p style="margin: 8px 0 0;"><strong>Månadsabonnemang efter provperiod:</strong> ${formatSek(monthlyVat.gross)} inkl. moms, varav moms ${formatSek(monthlyVat.vat)}.</p>
          </div>
          <p>
            <a href="${onboardingUrl}" style="display: inline-block; background: #2f7df6; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
              Öppna startguiden
            </a>
          </p>
          <p style="color: #5f7187;">Länken gäller i 14 dagar.</p>
          <p>Vänliga hälsningar,<br />Screenia</p>
        </div>
      `,
      }),
  });

  if (!emailResult.ok) {
    const errorMessage = emailResult.error;
    console.error("Resend quote email error:", errorMessage);

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "system",
          eventType: "quote_onboarding_email_failed",
          eventDescription: "System could not send quote and onboarding email.",
          metadata: {
            sentTo: customer.email,
            orderNumber: order.order_number,
            pricingPlanCode: plan.code,
            error: errorMessage,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );

      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "quote_onboarding_email_failed",
          title: "Onboarding email failed",
          message: `Quote ${order.order_number} could not be sent to ${customer.email}: ${errorMessage}`,
          priority: "urgent",
          metadata: {
            orderNumber: order.order_number,
            pricingPlanCode: plan.code,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error("Quote onboarding email failure evidence was not stored:", evidenceError);

      return NextResponse.json(
        {
          error:
            "Quote email failed, and Screenia could not store failure evidence.",
          onboardingUrl,
          orderNumber: order.order_number,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: `Quote was prepared, but the email could not be sent: ${errorMessage}`,
        onboardingUrl,
        orderNumber: order.order_number,
      },
      { status: 502 },
    );
  }

  const { error: quoteSentUpdateError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update({ status: "quote_sent" })
    .eq("id", order.id);

  if (quoteSentUpdateError) {
    console.error("Quote sent status update failed:", quoteSentUpdateError);
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customer.id,
        eventType: "quote_onboarding_status_sync_failed",
        title: "Quote email sent but order status not synced",
        message: `Quote ${order.order_number} was sent to ${customer.email}, but Screenia could not mark the order as quote_sent.`,
        priority: "urgent",
        metadata: {
          orderNumber: order.order_number,
          pricingPlanCode: plan.code,
          sentTo: customer.email,
          error: quoteSentUpdateError.message,
        },
      },
      { throwOnError: true },
    );

    return NextResponse.json(
      {
        error:
          "Quote email was sent, but Screenia could not update the order status. Review the order before continuing.",
        onboardingUrl,
        orderNumber: order.order_number,
      },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "system",
        eventType: "quote_onboarding_email_sent",
        eventDescription: "System sent quote and onboarding email to customer.",
        metadata: {
          sentTo: customer.email,
          orderNumber: order.order_number,
          pricingPlanCode: plan.code,
          expiresAt: expiresAt.toISOString(),
          resendEmailId: emailResult.id || null,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Quote onboarding email sent audit was not stored:", auditError);
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customer.id,
        eventType: "quote_onboarding_email_audit_failed",
        title: "Quote email audit missing",
        message: `Quote ${order.order_number} was sent to ${customer.email}, but delivery audit evidence was not stored.`,
        priority: "urgent",
        metadata: {
          orderNumber: order.order_number,
          pricingPlanCode: plan.code,
          sentTo: customer.email,
          resendEmailId: emailResult.id || null,
          error: auditError instanceof Error ? auditError.message : String(auditError),
        },
      },
      { throwOnError: true },
    );

    return NextResponse.json(
      {
        error:
          "Quote email was sent, but Screenia could not store delivery audit evidence.",
        onboardingUrl,
        orderNumber: order.order_number,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    emailSent: true,
    sentTo: customer.email,
    onboardingUrl,
    orderNumber: order.order_number,
  });
}
