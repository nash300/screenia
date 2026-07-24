import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import {
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

type QuoteItem = {
  pricingPlanCode?: string;
  quantity?: number;
  monthlyFeeSek?: number;
  name?: string;
  resolution?: string;
};

type LocalSubscription = {
  id: string;
  order_number: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
  quote_items: QuoteItem[] | null;
  monthly_fee_sek: number | null;
  screen_quantity: number | null;
};

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== day) next.setDate(0);
  return next;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatSek(value: number | null | undefined) {
  return `${(value ?? 0).toLocaleString("sv-SE")} kr`;
}

function normalizeQuoteItems(subscription: LocalSubscription) {
  const quoteItems = Array.isArray(subscription.quote_items)
    ? subscription.quote_items
    : [];

  if (quoteItems.length) {
    return quoteItems.map((item) => ({
      pricingPlanCode: String(item.pricingPlanCode || "").trim(),
      quantity: Math.max(1, Number(item.quantity) || 1),
      monthlyFeeSek: Number(item.monthlyFeeSek) || 0,
      label: [item.name, item.resolution].filter(Boolean).join(" ").trim(),
    }));
  }

  return [
    {
      pricingPlanCode: "",
      quantity: Math.max(1, Number(subscription.screen_quantity) || 1),
      monthlyFeeSek: Number(subscription.monthly_fee_sek) || 0,
      label: "Screenia-abonnemang",
    },
  ];
}

function findStripeItem(
  subscription: Stripe.Subscription,
  stripePriceId: string | null,
) {
  const items = subscription.items.data;
  if (stripePriceId) {
    return items.find((item) => item.price.id === stripePriceId) || null;
  }

  return items.length === 1 ? items[0] : null;
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const deviceId = String(body.deviceId || "").trim();
  const customerSubscriptionId = String(body.customerSubscriptionId || "").trim();
  const pricingPlanCode = String(body.pricingPlanCode || "").trim();
  const reason =
    String(body.reason || "").trim().slice(0, 300) ||
    "Customer paused one display device temporarily.";
  const durationMonths = Number(body.durationMonths);

  if (!deviceId) {
    return NextResponse.json({ error: "Välj skärmen som ska pausas." }, { status: 400 });
  }

  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 4) {
    return NextResponse.json(
      { error: "Pausen kan vara mellan 1 och 4 månader." },
      { status: 400 },
    );
  }

  const { data: device, error: deviceError } = await supabaseAdmin
    .from("devices")
    .select("id, device_code, name, location, is_active")
    .eq("id", deviceId)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (deviceError) {
    return NextResponse.json(
      { error: "Kunde inte kontrollera vald skärm." },
      { status: 500 },
    );
  }

  if (!device) {
    return NextResponse.json(
      { error: "Den valda skärmen finns inte på kontot." },
      { status: 404 },
    );
  }

  if (!device.is_active) {
    return NextResponse.json(
      { error: "Endast aktiva skärmar kan pausas." },
      { status: 400 },
    );
  }

  const { data: existingPause, error: existingPauseError } = await supabaseAdmin
    .from("subscription_device_pauses")
    .select("id, pause_resumes_at")
    .eq("device_id", device.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingPauseError) {
    return NextResponse.json(
      { error: "Kunde inte kontrollera om skärmen redan är pausad." },
      { status: 500 },
    );
  }

  if (existingPause) {
    return NextResponse.json(
      {
        error: `Skärmen är redan pausad till ${formatDate(
          existingPause.pause_resumes_at,
        )}.`,
      },
      { status: 400 },
    );
  }

  const { data: existingCancellation, error: existingCancellationError } =
    await supabaseAdmin
      .from("subscription_device_cancellations")
      .select("id, cancellation_effective_at")
      .eq("device_id", device.id)
      .in("status", ["scheduled", "active_until_period_end"])
      .maybeSingle();

  if (existingCancellationError) {
    return NextResponse.json(
      { error: "Kunde inte kontrollera om skärmen redan är under avslut." },
      { status: 500 },
    );
  }

  if (existingCancellation) {
    return NextResponse.json(
      {
        error: `Skärmen är redan markerad för avslut ${
          existingCancellation.cancellation_effective_at
            ? formatDate(existingCancellation.cancellation_effective_at)
            : ""
        }.`.trim(),
      },
      { status: 400 },
    );
  }

  let subscriptionQuery = supabaseAdmin
    .from("customer_subscriptions")
    .select(
      "id, order_number, status, stripe_subscription_id, quote_items, monthly_fee_sek, screen_quantity",
    )
    .eq("customer_id", customer.id)
    .not("stripe_subscription_id", "is", null)
    .in("status", ["paid", "active", "trialing"]);

  if (customerSubscriptionId) {
    subscriptionQuery = subscriptionQuery.eq("id", customerSubscriptionId);
  }

  const { data: subscriptions, error: subscriptionError } =
    await subscriptionQuery.order("created_at", { ascending: false });

  if (subscriptionError) {
    return NextResponse.json(
      { error: "Kunde inte hämta abonnemanget." },
      { status: 500 },
    );
  }

  const localSubscriptions = (subscriptions || []) as LocalSubscription[];
  if (!localSubscriptions.length) {
    return NextResponse.json(
      { error: "Det finns inget aktivt abonnemang för vald skärm." },
      { status: 400 },
    );
  }

  if (!customerSubscriptionId && localSubscriptions.length > 1) {
    return NextResponse.json(
      {
        error:
          "Välj vilken abonnemangsdel skärmen hör till innan den pausas.",
      },
      { status: 400 },
    );
  }

  const localSubscription = localSubscriptions[0];
  const quoteItems = normalizeQuoteItems(localSubscription);
  const selectedQuoteItem =
    pricingPlanCode && quoteItems.length > 1
      ? quoteItems.find((item) => item.pricingPlanCode === pricingPlanCode)
      : quoteItems[0];

  if (!selectedQuoteItem) {
    return NextResponse.json(
      { error: "Välj rätt teknisk nivå för skärmen som ska pausas." },
      { status: 400 },
    );
  }

  const { data: plan } = selectedQuoteItem.pricingPlanCode
    ? await supabaseAdmin
        .from("pricing_plans")
        .select("code, stripe_monthly_price_id")
        .eq("code", selectedQuoteItem.pricingPlanCode)
        .maybeSingle()
    : { data: null };
  const stripePriceId =
    typeof plan?.stripe_monthly_price_id === "string"
      ? plan.stripe_monthly_price_id
      : null;

  const stripeSubscription = await stripe.subscriptions.retrieve(
    localSubscription.stripe_subscription_id!,
  );

  if (stripeSubscription.status === "canceled") {
    return NextResponse.json(
      { error: "Abonnemanget är avslutat och kan inte pausas." },
      { status: 400 },
    );
  }

  const stripeItem = findStripeItem(stripeSubscription, stripePriceId);
  if (!stripeItem) {
    return NextResponse.json(
      {
        error:
          "Kunde inte hitta rätt Stripe-rad för vald skärm. Kontakta Screenia så pausen kan göras manuellt.",
      },
      { status: 409 },
    );
  }

  const currentQuantity = stripeItem.quantity || 0;
  if (currentQuantity <= 1) {
    return NextResponse.json(
      {
        error:
          "Den här abonnemangsdelen har bara en skärm. Använd paus för hela abonnemanget om hela tjänsten ska pausas.",
      },
      { status: 400 },
    );
  }

  const pauseResumesAt = addMonths(new Date(), durationMonths);
  const pauseResumesAtIso = pauseResumesAt.toISOString();
  const adjustedQuantity = currentQuantity - 1;

  await stripe.subscriptionItems.update(stripeItem.id, {
    quantity: adjustedQuantity,
    proration_behavior: "none",
  });

  const { data: pauseRow, error: pauseInsertError } = await supabaseAdmin
    .from("subscription_device_pauses")
    .insert({
      customer_id: customer.id,
      customer_subscription_id: localSubscription.id,
      device_id: device.id,
      stripe_subscription_id: stripeSubscription.id,
      stripe_subscription_item_id: stripeItem.id,
      stripe_price_id: stripeItem.price.id,
      pricing_plan_code: selectedQuoteItem.pricingPlanCode || null,
      monthly_fee_sek: selectedQuoteItem.monthlyFeeSek,
      reason,
      pause_resumes_at: pauseResumesAtIso,
      original_subscription_item_quantity: currentQuantity,
      adjusted_subscription_item_quantity: adjustedQuantity,
    })
    .select("id")
    .single();

  if (pauseInsertError || !pauseRow) {
    await stripe.subscriptionItems.update(stripeItem.id, {
      quantity: currentQuantity,
      proration_behavior: "none",
    });

    return NextResponse.json(
      {
        error:
          "Stripe uppdaterades men Screenia kunde inte spara pausbeviset. Ändringen återställdes.",
      },
      { status: 500 },
    );
  }

  await supabaseAdmin
    .from("devices")
    .update({ is_active: false, inventory_status: "paused" })
    .eq("id", device.id);

  const deviceLabel = device.name || device.device_code;
  const emailResult = await sendTransactionalEmail({
    to: customer.email,
    subject: "Bekräftelse: en skärm är pausad",
    text: [
      `Hej ${customer.name},`,
      "",
      `Vi bekräftar att skärmen ${deviceLabel} är pausad enligt begäran.`,
      `Den här skärmen tas bort från kommande månadsdebiteringar till ${formatDate(pauseResumesAtIso)}.`,
      "",
      `Abonnemangsdel: ${selectedQuoteItem.label || selectedQuoteItem.pricingPlanCode || "Screenia"}`,
      `Månadsbelopp som pausas: ${formatSek(selectedQuoteItem.monthlyFeeSek)}`,
      `Pauslängd: ${durationMonths} ${durationMonths === 1 ? "månad" : "månader"}`,
      `Planerad återaktivering: ${formatDate(pauseResumesAtIso)}`,
      `Notering: ${reason}`,
      "",
      "Övriga aktiva skärmar fortsätter att fungera och debiteras som vanligt.",
    ].join("\n"),
    html: renderBrandedEmail({
      eyebrow: "Abonnemang",
      title: "En skärm är pausad",
      intro: `Vi bekräftar att skärmen ${escapeHtml(
        deviceLabel,
      )} är pausad till ${formatDate(pauseResumesAtIso)}.`,
      showHelper: false,
      children: `
        <div style="border:1px solid #d8e7fb; border-radius:14px; background:#f7fbff; padding:16px 18px;">
          <p style="margin:0 0 8px;"><strong>Skärm:</strong> ${escapeHtml(deviceLabel)}</p>
          <p style="margin:0 0 8px;"><strong>Abonnemangsdel:</strong> ${escapeHtml(selectedQuoteItem.label || selectedQuoteItem.pricingPlanCode || "Screenia")}</p>
          <p style="margin:0 0 8px;"><strong>Månadsbelopp som pausas:</strong> ${formatSek(selectedQuoteItem.monthlyFeeSek)}</p>
          <p style="margin:0 0 8px;"><strong>Pauslängd:</strong> ${durationMonths} ${durationMonths === 1 ? "månad" : "månader"}</p>
          <p style="margin:0;"><strong>Planerad återaktivering:</strong> ${formatDate(pauseResumesAtIso)}</p>
        </div>
        <p style="margin:18px 0 0;">Övriga aktiva skärmar fortsätter att fungera och debiteras som vanligt.</p>
      `,
    }),
  });

  await Promise.all([
    recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "customer",
      actorId: user.id,
      eventType: "customer_device_subscription_paused",
      eventDescription:
        "Customer paused one selected display device from the customer profile.",
      metadata: {
        deviceId: device.id,
        deviceCode: device.device_code,
        customerSubscriptionId: localSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeSubscriptionItemId: stripeItem.id,
        previousQuantity: currentQuantity,
        adjustedQuantity,
        pricingPlanCode: selectedQuoteItem.pricingPlanCode || null,
        monthlyFeeSek: selectedQuoteItem.monthlyFeeSek,
        durationMonths,
        pauseResumesAt: pauseResumesAtIso,
        resendEmailId: emailResult.ok ? emailResult.id || null : null,
        emailWarning: emailResult.ok ? null : emailResult.error,
      },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    }),
    createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "customer_device_subscription_paused",
      title: "Customer paused one device",
      message: `${customer.name} paused ${deviceLabel}. Other devices remain active.`,
      priority: "high",
      metadata: {
        deviceId: device.id,
        deviceCode: device.device_code,
        customerSubscriptionId: localSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeSubscriptionItemId: stripeItem.id,
        adjustedQuantity,
        pauseResumesAt: pauseResumesAtIso,
        resendEmailId: emailResult.ok ? emailResult.id || null : null,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    pauseId: pauseRow.id,
    deviceId: device.id,
    deviceLabel,
    pauseResumesAt: pauseResumesAtIso,
    previousQuantity: currentQuantity,
    adjustedQuantity,
    monthlyAmountPausedSek: selectedQuoteItem.monthlyFeeSek,
    emailSent: emailResult.ok,
    resendEmailId: emailResult.ok ? emailResult.id || null : null,
    warning: emailResult.ok ? null : emailResult.error,
  });
}
