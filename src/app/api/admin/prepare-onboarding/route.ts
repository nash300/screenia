import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { createAdminNotification } from "@/lib/server/admin-notifications";

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

const formatSek = (amount: number | null | undefined) =>
  `${(amount ?? 0).toLocaleString("sv-SE")} kr`;

type QuoteItemInput = {
  pricingPlanCode?: string;
  quantity?: number;
};

const getResendErrorMessage = async (response: Response) => {
  const text = await response.text();

  if (!text.trim()) return `Resend returned ${response.status}.`;

  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object") {
      const message =
        "message" in data && typeof data.message === "string"
          ? data.message
          : null;
      const error =
        "error" in data && typeof data.error === "string" ? data.error : null;

      return message || error || `Resend returned ${response.status}.`;
    }
  } catch {
    return text.trim();
  }

  return `Resend returned ${response.status}.`;
};

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
      "id, code, name, resolution, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, trial_days",
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
    configuredPlan?.hardwareFeeSek ?? (plan.code === "premium_4k" ? 1099 : 699);
  const shippingFeeSek =
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
    .select("code, name, resolution, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, trial_days")
    .in("code", planCodes);
  const quotePlanRows = quotePlans || [];
  const quoteItemDetails = quoteItems.map((item) => {
    const itemPlan =
      quotePlanRows.find((row) => row.code === item.pricingPlanCode) || plan;
    const configuredItemPlan = PRICING_PLANS.find(
      (pricingPlan) => pricingPlan.code === itemPlan.code,
    );
    const itemHardwareFee =
      itemPlan.hardware_fee_sek ??
      configuredItemPlan?.hardwareFeeSek ??
      (itemPlan.code === "premium_4k" ? 1099 : 699);
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
  const deviceDiscountAmountSek = Math.round(
    deviceSubtotalSek * (deviceDiscountPercent / 100),
  );
  const monthlyDiscountAmountSek =
    deviceDiscountMonths > 0
      ? Math.round(monthlySubtotalSek * (deviceDiscountPercent / 100))
      : 0;

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
    setup_fee_sek: plan.setup_fee_sek,
    hardware_fee_sek: hardwareFeeSek,
    shipping_fee_sek: shippingFeeSek,
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
    quote_items: quoteItemDetails,
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
    `Quote items: ${quoteItemDetails
      .map((item) => `${item.quantity} x ${item.name} ${item.resolution}`)
      .join(", ")}`,
    deviceDiscountPercent > 0
      ? `Device discount: ${deviceDiscountPercent}% for ${deviceDiscountMonths} months`
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
    },
    ipAddress,
    userAgent,
  });

  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
  const resendFromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || "InfoSync <onboarding@resend.dev>";

  if (!resendApiKey) {
    await recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "system",
      eventType: "quote_onboarding_email_not_configured",
      eventDescription:
        "Quote and onboarding email was not sent because email is not configured.",
      metadata: {
        sentTo: customer.email,
        orderNumber: order.order_number,
        pricingPlanCode: plan.code,
      },
      ipAddress,
      userAgent,
    });

    await createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "quote_onboarding_email_not_configured",
      title: "Onboarding email not sent",
      message:
        "Quote and onboarding link were prepared, but RESEND_API_KEY is not configured.",
      priority: "urgent",
      metadata: {
        orderNumber: order.order_number,
        pricingPlanCode: plan.code,
      },
    });

    return NextResponse.json({
      success: true,
      emailSent: false,
      onboardingUrl,
      orderNumber: order.order_number,
      warning:
        "Quote and onboarding link prepared. Email sending is not configured, so copy the link manually.",
    });
  }

  const safeCustomerName = escapeHtml(customer.name);
  const safeQuoteNotes = quoteNotes ? escapeHtml(quoteNotes) : "";

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: customer.email,
      subject: `Din InfoSync-offert ${order.order_number}`,
      text: `Hej ${customer.name},

Här är din InfoSync-offert.

Paket: ${plan.name} ${plan.resolution}
Start- och konfigurationsavgift: ${formatSek(plan.setup_fee_sek)}
Skärmenhet: ${formatSek(hardwareFeeSek)}
Frakt: ${formatSek(shippingFeeSek)}
Screens/devices: ${screenQuantity}
Device discount: ${deviceDiscountPercent}% (${formatSek(deviceDiscountAmountSek)})
Månadsabonnemang: ${formatSek(plan.monthly_fee_sek)}
Kostnadsfri provperiod: ${plan.trial_days} dagar
Ordernummer: ${order.order_number}
${quoteNotes ? `\nMeddelande: ${quoteNotes}\n` : ""}
Fortsätt här för att bekräfta uppgifter och gå vidare till betalning. Material samlas in efter betalning:
${onboardingUrl}

Länken gäller i 14 dagar.

Vänliga hälsningar,
InfoSync`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #102033; line-height: 1.6;">
          <h1 style="color: #082354;">Din InfoSync-offert</h1>
          <p>Hej ${safeCustomerName},</p>
          <p>Här är offerten för din beställning. Fortsätt via länken för att bekräfta uppgifter och gå vidare till säker betalning. Material samlas in efter betalning.</p>
          <div style="border: 1px solid #d9e5f7; border-radius: 14px; padding: 16px; background: #f7fbff;">
            <p><strong>Ordernummer:</strong> ${order.order_number}</p>
            <p><strong>Paket:</strong> ${escapeHtml(plan.name)} ${escapeHtml(plan.resolution)}</p>
            <p><strong>Start- och konfigurationsavgift:</strong> ${formatSek(plan.setup_fee_sek)}</p>
            <p><strong>Skärmenhet:</strong> ${formatSek(hardwareFeeSek)}</p>
            <p><strong>Antal skärmar/enheter:</strong> ${screenQuantity}</p>
            <p><strong>Enhetsrabatt:</strong> ${deviceDiscountPercent}% (${formatSek(deviceDiscountAmountSek)})</p>
            <p><strong>Frakt:</strong> ${formatSek(shippingFeeSek)}</p>
            <p><strong>Månadsabonnemang:</strong> ${formatSek(plan.monthly_fee_sek)}</p>
            <p><strong>Månadsrabatt:</strong> ${
              deviceDiscountMonths > 0
                ? `${deviceDiscountPercent}% i ${deviceDiscountMonths} månader`
                : "Ingen"
            }</p>
            <p><strong>Kostnadsfri provperiod:</strong> ${plan.trial_days} dagar</p>
            ${safeQuoteNotes ? `<p><strong>Meddelande:</strong> ${safeQuoteNotes}</p>` : ""}
          </div>
          <p>
            <a href="${onboardingUrl}" style="display: inline-block; background: #2f7df6; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
              Öppna startguiden
            </a>
          </p>
          <p style="color: #5f7187;">Länken gäller i 14 dagar.</p>
          <p>Vänliga hälsningar,<br />InfoSync</p>
        </div>
      `,
    }),
  });

  if (!emailResponse.ok) {
    const errorMessage = await getResendErrorMessage(emailResponse);
    console.error("Resend quote email error:", errorMessage);

    await recordAuditEvent(supabaseAdmin, {
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
    });

    await createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "quote_onboarding_email_failed",
      title: "Onboarding email failed",
      message: `Quote ${order.order_number} could not be sent to ${customer.email}: ${errorMessage}`,
      priority: "urgent",
      metadata: {
        orderNumber: order.order_number,
        pricingPlanCode: plan.code,
      },
    });

    return NextResponse.json(
      {
        error: `Quote was prepared, but the email could not be sent: ${errorMessage}`,
        onboardingUrl,
        orderNumber: order.order_number,
      },
      { status: 502 },
    );
  }

  await supabaseAdmin
    .from("customer_subscriptions")
    .update({ status: "quote_sent" })
    .eq("id", order.id);

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "system",
    eventType: "quote_onboarding_email_sent",
    eventDescription: "System sent quote and onboarding email to customer.",
    metadata: {
      sentTo: customer.email,
      orderNumber: order.order_number,
      pricingPlanCode: plan.code,
      expiresAt: expiresAt.toISOString(),
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    emailSent: true,
    sentTo: customer.email,
    onboardingUrl,
    orderNumber: order.order_number,
  });
}
