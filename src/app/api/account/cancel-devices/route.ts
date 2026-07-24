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

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const itemPeriodEnd = subscription.items.data
    .map((item) => item.current_period_end)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const periodEnd =
    subscription.cancel_at ||
    subscription.trial_end ||
    itemPeriodEnd ||
    Math.floor(Date.now() / 1000);

  return new Date(periodEnd * 1000).toISOString();
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rawDeviceIds = Array.isArray(body.deviceIds) ? body.deviceIds : [];
  const deviceIds = Array.from(
    new Set(rawDeviceIds.map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const customerSubscriptionId = String(body.customerSubscriptionId || "").trim();
  const pricingPlanCode = String(body.pricingPlanCode || "").trim();
  const reason =
    String(body.reason || "").trim().slice(0, 500) ||
    "Customer cancelled selected display devices.";

  if (!deviceIds.length) {
    return NextResponse.json(
      { error: "Välj minst en skärm som ska avslutas." },
      { status: 400 },
    );
  }

  if (!customerSubscriptionId) {
    return NextResponse.json(
      { error: "Välj vilken abonnemangsdel skärmarna hör till." },
      { status: 400 },
    );
  }

  const { data: devices, error: deviceError } = await supabaseAdmin
    .from("devices")
    .select("id, device_code, name, location, is_active, inventory_status")
    .eq("customer_id", customer.id)
    .in("id", deviceIds);

  if (deviceError) {
    return NextResponse.json(
      { error: "Kunde inte kontrollera valda skärmar." },
      { status: 500 },
    );
  }

  if ((devices || []).length !== deviceIds.length) {
    return NextResponse.json(
      { error: "En eller flera valda skärmar finns inte på kontot." },
      { status: 404 },
    );
  }

  const inactiveDevice = (devices || []).find((device) => !device.is_active);
  if (inactiveDevice) {
    return NextResponse.json(
      {
        error: `Skärmen ${
          inactiveDevice.name || inactiveDevice.device_code
        } är inte aktiv och kan inte avslutas här.`,
      },
      { status: 400 },
    );
  }

  const { data: existingCancellations, error: existingCancellationError } =
    await supabaseAdmin
      .from("subscription_device_cancellations")
      .select("id, device_id")
      .in("device_id", deviceIds)
      .in("status", ["scheduled", "active_until_period_end"]);

  if (existingCancellationError) {
    return NextResponse.json(
      { error: "Kunde inte kontrollera om någon skärm redan är under avslut." },
      { status: 500 },
    );
  }

  if (existingCancellations?.length) {
    return NextResponse.json(
      { error: "En eller flera valda skärmar är redan markerade för avslut." },
      { status: 400 },
    );
  }

  const { data: existingPauses, error: existingPauseError } = await supabaseAdmin
    .from("subscription_device_pauses")
    .select("id, device_id")
    .in("device_id", deviceIds)
    .eq("status", "active");

  if (existingPauseError) {
    return NextResponse.json(
      { error: "Kunde inte kontrollera om någon skärm är pausad." },
      { status: 500 },
    );
  }

  if (existingPauses?.length) {
    return NextResponse.json(
      {
        error:
          "Pausade skärmar måste återaktiveras innan de kan avslutas från kundportalen.",
      },
      { status: 400 },
    );
  }

  const { data: localSubscription, error: subscriptionError } =
    await supabaseAdmin
      .from("customer_subscriptions")
      .select(
        "id, order_number, status, stripe_subscription_id, quote_items, monthly_fee_sek, screen_quantity",
      )
      .eq("customer_id", customer.id)
      .eq("id", customerSubscriptionId)
      .not("stripe_subscription_id", "is", null)
      .in("status", ["paid", "active", "trialing"])
      .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json(
      { error: "Kunde inte hämta abonnemanget." },
      { status: 500 },
    );
  }

  if (!localSubscription) {
    return NextResponse.json(
      { error: "Det finns inget aktivt abonnemang för valda skärmar." },
      { status: 400 },
    );
  }

  const quoteItems = normalizeQuoteItems(localSubscription as LocalSubscription);
  const selectedQuoteItem =
    pricingPlanCode && quoteItems.length > 1
      ? quoteItems.find((item) => item.pricingPlanCode === pricingPlanCode)
      : quoteItems[0];

  if (!selectedQuoteItem) {
    return NextResponse.json(
      { error: "Välj rätt teknisk nivå för skärmarna som ska avslutas." },
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
      { error: "Abonnemanget är redan avslutat." },
      { status: 400 },
    );
  }

  const stripeItem = findStripeItem(stripeSubscription, stripePriceId);
  if (!stripeItem) {
    return NextResponse.json(
      {
        error:
          "Kunde inte hitta rätt Stripe-rad för valda skärmar. Kontakta Screenia så avslutet kan göras manuellt.",
      },
      { status: 409 },
    );
  }

  const currentQuantity = stripeItem.quantity || 0;
  const cancelQuantity = deviceIds.length;
  const adjustedQuantity = currentQuantity - cancelQuantity;

  if (cancelQuantity > currentQuantity) {
    return NextResponse.json(
      {
        error:
          "Antalet valda skärmar är större än den valda abonnemangsdelen i Stripe.",
      },
      { status: 400 },
    );
  }

  if (adjustedQuantity === 0 && stripeSubscription.items.data.length === 1) {
    return NextResponse.json(
      {
        error:
          "Det här avslutar hela abonnemanget. Använd knappen Avsluta abonnemang för hela tjänsten.",
      },
      { status: 400 },
    );
  }

  if (adjustedQuantity > 0) {
    await stripe.subscriptionItems.update(stripeItem.id, {
      quantity: adjustedQuantity,
      proration_behavior: "none",
    });
  } else {
    await stripe.subscriptionItems.del(stripeItem.id, {
      proration_behavior: "none",
    });
  }

  const cancellationEffectiveAt = subscriptionPeriodEnd(stripeSubscription);
  const cancellationRows = deviceIds.map((deviceId) => ({
    customer_id: customer.id,
    customer_subscription_id: localSubscription.id,
    device_id: deviceId,
    stripe_subscription_id: stripeSubscription.id,
    stripe_subscription_item_id: stripeItem.id,
    stripe_price_id: stripeItem.price.id,
    pricing_plan_code: selectedQuoteItem.pricingPlanCode || null,
    monthly_fee_sek: selectedQuoteItem.monthlyFeeSek,
    status: "active_until_period_end",
    reason,
    cancellation_effective_at: cancellationEffectiveAt,
    original_subscription_item_quantity: currentQuantity,
    adjusted_subscription_item_quantity: adjustedQuantity,
  }));

  const { data: cancellationRecords, error: cancellationInsertError } =
    await supabaseAdmin
      .from("subscription_device_cancellations")
      .insert(cancellationRows)
      .select("id");

  if (cancellationInsertError || !cancellationRecords) {
    if (adjustedQuantity > 0) {
      await stripe.subscriptionItems.update(stripeItem.id, {
        quantity: currentQuantity,
        proration_behavior: "none",
      });
    } else {
      await stripe.subscriptionItems.create({
        subscription: stripeSubscription.id,
        price: stripeItem.price.id,
        quantity: currentQuantity,
        proration_behavior: "none",
      });
    }

    return NextResponse.json(
      {
        error:
          "Stripe uppdaterades men Screenia kunde inte spara avslutsbeviset. Ändringen återställdes.",
      },
      { status: 500 },
    );
  }

  await supabaseAdmin
    .from("devices")
    .update({ inventory_status: "cancellation_scheduled" })
    .in("id", deviceIds);

  const deviceById = new Map((devices || []).map((device) => [device.id, device]));
  const deviceLabels = deviceIds.map((deviceId) => {
    const device = deviceById.get(deviceId);
    return device?.name || device?.device_code || deviceId;
  });
  const totalMonthlyRemoved = selectedQuoteItem.monthlyFeeSek * cancelQuantity;
  const emailResult = await sendTransactionalEmail({
    to: customer.email,
    subject: "Bekräftelse: skärmar avslutas",
    text: [
      `Hej ${customer.name},`,
      "",
      `Vi bekräftar att ${cancelQuantity} skärm${
        cancelQuantity === 1 ? "" : "ar"
      } är markerad${cancelQuantity === 1 ? "" : "e"} för avslut.`,
      `Avslutet gäller från ${formatDate(cancellationEffectiveAt)}. Fram till dess fortsätter skärmarna enligt nuvarande betalda period.`,
      "",
      `Skärmar: ${deviceLabels.join(", ")}`,
      `Abonnemangsdel: ${
        selectedQuoteItem.label || selectedQuoteItem.pricingPlanCode || "Screenia"
      }`,
      `Månadsbelopp som tas bort från kommande fakturor: ${formatSek(
        totalMonthlyRemoved,
      )}`,
      `Notering: ${reason}`,
      "",
      "Övriga aktiva skärmar fortsätter att fungera och debiteras som vanligt.",
    ].join("\n"),
    html: renderBrandedEmail({
      eyebrow: "Abonnemang",
      title: "Skärmar markerade för avslut",
      intro: `${cancelQuantity} skärm${
        cancelQuantity === 1 ? "" : "ar"
      } avslutas från ${formatDate(cancellationEffectiveAt)}.`,
      showHelper: false,
      children: `
        <div style="border:1px solid #d8e7fb; border-radius:14px; background:#f7fbff; padding:16px 18px;">
          <p style="margin:0 0 8px;"><strong>Skärmar:</strong> ${escapeHtml(deviceLabels.join(", "))}</p>
          <p style="margin:0 0 8px;"><strong>Abonnemangsdel:</strong> ${escapeHtml(selectedQuoteItem.label || selectedQuoteItem.pricingPlanCode || "Screenia")}</p>
          <p style="margin:0 0 8px;"><strong>Gäller från:</strong> ${formatDate(cancellationEffectiveAt)}</p>
          <p style="margin:0;"><strong>Månadsbelopp som tas bort:</strong> ${formatSek(totalMonthlyRemoved)}</p>
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
      eventType: "customer_device_subscription_cancel_scheduled",
      eventDescription:
        "Customer scheduled selected display devices for subscription cancellation.",
      metadata: {
        deviceIds,
        deviceLabels,
        cancellationRecordIds: cancellationRecords.map((record) => record.id),
        customerSubscriptionId: localSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeSubscriptionItemId: stripeItem.id,
        previousQuantity: currentQuantity,
        adjustedQuantity,
        cancelledQuantity: cancelQuantity,
        pricingPlanCode: selectedQuoteItem.pricingPlanCode || null,
        monthlyFeeSek: selectedQuoteItem.monthlyFeeSek,
        monthlyAmountRemovedSek: totalMonthlyRemoved,
        cancellationEffectiveAt,
        resendEmailId: emailResult.ok ? emailResult.id || null : null,
        emailWarning: emailResult.ok ? null : emailResult.error,
      },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    }),
    createAdminNotification(supabaseAdmin, {
      customerId: customer.id,
      eventType: "customer_device_subscription_cancel_scheduled",
      title: "Customer cancelled selected devices",
      message: `${customer.name} scheduled ${cancelQuantity} device${
        cancelQuantity === 1 ? "" : "s"
      } for cancellation. Other devices remain active.`,
      priority: "high",
      metadata: {
        deviceIds,
        customerSubscriptionId: localSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeSubscriptionItemId: stripeItem.id,
        adjustedQuantity,
        cancellationEffectiveAt,
        resendEmailId: emailResult.ok ? emailResult.id || null : null,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    cancellationIds: cancellationRecords.map((record) => record.id),
    deviceIds,
    deviceLabels,
    cancellationEffectiveAt,
    previousQuantity: currentQuantity,
    adjustedQuantity,
    monthlyAmountRemovedSek: totalMonthlyRemoved,
    emailSent: emailResult.ok,
    resendEmailId: emailResult.ok ? emailResult.id || null : null,
    warning: emailResult.ok ? null : emailResult.error,
  });
}
