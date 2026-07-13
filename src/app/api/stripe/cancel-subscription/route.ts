import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

function cleanReason(value: unknown) {
  return String(value || "").trim().slice(0, 1200);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId, subscriptionId, reason: rawReason } =
      await request.json().catch(() => ({}));
    const reason = cleanReason(rawReason);

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing customerId or subscriptionId" },
        { status: 400 },
      );
    }

    if (reason.length < 5) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const { data: localSubscription, error: localSubscriptionError } =
      await supabaseAdmin
        .from("customer_subscriptions")
        .select("id, customer_id, stripe_subscription_id")
        .eq("customer_id", customerId)
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

    if (
      localSubscriptionError &&
      localSubscriptionError.code !== "PGRST116"
    ) {
      console.error(
        "Supabase subscription ownership lookup error:",
        localSubscriptionError,
      );
      return NextResponse.json(
        { error: "Could not verify subscription ownership" },
        { status: 500 },
      );
    }

    if (
      customer.stripe_subscription_id !== subscriptionId &&
      !localSubscription
    ) {
      return NextResponse.json(
        { error: "Subscription does not belong to this customer" },
        { status: 403 },
      );
    }

    const existingStripeSubscription =
      await stripe.subscriptions.retrieve(subscriptionId);

    if (
      customer.stripe_customer_id &&
      typeof existingStripeSubscription.customer === "string" &&
      existingStripeSubscription.customer !== customer.stripe_customer_id
    ) {
      return NextResponse.json(
        { error: "Stripe subscription customer mismatch" },
        { status: 403 },
      );
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    const entitlement = getStripeSubscriptionEntitlement(subscription);
    const cancellationEffectiveAt =
      entitlement.cancellationEffectiveAt || entitlement.currentPeriodEnd;

    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "active",
        payment_status: "paid",
        service_access_status: "active_until_period_end",
        service_access_until: cancellationEffectiveAt,
        inactive_reason: null,
        cancellation_reason: "admin_period_end",
        cancellation_details: reason,
        cancelled_at: null,
        cancellation_source: "admin",
      })
      .eq("id", customerId);

    if (error) {
      console.error("Supabase cancel update error:", error);
      return NextResponse.json(
        { error: "Subscription was scheduled, but database update failed" },
        { status: 500 },
      );
    }

    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "active",
        stripe_payment_status: subscription.status,
        fulfillment_status: "active",
        stripe_current_period_start: entitlement.currentPeriodStart,
        stripe_current_period_end: entitlement.currentPeriodEnd,
        cancel_at_period_end: true,
        cancellation_effective_at: cancellationEffectiveAt,
      })
      .eq("stripe_subscription_id", subscriptionId);

    if (subscriptionUpdateError) {
      console.error(
        "Supabase subscription cancel update error:",
        subscriptionUpdateError,
      );
    }

    await recordAuditEvent(supabaseAdmin, {
      customerId,
      actorType: "admin",
      actorId: user.id,
      eventType: "subscription_cancelled",
      eventDescription:
        "Admin scheduled Stripe subscription cancellation for the end of the paid period.",
      metadata: {
        stripeSubscriptionId: subscriptionId,
        cancellationEffectiveAt,
        reason,
      },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true, cancellationEffectiveAt });
  } catch (error) {
    console.error("Cancel subscription error:", error);

    return NextResponse.json(
      { error: "Could not cancel subscription" },
      { status: 500 },
    );
  }
}
