import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";
import { createAdminNotification } from "@/lib/server/admin-notifications";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.app_metadata?.role === "admin" ? user : null;
}

function cleanReason(value: unknown) {
  return String(value || "").trim().slice(0, 1200);
}

function requireAdminReason(reason: string) {
  return reason.length >= 5;
}

async function getCustomer(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select(
      "id, name, status, payment_status, stripe_customer_id, stripe_subscription_id, service_access_status, service_access_until, activated_at, inactive_reason, cancelled_at, cancellation_source",
    )
    .eq("id", customerId)
    .single();

  if (error || !data) return null;
  return data;
}

async function getLatestCustomerSubscriptionSnapshot(customerId: string) {
  const { data } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id, status, fulfillment_status, inventory_status")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

async function updateLocalSubscription(
  subscription: Stripe.Subscription,
  customerId: string,
  extra: Record<string, unknown> = {},
  context?: {
    actorId: string;
    action: string;
    reason: string;
    ipAddress: string | null;
    userAgent: string | null;
  },
) {
  const entitlement = getStripeSubscriptionEntitlement(subscription);
  const update = {
    stripe_payment_status: subscription.status,
    stripe_current_period_start: entitlement.currentPeriodStart,
    stripe_current_period_end: entitlement.currentPeriodEnd,
    cancel_at_period_end: entitlement.cancelAtPeriodEnd,
    cancellation_effective_at: entitlement.cancellationEffectiveAt,
    pause_started_at:
      entitlement.serviceAccessStatus === "paused"
        ? entitlement.pauseStartedAt
        : null,
    pause_resumes_at: entitlement.pauseResumesAt,
    ...extra,
  };

  const { data, error: lookupError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  let syncError: string | null = lookupError?.message || null;
  const targetId = data?.id;
  if (targetId) {
    const { error } = await supabaseAdmin
      .from("customer_subscriptions")
      .update(update)
      .eq("id", targetId);
    syncError = error?.message || null;
  } else {
    const { data: fallback, error: fallbackLookupError } = await supabaseAdmin
      .from("customer_subscriptions")
      .select("id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    syncError = syncError || fallbackLookupError?.message || null;

    if (fallback?.id) {
      const { error } = await supabaseAdmin
        .from("customer_subscriptions")
        .update(update)
        .eq("id", fallback.id);
      syncError = error?.message || null;
    } else if (!syncError) {
      syncError = "No local customer_subscriptions row matched the Stripe subscription or customer.";
    }
  }

  let syncFailureResponse: NextResponse | null = null;

  if (syncError && context) {
    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId,
          actorType: "admin",
          actorId: context.actorId,
          eventType: "admin_subscription_local_sync_failed",
          eventDescription:
            "Stripe subscription operation succeeded, but Screenia could not sync the local subscription row.",
          metadata: {
            action: context.action,
            reason: context.reason,
            stripeSubscriptionId: subscription.id,
            syncError,
            attemptedUpdate: update,
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
        { throwOnError: true },
      );
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId,
          eventType: "admin_subscription_local_sync_failed",
          title: "Subscription local sync failed",
          message:
            "A Stripe subscription operation succeeded, but Screenia could not update the local subscription row. Review customer access and billing state.",
          priority: "urgent",
          metadata: {
            action: context.action,
            stripeSubscriptionId: subscription.id,
            syncError,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error("Admin subscription local sync failure evidence error:", evidenceError);
      syncFailureResponse = NextResponse.json(
        {
          error:
            "Stripe operation succeeded, but Screenia could not update the local subscription row or store urgent failure evidence. Review this customer immediately.",
        },
        { status: 500 },
      );
    }
  }

  return { entitlement, syncFailureResponse };
}

async function recordCustomerAccessSyncFailure(
  customerId: string,
  stripeSubscriptionId: string | null,
  context: {
    actorId: string;
    action: string;
    reason: string;
    ipAddress: string | null;
    userAgent: string | null;
  },
  syncError: string,
  attemptedUpdate: Record<string, unknown>,
) {
  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "admin",
        actorId: context.actorId,
        eventType: "admin_subscription_customer_sync_failed",
        eventDescription:
          "Stripe subscription operation succeeded, but Screenia could not sync customer access.",
        metadata: {
          action: context.action,
          reason: context.reason,
          stripeSubscriptionId,
          syncError,
          attemptedUpdate,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      { throwOnError: true },
    );
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId,
        eventType: "admin_subscription_customer_sync_failed",
        title: "Customer subscription access sync failed",
        message:
          "A Stripe subscription operation succeeded, but Screenia could not update customer access. Review display access and billing state before considering the action complete.",
        priority: "urgent",
        metadata: {
          action: context.action,
          stripeSubscriptionId,
          syncError,
        },
      },
      { throwOnError: true },
    );
    return null;
  } catch (evidenceError) {
    console.error("Admin subscription customer sync failure evidence error:", evidenceError);
    return NextResponse.json(
      {
        error:
          "Stripe operation succeeded, but Screenia could not update customer access or store urgent failure evidence. Review this customer immediately.",
      },
      { status: 500 },
    );
  }
}

async function updateCustomerAccessAfterStripe(
  customerId: string,
  stripeSubscriptionId: string | null,
  update: Record<string, unknown>,
  context: {
    actorId: string;
    action: string;
    reason: string;
    ipAddress: string | null;
    userAgent: string | null;
  },
) {
  const { error } = await supabaseAdmin
    .from("customers")
    .update(update)
    .eq("id", customerId);

  if (!error) return null;

  const evidenceFailureResponse = await recordCustomerAccessSyncFailure(
    customerId,
    stripeSubscriptionId,
    context,
    error.message,
    update,
  );

  if (evidenceFailureResponse) return evidenceFailureResponse;

  return NextResponse.json(
    {
      error:
        "Stripe operation succeeded, but Screenia could not update customer access. An urgent admin notification was created.",
    },
    { status: 500 },
  );
}

type RequiredSubscriptionAuditInput = {
  customerId: string;
  actorId: string;
  eventType: string;
  eventDescription: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
};

async function recordRequiredSubscriptionAudit(
  event: RequiredSubscriptionAuditInput,
) {
  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: event.customerId,
        actorType: "admin",
        actorId: event.actorId,
        eventType: event.eventType,
        eventDescription: event.eventDescription,
        metadata: event.metadata,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
      { throwOnError: true },
    );
    return null;
  } catch (auditError) {
    console.error("Admin subscription success audit error:", auditError);

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: event.customerId,
          eventType: "admin_subscription_success_audit_failed",
          title: "Subscription action audit failed",
          message:
            "A Stripe subscription action succeeded, but Screenia could not store the required success audit event. Review this customer immediately.",
          priority: "urgent",
          metadata: {
            requiredEventType: event.eventType,
            requiredMetadata: event.metadata,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Admin subscription success audit notification error:",
        notificationError,
      );
    }

    return NextResponse.json(
      {
        error:
          "Subscription operation succeeded, but Screenia could not store the required success audit evidence. Review this customer immediately.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { customerId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const reason = cleanReason(body.reason);
  const customer = await getCustomer(customerId);

  if (!customer) {
    return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
  }

  const auditBase = {
    customerId,
    actorType: "admin" as const,
    actorId: user.id,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  };
  const syncContext = (operation: string) => ({
    actorId: user.id,
    action: operation,
    reason,
    ipAddress: auditBase.ipAddress,
    userAgent: auditBase.userAgent,
  });

  if (action === "activate_customer" || action === "reactivate_customer") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const previousSubscription = await getLatestCustomerSubscriptionSnapshot(customerId);
    const activatedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "active",
        activated_at: activatedAt,
        inactive_reason: null,
        cancelled_at: null,
        cancellation_source: null,
        service_access_status:
          customer.payment_status === "paid" ? "active" : customer.service_access_status,
      })
      .eq("id", customerId);

    if (error) {
      return NextResponse.json({ error: "Could not activate customer." }, { status: 500 });
    }

    await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "active",
        fulfillment_status: "completed",
        inventory_status: "assigned",
      })
      .eq("customer_id", customerId)
      .in("status", ["paid", "active", "checkout_started"]);

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          ...auditBase,
          eventType: action,
          eventDescription: "Admin marked customer active.",
          metadata: { reason: reason || null },
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Customer activation audit error:", auditError);

      const { error: customerRollbackError } = await supabaseAdmin
        .from("customers")
        .update({
          status: customer.status,
          activated_at: customer.activated_at,
          inactive_reason: customer.inactive_reason,
          cancelled_at: customer.cancelled_at,
          cancellation_source: customer.cancellation_source,
          service_access_status: customer.service_access_status,
        })
        .eq("id", customerId);

      if (customerRollbackError) {
        console.error("Customer activation rollback error:", customerRollbackError);
      }

      if (previousSubscription?.id) {
        const { error: subscriptionRollbackError } = await supabaseAdmin
          .from("customer_subscriptions")
          .update({
            status: previousSubscription.status,
            fulfillment_status: previousSubscription.fulfillment_status,
            inventory_status: previousSubscription.inventory_status,
          })
          .eq("id", previousSubscription.id);

        if (subscriptionRollbackError) {
          console.error(
            "Customer activation subscription rollback error:",
            subscriptionRollbackError,
          );
        }
      }

      return NextResponse.json(
        {
          error:
            "Customer activation was not saved because Screenia could not store the required audit evidence.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "suspend_customer") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const previousSubscription = await getLatestCustomerSubscriptionSnapshot(customerId);
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        service_access_status: "inactive",
        service_access_until: null,
        inactive_reason: "manual_suspend",
        cancellation_source: "admin",
      })
      .eq("id", customerId);

    if (error) {
      return NextResponse.json({ error: "Could not suspend customer." }, { status: 500 });
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          ...auditBase,
          eventType: "customer_suspended",
          eventDescription: "Admin manually suspended customer access.",
          metadata: { reason },
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Customer suspension audit error:", auditError);

      const { error: customerRollbackError } = await supabaseAdmin
        .from("customers")
        .update({
          status: customer.status,
          service_access_status: customer.service_access_status,
          service_access_until: customer.service_access_until,
          inactive_reason: customer.inactive_reason,
          cancellation_source: customer.cancellation_source,
        })
        .eq("id", customerId);

      if (customerRollbackError) {
        console.error("Customer suspension rollback error:", customerRollbackError);
      }

      if (previousSubscription?.id) {
        const { error: subscriptionRollbackError } = await supabaseAdmin
          .from("customer_subscriptions")
          .update({
            status: previousSubscription.status,
            fulfillment_status: previousSubscription.fulfillment_status,
            inventory_status: previousSubscription.inventory_status,
          })
          .eq("id", previousSubscription.id);

        if (subscriptionRollbackError) {
          console.error(
            "Customer suspension subscription rollback error:",
            subscriptionRollbackError,
          );
        }
      }

      return NextResponse.json(
        {
          error:
            "Customer suspension was not saved because Screenia could not store the required audit evidence.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (!customer.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No Stripe subscription is connected." },
      { status: 400 },
    );
  }

  if (action === "cancel_period_end") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.update(
      customer.stripe_subscription_id,
      { cancel_at_period_end: true },
    );
    const { entitlement, syncFailureResponse } = await updateLocalSubscription(
      subscription,
      customerId,
      {
        status: "active",
      },
      syncContext(action),
    );
    if (syncFailureResponse) return syncFailureResponse;
    const effectiveAt =
      entitlement.cancellationEffectiveAt || entitlement.currentPeriodEnd;

    const customerSyncResponse = await updateCustomerAccessAfterStripe(
      customerId,
      customer.stripe_subscription_id,
      {
        status: "active",
        payment_status: "paid",
        service_access_status: "active_until_period_end",
        service_access_until: effectiveAt,
        inactive_reason: null,
        cancellation_reason: "admin_period_end",
        cancellation_details: reason,
        cancelled_at: null,
        cancellation_source: "admin",
      },
      syncContext(action),
    );

    if (customerSyncResponse) return customerSyncResponse;

    const auditResponse = await recordRequiredSubscriptionAudit({
      ...auditBase,
      eventType: "subscription_cancel_scheduled",
      eventDescription:
        "Admin scheduled subscription cancellation for the end of the paid period.",
      metadata: {
        reason,
        stripeSubscriptionId: customer.stripe_subscription_id,
        cancellationEffectiveAt: effectiveAt,
      },
    });
    if (auditResponse) return auditResponse;

    return NextResponse.json({ success: true, cancellationEffectiveAt: effectiveAt });
  }

  if (action === "cancel_immediately") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      customer.stripe_subscription_id,
    );
    if (subscription.status !== "canceled") {
      await stripe.subscriptions.cancel(customer.stripe_subscription_id);
    }

    const cancelledAt = new Date().toISOString();
    const customerSyncResponse = await updateCustomerAccessAfterStripe(
      customerId,
      customer.stripe_subscription_id,
      {
        status: "suspended",
        payment_status: "cancelled",
        service_access_status: "cancelled",
        service_access_until: null,
        inactive_reason: "subscription_cancelled",
        cancellation_reason: "admin_immediate",
        cancellation_details: reason,
        cancelled_at: cancelledAt,
        cancellation_source: "admin",
      },
      syncContext(action),
    );

    if (customerSyncResponse) return customerSyncResponse;

    const { error: subscriptionSyncError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "cancelled",
        stripe_payment_status: "canceled",
        fulfillment_status: "cancelled",
        cancellation_effective_at: cancelledAt,
        cancel_at_period_end: false,
      })
      .eq("stripe_subscription_id", customer.stripe_subscription_id);

    if (subscriptionSyncError) {
      const evidenceFailureResponse = await recordCustomerAccessSyncFailure(
        customerId,
        customer.stripe_subscription_id,
        syncContext(action),
        subscriptionSyncError.message,
        {
          status: "cancelled",
          stripe_payment_status: "canceled",
          fulfillment_status: "cancelled",
          cancellation_effective_at: cancelledAt,
          cancel_at_period_end: false,
        },
      );

      if (evidenceFailureResponse) return evidenceFailureResponse;

      return NextResponse.json(
        {
          error:
            "Stripe operation succeeded, but Screenia could not update the local subscription. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    const auditResponse = await recordRequiredSubscriptionAudit({
      ...auditBase,
      eventType: "subscription_cancelled_immediately",
      eventDescription: "Admin immediately cancelled the Stripe subscription.",
      metadata: { reason, stripeSubscriptionId: customer.stripe_subscription_id },
    });
    if (auditResponse) return auditResponse;

    return NextResponse.json({ success: true });
  }

  if (action === "pause_subscription") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.update(
      customer.stripe_subscription_id,
      {
        pause_collection: {
          behavior: "void",
        },
      },
    );
    const { entitlement, syncFailureResponse } = await updateLocalSubscription(
      subscription,
      customerId,
      {
        status: "paused",
        pause_reason: reason,
      },
      syncContext(action),
    );
    if (syncFailureResponse) return syncFailureResponse;

    const customerSyncResponse = await updateCustomerAccessAfterStripe(
      customerId,
      customer.stripe_subscription_id,
      {
        status: "suspended",
        service_access_status: "paused",
        service_access_until: null,
        inactive_reason: "paused",
        cancellation_source: "admin",
      },
      syncContext(action),
    );

    if (customerSyncResponse) return customerSyncResponse;

    const auditResponse = await recordRequiredSubscriptionAudit({
      ...auditBase,
      eventType: "subscription_paused",
      eventDescription: "Admin paused billing collection and display access.",
      metadata: {
        reason,
        stripeSubscriptionId: customer.stripe_subscription_id,
        pauseResumesAt: entitlement.pauseResumesAt,
      },
    });
    if (auditResponse) return auditResponse;

    return NextResponse.json({ success: true });
  }

  if (action === "resume_subscription") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.update(
      customer.stripe_subscription_id,
      {
        cancel_at_period_end: false,
        pause_collection: "",
      } as Stripe.SubscriptionUpdateParams,
    );
    const { entitlement, syncFailureResponse } = await updateLocalSubscription(
      subscription,
      customerId,
      {
        status: "active",
        pause_reason: null,
      },
      syncContext(action),
    );
    if (syncFailureResponse) return syncFailureResponse;

    const customerSyncResponse = await updateCustomerAccessAfterStripe(
      customerId,
      customer.stripe_subscription_id,
      {
        status: "active",
        payment_status: "paid",
        service_access_status: entitlement.serviceAccessStatus,
        service_access_until: entitlement.serviceAccessUntil,
        inactive_reason: null,
        cancellation_reason: null,
        cancellation_details: null,
        cancellation_source: null,
        cancelled_at: null,
      },
      syncContext(action),
    );

    if (customerSyncResponse) return customerSyncResponse;

    const auditResponse = await recordRequiredSubscriptionAudit({
      ...auditBase,
      eventType: "subscription_resumed",
      eventDescription: "Admin resumed billing collection and display access.",
      metadata: {
        reason: reason || null,
        stripeSubscriptionId: customer.stripe_subscription_id,
      },
    });
    if (auditResponse) return auditResponse;

    return NextResponse.json({ success: true });
  }

  if (action === "apply_temporary_discount") {
    const percentOff = Math.min(100, Math.max(1, Number(body.percentOff) || 0));
    const durationMonths = Math.min(
      36,
      Math.max(1, Math.round(Number(body.durationMonths) || 0)),
    );

    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration: "repeating",
      duration_in_months: durationMonths,
      name: `Screenia admin discount ${percentOff}%`,
      metadata: {
        customer_id: customerId,
        reason,
      },
    });

    const subscription = await stripe.subscriptions.update(
      customer.stripe_subscription_id,
      { discounts: [{ coupon: coupon.id }] },
    );
    const { entitlement, syncFailureResponse } = await updateLocalSubscription(
      subscription,
      customerId,
      {},
      syncContext(action),
    );
    if (syncFailureResponse) return syncFailureResponse;

    const { data: localSubscription } = await supabaseAdmin
      .from("customer_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", customer.stripe_subscription_id)
      .maybeSingle();

    const adjustmentInsert = {
      customer_id: customerId,
      customer_subscription_id: localSubscription?.id || null,
      stripe_subscription_id: customer.stripe_subscription_id,
      adjustment_type: "temporary_discount",
      percent_off: percentOff,
      duration_months: durationMonths,
      stripe_coupon_id: coupon.id,
      reason,
      status: "active",
      created_by: user.id,
    };
    const { error: adjustmentError } = await supabaseAdmin
      .from("subscription_adjustments")
      .insert(adjustmentInsert);

    if (adjustmentError) {
      const evidenceFailureResponse = await recordCustomerAccessSyncFailure(
        customerId,
        customer.stripe_subscription_id,
        syncContext(action),
        adjustmentError.message,
        adjustmentInsert,
      );

      if (evidenceFailureResponse) return evidenceFailureResponse;

      return NextResponse.json(
        {
          error:
            "Stripe discount was applied, but Screenia could not store the local discount record. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    const customerSyncResponse = await updateCustomerAccessAfterStripe(
      customerId,
      customer.stripe_subscription_id,
      {
        service_access_status: entitlement.serviceAccessStatus,
        service_access_until: entitlement.serviceAccessUntil,
      },
      syncContext(action),
    );

    if (customerSyncResponse) return customerSyncResponse;

    const auditResponse = await recordRequiredSubscriptionAudit({
      ...auditBase,
      eventType: "subscription_discount_applied",
      eventDescription: "Admin applied a temporary subscription discount.",
      metadata: {
        reason,
        percentOff,
        durationMonths,
        stripeCouponId: coupon.id,
        stripeSubscriptionId: customer.stripe_subscription_id,
      },
    });
    if (auditResponse) return auditResponse;

    return NextResponse.json({ success: true, stripeCouponId: coupon.id });
  }

  if (action === "remove_temporary_discount") {
    if (!requireAdminReason(reason)) {
      return NextResponse.json(
        { error: "A reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    const existingSubscription = await stripe.subscriptions.retrieve(
      customer.stripe_subscription_id,
      { expand: ["discounts"] },
    );
    const hasStripeDiscount =
      Array.isArray(existingSubscription.discounts) &&
      existingSubscription.discounts.length > 0;

    const { data: activeAdjustments, error: activeAdjustmentError } =
      await supabaseAdmin
        .from("subscription_adjustments")
        .select("id, stripe_coupon_id, percent_off, duration_months")
        .eq("customer_id", customerId)
        .eq("stripe_subscription_id", customer.stripe_subscription_id)
        .eq("status", "active");

    if (activeAdjustmentError) {
      const evidenceFailureResponse = await recordCustomerAccessSyncFailure(
        customerId,
        customer.stripe_subscription_id,
        syncContext(action),
        activeAdjustmentError.message,
        { operation: "lookup_active_subscription_adjustments" },
      );

      if (evidenceFailureResponse) return evidenceFailureResponse;

      return NextResponse.json(
        { error: "Could not verify active local discount records." },
        { status: 500 },
      );
    }

    if (!hasStripeDiscount && !(activeAdjustments || []).length) {
      return NextResponse.json(
        { error: "No active temporary discount is connected to this subscription." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.update(
      customer.stripe_subscription_id,
      { discounts: "" } as Stripe.SubscriptionUpdateParams,
    );
    const { entitlement, syncFailureResponse } = await updateLocalSubscription(
      subscription,
      customerId,
      {},
      syncContext(action),
    );
    if (syncFailureResponse) return syncFailureResponse;

    const adjustmentIds = (activeAdjustments || []).map((adjustment) => adjustment.id);
    if (adjustmentIds.length) {
      const { error: adjustmentUpdateError } = await supabaseAdmin
        .from("subscription_adjustments")
        .update({ status: "inactive" })
        .in("id", adjustmentIds);

      if (adjustmentUpdateError) {
        const evidenceFailureResponse = await recordCustomerAccessSyncFailure(
          customerId,
          customer.stripe_subscription_id,
          syncContext(action),
          adjustmentUpdateError.message,
          { operation: "mark_subscription_adjustments_inactive", adjustmentIds },
        );

        if (evidenceFailureResponse) return evidenceFailureResponse;

        return NextResponse.json(
          {
            error:
              "Stripe discount was removed, but Screenia could not mark local discount records inactive.",
          },
          { status: 500 },
        );
      }
    }

    const customerSyncResponse = await updateCustomerAccessAfterStripe(
      customerId,
      customer.stripe_subscription_id,
      {
        service_access_status: entitlement.serviceAccessStatus,
        service_access_until: entitlement.serviceAccessUntil,
      },
      syncContext(action),
    );

    if (customerSyncResponse) return customerSyncResponse;

    const auditResponse = await recordRequiredSubscriptionAudit({
      ...auditBase,
      eventType: "subscription_discount_removed",
      eventDescription: "Admin removed a temporary subscription discount.",
      metadata: {
        reason,
        stripeSubscriptionId: customer.stripe_subscription_id,
        removedAdjustmentIds: adjustmentIds,
        removedStripeCoupons: (activeAdjustments || []).map(
          (adjustment) => adjustment.stripe_coupon_id,
        ),
      },
    });
    if (auditResponse) return auditResponse;

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported subscription action." }, { status: 400 });
}
