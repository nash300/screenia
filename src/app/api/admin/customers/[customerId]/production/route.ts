import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { hasDisplayEntitlement } from "@/lib/server/subscription-entitlements";

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

function isMissingProductionColumns(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("production_status") ||
    error.message?.includes("layout_started_at") ||
    error.message?.includes("setup_fee_locked_at") ||
    error.message?.includes("service_access_status") ||
    error.message?.includes("service_access_until")
  );
}

type LayoutCustomerState = {
  id: string;
  name: string | null;
  status: string | null;
  payment_status: string | null;
  service_access_status: string | null;
  service_access_until: string | null;
  production_status: string | null;
  layout_started_at: string | null;
  setup_fee_locked_at: string | null;
};

type LayoutSubscriptionState = {
  id: string;
  fulfillment_status: string | null;
};

async function rollbackLayoutStart(
  customer: LayoutCustomerState,
  subscriptions: LayoutSubscriptionState[],
) {
  const customerRollback = await supabaseAdmin
    .from("customers")
    .update({
      production_status: customer.production_status || null,
      layout_started_at: customer.layout_started_at || null,
      setup_fee_locked_at: customer.setup_fee_locked_at || null,
    })
    .eq("id", customer.id);

  const subscriptionRollbackErrors = [];

  for (const subscription of subscriptions) {
    const { error } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({ fulfillment_status: subscription.fulfillment_status || null })
      .eq("id", subscription.id);

    if (error) subscriptionRollbackErrors.push(error.message);
  }

  return {
    ok: !customerRollback.error && subscriptionRollbackErrors.length === 0,
    error: [
      customerRollback.error?.message,
      ...subscriptionRollbackErrors,
    ].filter(Boolean).join(" | ") || null,
  };
}

async function notifyLayoutStartRollbackFailure({
  customer,
  timestamp,
  reason,
  failureType,
  failureError,
  rollbackError,
}: {
  customer: LayoutCustomerState;
  timestamp: string;
  reason: string;
  failureType: string;
  failureError: unknown;
  rollbackError: string | null;
}) {
  await createAdminNotification(
    supabaseAdmin,
    {
      customerId: customer.id,
      eventType: "layout_start_rollback_failed",
      title: "Layout start rollback failed",
      message:
        "Layout start state could not be fully restored after a required sync or audit step failed.",
      priority: "urgent",
      metadata: {
        customerName: customer.name,
        attemptedLayoutStartedAt: timestamp,
        previousProductionStatus: customer.production_status,
        previousLayoutStartedAt: customer.layout_started_at,
        previousSetupFeeLockedAt: customer.setup_fee_locked_at,
        reason,
        failureType,
        failureError:
          failureError instanceof Error ? failureError.message : String(failureError),
        rollbackError,
      },
    },
    { throwOnError: true },
  );
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
  if (body.action !== "start_layout") {
    return NextResponse.json({ error: "Unsupported production action." }, { status: 400 });
  }
  const reason = String(body.reason || "").trim().slice(0, 1000);
  if (reason.length < 5) {
    return NextResponse.json(
      {
        error:
          "A reason is required before starting layout work and locking the setup fee.",
      },
      { status: 400 },
    );
  }

  const { customerId } = await params;
  const timestamp = new Date().toISOString();

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, status, payment_status, service_access_status, service_access_until, production_status, layout_started_at, setup_fee_locked_at")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    if (customerError && isMissingProductionColumns(customerError)) {
      return NextResponse.json(
        {
          error:
            "Production tracking columns are missing. Apply the latest Supabase migration first.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
  }

  const customerState = customer as LayoutCustomerState;

  if (customer.layout_started_at) {
    return NextResponse.json({
      success: true,
      alreadyStarted: true,
      layoutStartedAt: customer.layout_started_at,
    });
  }

  if (customer.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Layout work can only be started after payment is marked paid." },
      { status: 400 },
    );
  }

  if (
    !hasDisplayEntitlement({
      customerStatus: customer.status,
      paymentStatus: customer.payment_status,
      serviceAccessStatus: customer.service_access_status,
      serviceAccessUntil: customer.service_access_until,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "Layout work can only be started while the customer's paid service access is active.",
      },
      { status: 409 },
    );
  }

  const { data: subscriptionsBefore, error: subscriptionsBeforeError } =
    await supabaseAdmin
      .from("customer_subscriptions")
      .select("id, fulfillment_status")
      .eq("customer_id", customer.id)
      .in("status", ["paid", "active", "checkout_started"]);

  if (subscriptionsBeforeError && subscriptionsBeforeError.code !== "42703") {
    console.error("Load subscriptions before layout start error:", subscriptionsBeforeError);
    return NextResponse.json(
      {
        error:
          "Could not verify subscription fulfillment state before starting layout work.",
      },
      { status: 500 },
    );
  }

  const subscriptionStates =
    ((subscriptionsBefore || []) as LayoutSubscriptionState[]) || [];

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      production_status: "layout_started",
      layout_started_at: timestamp,
      setup_fee_locked_at: timestamp,
    })
    .eq("id", customer.id);

  if (updateError) {
    if (isMissingProductionColumns(updateError)) {
      return NextResponse.json(
        {
          error:
            "Production tracking columns are missing. Apply the latest Supabase migration first.",
        },
        { status: 409 },
      );
    }

    console.error("Start layout production update error:", updateError);
    return NextResponse.json({ error: "Could not start layout work." }, { status: 500 });
  }

  const subscriptionResult = await supabaseAdmin
    .from("customer_subscriptions")
    .update({
      fulfillment_status: "layout_started",
      setup_started_at: timestamp,
    })
    .eq("customer_id", customer.id)
    .in("status", ["paid", "active", "checkout_started"]);

  if (subscriptionResult.error) {
    console.error("Layout start subscription fulfillment sync error:", subscriptionResult.error);
    const rollbackResult = await rollbackLayoutStart(customerState, subscriptionStates);

    if (!rollbackResult.ok) {
      try {
        await notifyLayoutStartRollbackFailure({
          customer: customerState,
          timestamp,
          reason,
          failureType: "subscription_sync",
          failureError: subscriptionResult.error,
          rollbackError: rollbackResult.error,
        });
      } catch (notificationError) {
        console.error(
          "Layout start rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Layout start failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Layout start failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Layout work was not started because subscription fulfillment state could not be synced.",
      },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "admin",
        actorId: user.id,
        eventType: "layout_work_started",
        eventDescription:
          "Admin marked layout work as started. Setup fee is now non-refundable.",
        metadata: {
          customerName: customer.name,
          previousProductionStatus: customer.production_status,
          previousLayoutStartedAt: customer.layout_started_at,
          previousSetupFeeLockedAt: customer.setup_fee_locked_at,
          setupFeeLockedAt: timestamp,
          syncedSubscriptionIds: subscriptionStates.map(
            (subscription) => subscription.id,
          ),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Layout start audit error:", auditError);
    const rollbackResult = await rollbackLayoutStart(customerState, subscriptionStates);

    if (!rollbackResult.ok) {
      try {
        await notifyLayoutStartRollbackFailure({
          customer: customerState,
          timestamp,
          reason,
          failureType: "audit",
          failureError: auditError,
          rollbackError: rollbackResult.error,
        });
      } catch (notificationError) {
        console.error(
          "Layout start rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Layout start audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Layout start audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Layout work was not started because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    layoutStartedAt: timestamp,
    setupFeeLockedAt: timestamp,
  });
}
